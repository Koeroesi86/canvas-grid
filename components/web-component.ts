import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';
import classNames from 'classnames';
import Collection from './utils/collection';
import {
  getColumn,
  getNow,
  generateColumn,
  getRowId,
} from './utils/selectors';
import s from './component.css';
import Loading from './utils/loading';
import { getContext2d } from './utils/canvas';
import DrawingLayer from './utils/drawing-layer';
import CellBackground from './cell-background';
import HeaderRenderer from './header';
import CellValueRenderer from './cell-value';
import type { ColumnData, Key, RowData, RowId, RowInput } from './types';

type Row = RowData<Collection<ColumnData>>;

type RowIdGetter = (row: RowInput, index?: number) => RowId;

type CellRender = (
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  isUpdated: boolean,
  isValueUpdated: boolean,
  forcedDraw: boolean,
  diff: number,
) => void;

export interface ColumnHeader {
  index: number;
  id: Key;
  displayName?: string;
  width: number;
  cellRenderer: CellRender;
  valueFormatter: (value: unknown) => string;
  headerRenderer: (header: ColumnHeader, x: number) => void;
}

export type ColumnDefinition = Key | (Partial<ColumnHeader> & { id: Key });

export interface Transaction {
  add?: RowInput[];
  remove?: RowInput[];
  update?: RowInput[];
}

interface AgApi {
  setRowData: (data: RowInput[]) => void;
  updateRowData: (transaction: Transaction) => void;
  setColumnDefs: (columns: ColumnDefinition[]) => void;
  getRowNodeId: RowIdGetter;
}

declare global {
  interface HTMLElementTagNameMap {
    'canvas-grid': CanvasGridComponent;
  }

  interface Window {
    cellBackgroundDrawingLayer?: DrawingLayer<CellBackground>;
    cellValueDrawingLayer?: DrawingLayer<CellValueRenderer>;
    headerDrawingLayer?: DrawingLayer<HeaderRenderer>;
  }
}

class CanvasGridComponent extends HTMLElement {
  fps = 30;
  _font = '12px monospace';
  _headerFont = '13px monospace';
  headerHeight = 30;
  cellHeight = 20;
  flashInDuration = 200;
  flashOutDuration = 500;
  cellPadding = {
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
  };
  showRowNumbers = true;
  showHeaders = true;
  rowNumbersWidth = 30;
  ellipsis = '…';
  _backgroundColor = '#333';
  _headerBackgroundColor = '#222';
  charactersToCache = `${Array(200).fill(1).map((_, index) => String.fromCharCode(index)).join('')} ${this.ellipsis}`;
  textColor = '#efefef';
  _dataCollection = new Collection<Row>();
  prevValues = new Collection<Record<string, string | undefined>>();
  getRowId: RowIdGetter = getRowId;
  headers = new Collection<ColumnHeader>();
  animationFrame: number | undefined = undefined;
  scrollYOffset = 0;
  prevScrollYOffset = 0;
  scrollXOffset = 0;
  prevScrollXOffset = 0;
  lastRender = new Date().valueOf();
  backgroundCanvas = this.createLayerCanvas(s.background);
  canvas = this.createLayerCanvas(s.content);
  headerCanvas = this.createLayerCanvas(s.header);
  scrollHelper = document.createElement('div');
  scrollArea = this.createScrollArea();

  cellBackgroundDrawingLayer = new DrawingLayer({
    canvas: this.backgroundCanvas,
    renderer: new CellBackground({
      canvas: this.backgroundCanvas,
      background: this._backgroundColor,
      alpha: false,
      enableFlashing: true,
      flashInDuration: 200,
      flashOutDuration: 400,
      flashRGB: '214, 144, 13',
      borderRightWidth: 1,
      borderRightColor: '#3f3f3f',
      borderBottomWidth: 1,
      borderBottomColor: '#3f3f3f',
    }),
  });

  cellValueDrawingLayer = new DrawingLayer({
    canvas: this.canvas,
    renderer: new CellValueRenderer({
      font: this._font,
      color: this.textColor,
      characters: this.charactersToCache,
      canvas: this.canvas,
    }),
  });

  headerDrawingLayer = new DrawingLayer({
    canvas: this.headerCanvas,
    renderer: new HeaderRenderer({
      canvas: this.headerCanvas,
      font: this._headerFont,
      color: this.textColor,
      characters: this.charactersToCache,
      background: '#222',
      borderRightWidth: 1,
      borderRightColor: '#2f2f2f',
      borderBottomWidth: 1,
      borderBottomColor: '#2f2f2f',
    }),
  });

  loadingIndicator = new Loading({ ctx: getContext2d(this.headerCanvas) });
  pendingUpdates = new Collection<RowInput>();
  pendingRemoves = new Collection<RowInput>();
  throttleTransation = throttle(() => {
    const prevSize = this.totalHeight;
    if (this.pendingUpdates.length > 0) {
      this.updateValues();
    }
    if (this.pendingRemoves.length > 0) {
      this.removeValues();
    }
    if (prevSize !== this.totalHeight) {
      this.refreshScrollbar();
    }
  }, 50);

  agApi: AgApi;

  constructor() {
    super();

    this.resize = this.resize.bind(this);
    this.setValues = this.setValues.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.clearValues = this.clearValues.bind(this);
    this.updateLastRender = this.updateLastRender.bind(this);
    this.renderHeader = this.renderHeader.bind(this);
    this.renderCell = this.renderCell.bind(this);
    this.transaction = this.transaction.bind(this);
    this.queueUpdate = this.queueUpdate.bind(this);

    const component = this;
    this.agApi = {
      setRowData: this.setValues,
      updateRowData: this.transaction,
      setColumnDefs: this.setColumns,
      get getRowNodeId() {
        return component.getRowId;
      },
      set getRowNodeId(getId) {
        if (typeof getId === 'function') component.getRowId = getId;
      },
    };
  }

  createLayerCanvas(layerClassName: string) {
    const canvas = document.createElement('canvas');
    canvas.className = classNames(s.drawingLayer, layerClassName);
    return canvas;
  }

  createScrollArea() {
    const scrollArea = document.createElement('div');
    scrollArea.className = s.scrollArea;
    scrollArea.appendChild(this.scrollHelper);
    return scrollArea;
  }

  set font(font: string) {
    if (this._font !== font) {
      this._font = font;
      this.cellValueDrawingLayer.renderer.font = font;
    }
  }

  get font() {
    return this._font;
  }

  set headerFont(font: string) {
    if (this._headerFont !== font) {
      this._headerFont = font;
      this.headerDrawingLayer.renderer.font = font;
    }
  }

  get headerFont() {
    return this._headerFont;
  }

  connectedCallback() {
    this.appendChild(this.backgroundCanvas);
    this.appendChild(this.canvas);
    this.appendChild(this.headerCanvas);
    this.appendChild(this.scrollArea);
    window.cellBackgroundDrawingLayer = this.cellBackgroundDrawingLayer;
    window.cellValueDrawingLayer = this.cellValueDrawingLayer;
    window.headerDrawingLayer = this.headerDrawingLayer;

    this.updateLastRender();
    this.resize();
    this.setColumns(Array(50).fill(1).map((_, index) => index));

    document.addEventListener('visibilitychange', () => {
      switch (document.visibilityState) {
        case 'hidden':
          this.cancelRender();
          break;
        case 'visible':
        default:
          this.resize();
      }
    });

    if (document && document.fonts) {
      document.fonts.onloadingdone = () => {
        this.cellValueDrawingLayer.clearCache();
        this.headerDrawingLayer.clearCache();
        this.cellValueDrawingLayer.preWarmCache();
        this.headerDrawingLayer.preWarmCache();
        this.resize();
      };
    } else {
      setTimeout(() => {
        this.cellValueDrawingLayer.clearCache();
        this.headerDrawingLayer.clearCache();
        this.cellValueDrawingLayer.preWarmCache();
        this.headerDrawingLayer.preWarmCache();
        this.resize();
      }, 2000);
    }

    const debounceAfterScroll = debounce(() => {
      this.cellValueDrawingLayer.isScrolling = false;
      this.cellBackgroundDrawingLayer.isScrolling = false;
      this.headerDrawingLayer.isScrolling = false;
    }, 200);
    const throttledUpdate = throttle((scrollYOffset: number, scrollXOffset: number) => {
      this.scrollXOffset = Math.round(scrollXOffset);
      this.scrollYOffset = Math.round(scrollYOffset);
      debounceAfterScroll();
    }, 10);
    this.scrollArea.addEventListener('scroll', () => {
      const { scrollTop, scrollLeft } = this.scrollArea;
      this.cellValueDrawingLayer.isScrolling = true;
      this.cellBackgroundDrawingLayer.isScrolling = true;
      this.headerDrawingLayer.isScrolling = true;
      throttledUpdate(scrollTop, scrollLeft);
    });
  }

  cancelRender() {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
  }

  updateLastRender() {
    this.lastRender = new Date().valueOf();
  }

  render() {
    const delta = new Date().valueOf() - this.lastRender;
    if (delta >= (1000 / this.fps)) {
      if (this.canvas.width !== this.clientWidth || this.canvas.height !== this.clientHeight) {
        this.resize();
      }

      this.draw();
      this.updateLastRender();
    }
    this.animationFrame = requestAnimationFrame(() => this.render());
  }

  hasScrolled() {
    return this.hasXScrolled() || this.hasYScrolled();
  }

  hasYScrolled() {
    return this.prevScrollYOffset !== this.scrollYOffset;
  }

  hasXScrolled() {
    return this.prevScrollXOffset !== this.scrollXOffset;
  }

  isInViewport(x = 0, y = 0, width = 0, height = 0)  {
    if (x > this.canvas.width) return false;
    if (y > this.canvas.height) return false;
    if (x + width < 0) return false;
    if (y + height < 0) return false;

    return true;
  }

  draw(forced = false) {
    const now = new Date().valueOf();

    if ((forced || this.hasXScrolled()) && this.showHeaders) {
      this.renderHeaders();
    }

    const fakeRows = 200;
    if (forced && this.showRowNumbers && this._dataCollection.length === 0) {
      for (let fakeRowIndex= 0; fakeRowIndex <= fakeRows; fakeRowIndex++)  {
        this.renderRowNumber({ index: fakeRowIndex }, (fakeRowIndex * this.cellHeight) + (this.showHeaders ? this.headerHeight : 0) - this.scrollYOffset);
      }
    }

    if (this._dataCollection.length === 0) {
      this.loadingIndicator.render();
      for (let fakeRowIndex= 0; fakeRowIndex <= fakeRows; fakeRowIndex++)  {
        this.headers.forEach(header => {
          header.cellRenderer(
            '',
            Math.round((header.index * header.width) + (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset),
            Math.round((fakeRowIndex * this.cellHeight) + (this.showHeaders ? this.headerHeight : 0) - this.scrollYOffset),
            header.width,
            this.cellHeight,
            true,
            false,
            true,
            0
          );
        });
      }
    }

    let currentY = Math.round((this.showHeaders ? this.headerHeight : 0) - this.scrollYOffset);
    const updateUntil = now - (this.flashInDuration + this.flashOutDuration + 100);
    const xOffset = Math.round((this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset);
    this._dataCollection.forEach((row, key) => {
      const { columns } = row;
      let currentX = xOffset;

      if ((forced || this.hasYScrolled()) && this.showRowNumbers) {
        this.renderRowNumber(row, currentY);
      }

      if (row.height + currentY > 0 && currentY < this.canvas.height) {
        let prevRow = this.prevValues.get(key);
        if (!prevRow) {
          prevRow = {};
          this.prevValues.set(key, prevRow);
        }

        columns.forEach((column, columnKey) => {
          const { displayedValue, updatedAt = 0 } = column;
          const header = this.getColumnHeader(columnKey);
          const shouldUpdate = updatedAt > updateUntil;

          if (header) {
            const isNotPrev = prevRow[columnKey] !== displayedValue;
            if (this.isInViewport(currentX, currentY, header.width, row.height) && (forced || this.hasScrolled() || shouldUpdate)) {
              header.cellRenderer(
                displayedValue,
                currentX,
                currentY,
                header.width,
                row.height,
                shouldUpdate || this.hasScrolled() || forced,
                isNotPrev,
                forced || this.hasScrolled(),
                now - updatedAt
              );
            }
            if (isNotPrev) {
              prevRow[columnKey] = displayedValue;
            }
            currentX += Math.round(header.width);
          }
        });
      }
      currentY += Math.round(row.height);
    });
    if (this.scrollYOffset > 0 || this.scrollXOffset > 0) {
      this.renderBrick();
    }
    this.prevScrollYOffset = this.scrollYOffset;
    this.prevScrollXOffset = this.scrollXOffset;
  }

  renderRowNumber(row: { index: number; height?: number }, y: number) {
    if (!this.isInViewport(0, y, this.rowNumbersWidth, row.height)) return;
    this.headerDrawingLayer.render(
      `${row.index + 1}`,
      0,
      Math.ceil(y),
      this.rowNumbersWidth,
      row.height,
      true,
      true
    );
  }

  forceDraw() {
    this.cellValueDrawingLayer.clear();
    this.cellBackgroundDrawingLayer.clear();
    this.headerDrawingLayer.clear();
    this.draw(true);
  }

  resize() {
    this.cancelRender();
    this.canvas.width = this.clientWidth;
    this.canvas.height = this.clientHeight;
    this.headerCanvas.width = this.clientWidth;
    this.headerCanvas.height = this.clientHeight;
    this.backgroundCanvas.width = this.clientWidth;
    this.backgroundCanvas.height = this.clientHeight;
    this.forceDraw();
    this.render();
  }

  getRowData(rowId: RowId) {
    return this._dataCollection.get(rowId);
  }

  renderBrick() {
    if (this.showHeaders && this.showRowNumbers && this._headerBackgroundColor) {
      this.headerDrawingLayer.render(
        '',
        0,
        0,
        this.rowNumbersWidth,
        this.headerHeight,
        true,
        true
      );
    }
  }

  renderHeader(header: ColumnHeader, x: number) {
    this.headerDrawingLayer.render(
      header.displayName,
      x,
      0,
      header.width,
      this.headerHeight,
      true,
      true
    );
  }

  renderHeaders() {
    let currentX = (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset;

    this.headers.forEach(header => {
      if (this.isInViewport(currentX, 0, header.width, this.headerHeight)) {
        header.headerRenderer(header, currentX);
      }
      currentX += header.width;
    });

    if (this.scrollXOffset + this.rowNumbersWidth > 0) {
      this.renderBrick();
    }
  }

  getColumnHeader(key: Key) {
    return this.headers.get(key);
  }

  get totalHeight() {
    let totalHeight = 0;
    this._dataCollection.forEach(row => {
      totalHeight += row.height;
    });
    return totalHeight;
  }

  refreshScrollbar() {
    const height = this.totalHeight + this.headerHeight;
    this.scrollHelper.style.height = `${height}px`;
    let width = 0;
    this.headers.forEach(header => {
      width += Math.round(header.width);
    });
    this.scrollHelper.style.width = `${width}px`;
  }

  queueUpdate(row: RowInput) {
    this.pendingUpdates.add(row);
    this.throttleTransation();
  }

  queueRemove(row: RowInput) {
    this.pendingRemoves.add(row);
    this.throttleTransation();
  }

  transaction({ add = [], remove = [], update = [] }: Transaction) {
    if (Array.isArray(add)) {
      add.forEach(row => this.queueUpdate(row));
    }

    if (Array.isArray(update)) {
      update.forEach(row => this.queueUpdate(row));
    }

    if (Array.isArray(remove)) {
      remove.forEach(row => this.queueRemove(row));
    }
  }

  clearValues() {
    this._dataCollection.clear();
    this.prevValues.clear();
  }

  formatValue(key: Key, value: unknown) {
    return this.headers.get(key)?.valueFormatter(value) ?? String(value);
  }

  setValues(data: RowInput[]) {
    this.throttleTransation.cancel();
    this.pendingUpdates.clear();
    this.pendingRemoves.clear();
    this.clearValues();
    if (Array.isArray(data)) {
      data.forEach((row, index) => {
        const rowId = this.getRowId(row, index);
        const columns = new Collection<ColumnData>();
        Object.keys(row).forEach(key => {
          columns.set(key, generateColumn(row[key], key, undefined, this.formatValue(key, row[key])));
        });
        this._dataCollection.set(rowId, { index, height: this.cellHeight, columns });
      });
      this.refreshScrollbar();
      this.forceDraw();
    }
  }

  removeValues() {
    this.pendingRemoves.forEach(row => {
      this._dataCollection.delete(this.getRowId(row));
    });
    this.pendingRemoves.clear();
  }

  updateValues() {
    const now = getNow();
    this.pendingUpdates.forEach(row => {
      const rowId = this.getRowId(row);
      const currentIndex = this._dataCollection.keys.indexOf(rowId);
      const rowData = this.getRowData(rowId);
      if (rowData) {
        Object.keys(row).forEach(columnKey => {
          const columnValue = row[columnKey];
          const columnData = getColumn(rowData, columnKey);
          if (columnData) {
            if (columnData.value !== columnValue) {
              columnData.value = columnValue;
              columnData.displayedValue = this.formatValue(columnKey, columnValue);
              columnData.updatedAt = now;
            }
          } else {
            rowData.columns.set(columnKey, generateColumn(columnValue, columnKey, undefined, this.formatValue(columnKey, columnValue)));
          }
        });
      } else {
        const columns = new Collection<ColumnData>();
        Object.keys(row).forEach(key => {
          columns.set(key, generateColumn(row[key], key, now, this.formatValue(key, row[key])));
        });
        this._dataCollection.set(rowId, {
          index: currentIndex !== -1 ? currentIndex : this._dataCollection.keys.length,
          height: this.cellHeight,
          columns,
        });
      }
    });
    this.pendingUpdates.clear();
  }

  renderCell(
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    isUpdated: boolean,
    isValueUpdated: boolean,
    forcedDraw: boolean,
    diff: number,
  ) {
    this.cellBackgroundDrawingLayer.render('', x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);
    this.cellValueDrawingLayer.render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);
  }

  setColumns(columns: ColumnDefinition[]) {
    if (Array.isArray(columns)) {
      this.headers.clear();
      const defaults = {
        width: 100,
        cellRenderer: this.renderCell,
        valueFormatter: (v: unknown) => String(v),
        headerRenderer: this.renderHeader,
      };
      columns.forEach((column, index) => {
        if (typeof column === 'string' || typeof column === 'number') {
          const columnId = column + '';
          this.headers.set(columnId, {
            ...defaults,
            index: index,
            id: column,
            displayName: columnId,
          });
        }
        if (typeof column === 'object') {
          this.headers.set(column.id + '', {
            ...defaults,
            index: index,
            ...column,
          });
        }
        this.refreshScrollbar();
        this.forceDraw();
      });
    }
  }

  disconnectedCallback() {
    this.cancelRender();
  }

  attributeChangedCallback(attrName: string, oldVal: string | null, newVal: string | null) {
    console.log('attributeChangedCallback', attrName, oldVal, newVal)
  }
}

if (window && window.customElements) {
  customElements.define('canvas-grid', CanvasGridComponent);
}

export default CanvasGridComponent;

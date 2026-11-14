import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';
import Collection from './utils/collection';
import ColumnStore from './utils/column-store';
import DataStore from './utils/data-store';
import LruCache from './utils/lru-cache';
import { getRowId } from './utils/selectors';
import styles from './component.css?inline';
import Loading from './utils/loading';
import Layer from './utils/layer';
import RendererRegistry from './utils/renderer-registry';
import CellBackground from './cell-background';
import HeaderRenderer from './header';
import CellValueRenderer from './cell-value';
import { defaultTextStyle } from './text';
import type { TextStyle } from './text';
import { resolveFont } from './utils/inherited-font';
import type { LayerOptions } from './utils/layer';
import type { CellContext, CellRenderer, CellState, Key, RendererRef, RowId, RowInput, SortDirection, SortKey } from './types';
import type { RowIdGetter } from './utils/data-store';

const classes = {
  scrollArea: 'scrollArea',
};

/** Layers and renderers every grid starts with. */
const builtIn = {
  background: 'background',
  content: 'content',
  header: 'header',
  backgroundRenderer: 'background',
  valueRenderer: 'value',
  headerRenderer: 'header',
};

/** What the grid remembers about a cell between frames. */
interface CellEntry {
  /** The raw value last drawn, and its formatted text; formatting only runs when the value differs. */
  value: unknown;
  formatted: string | undefined;
  animating: boolean;
  state: CellState;
}

const STYLE_ELEMENT_ID = 'canvas-grid-styles';

const injectStyles = () => {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = styles;
  document.head.appendChild(style);
};

export interface ColumnHeader {
  index: number;
  id: Key;
  displayName?: string;
  width: number;
  /** Renderers drawing a cell of this column, in order. Defaults to the grid's `cellRenderers`. */
  renderers?: RendererRef[];
  valueFormatter: (value: unknown) => string;
  /** CSS font of this column's cells, instead of the grid's `font`. Not `'inherit'`: that is the grid's. */
  font?: string;
  /** CSS font of this column's header, instead of the grid's `headerFont`. */
  headerFont?: string;
  /** Renderer drawing the header of this column. */
  headerRenderer: RendererRef;
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

export type { CellContext, CellRenderer, CellState, LayerOptions, RendererRef, SortDirection, SortKey };

declare global {
  interface HTMLElementTagNameMap {
    'canvas-grid': CanvasGridComponent;
  }
}

const DEFAULT_FONT = '12px sans-serif';
const DEFAULT_HEADER_FONT = '13px sans-serif';

class CanvasGridComponent extends HTMLElement {
  fps = 30;
  _font = DEFAULT_FONT;
  _headerFont = DEFAULT_HEADER_FONT;
  headerHeight = 30;
  cellHeight = 20;
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
  _headerBackgroundColor = '#262626';
  textColor = '#efefef';
  dataStore = new DataStore({
    getRowId: (row, index) => this.getRowId(row, index),
    getCellHeight: () => this.cellHeight,
  });
  _dataCollection = this.dataStore.rows;
  /** Per-cell memory of the rows drawn recently; bounded, since only the rows in view need it. */
  cellEntries = new LruCache<Record<string, CellEntry>>(2048);
  getRowId: RowIdGetter = getRowId;
  headers = new Collection<ColumnHeader>();
  animationFrame: number | undefined = undefined;
  scrollYOffset = 0;
  prevScrollYOffset = 0;
  scrollXOffset = 0;
  prevScrollXOffset = 0;
  lastRender = new Date().valueOf();
  lastDraw = this.lastRender;
  isScrolling = false;
  scrollHelper = document.createElement('div');
  scrollArea = this.createScrollArea();

  /** Canvases from bottom to top. */
  layers: Layer[] = [];
  private readonly layersByName = new Map<string, Layer>();
  private readonly warnedLayers = new Set<string>();
  renderers = new RendererRegistry();
  /** Renderers drawing a cell when its column does not name its own. */
  cellRenderers: RendererRef[] = [builtIn.backgroundRenderer, builtIn.valueRenderer];

  cellBackgroundRenderer = new CellBackground({
    layer: builtIn.background,
    background: this._backgroundColor,
    enableFlashing: true,
    flashInDuration: 200,
    flashOutDuration: 400,
    flashRGB: '214, 144, 13',
    borderRightWidth: 1,
    borderRightColor: '#3b3b3b',
    borderBottomWidth: 1,
    borderBottomColor: '#3b3b3b',
  });

  cellValueRenderer = new CellValueRenderer({
    layer: builtIn.content,
    font: this._font,
    color: this.textColor,
  });

  headerCellRenderer = new HeaderRenderer({
    layer: builtIn.header,
    font: this._headerFont,
    color: this.textColor,
    background: '#262626',
    borderRightWidth: 1,
    borderRightColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  });

  loadingIndicator: Loading;
  /** Reused for every cell drawn; see CellContext. */
  private readonly cell: CellContext;
  private readonly placeholderState: CellState = {};
  throttleTransation = throttle(() => {
    const prevSize = this.totalHeight;
    const moved = this.dataStore.flush();
    if (prevSize !== this.totalHeight) {
      this.refreshScrollbar();
    }
    // rows that were removed or re-sorted changed position, and a normal draw only repaints cells whose value changed
    if (moved) this.forceDraw();
    this.requestRender();
  }, 50);

  agApi: AgApi;

  constructor() {
    super();

    this.resize = this.resize.bind(this);
    this.setValues = this.setValues.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.clearValues = this.clearValues.bind(this);
    this.updateLastRender = this.updateLastRender.bind(this);
    this.transaction = this.transaction.bind(this);
    this.queueUpdate = this.queueUpdate.bind(this);

    this.addLayer(builtIn.background, { alpha: false });
    this.addLayer(builtIn.content);
    this.addLayer(builtIn.header);
    this.registerRenderer(builtIn.backgroundRenderer, this.cellBackgroundRenderer);
    this.registerRenderer(builtIn.valueRenderer, this.cellValueRenderer);
    this.registerRenderer(builtIn.headerRenderer, this.headerCellRenderer);
    this.loadingIndicator = new Loading({ ctx: this.requireLayer(builtIn.header).ctx });
    this.cell = {
      ctx: this.requireLayer(builtIn.content).ctx,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      row: undefined,
      column: undefined,
      value: undefined,
      formatted: '',
      updatedAt: undefined,
      age: Infinity,
      now: 0,
      dt: 0,
      valueChanged: false,
      forced: false,
      isScrolling: false,
      state: {},
    };

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

  /** Canvas of the content layer, which also defines the viewport size. */
  get canvas() {
    return this.requireLayer(builtIn.content).canvas;
  }

  get flashInDuration() {
    return this.cellBackgroundRenderer.options.flashInDuration;
  }

  set flashInDuration(flashInDuration: number) {
    this.cellBackgroundRenderer.update({ flashInDuration });
  }

  get flashOutDuration() {
    return this.cellBackgroundRenderer.options.flashOutDuration;
  }

  set flashOutDuration(flashOutDuration: number) {
    this.cellBackgroundRenderer.update({ flashOutDuration });
  }

  getLayer(name: string) {
    return this.layersByName.get(name);
  }

  private requireLayer(name: string) {
    const layer = this.getLayer(name);
    if (!layer) throw new Error(`canvas-grid: no layer named "${name}"`);
    return layer;
  }

  /** Adds a canvas on top of the existing layers, or below the layer named in `before`. */
  addLayer(name: string, { alpha = true, desynchronized = false, before }: LayerOptions = {}) {
    if (this.getLayer(name)) throw new Error(`canvas-grid: layer "${name}" already exists`);

    const layer = new Layer(name, { alpha, desynchronized });
    const next = before === undefined ? undefined : this.requireLayer(before);
    this.layers.splice(next ? this.layers.indexOf(next) : this.layers.length, 0, layer);
    this.layersByName.set(name, layer);
    // the constructor already runs on elements that are in the document, before connectedCallback mounted anything
    if (this.scrollArea.parentElement === this) {
      this.insertBefore(layer.canvas, next?.canvas ?? this.scrollArea);
      layer.resize(this.clientWidth, this.clientHeight, this.pixelRatio);
      this.forceDraw();
    }
    return layer;
  }

  removeLayer(name: string) {
    const layer = this.requireLayer(name);
    this.layers = this.layers.filter(candidate => candidate !== layer);
    this.layersByName.delete(name);
    layer.canvas.remove();
  }

  /** Makes a renderer available to columns under `name`; registering an existing name replaces it. */
  registerRenderer(name: string, renderer: CellRenderer) {
    this.renderers.register(name, renderer);
  }

  unregisterRenderer(name: string) {
    this.renderers.unregister(name);
  }

  createScrollArea() {
    const scrollArea = document.createElement('div');
    scrollArea.className = classes.scrollArea;
    scrollArea.appendChild(this.scrollHelper);
    return scrollArea;
  }

  set font(font: string) {
    if (this._font !== font) {
      this._font = font;
      this.cellValueRenderer.font = resolveFont(font, getComputedStyle(this), DEFAULT_FONT);
    }
  }

  get font() {
    return this._font;
  }

  set headerFont(font: string) {
    if (this._headerFont !== font) {
      this._headerFont = font;
      this.headerCellRenderer.font = resolveFont(font, getComputedStyle(this), DEFAULT_HEADER_FONT);
    }
  }

  get headerFont() {
    return this._headerFont;
  }

  private textStyle: TextStyle = { ...defaultTextStyle };

  private setTextStyle(style: Partial<TextStyle>) {
    this.textStyle = { ...this.textStyle, ...style };
    this.cellValueRenderer.setTextStyle(this.textStyle);
    this.headerCellRenderer.setTextStyle(this.textStyle);
    this.forceDraw();
  }

  /** Canvas `textRendering` for cells and headers: `'auto'` (default), `'optimizeSpeed'`, `'optimizeLegibility'` or `'geometricPrecision'`. */
  set textRendering(textRendering: TextStyle['textRendering']) {
    this.setTextStyle({ textRendering });
  }

  get textRendering() {
    return this.textStyle.textRendering;
  }

  /** Canvas `fontKerning` for cells and headers: `'auto'` (default), `'normal'` or `'none'`. */
  set fontKerning(fontKerning: TextStyle['fontKerning']) {
    this.setTextStyle({ fontKerning });
  }

  get fontKerning() {
    return this.textStyle.fontKerning;
  }

  /** Extra space after each character as a CSS length, `'0px'` by default. */
  set letterSpacing(letterSpacing: string) {
    this.setTextStyle({ letterSpacing });
  }

  get letterSpacing() {
    return this.textStyle.letterSpacing;
  }

  /** `'ltr'` (default), `'rtl'`, or `'auto'` to pick the direction per cell from its first letter. */
  set direction(direction: TextStyle['direction']) {
    this.setTextStyle({ direction });
  }

  get direction() {
    return this.textStyle.direction;
  }

  connectedCallback() {
    this.layers.forEach(layer => this.appendChild(layer.canvas));
    this.appendChild(this.scrollArea);

    this.updateLastRender();
    this.refreshFonts();
    if (this.headers.length === 0) this.setColumns(Array(50).fill(1).map((_, index) => index));

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.observeSize();
    this.pixelRatioQuery = window.matchMedia(`(resolution: ${this.pixelRatio}dppx)`);
    this.pixelRatioQuery.addEventListener('change', this.watchPixelRatio, { once: true });

    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    } else {
      this.fontsTimeout = setTimeout(this.onFontsLoaded, 2000);
    }

    const debounceAfterScroll = debounce(() => {
      this.isScrolling = false;
    }, 200);
    this.scrollArea.addEventListener('pointermove', this.onPointerMove);
    this.scrollArea.addEventListener('pointerleave', this.onPointerLeave);
    // the offsets are read once per frame in `render`, so a scroll event costs nothing and no frame shows a stale position
    this.scrollArea.addEventListener('scroll', () => {
      this.isScrolling = true;
      this.updateHoveredRow();
      debounceAfterScroll();
      this.requestRender();
    });
  }

  /** Rows whose cells must be redrawn because the hover highlight moved off or onto them. */
  private hoverDirty: (number | undefined)[] = [];

  private setHoveredRow(index: number | undefined) {
    const previous = this.cellBackgroundRenderer.hoveredRowIndex;
    if (previous === index) return;

    this.cellBackgroundRenderer.hover(index);
    // added to, not replaced: the pointer can cross several rows before the next frame, and each needs its redraw
    this.hoverDirty.push(previous, index);
    this.requestRender();
  }

  /** Pointer position relative to the grid, kept to find the hovered row again after scrolling. */
  private pointerY: number | undefined = undefined;

  private updateHoveredRow() {
    if (this.pointerY === undefined) return;

    const y = this.pointerY - (this.showHeaders ? this.headerHeight : 0);
    const index = this._dataCollection.indexAt(y + this.scrollArea.scrollTop);
    this.setHoveredRow(y < 0 || index >= this._dataCollection.length ? undefined : index);
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    this.pointerY = event.clientY - this.getBoundingClientRect().top;
    this.updateHoveredRow();
  };

  private readonly onPointerLeave = () => {
    this.pointerY = undefined;
    this.setHoveredRow(undefined);
  };

  private fontsTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.cancelRender();
      return;
    }
    this.resize();
  };

  /**
   * Re-reads the fonts and redraws. Call it after changing the CSS font of the grid or its ancestors
   * while `font` / `headerFont` are `'inherit'`. Web fonts finishing to load trigger it too.
   */
  refreshFonts() {
    this.cellValueRenderer.font = resolveFont(this._font, getComputedStyle(this), DEFAULT_FONT);
    this.headerCellRenderer.font = resolveFont(this._headerFont, getComputedStyle(this), DEFAULT_HEADER_FONT);
    this.renderers.clearCaches();
    this.resize();
  }

  private readonly onFontsLoaded = () => this.refreshFonts();

  cancelRender() {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
  }

  /**
   * Schedules a draw for the next animation frame. Nothing is drawn while the grid is idle:
   * scrolling, data changes and resizes request a draw, and `draw` requests the next one itself while a cell animates.
   */
  requestRender() {
    this.animationFrame ??= requestAnimationFrame(() => this.render());
  }

  updateLastRender() {
    this.lastRender = new Date().valueOf();
  }

  render() {
    this.animationFrame = undefined;
    this.readScrollOffsets();
    const delta = new Date().valueOf() - this.lastRender;
    // the frame cap is for animations; scrolling draws on every frame, or it would visibly lag behind the scrollbar
    if (!this.isScrolling && delta < (1000 / this.fps)) {
      this.requestRender();
      return;
    }
    this.draw();
    this.updateLastRender();
  }

  private readScrollOffsets() {
    this.scrollXOffset = Math.round(this.scrollArea.scrollLeft);
    this.scrollYOffset = Math.round(this.scrollArea.scrollTop);
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
    if (x > this.viewportWidth) return false;
    if (y > this.viewportHeight) return false;
    if (x + width < 0) return false;
    if (y + height < 0) return false;

    return true;
  }

  /** Fills the shared context for something that is not a data cell: a header, row number or placeholder. */
  private describe(x: number, y: number, width: number, height: number, overrides: Partial<CellContext>) {
    return Object.assign(this.cell, {
      x,
      y,
      width,
      height,
      row: undefined,
      column: undefined,
      value: undefined,
      formatted: '',
      updatedAt: undefined,
      age: Infinity,
      valueChanged: true,
      forced: true,
      state: this.placeholderState,
    }, overrides);
  }

  private paint(ref: RendererRef) {
    const renderer = this.renderers.resolve(ref);
    const layer = renderer && this.layersByName.get(renderer.layer);
    if (renderer && !layer && !this.warnedLayers.has(renderer.layer)) {
      this.warnedLayers.add(renderer.layer);
      console.warn(`canvas-grid: renderer draws on missing layer "${renderer.layer}"`);
    }
    if (!renderer || !layer) return;

    this.cell.ctx = layer.ctx;
    renderer.draw(this.cell);
  }

  private paintAll(refs: readonly RendererRef[]) {
    refs.forEach(ref => this.paint(ref));
  }

  private isAnimating(refs: readonly RendererRef[]) {
    return refs.some(ref => this.renderers.resolve(ref)?.isAnimating?.(this.cell) === true);
  }

  draw(forced = false) {
    const now = new Date().valueOf();
    const redrawAll = forced || this.hasScrolled();
    this.cell.now = now;
    this.cell.dt = now - this.lastDraw;
    this.cell.isScrolling = this.isScrolling;
    this.lastDraw = now;
    // the loading indicator animates until there is data
    let keepDrawing = this._dataCollection.length === 0;

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
          this.describe(
            Math.round((header.index * header.width) + (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset),
            Math.round((fakeRowIndex * this.cellHeight) + (this.showHeaders ? this.headerHeight : 0) - this.scrollYOffset),
            header.width,
            this.cellHeight,
            { column: header, valueChanged: false },
          );
          this.paintAll(header.renderers ?? this.cellRenderers);
        });
      }
    }

    const originY = Math.round((this.showHeaders ? this.headerHeight : 0) - this.scrollYOffset);
    const xOffset = Math.round((this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset);
    // only the rows overlapping the viewport: found by offset instead of walking from the first row
    const firstRow = this._dataCollection.indexAt(-originY);
    const visibleColumns = this.getVisibleColumns(xOffset);
    for (let rowIndex = firstRow; rowIndex < this._dataCollection.length; rowIndex++) {
      const row = this._dataCollection.at(rowIndex);
      const currentY = originY + this._dataCollection.topOf(rowIndex);
      if (!row || currentY >= this.viewportHeight) break;

      const { id: key, slot } = row;

      if ((forced || this.hasYScrolled()) && this.showRowNumbers) {
        this.renderRowNumber(row, currentY);
      }

      if (row.height + currentY > 0) {
        let entries = this.cellEntries.get(String(key));
        if (!entries) {
          entries = {};
          this.cellEntries.set(String(key), entries);
        }
        const cellRow = { id: key, index: row.index };

        for (const { header, id: columnKey, x, store } of visibleColumns) {
          const value = store?.get(slot);
          if (value === undefined) continue;

          const entry = entries[columnKey] ??= { value: undefined, formatted: undefined, animating: false, state: {} };
          // values are only formatted for the cells being drawn, and again only once they change
          const formatted = entry.formatted !== undefined && entry.value === value ? entry.formatted : header.valueFormatter(value);
          const valueChanged = entry.formatted !== formatted;
          const updatedAt = store?.getUpdatedAt(slot);

          const { cell } = this;
          cell.x = x;
          cell.y = currentY;
          cell.width = header.width;
          cell.height = row.height;
          cell.row = cellRow;
          cell.column = header;
          cell.value = value;
          cell.formatted = formatted;
          cell.updatedAt = updatedAt;
          cell.age = updatedAt === undefined ? Infinity : now - updatedAt;
          cell.valueChanged = valueChanged;
          cell.forced = redrawAll;
          cell.state = entry.state;
          const refs = header.renderers ?? this.cellRenderers;
          const animating = this.isAnimating(refs);
          // an animation gets one last frame after it stops, so its final state is what stays on screen
          if (redrawAll || valueChanged || animating || entry.animating || this.hoverDirty.includes(rowIndex)) this.paintAll(refs);
          entry.animating = animating;
          entry.value = value;
          entry.formatted = formatted;
          keepDrawing ||= animating;
        }
      }
    }
    if (this.scrollYOffset > 0 || this.scrollXOffset > 0) {
      this.renderBrick();
    }
    this.hoverDirty = [];
    this.prevScrollYOffset = this.scrollYOffset;
    this.prevScrollXOffset = this.scrollXOffset;
    if (keepDrawing) this.requestRender();
  }

  /** The columns overlapping the viewport horizontally, with their x position and values; found once per draw, not per row. */
  private getVisibleColumns(xOffset: number) {
    const visible: { header: ColumnHeader; id: string; x: number; store: ColumnStore | undefined }[] = [];
    let x = xOffset;
    this.headers.forEach((header, key) => {
      if (this.isInViewport(x, 0, header.width, 0)) {
        visible.push({ header, id: String(key), x, store: this.dataStore.columns.get(String(key)) });
      }
      x += Math.round(header.width);
    });
    return visible;
  }

  renderRowNumber(row: { index: number; height?: number }, y: number) {
    if (!this.isInViewport(0, y, this.rowNumbersWidth, row.height)) return;
    this.describe(0, Math.ceil(y), this.rowNumbersWidth, row.height ?? 0, {
      row: { id: row.index, index: row.index },
      formatted: `${row.index + 1}`,
    });
    this.paint(builtIn.headerRenderer);
  }

  forceDraw() {
    this.layers.forEach(layer => layer.clear());
    this.draw(true);
  }

  /** Viewport size in CSS pixels as of the last resize; cached because reading `clientWidth` per cell is slow. */
  viewportWidth = 0;

  viewportHeight = 0;

  /** Device pixels per CSS pixel; canvases are scaled by it to stay sharp on HiDPI screens. */
  get pixelRatio() {
    return window.devicePixelRatio || 1;
  }

  /** Resizes the layers when the size or pixel ratio changed, then redraws everything. */
  resize() {
    this.cancelRender();
    const { pixelRatio } = this;
    this.viewportWidth = this.clientWidth;
    this.viewportHeight = this.clientHeight;
    this.layers.forEach(layer => layer.resize(this.clientWidth, this.clientHeight, pixelRatio));
    if (this.cellValueRenderer.pixelRatio !== pixelRatio) {
      this.renderers.clearCaches();
    }
    this.cellValueRenderer.pixelRatio = pixelRatio;
    this.headerCellRenderer.pixelRatio = pixelRatio;
    this.forceDraw();
  }

  /** Redraws when the element changes size, instead of checking on every frame. */
  private observeSize() {
    this.resizeObserver ??= new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
  }

  /** The pixel ratio changes with browser zoom or when the window moves to another screen. */
  private watchPixelRatio = () => {
    this.pixelRatioQuery?.removeEventListener('change', this.watchPixelRatio);
    this.pixelRatioQuery = window.matchMedia(`(resolution: ${this.pixelRatio}dppx)`);
    this.pixelRatioQuery.addEventListener('change', this.watchPixelRatio, { once: true });
    this.resize();
  };

  private resizeObserver: ResizeObserver | undefined = undefined;

  private pixelRatioQuery: MediaQueryList | undefined = undefined;

  /** A row's position and height along with its values by column id, or undefined for an unknown row. */
  getRowData(rowId: RowId) {
    const row = this._dataCollection.get(rowId);
    if (!row) return undefined;

    const values: Record<string, unknown> = {};
    this.dataStore.columns.forEach((column, key) => {
      const value = column.get(row.slot);
      if (value !== undefined) values[key] = value;
    });
    return { id: row.id, index: row.index, height: row.height, values };
  }

  /** Orders the rows by the given columns, in priority order; an empty list restores the original order. */
  setSortModel(model: readonly SortKey[]) {
    this.dataStore.setSortModel(model);
    this.forceDraw();
  }

  getSortModel() {
    return this.dataStore.getSortModel();
  }

  renderBrick() {
    if (this.showHeaders && this.showRowNumbers && this._headerBackgroundColor) {
      this.describe(0, 0, this.rowNumbersWidth, this.headerHeight, {});
      this.paint(builtIn.headerRenderer);
    }
  }

  renderHeaders() {
    let currentX = (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset;

    this.headers.forEach(header => {
      if (this.isInViewport(currentX, 0, header.width, this.headerHeight)) {
        this.describe(currentX, 0, header.width, this.headerHeight, {
          column: header,
          formatted: header.displayName ?? '',
        });
        this.paint(header.headerRenderer);
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
    return this._dataCollection.totalHeight;
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
    this.dataStore.queueUpdate(row);
    this.throttleTransation();
  }

  queueRemove(row: RowInput) {
    this.dataStore.queueRemove(row);
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
    this.dataStore.clear();
    this.cellEntries.clear();
  }

  formatValue(key: Key, value: unknown) {
    return this.headers.get(key)?.valueFormatter(value) ?? String(value);
  }

  setValues(data: RowInput[]) {
    this.throttleTransation.cancel();
    this.clearValues();
    if (!Array.isArray(data)) return;
    this.dataStore.setRows(data);
    this.refreshScrollbar();
    this.forceDraw();
  }

  setColumns(columns: ColumnDefinition[]) {
    if (Array.isArray(columns)) {
      this.headers.clear();
      // cached formatted values belong to the previous formatters
      this.cellEntries.clear();
      const defaults = {
        width: 100,
        valueFormatter: (v: unknown) => String(v),
        headerRenderer: builtIn.headerRenderer,
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
      });
      this.refreshScrollbar();
      this.forceDraw();
    }
  }

  disconnectedCallback() {
    this.cancelRender();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.pixelRatioQuery?.removeEventListener('change', this.watchPixelRatio);
    document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded);
    clearTimeout(this.fontsTimeout);
  }
}

if (window && window.customElements) {
  injectStyles();
  customElements.define('canvas-grid', CanvasGridComponent);
}

export default CanvasGridComponent;

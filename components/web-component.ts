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
import { createColorCheck, isCssFont, isSameTheme, readTheme, THEME_DEFAULTS } from './utils/theme';
import type { Theme, ThemeName } from './utils/theme';
import { borderAt, buildOffsets, clampWidth, columnAt } from './utils/column-layout';
import { SORT_INDICATOR_AREA } from './sort-indicator';
import SelectionModel, {
  columnLevel,
  contains,
  crossIndex,
  dragScrollSpeed,
  lineIndex,
  linePosition,
  lineRange,
  rangeFor,
  resolve,
  rowLevel,
  shapeOf,
} from './utils/selection';
import type { Axis } from './utils/selection';
import { moveTarget, revealOffset, stepAfterEdit, stepWithin } from './utils/selection-navigation';
import { toTsv } from './utils/clipboard';
import ContextMenu from './utils/context-menu';
import { createEditor, startsByTyping } from './utils/cell-editors';
import { resolveEdit } from './utils/edit-value';
import type { EditResult } from './utils/edit-value';
import type { LayerOptions } from './utils/layer';
import type {
  BuiltInCellEditor,
  CellContext,
  CellEditable,
  CellEditContext,
  CellEditEndDetail,
  CellEditor,
  CellEditorContext,
  CellEditorInstance,
  CellEditStartDetail,
  CellFocusDetail,
  CellPosition,
  CellRange,
  CellRenderer,
  CellState,
  CellValueChange,
  CellValueChangedDetail,
  ContextMenuDetail,
  ContextMenuItem,
  CustomCellEditor,
  EditOutOfView,
  GridSelection,
  Key,
  RendererRef,
  RowId,
  RowInput,
  SelectionChangeDetail,
  SelectionCopyDetail,
  SelectionLevel,
  SelectionMode,
  SelectOption,
  SortDirection,
  SortKey,
} from './types';
import type { RowIdGetter } from './utils/data-store';
import type { Row } from './utils/row-store';

const classes = {
  scrollArea: 'scrollArea',
  resizeGuide: 'resizeGuide',
  horizontalGuide: 'horizontal',
};

/** How far from a column border the pointer still grabs it, in CSS px. Fingers are less precise than mice. */
const RESIZE_GRAB = { mouse: 4, touch: 12 };
/** Longest a live `columnresizing` event is held back while dragging, in ms. */
const RESIZE_EVENT_INTERVAL_MS = 50;
/** Most rows measured by auto-fit; the rows in view are what counts, and 100k rows must not make it slow. */
const AUTO_SIZE_SAMPLE_ROWS = 500;
/** How far a touch may move and still count as a tap, in CSS px. */
const TAP_SLOP = 8;

/** Layers and renderers every grid starts with. */
const builtIn = {
  background: 'background',
  content: 'content',
  selection: 'selection',
  header: 'header',
  backgroundRenderer: 'background',
  valueRenderer: 'value',
  headerRenderer: 'header',
};

const BUILT_IN_LAYERS = [builtIn.background, builtIn.content, builtIn.selection, builtIn.header];

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

const parentOf = (element: Element) => {
  const root = element.getRootNode();
  return element.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
};

/** The element and everything above it, out of shadow roots too. */
const ancestorsOf = (element: Element) => {
  const chain: Element[] = [];
  for (let current: Element | null = element; current; current = parentOf(current)) chain.push(current);
  return chain;
};

export interface ColumnHeader {
  index: number;
  id: Key;
  displayName?: string;
  width: number;
  /** Narrowest the column can get when resized, in px. Defaults to 20. */
  minWidth?: number;
  /** Widest the column can get when resized, in px. Defaults to unlimited. */
  maxWidth?: number;
  /** Whether the user can drag this column's right border. Defaults to `true`; `setColumnWidth` ignores it. */
  resizable?: boolean;
  /** Renderers drawing a cell of this column, in order. Defaults to the grid's `cellRenderers`. */
  renderers?: RendererRef[];
  valueFormatter: (value: unknown) => string;
  /** CSS font of this column's cells, instead of the grid's `font`. Not `'inherit'`: that is the grid's. */
  font?: string;
  /** CSS font of this column's header, instead of the grid's `headerFont`. */
  headerFont?: string;
  /** Renderer drawing the header of this column. */
  headerRenderer: RendererRef;
  /** Whether the user can edit this column's cells: `true`, or a function asked per cell. Defaults to `false`. `startEditing` follows it too. */
  editable?: CellEditable;
  /** Editor over the cell: `'text'` (default), `'number'`, `'checkbox'`, `{ type: 'select', options }`, or a function building a custom one. */
  cellEditor?: CellEditor;
  /** Turns the text of the text and number editors into the value to store; throw to mark the text invalid. Defaults to the text, or a number for `'number'`. */
  valueParser?: (text: string, change: CellValueChange) => unknown;
  /** Says whether a parsed value may be stored: `true`, or `false` / a message for an invalid-state editor that cannot be committed. */
  validator?: (value: unknown, change: CellValueChange) => boolean | string;
  /** Applies a committed edit instead of the grid storing it. Return `false` to reject the edit and keep the editor open. */
  valueSetter?: (change: CellValueChange) => boolean | void;
}

/** What `getColumnState` returns and `setColumnState` takes: enough to restore the column widths later. */
export interface ColumnState {
  id: Key;
  width: number;
}

/** What triggered a resize: the user dragging or double-clicking a border, `autoSizeColumns`, or code calling `setColumnWidth` / `setColumnState`. */
export type ColumnResizeSource = 'drag' | 'auto' | 'api';

export interface ColumnResizeDetail {
  columnId: Key;
  width: number;
  source: ColumnResizeSource;
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

export type {
  BuiltInCellEditor,
  CellContext,
  CellEditable,
  CellEditContext,
  CellEditEndDetail,
  CellEditor,
  CellEditorContext,
  CellEditorInstance,
  CellEditStartDetail,
  CellFocusDetail,
  CellPosition,
  CellRange,
  CellRenderer,
  CellState,
  CellValueChange,
  CellValueChangedDetail,
  ContextMenuDetail,
  ContextMenuItem,
  CustomCellEditor,
  EditOutOfView,
  GridSelection,
  LayerOptions,
  RendererRef,
  SelectionChangeDetail,
  SelectionCopyDetail,
  SelectionMode,
  SelectOption,
  SortDirection,
  SortKey,
};

export interface RowResizeDetail {
  rowId: RowId;
  height: number;
  source: RowResizeSource;
}

/** What triggered a row resize: the user dragging a row-number border, or code calling `setRowHeightById`. */
export type RowResizeSource = 'drag' | 'api';

type ResizeTarget = { axis: 'column'; column: ColumnHeader } | { axis: 'row'; row: Row };

/** A border being dragged: where the pointer started, the size at that point, and when the last live event went out. */
interface DragProgress {
  start: number;
  startSize: number;
  lastEvent: number;
}

type ColumnDrag = DragProgress & { axis: 'column'; column: ColumnHeader };

type RowDrag = DragProgress & { axis: 'row'; row: Row };

type ResizeDrag = ColumnDrag | RowDrag;

/** Which keys change what a click does: shift extends the selection, ctrl or cmd adds a range to it. */
interface PointerModifiers {
  extend: boolean;
  additive: boolean;
}

/** What a press can select: a cell, a whole column (header), a whole row (row number), or everything (the corner). */
type SelectionHit =
  | { zone: 'cell'; row: number; column: number }
  | { zone: 'column'; column: number }
  | { zone: 'row'; row: number }
  | { zone: 'all' };

/** A selection being dragged out with the pointer, from `anchor` to wherever the pointer is. */
interface SelectionDrag {
  pointerId: number;
  anchor: CellPosition;
  /** Set when the drag started on column headers (`'column'`) or row numbers (`'row'`) and selects whole columns or rows. */
  axis: Axis | undefined;
  /** Pointer position in client coordinates. */
  x: number;
  y: number;
  /** Pending animation frame of the scrolling that continues while the pointer rests outside the grid. */
  frame: number | undefined;
}

/** The cell being edited, the editor over it and the value the cell had when editing began. */
interface EditSession {
  cell: CellEditContext;
  instance: CellEditorInstance;
  wrapper: HTMLElement;
}

/** A touch that may turn out to be a tap; a touch that moves is a scroll instead. */
interface TouchTap {
  pointerId: number;
  x: number;
  y: number;
  hit: SelectionHit;
  modifiers: PointerModifiers;
}

declare global {
  interface HTMLElementTagNameMap {
    'canvas-grid': CanvasGridComponent;
  }

  interface HTMLElementEventMap {
    columnresizing: CustomEvent<ColumnResizeDetail>;
    columnresized: CustomEvent<ColumnResizeDetail>;
    rowresizing: CustomEvent<RowResizeDetail>;
    rowresized: CustomEvent<RowResizeDetail>;
    selectionchange: CustomEvent<SelectionChangeDetail>;
    cellfocus: CustomEvent<CellFocusDetail>;
    selectioncopy: CustomEvent<SelectionCopyDetail>;
    gridcontextmenu: CustomEvent<ContextMenuDetail>;
    celleditstart: CustomEvent<CellEditStartDetail>;
    celleditend: CustomEvent<CellEditEndDetail>;
    cellvaluechanged: CustomEvent<CellValueChangedDetail>;
  }
}

/** Slack for the frame cap, in ms. */
const FRAME_JITTER_MS = 2;
const DEFAULT_FONT = '12px sans-serif';
const DEFAULT_HEADER_FONT = '13px sans-serif';

class CanvasGridComponent extends HTMLElement {
  /** Maximum redraw rate. */
  fps = 60;
  /** Theme read from the CSS custom properties, `refreshTheme` keeps it current. Explicit options win over it. */
  private theme: Theme = THEME_DEFAULTS.dark;
  _font: string | undefined = undefined;
  _headerFont: string | undefined = undefined;
  _headerHeight: number | undefined = undefined;
  _cellHeight: number | undefined = undefined;
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
  private _backgroundColor: string | undefined = undefined;
  private _headerBackgroundColor: string | undefined = undefined;
  private _textColor: string | undefined = undefined;
  /** Tint of selected cells; set it, then call `forceDraw`. */
  selectionColor: string | undefined = undefined;
  /** Colour of the outline of a selection and of the border around the active cell. */
  selectionBorderColor: string | undefined = undefined;

  /** Cell background; set it to override `--cg-background`, `undefined` hands it back to the theme. */
  get backgroundColor(): string {
    return this._backgroundColor ?? this.theme.background;
  }

  set backgroundColor(color: string | undefined) {
    this._backgroundColor = color;
    this.applyTheme();
  }

  /** Header background; overrides `--cg-header-background`. An empty string hides the corner above the row numbers. */
  get headerBackgroundColor(): string {
    return this._headerBackgroundColor ?? this.theme.headerBackground;
  }

  set headerBackgroundColor(color: string | undefined) {
    this._headerBackgroundColor = color;
    this.applyTheme();
  }

  /** Text colour of cells and headers; overrides `--cg-text-color` and `--cg-header-text-color`. */
  get textColor(): string {
    return this._textColor ?? this.theme.text;
  }

  set textColor(color: string | undefined) {
    this._textColor = color;
    this.applyTheme();
  }

  get headerHeight() {
    return this._headerHeight ?? this.theme.headerHeight;
  }

  set headerHeight(height: number) {
    this._headerHeight = height;
  }

  get cellHeight() {
    return this._cellHeight ?? this.theme.rowHeight;
  }

  set cellHeight(height: number) {
    this._cellHeight = height;
  }
  dataStore = new DataStore({
    getRowId: (row, index) => this.getRowId(row, index),
    getCellHeight: () => this.cellHeight,
    getRowHeight: id => this.newRowHeight(id),
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
    background: this.theme.background,
    enableFlashing: true,
    flashInDuration: 200,
    flashOutDuration: 400,
    flashColor: this.theme.flash,
    zebraColor: this.theme.zebra,
    hoverColor: this.theme.hover,
    borderRightWidth: 1,
    borderRightColor: this.theme.border,
    borderBottomWidth: 1,
    borderBottomColor: this.theme.border,
  });

  cellValueRenderer = new CellValueRenderer({
    layer: builtIn.content,
    font: this.theme.font,
    color: this.theme.text,
  });

  headerCellRenderer = new HeaderRenderer({
    layer: builtIn.header,
    font: this.theme.headerFont,
    color: this.theme.headerText,
    background: this.theme.headerBackground,
    selectedBackground: this.theme.headerSelected,
    fullySelectedBackground: this.theme.headerFullySelected,
    borderRightWidth: 1,
    borderRightColor: this.theme.headerBorder,
    borderBottomWidth: 1,
    borderBottomColor: this.theme.headerBottomBorder,
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
    this.refitSelection();
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
      selected: 'none',
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
    return this._font ?? this.theme.font;
  }

  set headerFont(font: string) {
    if (this._headerFont !== font) {
      this._headerFont = font;
      this.headerCellRenderer.font = resolveFont(font, getComputedStyle(this), DEFAULT_HEADER_FONT);
    }
  }

  get headerFont() {
    return this._headerFont ?? this.theme.headerFont;
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

  /**
   * What happens to text wider than its cell: `'clip'` (default) cuts it off at the cell edge and measures nothing,
   * `'ellipsis'` shortens it and ends it with an ellipsis, which means measuring the text.
   */
  set textOverflow(textOverflow: TextStyle['textOverflow']) {
    this.setTextStyle({ textOverflow });
  }

  get textOverflow() {
    return this.textStyle.textOverflow;
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
    this.appendChild(this.resizeGuide);

    this.updateLastRender();
    this.refreshTheme();
    this.refreshFonts();
    this.watchTheme();
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
    this.scrollArea.addEventListener('pointerdown', this.onResizePointerDown);
    this.scrollArea.addEventListener('pointermove', this.onResizePointerMove);
    this.scrollArea.addEventListener('pointerup', this.onResizePointerEnd);
    this.scrollArea.addEventListener('pointercancel', this.onResizePointerEnd);
    this.scrollArea.addEventListener('dblclick', this.onResizeDoubleClick);
    this.scrollArea.addEventListener('touchstart', this.onResizeTouchStart, { passive: false });
    // after the resize listeners, which claim a press on a border first
    this.scrollArea.addEventListener('pointerdown', this.onSelectPointerDown);
    this.scrollArea.addEventListener('pointermove', this.onSelectPointerMove);
    this.scrollArea.addEventListener('pointerup', this.onSelectPointerEnd);
    this.scrollArea.addEventListener('pointercancel', this.onSelectPointerEnd);
    this.scrollArea.addEventListener('dblclick', this.onEditDoubleClick);
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('copy', this.onCopy);
    this.addEventListener('contextmenu', this.onContextMenu);
    // the offsets are read once per frame in `render`, so a scroll event costs nothing and no frame shows a stale position
    this.scrollArea.addEventListener('scroll', () => {
      this.contextMenu?.close();
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
    this.cellValueRenderer.font = resolveFont(this.font, getComputedStyle(this), DEFAULT_FONT);
    this.headerCellRenderer.font = resolveFont(this.headerFont, getComputedStyle(this), DEFAULT_HEADER_FONT);
    this.renderers.clearCaches();
    this.resize();
  }

  private readonly onFontsLoaded = () => this.refreshFonts();

  private themeQuery: MediaQueryList | undefined = undefined;
  private themeObserver: MutationObserver | undefined = undefined;
  private colorCheck: ((value: string) => boolean) | undefined = undefined;

  /** The `theme` attribute when it names a theme, else the colour scheme the page prefers. */
  private get themeName(): ThemeName {
    const attribute = this.getAttribute('theme');
    if (attribute === 'light' || attribute === 'dark') return attribute;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  /**
   * Re-reads the `--cg-*` custom properties and redraws when a value changed. Runs by itself when the colour scheme,
   * the `theme` attribute or the `class`, `style` or `data-theme` attribute of the grid or an ancestor change;
   * call it after changing the tokens any other way, such as a stylesheet rule that is toggled.
   */
  refreshTheme() {
    const style = getComputedStyle(this);
    this.colorCheck ??= createColorCheck(document.createElement('canvas').getContext('2d') ?? { fillStyle: '' });
    const next = readTheme(this.themeName, {
      read: token => style.getPropertyValue(token),
      isColor: this.colorCheck,
      isFont: isCssFont,
    });
    if (isSameTheme(next, this.theme)) return;

    const sizeChanged = next.rowHeight !== this.theme.rowHeight || next.headerHeight !== this.theme.headerHeight;
    this.theme = next;
    if (sizeChanged) this.syncThemeHeights();
    this.applyTheme();
  }

  /** Hands the theme, with the explicit options on top, to the renderers and redraws. */
  private applyTheme() {
    const { theme } = this;
    this.cellBackgroundRenderer.update({
      background: this.backgroundColor,
      borderRightColor: theme.border,
      borderBottomColor: theme.border,
      zebraColor: theme.zebra,
      hoverColor: theme.hover,
      flashColor: theme.flash,
    });
    this.headerCellRenderer.update({
      background: this.headerBackgroundColor,
      color: this._textColor ?? theme.headerText,
      selectedBackground: theme.headerSelected,
      fullySelectedBackground: theme.headerFullySelected,
      borderRightColor: theme.headerBorder,
      borderBottomColor: theme.headerBottomBorder,
    });
    this.cellValueRenderer.color = this.textColor;
    this.loadingIndicator.setColor(this.textColor);
    this.refreshFonts();
  }

  /** Row heights follow `--cg-row-height` until `cellHeight`, `setRowHeight` or a drag sets them. */
  private syncThemeHeights() {
    if (this._cellHeight === undefined && this.rowHeightOf === undefined) this._dataCollection.setHeights(id => this.heightOfRow(id));
    this.refreshRowHeights();
    this.refreshScrollbar();
  }

  private readonly onThemeChange = () => this.refreshTheme();

  private watchTheme() {
    this.themeQuery = window.matchMedia('(prefers-color-scheme: light)');
    this.themeQuery.addEventListener('change', this.onThemeChange);
    this.themeObserver = new MutationObserver(this.onThemeChange);
    ancestorsOf(this).forEach(element => this.themeObserver?.observe(element, { attributes: true, attributeFilter: ['class', 'style', 'theme', 'data-theme'] }));
  }

  private unwatchTheme() {
    this.themeQuery?.removeEventListener('change', this.onThemeChange);
    this.themeObserver?.disconnect();
  }

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
    if (this.relayoutPending) {
      this.relayoutPending = false;
      this.forceDraw();
      this.updateLastRender();
      return;
    }
    const delta = new Date().valueOf() - this.lastRender;
    // the frame cap is for animations; scrolling draws on every frame, or it would visibly lag behind the scrollbar
    // a little under the frame time: frames arrive a fraction early or late, and would otherwise be skipped by turns
    if (!this.isScrolling && delta < (1000 / this.fps) - FRAME_JITTER_MS) {
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
      selected: 'none',
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
    if (this.edit) this.positionEditor();
    const now = new Date().valueOf();
    const redrawAll = forced || this.hasScrolled();
    this.cell.now = now;
    this.cell.dt = now - this.lastDraw;
    this.cell.isScrolling = this.isScrolling;
    this.lastDraw = now;
    // everything visible is painted again after a scroll, so custom layers start clean: a renderer that only clears its own cell
    // would leave what it drew at the old position in the gaps between cells
    if (!forced && this.hasScrolled()) this.clearCustomLayers();
    // the loading indicator animates until there is data
    let keepDrawing = this._dataCollection.length === 0;

    if ((forced || this.hasXScrolled() || this.headersDirty) && this.showHeaders) {
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
            Math.round(this.columnOffsets[header.index] + (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset),
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

      if ((forced || this.hasYScrolled() || this.headersDirty) && this.showRowNumbers) {
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
          cell.width = Math.round(header.width);
          cell.height = row.height;
          cell.row = cellRow;
          cell.column = header;
          cell.value = value;
          cell.formatted = formatted;
          cell.updatedAt = updatedAt;
          cell.age = updatedAt === undefined ? Infinity : now - updatedAt;
          cell.valueChanged = valueChanged;
          cell.forced = redrawAll;
          cell.selected = 'none';
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
    if (redrawAll || this.selectionDirty) this.renderSelection();
    if (this.scrollYOffset > 0 || this.scrollXOffset > 0) {
      this.renderBrick();
    }
    this.hoverDirty = [];
    this.selectionDirty = false;
    this.headersDirty = false;
    this.prevScrollYOffset = this.scrollYOffset;
    this.prevScrollXOffset = this.scrollXOffset;
    if (keepDrawing) this.requestRender();
  }

  /** The columns overlapping the viewport horizontally, with their x position and values; found once per draw, not per row. */
  private getVisibleColumns(xOffset: number) {
    const visible: { header: ColumnHeader; id: string; x: number; store: ColumnStore | undefined }[] = [];
    const { columnList, columnOffsets } = this;
    for (let index = Math.max(0, columnAt(columnOffsets, -xOffset)); index < columnList.length; index++) {
      const x = xOffset + columnOffsets[index];
      if (x > this.viewportWidth) break;

      const header = columnList[index];
      visible.push({ header, id: String(header.id), x, store: this.dataStore.columns.get(String(header.id)) });
    }
    return visible;
  }

  /** Columns in display order, and where each starts; rebuilt when columns or widths change. */
  private columnList: ColumnHeader[] = [];

  private columnOffsets: number[] = [0];

  private updateColumnLayout() {
    this.columnList = [];
    this.headers.forEach(header => this.columnList.push(header));
    this.columnOffsets = buildOffsets(this.columnList.map(header => header.width));
  }

  /** The selection must be drawn again on the next frame. */
  private selectionDirty = false;

  /** The headers and row numbers must be drawn again, because the selection they show changed. */
  private headersDirty = false;

  /** How much of a column is selected, for its header. */
  private columnSelection(index: number): SelectionLevel {
    const { ranges } = this.selectionModel;
    return ranges.length === 0 ? 'none' : columnLevel(ranges, index, this._dataCollection.length);
  }

  /** How much of a row is selected, for its row number. */
  private rowSelection(index: number): SelectionLevel {
    const { ranges } = this.selectionModel;
    return ranges.length === 0 ? 'none' : rowLevel(ranges, index, this.columnList.length);
  }

  /** Whether the selection layer holds anything, so a grid that never selects never clears it. */
  private selectionDrawn = false;

  /** Tints each selected range and outlines the active cell: one rectangle per range, however many cells it covers. */
  private renderSelection() {
    const { ranges, active } = this.selectionModel;
    if (ranges.length === 0 && !this.selectionDrawn) return;

    const layer = this.getLayer(builtIn.selection);
    if (!layer) return;

    const { ctx } = layer;
    layer.clear();
    this.selectionDrawn = ranges.length > 0;
    if (!this.selectionDrawn) return;

    const left = this.showRowNumbers ? this.rowNumbersWidth : 0;
    const top = this.showHeaders ? this.headerHeight : 0;
    const originX = left - this.scrollXOffset;
    const originY = top - this.scrollYOffset;
    const { _dataCollection: rows, columnOffsets } = this;
    const rectOf = (range: CellRange) => {
      const bounds = resolve(range, rows.length, this.columnList.length);
      if (!bounds) return undefined;

      const x = originX + columnOffsets[bounds.left];
      const y = originY + rows.topOf(bounds.top);
      return { x, y, width: originX + columnOffsets[bounds.right + 1] - x, height: originY + rows.topOf(bounds.bottom + 1) - y };
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, this.viewportWidth - left, this.viewportHeight - top);
    ctx.clip();
    ctx.fillStyle = this.selectionColor ?? this.theme.selection;
    ctx.strokeStyle = this.selectionBorderColor ?? this.theme.selectionBorder;
    ctx.lineWidth = 1;
    ranges.map(rectOf).forEach(rect => {
      if (!rect) return;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    });
    const cell = active && rectOf({ rows: [active.row, active.row], columns: [active.column, active.column] });
    if (cell) {
      // the active cell is left untinted, like in a spreadsheet
      ctx.clearRect(cell.x, cell.y, cell.width, cell.height);
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2);
    }
    ctx.restore();
  }

  renderRowNumber(row: { index: number; height?: number }, y: number) {
    if (!this.isInViewport(0, y, this.rowNumbersWidth, row.height)) return;
    this.describe(0, Math.ceil(y), this.rowNumbersWidth, row.height ?? 0, {
      row: { id: row.index, index: row.index },
      formatted: `${row.index + 1}`,
      selected: this.rowSelection(row.index),
    });
    this.paint(builtIn.headerRenderer);
  }

  private clearCustomLayers() {
    this.layers.filter(layer => !BUILT_IN_LAYERS.includes(layer.name)).forEach(layer => layer.clear());
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
    this.headerCellRenderer.setSortModel(model);
    this.forceDraw();
  }

  getSortModel() {
    return this.dataStore.getSortModel();
  }

  renderBrick() {
    if (this.showHeaders && this.showRowNumbers && this.headerBackgroundColor) {
      this.describe(0, 0, this.rowNumbersWidth, this.headerHeight, {});
      this.paint(builtIn.headerRenderer);
    }
  }

  renderHeaders() {
    const xOffset = (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.scrollXOffset;

    this.getVisibleColumns(xOffset).forEach(({ header, x }) => {
      this.describe(x, 0, Math.round(header.width), this.headerHeight, {
        column: header,
        formatted: header.displayName ?? '',
        selected: this.columnSelection(header.index),
      });
      this.paint(header.headerRenderer);
    });

    if (this.scrollXOffset + this.rowNumbersWidth > 0) {
      this.renderBrick();
    }
  }

  getColumnHeader(key: Key) {
    return this.headers.get(key);
  }

  /** Redraws everything on the next frame, without waiting for the frame cap; for changes that move cells, like resizing. */
  private requestRelayout() {
    this.relayoutPending = true;
    this.requestRender();
  }

  private relayoutPending = false;

  private emitResized(type: 'columnresized' | 'columnresizing', column: ColumnHeader, source: ColumnResizeSource) {
    this.dispatchEvent(new CustomEvent<ColumnResizeDetail>(type, { detail: { columnId: column.id, width: column.width, source } }));
  }

  /** Sets the widths within each column's limits and refreshes the layout once; returns the columns that actually changed. */
  private applyColumnWidths(widths: Iterable<[Key, number]>) {
    const changed = Array.from(widths)
      .map(([id, width]) => ({ column: this.headers.get(id), width }))
      .filter(({ column, width }) => column !== undefined && clampWidth(width, column.minWidth, column.maxWidth) !== Math.round(column.width))
      .flatMap(({ column, width }) => (column === undefined ? [] : [{ column, width: clampWidth(width, column.minWidth, column.maxWidth) }]))
      .map(({ column, width }) => Object.assign(column, { width }));
    if (changed.length === 0) return changed;

    this.updateColumnLayout();
    this.refreshScrollbar();
    this.requestRelayout();
    return changed;
  }

  /** Sets a column's width in px, within its `minWidth` / `maxWidth`, and fires `columnresized` when it changed. Works for columns that are not `resizable`. */
  setColumnWidth(id: Key, width: number) {
    this.applyColumnWidths([[id, width]]).forEach(column => this.emitResized('columnresized', column, 'api'));
  }

  /** The widths of all columns, in display order; pass it to `setColumnState` to restore them. */
  getColumnState(): ColumnState[] {
    return this.columnList.map(({ id, width }) => ({ id, width: Math.round(width) }));
  }

  /** Restores widths from `getColumnState`; unknown columns are skipped. Fires `columnresized` for each column that changed. */
  setColumnState(state: readonly ColumnState[]) {
    this.applyColumnWidths(state.map(({ id, width }): [Key, number] => [id, width]))
      .forEach(column => this.emitResized('columnresized', column, 'api'));
  }

  private measureContext: CanvasRenderingContext2D | null | undefined = undefined;

  /**
   * Fits columns (all of them by default) to their content: the header and the rows in view, at most
   * `AUTO_SIZE_SAMPLE_ROWS` of them, so it stays fast with any number of rows. Fires `columnresized` for each that changed.
   */
  autoSizeColumns(ids?: readonly Key[]) {
    this.measureContext ??= document.createElement('canvas').getContext('2d');
    const ctx = this.measureContext;
    if (!ctx) return;

    const { scrollTop } = this.scrollArea;
    const rows: Row[] = [];
    for (let index = this._dataCollection.indexAt(scrollTop); index < this._dataCollection.length && rows.length < AUTO_SIZE_SAMPLE_ROWS; index++) {
      const row = this._dataCollection.at(index);
      if (!row || this._dataCollection.topOf(index) > scrollTop + this.viewportHeight) break;
      rows.push(row);
    }

    const padding = this.cellPadding.left + this.cellPadding.right + 1;
    const widest = (font: string, texts: Iterable<string>) => {
      ctx.font = font;
      return Math.max(0, ...Array.from(texts, text => ctx.measureText(text).width));
    };
    const widths = (ids ?? this.columnList.map(({ id }) => id))
      .flatMap(id => this.headers.get(id) ?? [])
      .map((column): [Key, number] => {
        const store = this.dataStore.columns.get(String(column.id));
        const texts = rows.flatMap(({ slot }) => store?.get(slot) ?? []).map(value => column.valueFormatter(value));
        const header = widest(column.headerFont ?? this.headerCellRenderer.font, [column.displayName ?? '']) + padding + SORT_INDICATOR_AREA;
        const content = widest(column.font ?? this.cellValueRenderer.font, texts) + padding;
        return [column.id, Math.ceil(Math.max(header, content))];
      });
    this.applyColumnWidths(widths).forEach(column => this.emitResized('columnresized', column, 'auto'));
  }

  /** Smallest row height the user can drag to, or a row-height function can return. */
  private static readonly MIN_ROW_HEIGHT = 8;

  /** Heights set for single rows by dragging or `setRowHeightById`, by row id; they win over `setRowHeight`'s function. */
  private readonly rowHeightOverrides = new Map<string, number>();

  private rowHeightOf: ((id: RowId) => number) | undefined = undefined;

  private heightOfRow(id: RowId) {
    const height = this.rowHeightOverrides.get(String(id)) ?? this.rowHeightOf?.(id) ?? this.cellHeight;
    return Math.max(CanvasGridComponent.MIN_ROW_HEIGHT, Math.round(height));
  }

  /** Only asked for rows being added, and only when it can differ from `cellHeight`. */
  private readonly newRowHeight = (id: RowId) =>
    this.rowHeightOverrides.size === 0 && this.rowHeightOf === undefined ? undefined : this.heightOfRow(id);

  private refreshRowHeights() {
    this.refreshScrollbar();
    this.requestRelayout();
  }

  private emitRowResized(type: 'rowresized' | 'rowresizing', rowId: RowId, source: RowResizeSource) {
    const height = this._dataCollection.get(rowId)?.height;
    if (height !== undefined) this.dispatchEvent(new CustomEvent<RowResizeDetail>(type, { detail: { rowId, height, source } }));
  }

  /**
   * Sets the height of every row: a number in px (also the height of rows added later), or a function of the row id
   * returning one, called for existing rows now and for rows as they are added once their values are stored.
   * Replaces the heights of rows resized one by one. Fires no events.
   */
  setRowHeight(height: number | ((id: RowId) => number)) {
    this.rowHeightOverrides.clear();
    if (typeof height === 'function') this.rowHeightOf = height;
    else {
      this.rowHeightOf = undefined;
      this._cellHeight = height;
    }
    this._dataCollection.setHeights(id => this.heightOfRow(id));
    this.refreshRowHeights();
  }

  /** Sets one row's height in px (at least 8) and fires `rowresized`; the height sticks to the row through sorting and updates. */
  setRowHeightById(id: RowId, height: number) {
    this.rowHeightOverrides.set(String(id), Math.max(CanvasGridComponent.MIN_ROW_HEIGHT, Math.round(height)));
    if (!this._dataCollection.setHeight(id, this.heightOfRow(id))) return;

    this.refreshRowHeights();
    this.emitRowResized('rowresized', id, 'api');
  }

  private resizeDrag: ResizeDrag | undefined = undefined;

  /** The column border or row border under the pointer, when it can be dragged. */
  private findResizeTarget(clientX: number, clientY: number, pointerType: string): ResizeTarget | undefined {
    const rect = this.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const grab = pointerType === 'touch' ? RESIZE_GRAB.touch : RESIZE_GRAB.mouse;
    // not over the vertical scrollbar
    if (x < 0 || y < 0 || x > this.scrollArea.clientWidth) return undefined;

    const rowNumbers = this.showRowNumbers ? this.rowNumbersWidth : 0;
    const headers = this.showHeaders ? this.headerHeight : 0;
    if (this.showHeaders && y <= headers) return this.findColumnBorder(x - rowNumbers, grab);
    if (this.showRowNumbers && x < rowNumbers) return this.findRowBorder(y - headers, grab);
    return undefined;
  }

  private findColumnBorder(x: number, grab: number): ResizeTarget | undefined {
    if (x < 0) return undefined;

    const column = this.columnList[borderAt(this.columnOffsets, x + this.scrollArea.scrollLeft, grab)];
    return column === undefined || column.resizable === false ? undefined : { axis: 'column', column };
  }

  private findRowBorder(y: number, grab: number): ResizeTarget | undefined {
    const row = this._dataCollection.at(this._dataCollection.borderAt(y + this.scrollArea.scrollTop, grab));
    return row === undefined ? undefined : { axis: 'row', row };
  }

  private moveResizeGuide() {
    const { resizeDrag, resizeGuide } = this;
    resizeGuide.style.display = resizeDrag ? 'block' : 'none';
    if (!resizeDrag) return;

    const horizontal = resizeDrag.axis === 'row';
    resizeGuide.classList.toggle(classes.horizontalGuide, horizontal);
    const column = this.showRowNumbers ? this.rowNumbersWidth : 0;
    const header = this.showHeaders ? this.headerHeight : 0;
    resizeGuide.style.transform = resizeDrag.axis === 'row'
      ? `translateY(${header + this._dataCollection.topOf(resizeDrag.row.index) + resizeDrag.row.height - this.scrollArea.scrollTop}px)`
      : `translateX(${column + (this.columnOffsets[resizeDrag.column.index + 1] ?? 0) - this.scrollArea.scrollLeft}px)`;
  }

  private readonly resizeGuide = Object.assign(document.createElement('div'), { className: classes.resizeGuide });

  private readonly onResizePointerDown = (event: PointerEvent) => {
    const target = event.button === 0 ? this.findResizeTarget(event.clientX, event.clientY, event.pointerType) : undefined;
    if (!target) return;

    event.preventDefault();
    this.scrollArea.setPointerCapture(event.pointerId);
    this.resizeDrag = target.axis === 'row'
      ? { ...target, start: event.clientY, startSize: target.row.height, lastEvent: 0 }
      : { ...target, start: event.clientX, startSize: target.column.width, lastEvent: 0 };
    this.moveResizeGuide();
  };

  private readonly onResizePointerMove = (event: PointerEvent) => {
    const { resizeDrag } = this;
    if (!resizeDrag) {
      // the cursor follows the border; touch has no hover
      const target = this.findResizeTarget(event.clientX, event.clientY, event.pointerType);
      this.scrollArea.style.cursor = target === undefined ? '' : `${target.axis === 'row' ? 'row' : 'col'}-resize`;
      return;
    }

    if (resizeDrag.axis === 'row') this.dragRow(resizeDrag, event.clientY - resizeDrag.start);
    else this.dragColumn(resizeDrag, event.clientX - resizeDrag.start);
    this.moveResizeGuide();
  };

  private dragColumn(drag: ColumnDrag, delta: number) {
    const { column } = drag;
    this.applyColumnWidths([[column.id, drag.startSize + delta]]);
    if (!this.dueForLiveEvent(drag)) return;

    this.emitResized('columnresizing', column, 'drag');
  }

  private dragRow(drag: RowDrag, delta: number) {
    const { id } = drag.row;
    this.rowHeightOverrides.set(String(id), Math.max(CanvasGridComponent.MIN_ROW_HEIGHT, Math.round(drag.startSize + delta)));
    if (this._dataCollection.setHeight(id, this.heightOfRow(id))) this.refreshRowHeights();
    if (!this.dueForLiveEvent(drag)) return;

    this.emitRowResized('rowresizing', id, 'drag');
  }

  /** Whether enough time has passed since the last live event; counts this one as sent when it has. */
  private dueForLiveEvent(drag: ResizeDrag) {
    const now = performance.now();
    if (now - drag.lastEvent < RESIZE_EVENT_INTERVAL_MS) return false;

    drag.lastEvent = now;
    return true;
  }

  private readonly onResizePointerEnd = (event: PointerEvent) => {
    const { resizeDrag } = this;
    if (!resizeDrag) return;

    this.resizeDrag = undefined;
    this.scrollArea.releasePointerCapture(event.pointerId);
    this.moveResizeGuide();
    if (resizeDrag.axis === 'row' && resizeDrag.row.height !== resizeDrag.startSize) this.emitRowResized('rowresized', resizeDrag.row.id, 'drag');
    if (resizeDrag.axis === 'column' && resizeDrag.column.width !== resizeDrag.startSize) this.emitResized('columnresized', resizeDrag.column, 'drag');
  };

  private readonly onResizeDoubleClick = (event: MouseEvent) => {
    const target = this.findResizeTarget(event.clientX, event.clientY, 'mouse');
    if (target?.axis !== 'column') return;

    const { column } = target;
    if (column === this.columnList[this.columnList.length - 1] && this.fillRemainingSpace(column)) return;
    this.autoSizeColumns([column.id]);
  };

  /** Widens the last column to the right edge of the viewport when the columns leave it empty; returns whether there was room. */
  private fillRemainingSpace(column: ColumnHeader) {
    const free = this.scrollArea.clientWidth - (this.showRowNumbers ? this.rowNumbersWidth : 0) - this.columnOffsets[this.columnOffsets.length - 1];
    if (free <= 0) return false;

    this.applyColumnWidths([[column.id, column.width + free]]).forEach(changed => this.emitResized('columnresized', changed, 'auto'));
    return true;
  }

  /** Keeps a touch that starts on a border from scrolling the grid, so the pointer events can drag it instead. */
  private readonly onResizeTouchStart = (event: TouchEvent) => {
    const [touch] = Array.from(event.touches);
    if (event.touches.length === 1 && this.findResizeTarget(touch.clientX, touch.clientY, 'touch')) event.preventDefault();
  };

  private readonly selectionModel = new SelectionModel();

  private mode: SelectionMode = 'none';

  /**
   * What the user can select with the pointer: `'none'` (default), one `'cell'`, `'range'`s of cells with whole rows and columns
   * (like a spreadsheet), or whole `'row'`s or `'column'`s. `getSelection` and `setSelection` work in every mode; switching to `'none'` clears it.
   */
  set selectionMode(mode: SelectionMode) {
    if (mode === this.mode) return;

    this.mode = mode;
    this.updateTabIndex();
    if (mode === 'none') this.clearSelection();
  }

  /** Whether the grid put `tabindex` on itself, so it is only taken away again when it was not the page's. */
  private ownsTabIndex = false;

  /** A grid with selection takes keyboard focus; one without it stays out of the tab order, as before. */
  private updateTabIndex() {
    if (this.mode !== 'none' && !this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
      this.ownsTabIndex = true;
    }
    if (this.mode === 'none' && this.ownsTabIndex) {
      this.removeAttribute('tabindex');
      this.ownsTabIndex = false;
    }
  }

  get selectionMode() {
    return this.mode;
  }

  /** The selected ranges and the active cell, by displayed position; the ranges are copies. */
  getSelection(): GridSelection {
    return this.selectionModel.snapshot();
  }

  /**
   * Selects the given ranges, with `active` in focus (the first cell of the last range by default). A range that leaves out `rows` or `columns`
   * covers all of them. Positions beyond the data are cut off when it changes. Fires `selectionchange`, and `cellfocus` when the active cell moved.
   */
  setSelection(ranges: readonly CellRange[], active?: CellPosition) {
    this.changeSelection(() => this.selectionModel.replace(ranges, active), false);
  }

  clearSelection() {
    this.changeSelection(() => this.selectionModel.clear(), false);
  }

  private emitSelectionChange(selecting: boolean) {
    this.dispatchEvent(new CustomEvent<SelectionChangeDetail>('selectionchange', { detail: { ...this.selectionModel.snapshot(), selecting } }));
  }

  private emitCellFocus() {
    const { active } = this.selectionModel;
    const row = active && this._dataCollection.at(active.row);
    const column = active && this.columnList[active.column];
    if (!active || !row || !column) return;

    this.dispatchEvent(new CustomEvent<CellFocusDetail>('cellfocus', {
      detail: { rowId: row.id, rowIndex: active.row, columnId: column.id, columnIndex: active.column },
    }));
  }

  /** Applies a change to the selection, then redraws it and fires the events if something differs. */
  private changeSelection(change: () => boolean, selecting: boolean) {
    const previous = this.selectionModel.active && { ...this.selectionModel.active };
    if (!change()) return false;

    // a canvas is only worth its memory and compositing once something is selected
    if (this.selectionModel.ranges.length > 0 && !this.getLayer(builtIn.selection)) this.addLayer(builtIn.selection, { before: builtIn.header });
    this.selectionDirty = true;
    this.headersDirty = true;
    this.requestRender();
    this.emitSelectionChange(selecting);
    const { active } = this.selectionModel;
    if (active && (active.row !== previous?.row || active.column !== previous.column)) this.emitCellFocus();
    return true;
  }

  /** Cuts the selection to the data after rows or columns changed, and redraws it: ranges that reach the end follow the data. */
  private refitSelection() {
    if (this.selectionModel.ranges.length === 0) return;

    this.changeSelection(() => this.selectionModel.clamp(this._dataCollection.length, this.columnList.length), false);
    this.selectionDirty = true;
  }

  private selectDrag: SelectionDrag | undefined = undefined;

  private touchTap: TouchTap | undefined = undefined;

  /** Where in the grid, in px from its top left, a point of the viewport is. */
  private offsetsOf(clientX: number, clientY: number) {
    const rect = this.getBoundingClientRect();
    const left = this.showRowNumbers ? this.rowNumbersWidth : 0;
    const top = this.showHeaders ? this.headerHeight : 0;
    return { x: clientX - rect.left, y: clientY - rect.top, left, top };
  }

  /** Index of the column at `contentX` px from the left of the first column, or undefined past the last one. */
  private columnIndexAt(contentX: number) {
    const column = columnAt(this.columnOffsets, contentX);
    return column < 0 || contentX >= this.columnOffsets[this.columnOffsets.length - 1] ? undefined : column;
  }

  /** Index of the row at `contentY` px from the top of the first row, or undefined past the last one. */
  private rowIndexAt(contentY: number) {
    const row = this._dataCollection.indexAt(contentY);
    return row >= this._dataCollection.length ? undefined : row;
  }

  /** What is under the pointer that a press can select: a cell, a column header, a row number or the corner. Scrollbars and empty space are nothing. */
  private hitAt(clientX: number, clientY: number): SelectionHit | undefined {
    const { x, y, left, top } = this.offsetsOf(clientX, clientY);
    if (x < 0 || y < 0 || x > this.scrollArea.clientWidth || y > this.scrollArea.clientHeight) return undefined;

    const inHeader = y < top;
    const inRowNumbers = x < left;
    const column = this.columnIndexAt(x - left + this.scrollArea.scrollLeft);
    const row = this.rowIndexAt(y - top + this.scrollArea.scrollTop);
    if (inHeader && inRowNumbers) return { zone: 'all' };
    if (inHeader) return column === undefined ? undefined : { zone: 'column', column };
    if (inRowNumbers) return row === undefined ? undefined : { zone: 'row', row };
    return column === undefined || row === undefined ? undefined : { zone: 'cell', row, column };
  }

  /** The cell nearest to the pointer, wherever it is: dragging past an edge selects up to that edge. */
  private nearestCell(clientX: number, clientY: number): CellPosition | undefined {
    const rows = this._dataCollection.length;
    if (rows === 0 || this.columnList.length === 0) return undefined;

    const { x, y, left, top } = this.offsetsOf(clientX, clientY);
    return {
      row: Math.min(rows - 1, this._dataCollection.indexAt(Math.max(0, y - top) + this.scrollArea.scrollTop)),
      column: columnAt(this.columnOffsets, Math.max(0, x - left) + this.scrollArea.scrollLeft),
    };
  }

  /** The row and column a header selection that was just made starts from: those at the top left of the viewport. */
  private firstVisible(axis: Axis) {
    return axis === 'column'
      ? this._dataCollection.indexAt(this.scrollArea.scrollTop)
      : Math.max(0, columnAt(this.columnOffsets, this.scrollArea.scrollLeft));
  }

  /**
   * Applies a press on a cell: plain selects it, shift extends from the active cell, ctrl or cmd adds a range.
   * Returns the cell a drag from here starts at.
   */
  private pressCell(cell: CellPosition, { extend, additive }: PointerModifiers, selecting: boolean) {
    const { selectionModel, mode } = this;
    const { active } = selectionModel;
    if (extend && active && mode !== 'cell') {
      const range = rangeFor(mode, active, cell);
      this.changeSelection(() => (additive ? selectionModel.extend(range, cell) : selectionModel.set(range, active, cell)), selecting);
      return { ...active };
    }

    const range = rangeFor(mode, cell, cell);
    this.changeSelection(() => (additive && mode !== 'cell' ? selectionModel.add(range, cell) : selectionModel.set(range, cell)), selecting);
    return cell;
  }

  /**
   * Applies a press on a column header or row number: it selects the whole column or row, shift extends from the active cell's,
   * ctrl or cmd adds one. Returns the cell a drag from here starts at.
   */
  private pressLine(axis: Axis, index: number, { extend, additive }: PointerModifiers, selecting: boolean) {
    const { selectionModel } = this;
    const { active } = selectionModel;
    if (extend && active) {
      const range = lineRange(axis, lineIndex(axis, active), index);
      const focus = linePosition(axis, index, crossIndex(axis, active));
      this.changeSelection(() => (additive ? selectionModel.extend(range, focus) : selectionModel.set(range, active, focus)), selecting);
      return { ...active };
    }

    const cell = linePosition(axis, index, this.firstVisible(axis));
    const range = lineRange(axis, index, index);
    this.changeSelection(() => (additive ? selectionModel.add(range, cell) : selectionModel.set(range, cell)), selecting);
    return cell;
  }

  /** Selects everything, keeping the active cell. */
  private selectEverything(selecting: boolean) {
    const active = this.selectionModel.active ?? { row: this.firstVisible('column'), column: this.firstVisible('row') };
    this.changeSelection(() => this.selectionModel.set({}, active), selecting);
  }

  /** Which modes a press in each part of the grid selects in; a column header does nothing when only rows can be selected, and so on. */
  private static readonly ZONE_MODES: Record<SelectionHit['zone'], readonly SelectionMode[]> = {
    cell: ['cell', 'range', 'row', 'column'],
    column: ['range', 'column'],
    row: ['range', 'row'],
    all: ['range', 'row', 'column'],
  };

  /** Applies a press wherever it landed. Returns the drag it starts, or undefined when there is nothing to drag. */
  private press(hit: SelectionHit, modifiers: PointerModifiers, selecting: boolean): Pick<SelectionDrag, 'anchor' | 'axis'> | undefined {
    if (!CanvasGridComponent.ZONE_MODES[hit.zone].includes(this.mode)) return undefined;
    if (hit.zone === 'all') {
      this.selectEverything(selecting);
      return undefined;
    }
    if (hit.zone === 'column') return { anchor: this.pressLine('column', hit.column, modifiers, selecting), axis: 'column' };
    if (hit.zone === 'row') return { anchor: this.pressLine('row', hit.row, modifiers, selecting), axis: 'row' };
    return { anchor: this.pressCell({ row: hit.row, column: hit.column }, modifiers, selecting), axis: undefined };
  }

  private dragSelectTo({ x, y, anchor, axis }: SelectionDrag) {
    const cell = this.nearestCell(x, y);
    if (!cell) return;

    if (axis) {
      const focus = linePosition(axis, lineIndex(axis, cell), crossIndex(axis, anchor));
      this.changeSelection(() => this.selectionModel.extend(lineRange(axis, lineIndex(axis, anchor), lineIndex(axis, cell)), focus), true);
      return;
    }
    if (this.mode === 'cell') return;

    const range = rangeFor(this.mode, anchor, cell);
    this.changeSelection(() => this.selectionModel.extend(range, cell), true);
  }

  private readonly onSelectPointerDown = (event: PointerEvent) => {
    if (this.mode === 'none' || event.button !== 0 || this.resizeDrag) return;

    const hit = this.hitAt(event.clientX, event.clientY);
    if (!hit) return;

    const modifiers = { extend: event.shiftKey, additive: event.ctrlKey || event.metaKey };
    if (event.pointerType === 'touch') {
      // a touch that moves scrolls, so it only selects when it ends where it started
      this.touchTap = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, hit, modifiers };
      return;
    }

    // cancelling the press also cancels the browser's own focusing, so the grid takes focus for the keyboard here
    event.preventDefault();
    this.focus({ preventScroll: true });
    const drag = this.press(hit, modifiers, true);
    if (!drag) return;

    this.scrollArea.setPointerCapture(event.pointerId);
    this.selectDrag = { ...drag, pointerId: event.pointerId, x: event.clientX, y: event.clientY, frame: undefined };
  };

  private readonly onSelectPointerMove = (event: PointerEvent) => {
    const { touchTap, selectDrag } = this;
    if (touchTap && Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y) > TAP_SLOP) this.touchTap = undefined;
    if (!selectDrag || selectDrag.pointerId !== event.pointerId) return;

    selectDrag.x = event.clientX;
    selectDrag.y = event.clientY;
    this.dragSelectTo(selectDrag);
    selectDrag.frame ??= requestAnimationFrame(this.scrollWhileDragging);
  };

  /** Keeps scrolling, and extending the selection with it, for as long as the pointer is held outside the cells. */
  private readonly scrollWhileDragging = () => {
    const drag = this.selectDrag;
    if (!drag) return;

    drag.frame = undefined;
    const { x, y, left, top } = this.offsetsOf(drag.x, drag.y);
    // a drag along the headers only follows the pointer across, and one along the row numbers only down
    const dx = drag.axis === 'row' ? 0 : dragScrollSpeed(x, left, this.scrollArea.clientWidth);
    const dy = drag.axis === 'column' ? 0 : dragScrollSpeed(y, top, this.scrollArea.clientHeight);
    if (dx === 0 && dy === 0) return;

    this.scrollArea.scrollBy(dx, dy);
    this.dragSelectTo(drag);
    drag.frame = requestAnimationFrame(this.scrollWhileDragging);
  };

  private readonly onSelectPointerEnd = (event: PointerEvent) => {
    const { touchTap, selectDrag } = this;
    if (touchTap?.pointerId === event.pointerId) {
      this.touchTap = undefined;
      if (event.type === 'pointerup') {
        this.focus({ preventScroll: true });
        this.press(touchTap.hit, touchTap.modifiers, false);
      }
      return;
    }
    if (!selectDrag || selectDrag.pointerId !== event.pointerId) return;

    this.endSelectDrag();
    if (this.scrollArea.hasPointerCapture(event.pointerId)) this.scrollArea.releasePointerCapture(event.pointerId);
    this.emitSelectionChange(false);
  };

  private endSelectDrag() {
    if (this.selectDrag?.frame !== undefined) cancelAnimationFrame(this.selectDrag.frame);
    this.selectDrag = undefined;
  }

  /** Scrolls the least that brings a cell fully into view. */
  private revealCell({ row, column }: CellPosition) {
    const { scrollArea, _dataCollection: rows, columnOffsets } = this;
    const { left, top } = this.offsetsOf(0, 0);
    const scrollTop = revealOffset(rows.topOf(row), rows.topOf(row + 1), scrollArea.scrollTop, scrollArea.clientHeight - top);
    const scrollLeft = revealOffset(columnOffsets[column], columnOffsets[column + 1], scrollArea.scrollLeft, scrollArea.clientWidth - left);
    if (scrollTop !== scrollArea.scrollTop) scrollArea.scrollTop = scrollTop;
    if (scrollLeft !== scrollArea.scrollLeft) scrollArea.scrollLeft = scrollLeft;
  }

  private get gridSize() {
    const { top } = this.offsetsOf(0, 0);
    return {
      rowCount: this._dataCollection.length,
      columnCount: this.columnList.length,
      pageRows: Math.max(1, Math.floor((this.scrollArea.clientHeight - top) / this.cellHeight)),
    };
  }

  /** Selects one cell, or its whole row or column in those modes, and brings it into view. */
  private moveTo(cell: CellPosition) {
    const range = rangeFor(this.mode, cell, cell);
    this.changeSelection(() => this.selectionModel.set(range, cell), false);
    this.revealCell(cell);
  }

  /** Stretches the newest range to `cell`; it keeps being whole columns or whole rows when it was, and the active cell stays. */
  private extendTo(cell: CellPosition) {
    const { selectionModel, mode } = this;
    const { active, focus } = selectionModel;
    const last = selectionModel.ranges[selectionModel.ranges.length - 1];
    if (!active || !focus || !last) return;

    const shape = shapeOf(last);
    if (shape === 'all') return;
    if (shape === 'block') {
      const range = rangeFor(mode, active, cell);
      this.changeSelection(() => selectionModel.extend(range, cell), false);
      this.revealCell(cell);
      return;
    }

    const axis = shape;
    const range = lineRange(axis, lineIndex(axis, active), lineIndex(axis, cell));
    const moved = linePosition(axis, lineIndex(axis, cell), crossIndex(axis, focus));
    this.changeSelection(() => selectionModel.extend(range, moved), false);
    this.revealCell(moved);
  }

  /** Moves the active cell inside a selection of several cells; with one cell selected Enter moves the selection, and Tab is left to the page. */
  private stepActive(axis: Axis, backwards: boolean) {
    const { selectionModel } = this;
    const { active } = selectionModel;
    const last = selectionModel.ranges[selectionModel.ranges.length - 1];
    const bounds = last && resolve(last, this._dataCollection.length, this.columnList.length);
    if (!active) return false;
    if (bounds && (bounds.top !== bounds.bottom || bounds.left !== bounds.right)) {
      const next = stepWithin(bounds, active, axis, backwards);
      this.changeSelection(() => selectionModel.activate(next), false);
      this.revealCell(next);
      return true;
    }
    if (axis === 'column') return false;

    const target = moveTarget(active, backwards ? 'ArrowUp' : 'ArrowDown', false, this.gridSize);
    if (target) this.moveTo(target);
    return true;
  }

  /** Selects the whole column (ctrl+space) or row (shift+space) of the active cell. */
  private selectLineOfActive(axis: Axis) {
    const { active } = this.selectionModel;
    if (!active || !CanvasGridComponent.ZONE_MODES[axis].includes(this.mode)) return false;

    const range = lineRange(axis, lineIndex(axis, active), lineIndex(axis, active));
    this.changeSelection(() => this.selectionModel.set(range, active), false);
    return true;
  }

  /** Collapses the selection to its active cell. */
  private collapseSelection() {
    const { active } = this.selectionModel;
    if (!active) return false;

    const range = rangeFor(this.mode, active, active);
    return this.changeSelection(() => this.selectionModel.set(range, active), false);
  }

  /** Moves or extends the selection for a navigation key; the first press just selects the cell at the top left of the view. */
  private navigate(event: KeyboardEvent, ctrl: boolean) {
    const { active, focus } = this.selectionModel;
    const size = this.gridSize;
    if (size.rowCount === 0 || size.columnCount === 0) return false;

    const start = { row: this.firstVisible('column'), column: this.firstVisible('row') };
    const extend = event.shiftKey && this.mode !== 'cell';
    const target = moveTarget(active ? (extend && focus) || active : start, event.key, ctrl, size);
    if (!target) return false;

    if (!active) this.moveTo(start);
    else if (extend) this.extendTo(target);
    else this.moveTo(target);
    return true;
  }

  /** Returns whether the key was a selection key, which is then kept from also scrolling the page. */
  private handleSelectionKey(event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;
    const { key, shiftKey } = event;
    if (ctrl && key.toLowerCase() === 'a') {
      if (!CanvasGridComponent.ZONE_MODES.all.includes(this.mode)) return false;
      this.selectEverything(false);
      return true;
    }
    if (key === ' ' && ctrl) return this.selectLineOfActive('column');
    if (key === ' ' && shiftKey) return this.selectLineOfActive('row');
    if (key === 'Enter') return this.stepActive('row', shiftKey);
    if (key === 'Tab') return this.stepActive('column', shiftKey);
    if (key === 'Escape') return this.collapseSelection();
    return this.navigate(event, ctrl);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.mode === 'none' || event.defaultPrevented || event.altKey) return;
    if (!this.handleEditKey(event) && !this.handleSelectionKey(event)) return;

    event.preventDefault();
  };

  /** The newest range as tab-separated text of the formatted values, as shown; undefined when nothing is selected. */
  private copiedSelection(): SelectionCopyDetail | undefined {
    const { ranges } = this.selectionModel;
    const range = ranges[ranges.length - 1];
    const bounds = range && resolve(range, this._dataCollection.length, this.columnList.length);
    if (!range || !bounds) return undefined;

    const columns = this.columnList.slice(bounds.left, bounds.right + 1)
      .map(header => ({ header, store: this.dataStore.columns.get(String(header.id)) }));
    const { text, truncated } = toTsv(bounds, (row, column) => {
      const { header, store } = columns[column - bounds.left];
      const value = store?.get(this._dataCollection.at(row)?.slot ?? -1);
      return value === undefined ? '' : header.valueFormatter(value);
    });
    return { text, range: { ...range }, truncated };
  }

  /** The selection as it is about to be copied, once `selectioncopy` let it through; undefined when there is nothing to copy or a listener cancelled. */
  private requestCopy() {
    const copied = this.mode === 'none' ? undefined : this.copiedSelection();
    if (!copied) return undefined;

    return this.dispatchEvent(new CustomEvent<SelectionCopyDetail>('selectioncopy', { detail: copied, cancelable: true })) ? copied : undefined;
  }

  /** Puts the selection on the clipboard when the user copies. `selectioncopy` can change the text or cancel the copy. */
  private readonly onCopy = (event: ClipboardEvent) => {
    const copied = event.clipboardData && this.requestCopy();
    if (!copied || !event.clipboardData) return;

    event.clipboardData.setData('text/plain', copied.text);
    event.preventDefault();
  };

  /**
   * Copies the newest selected range to the clipboard, as the copy shortcut does, `selectioncopy` included.
   * Resolves to whether anything was copied. Browsers allow it from a user action only, such as a click.
   */
  async copySelection() {
    const copied = this.requestCopy();
    if (!copied) return false;

    await navigator.clipboard.writeText(copied.text);
    return true;
  }

  /** The entries of the context menu. Replace them to change the menu; an empty list keeps the browser's own menu. */
  contextMenuItems: ContextMenuItem[] = [
    { id: 'copy', label: 'Copy', disabled: () => this.selectionModel.ranges.length === 0, run: () => void this.copySelection() },
  ];

  private contextMenu: ContextMenu | undefined;

  private menuDetail: ContextMenuDetail | undefined;

  /** Whether a right click on this hit already has what it selects selected; those that do keep their selection. */
  private isSelected(hit: SelectionHit) {
    const { ranges } = this.selectionModel;
    if (hit.zone === 'cell') return ranges.some(range => contains(range, hit.row, hit.column));
    if (hit.zone === 'column') return columnLevel(ranges, hit.column, this._dataCollection.length) === 'full';
    if (hit.zone === 'row') return rowLevel(ranges, hit.row, this.columnList.length) === 'full';
    return ranges.some(range => shapeOf(range) === 'all');
  }

  /** Where the menu opens for a key press: the corner of the active cell, or of the grid's cells. */
  private menuAnchor(): { x: number; y: number } {
    const { x, y, left, top } = this.offsetsOf(0, 0);
    const { active } = this.selectionModel;
    if (!active) return { x: left - x, y: top - y };

    return {
      x: left - x + this.columnOffsets[active.column] - this.scrollArea.scrollLeft,
      y: top - y + this._dataCollection.topOf(active.row + 1) - this.scrollArea.scrollTop,
    };
  }

  /** Opens the context menu on a right click, a long press or the menu key, once `gridcontextmenu` let it. */
  private readonly onContextMenu = (event: MouseEvent) => {
    if (this.mode === 'none' || this.contextMenuItems.length === 0 || event.defaultPrevented) return;

    // the menu key and Shift+F10 report no button 2, and a position that is not where the user is looking
    const byPointer = event.button === 2;
    const hit = byPointer ? this.hitAt(event.clientX, event.clientY) : undefined;
    if (byPointer && !hit) return;

    event.preventDefault();
    this.focus({ preventScroll: true });
    if (hit && !this.isSelected(hit)) this.press(hit, { extend: false, additive: false }, false);

    const anchor = byPointer ? { x: event.clientX, y: event.clientY } : this.menuAnchor();
    const active = this.selectionModel.active;
    const detail: ContextMenuDetail = {
      ...this.selectionModel.snapshot(),
      ...anchor,
      row: hit ? (hit.zone === 'cell' || hit.zone === 'row' ? hit.row : undefined) : active?.row,
      column: hit ? (hit.zone === 'cell' || hit.zone === 'column' ? hit.column : undefined) : active?.column,
      items: [...this.contextMenuItems],
    };
    if (!this.dispatchEvent(new CustomEvent<ContextMenuDetail>('gridcontextmenu', { detail, cancelable: true }))) return;
    if (detail.items.length === 0) return;

    this.menuDetail = detail;
    this.contextMenu ??= new ContextMenu(this, id => this.menuDetail?.items.find(item => item.id === id)?.run(this.menuDetail));
    this.contextMenu.open(detail.x, detail.y, detail.items.map(({ id, label, disabled }) => ({
      id,
      label,
      disabled: typeof disabled === 'function' ? disabled(detail) : disabled ?? false,
    })));
  };

  /** What happens to an edit when its cell scrolls out of view: `'cancel'` (default) drops it, `'commit'` writes it, `'keep'` hides the editor until the cell is back. */
  editOutOfView: EditOutOfView = 'cancel';

  private edit: EditSession | undefined;

  private cellOf(rowId: RowId, columnId: Key): CellEditContext | undefined {
    const row = this._dataCollection.get(rowId);
    const column = this.headers.get(columnId);
    if (!row || !column) return undefined;

    return { rowId: row.id, rowIndex: row.index, columnId: column.id, columnIndex: column.index, value: this.dataStore.getValue(row.id, column.id) };
  }

  private canEdit(cell: CellEditContext) {
    const editable = this.headers.get(cell.columnId)?.editable;
    return typeof editable === 'function' ? editable(cell) : editable === true;
  }

  /**
   * Puts an editor over a cell, committing the edit in progress first. Returns whether one opened: the cell has to exist and be `editable`,
   * and a cancelled `celleditstart` or an edit that cannot be committed stop it. The cell is scrolled into view.
   */
  startEditing(rowId: RowId, columnId: Key) {
    return this.openEditor(rowId, columnId, undefined);
  }

  /** Ends the edit in progress: commits it, or drops it with `cancel`. Returns false when there was none, or the value is invalid or rejected, which keeps the editor open. */
  stopEditing(cancel = false) {
    return this.finishEdit(cancel);
  }

  private openEditor(rowId: RowId, columnId: Key, initialText: string | undefined) {
    const cell = this.cellOf(rowId, columnId);
    if (!cell || !this.canEdit(cell) || !this.finishEditIfOpen()) return false;
    if (!this.dispatchEvent(new CustomEvent<CellEditStartDetail>('celleditstart', { detail: cell, cancelable: true }))) return false;

    this.revealCell({ row: cell.rowIndex, column: cell.columnIndex });
    const instance = createEditor(this.headers.get(columnId)?.cellEditor, {
      ...cell,
      initialText,
      commit: () => void this.finishEdit(false),
      cancel: () => void this.finishEdit(true),
    });
    const wrapper = document.createElement('div');
    wrapper.className = 'cellEditor';
    wrapper.append(instance.element);
    wrapper.addEventListener('keydown', this.onEditorKeyDown);
    wrapper.addEventListener('focusout', this.onEditorFocusOut);
    wrapper.addEventListener('input', () => this.showValidity());
    wrapper.addEventListener('change', () => this.showValidity());
    this.append(wrapper);
    this.edit = { cell, instance, wrapper };
    this.positionEditor();
    if (instance.focus) instance.focus();
    else instance.element.focus({ preventScroll: true });
    return true;
  }

  private finishEditIfOpen() {
    return !this.edit || this.finishEdit(false);
  }

  /** The editor's value parsed and validated against the value the cell holds now. */
  private checkEdit(edit: EditSession): EditResult {
    const column = this.headers.get(edit.cell.columnId);
    const oldValue = this.dataStore.getValue(edit.cell.rowId, edit.cell.columnId);
    return resolveEdit(
      edit.instance.getValue(),
      column?.cellEditor,
      { parse: column?.valueParser, validate: column?.validator },
      { ...edit.cell, value: oldValue, oldValue },
    );
  }

  private showValidity(result?: EditResult) {
    const { edit } = this;
    if (!edit) return;

    const { ok, message } = { message: undefined, ...(result ?? this.checkEdit(edit)) };
    edit.wrapper.classList.toggle('invalid', !ok);
    edit.wrapper.title = message ?? '';
    edit.instance.element.setAttribute('aria-invalid', String(!ok));
  }

  /** Writes a committed value, through the column's `valueSetter` when it has one. Returns false when that rejected it. */
  private applyEdit(edit: EditSession, newValue: unknown) {
    const { cell } = edit;
    const oldValue = this.dataStore.getValue(cell.rowId, cell.columnId);
    // an untouched cell is left alone, so a value streamed in meanwhile is not overwritten by the stale one the editor started from
    if (newValue === cell.value) return true;

    const setter = this.headers.get(cell.columnId)?.valueSetter;
    if (setter && setter({ ...cell, value: oldValue, oldValue, newValue }) === false) return false;
    if (!setter && this.dataStore.setValue(cell.rowId, cell.columnId, newValue)) this.forceDraw();
    if (!setter) this.requestRender();
    this.dispatchEvent(new CustomEvent<CellValueChangedDetail>('cellvaluechanged', { detail: { ...cell, value: newValue, oldValue, newValue } }));
    return true;
  }

  private finishEdit(cancel: boolean) {
    const { edit } = this;
    if (!edit) return false;

    const result = cancel ? undefined : this.checkEdit(edit);
    if (result && !result.ok) {
      this.showValidity(result);
      return false;
    }
    const newValue = result?.ok ? result.value : undefined;
    if (result && !this.applyEdit(edit, newValue)) {
      this.showValidity({ ok: false, message: 'Rejected' });
      return false;
    }

    this.closeEditor(edit);
    this.dispatchEvent(new CustomEvent<CellEditEndDetail>('celleditend', { detail: { ...edit.cell, cancelled: cancel, newValue } }));
    return true;
  }

  private closeEditor({ wrapper, instance }: EditSession) {
    const hadFocus = wrapper.contains(document.activeElement);
    this.edit = undefined;
    instance.destroy?.();
    wrapper.remove();
    if (hadFocus) this.focus({ preventScroll: true });
  }

  /** Keeps the editor on its cell as the grid scrolls, resizes or re-sorts; applies `editOutOfView` once the cell is gone from the view. */
  private positionEditor() {
    const { edit, scrollArea, columnOffsets } = this;
    if (!edit) return;

    const cell = this.cellOf(edit.cell.rowId, edit.cell.columnId);
    if (!cell) {
      this.finishEdit(true);
      return;
    }
    edit.cell.rowIndex = cell.rowIndex;
    edit.cell.columnIndex = cell.columnIndex;

    const { left, top } = this.offsetsOf(0, 0);
    const rows = this._dataCollection;
    const x = left + columnOffsets[cell.columnIndex] - Math.round(scrollArea.scrollLeft);
    const y = top + rows.topOf(cell.rowIndex) - Math.round(scrollArea.scrollTop);
    const width = columnOffsets[cell.columnIndex + 1] - columnOffsets[cell.columnIndex];
    const height = rows.topOf(cell.rowIndex + 1) - rows.topOf(cell.rowIndex);
    // the part under the headers, the row numbers or the scrollbars is cut off, so the editor never covers them
    const cut = {
      top: Math.max(0, top - y),
      right: Math.max(0, x + width - scrollArea.clientWidth),
      bottom: Math.max(0, y + height - scrollArea.clientHeight),
      left: Math.max(0, left - x),
    };
    const hidden = cut.top >= height || cut.bottom >= height || cut.left >= width || cut.right >= width;
    if (hidden && this.editOutOfView !== 'keep' && this.finishEdit(this.editOutOfView === 'cancel')) return;

    const { style } = edit.wrapper;
    style.left = `${x}px`;
    style.top = `${y}px`;
    style.width = `${width}px`;
    style.height = `${height}px`;
    // clipped rather than hidden, which would take the focus away
    style.clipPath = hidden ? 'inset(100%)' : `inset(${cut.top}px ${cut.right}px ${cut.bottom}px ${cut.left}px)`;
    style.pointerEvents = hidden ? 'none' : '';
  }

  /** Enter and Tab commit and move the selection on, Escape drops the edit; the keys stay inside the editor, which the grid would otherwise act on. */
  private readonly onEditorKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    const { edit } = this;
    const { key, shiftKey } = event;
    if (!edit || event.isComposing || !['Escape', 'Enter', 'Tab'].includes(key)) return;

    event.preventDefault();
    const { rowIndex: row, columnIndex: column } = edit.cell;
    if (!this.finishEdit(key === 'Escape') || key === 'Escape' || this.mode === 'none') return;

    const target = stepAfterEdit({ row, column }, key === 'Enter' ? 'row' : 'column', shiftKey, this.gridSize);
    this.moveTo(target);
  };

  /** Leaving the editor commits it, or drops it when its value is invalid. Switching windows leaves it be. */
  private readonly onEditorFocusOut = (event: FocusEvent) => {
    const { edit } = this;
    if (!edit || !document.hasFocus() || (event.relatedTarget instanceof Node && edit.wrapper.contains(event.relatedTarget))) return;
    if (!this.finishEdit(false)) this.finishEdit(true);
  };

  private readonly onEditDoubleClick = (event: MouseEvent) => {
    const hit = this.hitAt(event.clientX, event.clientY);
    const row = hit?.zone === 'cell' ? this._dataCollection.at(hit.row) : undefined;
    const column = hit?.zone === 'cell' ? this.columnList[hit.column] : undefined;
    if (row && column) this.openEditor(row.id, column.id, undefined);
  };

  /** Starts editing the active cell for F2, Enter (with a single cell selected) or a typed character, which begins the text. */
  private handleEditKey(event: KeyboardEvent) {
    const { active, ranges } = this.selectionModel;
    const row = active && this._dataCollection.at(active.row);
    const column = active && this.columnList[active.column];
    if (!row || !column) return false;

    const { key, shiftKey } = event;
    const bounds = ranges.length === 1 ? resolve(ranges[0], this._dataCollection.length, this.columnList.length) : undefined;
    const single = bounds !== undefined && bounds.top === bounds.bottom && bounds.left === bounds.right;
    const typed = key.length === 1 && !event.ctrlKey && !event.metaKey && !(key === ' ' && shiftKey);
    if (key === 'F2' || (key === 'Enter' && !shiftKey && single)) return this.openEditor(row.id, column.id, undefined);
    return typed && startsByTyping(column.cellEditor) && this.openEditor(row.id, column.id, key);
  }

  get totalHeight() {
    return this._dataCollection.totalHeight;
  }

  refreshScrollbar() {
    const height = this.totalHeight + this.headerHeight;
    this.scrollHelper.style.height = `${height}px`;
    const width = this.columnOffsets[this.columnOffsets.length - 1];
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
    this.refitSelection();
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
      this.updateColumnLayout();
      this.refreshScrollbar();
      this.refitSelection();
      this.forceDraw();
    }
  }

  disconnectedCallback() {
    this.finishEdit(true);
    this.cancelRender();
    this.endSelectDrag();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.pixelRatioQuery?.removeEventListener('change', this.watchPixelRatio);
    this.unwatchTheme();
    document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded);
    clearTimeout(this.fontsTimeout);
  }
}

if (window && window.customElements) {
  injectStyles();
  customElements.define('canvas-grid', CanvasGridComponent);
}

export default CanvasGridComponent;

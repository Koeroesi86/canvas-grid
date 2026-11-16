import React, { Group } from '../utils/jsx';
import Renderer from '../utils/renderer';
import Rect from '../rectangle';
import TextRenderer from '../text';
import type { TextStyle } from '../text';
import SortIndicator, { SORT_INDICATOR_AREA } from '../sort-indicator';
import type { CellContext, CellRenderer, SortDirection } from '../types';

export interface HeaderOptions {
  layer: string;
  background: string;
  /** Background of a header or row number with some of its cells selected. */
  selectedBackground: string;
  /** Background of a header or row number whose whole column or row is selected. */
  fullySelectedBackground: string;
  font: string;
  color: string;
  borderRightWidth: number;
  borderRightColor: string;
  borderBottomWidth: number;
  borderBottomColor: string;
}

class HeaderRenderer extends Renderer<HeaderOptions> implements CellRenderer {
  static readonly defaultOptions: HeaderOptions = {
    layer: 'header',
    background: '#333',
    selectedBackground: '#2f3d4a',
    fullySelectedBackground: '#3a5a7c',
    font: '13px sans-serif',
    color: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
  };

  private readonly textRenderer: TextRenderer;

  /** Sort direction by column id, set by the grid; sorted headers show an arrow. */
  private readonly sortDirections = new Map<string, SortDirection>();

  /** Shows the arrows of the columns in the sort model; the grid redraws the headers afterwards. */
  setSortModel(model: readonly { columnId: string | number; direction?: SortDirection }[]) {
    this.sortDirections.clear();
    model.forEach(({ columnId, direction = 'asc' }) => this.sortDirections.set(String(columnId), direction));
  }

  constructor(options: Partial<HeaderOptions> = {}) {
    super({ ...HeaderRenderer.defaultOptions, ...options });

    this.textRenderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
    });
  }

  get layer() {
    return this.options.layer;
  }

  set font(font: string) {
    this.options.font = font;
    this.textRenderer.font = font;
  }

  get font() {
    return this.textRenderer.font;
  }

  set pixelRatio(pixelRatio: number) {
    this.textRenderer.pixelRatio = pixelRatio;
  }

  get pixelRatio() {
    return this.textRenderer.pixelRatio;
  }

  setTextStyle(style: Partial<TextStyle>) {
    this.textRenderer.setStyle(style);
  }

  clearCache() {
    this.textRenderer.clearCache();
  }

  private backgroundFor(selected: CellContext['selected']) {
    if (selected === 'full') return this.options.fullySelectedBackground;
    if (selected === 'partial') return this.options.selectedBackground;
    return this.options.background;
  }

  draw({ ctx, x, y, width, height, column, formatted, selected }: Readonly<CellContext>) {
    if (width === 0 || height === 0) return;

    const direction = column === undefined ? undefined : this.sortDirections.get(String(column.id));
    const { borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;

    const background = this.backgroundFor(selected);

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {borderRightWidth > 0 && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {borderBottomWidth > 0 && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
        <this.textRenderer.element value={formatted} font={column?.headerFont} width={direction ? width - SORT_INDICATOR_AREA : width} height={height} />
        {direction && <SortIndicator width={width} height={height} direction={direction} color={this.options.color} />}
      </Group>
    ).draw(ctx, x, y);
  }
}

export default HeaderRenderer;

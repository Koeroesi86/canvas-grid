import React, { Group } from '../utils/jsx';
import Renderer from '../utils/renderer';
import Rect from '../rectangle';
import type { CellContext, CellRenderer } from '../types';

export interface CellBackgroundOptions {
  layer: string;
  enableFlashing: boolean;
  background: string;
  flashInDuration: number;
  flashOutDuration: number;
  flashRGB: string;
  borderRightWidth: number;
  borderRightColor: string;
  borderBottomWidth: number;
  borderBottomColor: string;
}

/** Lightens odd rows slightly, whatever the background is. */
const ZEBRA_COLOR = '#fff';
const ZEBRA_ALPHA = 0.025;
const HOVER_ALPHA = 0.06;
/** How long the hover highlight takes to fade in or out, in ms. */
const HOVER_DURATION = 120;

interface HoverFade {
  from: number;
  to: number;
  start: number;
}
/** Opacity of the flash that replaces the fade for people who prefer reduced motion. */
const REDUCED_MOTION_ALPHA = 0.5;

const reducedMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : undefined;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

class CellBackground extends Renderer<CellBackgroundOptions> implements CellRenderer {
  static readonly defaultOptions: CellBackgroundOptions = {
    layer: 'background',
    enableFlashing: true,
    background: '#333',
    flashInDuration: 200,
    flashOutDuration: 400,
    flashRGB: '214, 144, 13',
    borderRightWidth: 0,
    borderRightColor: '#fff',
    borderBottomWidth: 0,
    borderBottomColor: '#fff',
  };

  constructor(options: Partial<CellBackgroundOptions> = {}) {
    super({ ...CellBackground.defaultOptions, ...options });
  }

  /** Index of the row under the pointer, set by the grid through `hover`. */
  hoveredRowIndex: number | undefined = undefined;

  /** Rows whose highlight is fading in or out, or fully on. */
  private readonly hoverFades = new Map<number, HoverFade>();

  private get hoverDuration() {
    return reducedMotionQuery?.matches ? 0 : HOVER_DURATION;
  }

  /** Moves the highlight to the given row (or none); the rows involved fade from where they are. */
  hover(index: number | undefined, now = Date.now()) {
    if (index === this.hoveredRowIndex) return;

    if (this.hoveredRowIndex !== undefined) this.startFade(this.hoveredRowIndex, 0, now);
    if (index !== undefined) this.startFade(index, 1, now);
    this.hoveredRowIndex = index;
  }

  private startFade(row: number, to: number, now: number) {
    this.hoverFades.set(row, { from: this.getHoverFraction(row, now), to, start: now });
  }

  /** How much of the highlight a row shows, from 0 to 1; finished fade-outs are forgotten. */
  private getHoverFraction(row: number, now: number) {
    const fade = this.hoverFades.get(row);
    if (!fade) return 0;

    const duration = this.hoverDuration;
    const progress = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - fade.start) / duration));
    if (progress >= 1 && fade.to === 0) this.hoverFades.delete(row);
    const eased = 1 - (1 - progress) * (1 - progress);
    return fade.from + (fade.to - fade.from) * eased;
  }

  get layer() {
    return this.options.layer;
  }

  /** Cells flash after their value changed, until the flash has faded out. */
  isAnimating({ age, row, now }: Readonly<CellContext>) {
    const fade = row === undefined ? undefined : this.hoverFades.get(row.index);
    if (fade && now - fade.start < this.hoverDuration) return true;
    return this.options.enableFlashing && age <= this.options.flashInDuration + this.options.flashOutDuration;
  }

  /** Flash opacity for a cell updated `age` ms ago: eases in, eases out, then 0. A steady highlight with reduced motion. */
  private getFlashAlpha(age: number) {
    if (!this.options.enableFlashing) return 0;

    const { flashInDuration, flashOutDuration } = this.options;
    if (age > flashInDuration + flashOutDuration) return 0;
    if (reducedMotionQuery?.matches) return REDUCED_MOTION_ALPHA;

    const remaining = Math.max(0, (flashInDuration + flashOutDuration - age) / flashOutDuration);
    const alpha = age < flashInDuration ? smoothstep(age / flashInDuration) : remaining * remaining;
    return Math.round(alpha * 1000) / 1000;
  }

  draw({ ctx, x, y, width, height, age, row, now }: Readonly<CellContext>) {
    const { background, flashRGB, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;
    const flash = this.getFlashAlpha(age);
    const hover = row === undefined ? 0 : this.getHoverFraction(row.index, now) * HOVER_ALPHA;

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {row !== undefined && row.index % 2 === 1 && <Rect width={width} height={height} color={ZEBRA_COLOR} alpha={ZEBRA_ALPHA} />}
        {hover > 0 && <Rect width={width} height={height} color={ZEBRA_COLOR} alpha={hover} />}
        {flash > 0 && <Rect width={width} height={height} color={`rgb(${flashRGB})`} alpha={flash} />}
        {borderRightWidth > 0 && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {borderBottomWidth > 0 && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
      </Group>
    ).draw(ctx, x, y);
  }
}

export default CellBackground;

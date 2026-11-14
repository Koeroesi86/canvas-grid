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

  get layer() {
    return this.options.layer;
  }

  /** Cells flash after their value changed, until the flash has faded out. */
  isAnimating({ age }: Readonly<CellContext>) {
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

  draw({ ctx, x, y, width, height, age, row }: Readonly<CellContext>) {
    const { background, flashRGB, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;
    const flash = this.getFlashAlpha(age);

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {row !== undefined && row.index % 2 === 1 && <Rect width={width} height={height} color={ZEBRA_COLOR} alpha={ZEBRA_ALPHA} />}
        {flash > 0 && <Rect width={width} height={height} color={`rgb(${flashRGB})`} alpha={flash} />}
        {borderRightWidth > 0 && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {borderBottomWidth > 0 && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
      </Group>
    ).draw(ctx, x, y);
  }
}

export default CellBackground;

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

  /** Flash opacity for a cell updated `age` ms ago: fades in, then out, then 0. */
  private getFlashAlpha(age: number) {
    if (!this.options.enableFlashing) return 0;

    const { flashInDuration, flashOutDuration } = this.options;
    const alpha = age < flashInDuration
      ? age / flashInDuration
      : (flashInDuration + flashOutDuration - age) / flashOutDuration;
    return Math.max(0, Math.round(alpha * 1000) / 1000);
  }

  draw({ ctx, x, y, width, height, age, isScrolling }: Readonly<CellContext>) {
    const { background, flashRGB, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;
    const flash = isScrolling ? 0 : this.getFlashAlpha(age);

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {flash > 0 && <Rect width={width} height={height} color={`rgb(${flashRGB})`} alpha={flash} />}
        {borderRightWidth > 0 && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {borderBottomWidth > 0 && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
      </Group>
    ).draw(ctx, x, y);
  }
}

export default CellBackground;

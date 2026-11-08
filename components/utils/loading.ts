import Renderer from './renderer';
import { getContext2d } from './canvas';

interface LoadingOptions {
  ctx: CanvasRenderingContext2D;
}

class Loading extends Renderer<LoadingOptions> {
  private readonly ctx: CanvasRenderingContext2D;

  private readonly offCanvas = document.createElement('canvas');

  private readonly offCtx: CanvasRenderingContext2D;

  private rotation = 270 * (Math.PI / 180);

  private readonly speed = 6;

  private readonly count = 75;

  constructor(options: LoadingOptions) {
    super(options);

    this.ctx = this.options.ctx;

    this.offCanvas.width = 250;
    this.offCanvas.height = 250;
    this.offCtx = getContext2d(this.offCanvas);
    this.offCtx.lineWidth = 0.5;
    this.offCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  }

  updateLoader() {
    this.rotation += this.speed / 100;
  }

  renderLoader() {
    this.offCtx.save();
    this.offCtx.globalCompositeOperation = 'source-over';
    this.offCtx.translate(125, 125);
    this.offCtx.rotate(this.rotation);
    let i = this.count;
    while (i--) {
      this.offCtx.beginPath();
      this.offCtx.arc(0, 0, i + (Math.random() * 35), Math.random(), Math.PI / 3 + (Math.random() / 12), false);
      this.offCtx.stroke();
    }
    this.offCtx.restore();
  }

  render() {
    this.offCtx.globalCompositeOperation = 'destination-out';
    this.offCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    this.offCtx.fillRect(0, 0, 250, 250);
    this.updateLoader();
    this.renderLoader();

    const x = Math.round((this.ctx.canvas.width - this.offCanvas.width) / 2);
    const y = Math.round((this.ctx.canvas.height - this.offCanvas.height) / 2);
    this.ctx.clearRect(x, y, 250, 250);
    this.ctx.drawImage(this.offCanvas, x, y);

    return this.offCanvas;
  }
}

export default Loading;

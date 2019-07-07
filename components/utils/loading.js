class Loading {
  constructor({ ctx }) {
    this.ctx = ctx;

    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = 250;
    this.offCanvas.height = 250;
    this.offCtx = this.offCanvas.getContext('2d');
    this.offCtx.lineWidth = 0.5;
    this.offCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    this.rotation = 270 * (Math.PI / 180);
    this.speed = 6;
    this.count = 75;

    this.updateLoader = this.updateLoader.bind(this);
    this.renderLoader = this.renderLoader.bind(this);
    this.render = this.render.bind(this);
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
    this.offCtx.globalCompositeOperation = "destination-out";
    this.offCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
    this.offCtx.fillRect(0, 0, 250, 250);
    this.updateLoader();
    this.renderLoader();

    const x = Math.round((this.ctx.canvas.width - this.offCanvas.width) / 2);
    const y = Math.round((this.ctx.canvas.height - this.offCanvas.height) / 2);
    this.ctx.clearRect(x, y, 250, 250)
    this.ctx.drawImage(this.offCanvas, x, y);
  }
}

export default Loading;

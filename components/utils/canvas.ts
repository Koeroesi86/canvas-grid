export const getContext2d = (canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) => {
  const ctx = canvas.getContext('2d', options);
  if (!ctx) throw new Error('2D canvas context is not available');
  return ctx;
};

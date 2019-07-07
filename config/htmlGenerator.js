const getHtml = (locals) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Canvas example</title>
    <style>
      html, body {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
      }
      canvas-grid {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    </style>
    <link href="https://fonts.googleapis.com/css?family=Roboto+Mono&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css?family=Roboto&display=swap" rel="stylesheet">
    <script type="application/javascript" src="${locals.assets.example}"></script>
  </head>
  <body>
    <canvas-grid></canvas-grid>
  </body>
</html>`;
};

export default function htmlGenerator(locals) {
  return getHtml(locals);
};

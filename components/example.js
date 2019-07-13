import "./web-component";

let canvasGrid;

const init = () => {

  canvasGrid = document.querySelector('canvas-grid');
  canvasGrid.font = '12px "Roboto", sans-serif';
  canvasGrid.headerFont = '13px "Roboto", sans-serif';

  const ws = new WebSocket(`ws://localhost:${process.env.DEV_PORT || 3000}`);
  // ws.addEventListener('open', e => {
  //   console.log('open', e);
  // });
  ws.addEventListener('message', e => {
    try {
      const data = JSON.parse(e.data);
      if (data.columns && Array.isArray(data.columns)) {
        // const headers = data.columns.map((key, index) => ({
        //   id: key,
        //   index: index,
        //   displayName: `${key}`,
        // }));
        canvasGrid.setColumns(data.columns);
      }
      if (data.all) {
        canvasGrid.setValues(data.all);
      }
      if (data.row) {
        canvasGrid.queueUpdate(data.row)
      }
    } catch (e) {
      console.error(e)
    }
  });
  ws.addEventListener('close', e => {
    console.log('Connection closed, reconnecting...');
    setTimeout(init, 1000)
  });
  ws.addEventListener('error', e => {
    console.log('error', e);
  });
};

window.addEventListener('load', () => {
  init();

  if (module.hot) {
    if (!window.webpackHotUpdate) {
      window.webpackHotUpdate = () => {
        window.location.reload();
      };
    }
    module.hot.accept(); //['./example.js', './index.js']
  }
});

console.info('hmr injected');

const host = window.HMR_HOST;
createConnection();

function createConnection(reconnect) {
  const ws = new WebSocket(`ws://${host}/hmr`);

  ws.onopen = () => {
    if (reconnect) location.reload();
  };

  ws.onclose = () => {
    console.info('close');
    setTimeout(createConnection.bind(undefined, true), 2000);
  };

  ws.onmessage = ({ data }) => {
    const json = JSON.parse(data);
    const obj = json.urls.find(item => item.reqPath === location.pathname);
    if (!obj) return;

    console.info(json.changePath + ' changed');
    if (json.style) {
      const existStyle = document.querySelectorAll('style')[obj.styleIndex];
      if (existStyle) {
        existStyle.innerHTML = json.style;
        console.info('reload css');
        return;
      }
    }

    location.reload();
  };
}

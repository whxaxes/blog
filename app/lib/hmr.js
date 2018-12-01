const WebSocket = require('ws');
const url = require('url');
const path = require('path');
const chokidar = require('chokidar');
const wss = new WebSocket.Server({ noServer: true });
const manifest = {};

module.exports = app => {
  app.on('server', server => {
    const watcher = chokidar.watch([
      app.mus.baseDir,
      app.config.biz.docDir,
    ]);

    const wsList = [];
    watcher.on('change', async changePath => {
      const reqUrls = manifest[changePath] || [];
      if (!reqUrls.length) {
        return;
      }

      const extname = path.extname(changePath);
      const updateObj = { urls: reqUrls, changePath };
      if (extname === '.scss' || extname === '.css') {
        updateObj.style = await app.mus.readResource(changePath);
      }

      wsList.forEach(ws => {
        ws.send(JSON.stringify(updateObj));
      });
    });

    app.mus.evt.on('update-source', ({ reqPath, sources }) => {
      let styleIndex = 0;
      sources.forEach(url => {
        manifest[url] = manifest[url] || [];
        const item = manifest[url].find(item => item.reqPath === reqPath);
        if (item) {
          // update exists
          item.styleIndex = styleIndex;
        } else {
          manifest[url].push({ reqPath, styleIndex });
        }

        if (!url.match(/^(?:https?:)?\/\//) && url.match(/\.s?css$/)) {
          styleIndex++; // record style index
        }
      });
    });

    server.on('upgrade', (req, socket, head) => {
      const pathname = url.parse(req.url).pathname;
      if (pathname !== '/hmr') {
        return socket.destroy();
      }

      wss.handleUpgrade(req, socket, head, ws => {
        wsList.push(ws);
        ws.on('close', () => wsList.splice(wsList.indexOf(ws), 1));
      });
    });
  });
};

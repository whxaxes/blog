const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  // 解析请求 url 并且获得 pathname
  const pathname = url.parse(req.url).pathname;
  res.writeHead(200);
  res.write('hello ');
  // 结束响应的同时也可以写数据到响应上
  res.end(pathname.substring(1) || 'nodejs');
});

// 监听 3000 端口
server.listen(3000, () => {
  // 服务启动完成的时候会触发该回调，打印日志
  console.info('server listening in', server.address().port);
});

module.exports = server;

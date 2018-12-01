const http = require('http');
const url = require('url');

// 转义 mapping
const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
}

// 用于存储博客数据，给一条初始数据先
const blogs = [{
  id: '123',
  title: '我是标题',
  content: '666',
}];

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  if (pathname === '/') {
    // 博客首页
    return indexController(req, res);
  } else if (pathname.startsWith('/detail')) {
    // 博客详情页
    return detailController(req, res, pathname);
  } else if (pathname.startsWith('/edit')) {
    // 博客编辑页
    return editController(req, res, pathname);
  }

  // 404 页面
  notFoundController(req, res);
});

// 404 页面
function notFoundController(req, res) {
  res.writeHead(404);
  res.end(req.url + ' not found!');
}

// 博客首页
function indexController(req, res) {
  res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' });
  res.write('<h1>博客列表</h1>');

  if (blogs.length) {
    // 有博客的情况
    const html = blogs
      .map(blog => {
        // 博客标题
        const blogHtml = `<a href="/detail/${blog.id}">${escapeHtml(blog.title)}</a>`;
        // 博客编辑
        const editHtml = `<a href="/edit/${blog.id}">编辑</a>`;
        // 合并 html
        return `<p>${blogHtml} &nbsp;&nbsp; ${editHtml}</p>`;
      })
      .join('');

    res.write(html);
  } else {
    // 没有博客的情况
    res.write('<p>暂无博客</p>');
  }

  // 结束响应，顺便加个添加博客入口
  res.end('<a href="/edit">添加博客</a>');
}

// 从 pathname 中获取 id
function getIdFromPathname(pathname) {
  // 匹配 /xxx/{number}
  const matches = pathname.match(/^\/\w+\/(\d+)$/);
  return matches ? matches[1] : null;
}

// 博客详情页
function detailController(req, res, pathname) {
  const id = getIdFromPathname(pathname);
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog) {
    res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); // 写响应头
    res.end(`<h1>${escapeHtml(blog.title)}</h1>${escapeHtml(blog.content)}`);
  }

  // 根据 id 找不到博客，就直接 404
  return notFoundController(req, res);
}

// 博客编辑页
function editController(req, res, pathname) {
  const id = getIdFromPathname(pathname);
  const blog = id && blogs.find(blog => blog.id === id);
  if (req.method === 'GET') {
    // 展示博文编辑页
    return showEditPage(req, res, blog);
  } else if (req.method === 'POST') {
    // 提交博文更改
    return submitBlog(req, res, blog);
  }

  // 其他情况全部 404
  notFoundController(req, res);
}

// 展示编辑页
function showEditPage(req, res, blog) {
  res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' });
  res.end(`
    <script>
      function submitBlog() {
        var title = document.getElementById('title');
        var content = document.getElementById('content');
        if (!title || !content) return alert('数据不能为空');

        // 发个异步请求
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/edit${blog ? `/${blog.id}` : ''}');
        // 设置请求数据类型为 json
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            var resp = JSON.parse(xhr.responseText);

            // 提交完成，跳转到详情页
            if (resp.id) location.href = '/detail/' + resp.id;
          }
        };

        // 发送请求
        xhr.send(JSON.stringify({ title: title.value, content: content.value }));
      }
    </script>

    <p>标题：<input id="title" type="text" placeholder="输入博客标题" value="${blog ? blog.title : ''}"></p>
    <p>内容：<textarea id="content" placeholder="输入内容">${blog ? blog.content : ''}</textarea></p>
    <p><button onclick="submitBlog()">提交数据</button></p>
  `);
}

// 数据获取
function getDataFromReq(req) {
  let len = 0;
  const chunks = [];

  // 监听 data 事件
  req.on('data', buf => {
    // 如果数据量比较大的情况下，回调有可能会触发多次
    // 因此用个数组在这个回调中收集数据，数据均是 buffer
    chunks.push(buf);
    len += buf.length;
  });

  // 当触发 end 事件的时候，说明数据已经接收完了
  return new Promise(resolve =>
    req.on('end', () => {
      // 将收集的数据 buffer 组合成一个完整的 buffer ，然后通过 toString 将 buffer 转成字符串
      resolve(Buffer.concat(chunks, len).toString());
    })
  ).then(text => {
    const contentType = req.headers['content-type'];

    if (contentType.startsWith('application/json')) {
      return JSON.parse(text);
    }

    return text;
  });
}

// 博客编辑接口
let uniqId = 0;
async function submitBlog(req, res, blog) {
  // 获取请求数据
  const data = await getDataFromReq(req);

  if (blog && blog.id) {
    // 有 id ，说明是更新博文
    blog.title = data.title;
    blog.content = data.content;
  } else {
    // 无 id，说明是添加新博文
    blog = {
      id: `${Date.now()}${uniqId++}`, // 以时间戳作为 id
      title: data.title,
      content: data.content,
    };

    blogs.push(blog);
  }

  // 这里的 content-type 就是写 json 的 mime
  res.writeHead(200, { 'content-type': 'application/json;charset=utf-8' });
  res.end(JSON.stringify({ id: blog.id }));
}

// 监听 3000 端口
server.listen(3000, () => {
  // 服务启动完成的时候会触发该回调，打印日志
  console.info('server listening in', server.address().port);
});

module.exports = server;

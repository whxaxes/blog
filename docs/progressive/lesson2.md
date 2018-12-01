# 简易博客 - 系统搭建

在[上一篇文章](./lesson1.md)中讲了如何使用 Nodejs 搭建一个简单的 HTTP 服务，这一篇就让我们来实战一下，做个简单的博客系统。

## 功能分析

主要有三个页面，将三个页面的路由及功能划分了一下，如下：

- `http://127.0.0.1:3000/` 博客首页，展示博客列表
- `http://127.0.0.1:3000/detail/:id` 博客详情页，展示博客详情
- `http://127.0.0.1:3000/edit/:id` 博客编辑，支持添加/编辑博文

第二个后面 `/:id`，代表的意思是这个路径是 id ，比如我访问 `http://127.0.0.1:3000/detail/123` ，那么访问的就是 id 为 `123` 的博文详情。第三个同理。

数据存储则选择直接用 json 对象缓存在内存中，先不考虑使用 mongodb 那些数据库服务。

## 具体实现

先根据上面定的路由，简单划分一下逻辑

```js
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
```

可以看到上面的代码中我们将各个响应处理划分到不同的 Controller 方法中。除了业务处理的 `Controller` ，我们还需要有个异常处理的，就先统一为 `notFoundController` ，只要是异常的就抛 404 ，下面是 `notFoundController` 的逻辑，这个方法会在后面的处理中都会用到。

```js
// 404 页面
function notFoundController(req, res) {
  res.writeHead(404);
  res.end(req.url + ' not found!');
}
```

### 博客首页

404 页面也写好之后，就可以步入正题了，来看一下首页的如何来实现，我们可以用个数组 `blogs` 来存储博文，因此首页只需要遍历数组，把各个博文合并成一个列表即可，同时也要添加一下编辑博文以及添加博文的入口。

```js
// 博客首页
function indexController(req, res) {
  res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' });
  res.write('<h1>博客列表</h1>');

  if (blogs.length) {
    // 有博客的情况
    const html = blogs
      .map(blog => {
        // 博客标题
        const blogHtml = `<a href="/detail/${blog.id}">${blog.title}</a>`;
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
```

### 博客详情页

写完首页，然后再来写详情页的处理逻辑，由于我们需要在链接上拿到 id ，又由于我们在详情页和编辑页都需要获取 id ，因此可以把获取 id 的逻辑封装成个方法，可以用个简单的正则来匹配到 id ，同时也可以过滤掉非法的地址：

```js
// 从 pathname 中获取 id
function getIdFromPathname(pathname) {
  // 匹配 /xxx/{number}
  const matches = pathname.match(/^\/\w+\/(\d+)$/);
  return matches ? matches[1] : null;
}
```

然后就可以开始写博客详情页了，我们需要判断一下一些异常情况，比如 id 不存在，比如传入的 id 找不到博客，当遇到这种异常情况的时候，就可以直接抛 404。

```js
// 博客详情页
function detailController(req, res, pathname) {
  const id = getIdFromPathname(pathname);
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog) {
    res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); // 写响应头
    res.end(`<h1>${blog.title}</h1>${blog.content}`);
  }

  // 根据 id 找不到博客，就直接 404
  return notFoundController(req, res);
}
```

### 博客编辑页

写好详情页之后，就到我们相对来说最复杂的博客编辑页了。在这个页面上，我们还得区分请求类型，因为我期望不管是访问编辑页，还是在编辑页中提交数据都用同个地址，因此就得用请求类型来区分两种行为，在 Node 中可以通过 [req.method](https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_message_method) 拿到当前的请求类型。

拿到请求类型后，我们可以判断一下如果是 `GET` 请求则展示页面（ 在浏览器访问某个地址的时候，请求类型就是 GET ），如果是 `POST` 请求则提交文章数据，因此在博客编辑页的 `Controller` 中，我们又可以做一下功能划分

```js
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
```

然后是展示博文编辑页的逻辑，跟前面的只需要展示 html 不一样的是，编辑页还需要写一些 js 来发异步请求。

```js

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
```

可以看到，在前端点提交数据按钮的时候，会创建个 `xhr` 对象，然后发个 `POST` 请求到 Node 服务进行数据提交。而在 Node 服务中就要对该请求做出相关响应。

跟前面的页面渲染的逻辑都不一样的是，在这个 `POST` 请求中是有数据提交的，而当触发我们的请求回调的时候，此时的 `req` 对象里，是只有请求头，没有数据的，因此在我们的处理逻辑中，还需要加一个获取数据的逻辑，而这个逻辑是异步的，所以我们创建一个返回 `Promise` 的方法来获取数据。

```js
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

    // 如果请求数据类型是 json ，就 parse
    if (contentType.startsWith('application/json')) {
      return JSON.parse(text);
    }

    return text;
  });
}
```

获取数据的逻辑，就是通过监听 req 的 `data` 以及 `end` 事件来获取（ 可能有人会问，貌似在 req 的 [Node 文档](https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_class_http_incomingmessage) 中没有看到这两个事件？因为 req 是继承 Node 的可读流 [stream.Readable](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_class_stream_readable) 的，因此数据事件也就是可读流的事件了 ）。

当拿到数据之后，我们就可以继续进行详情页的操作了，而因为我们拿数据的行为是异步的，因此我们的 `Controller` 可以写成 `async` 方法来方便我们写异步操作。

```js
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
```

至此，我们的简易博客就已经完成了。

### XSS 防护

看似我们的页面已经完成了，其实上面的代码有一个很大的漏洞，因为我们提供了给用户录入数据的功能，用户录入的 `title` 还有 `content` 我们都需要展示在页面上，上面的首页和详情页代码都是直接将 `title` 拼在 html 中输出的，其实这样是有很大风险的。

如果用户在编辑页的输入框中输入以下内容（ 你们也可以试一下 ）

```js
<script>alert(document.cookie)</script>
```

然后点提交数据，再访问详情页的时候，就会发现你的页面稳定会弹出一个打印了你页面 cookie 的窗口，这就是典型的 xss 注入，因此我们需要写个方法在拼 html 的时候，对这些敏感的数据进行转义：

```js
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
```

通过 `escapeHtml` 方法就将所有敏感的字符都转义，然后我们可以改一下详情页和列表页的代码

```js
// 首页
... 
const blogHtml = `<a href="/detail/${blog.id}">${escapeHtml(blog.title)}</a>`;
...
```

```js
// 详情页
... 
res.end(`<h1>${escapeHtml(blog.title)}</h1>${escapeHtml(blog.content)}`);
...
```

## 结尾

至此，这个博客的搭建也就完成了，当然，这个博客还是相当简陋的，有很多异常情况都是没有考虑的，比如请求的数据合法性问题，比如不支持删除博客，比如数据没有落盘，每次应用重启都会消失等等...这些就有兴趣的可以自行一边补充一边学习啦~

---

以上代码可以在 [这里](./demo/httptest.2.js) 看到。单测则在 [这里](./demo/__tests__/httptest.2.js) 可以看到

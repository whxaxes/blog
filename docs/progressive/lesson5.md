# 简易博客 - 静态资源服务

随着我们的博文系统越来越多功能，前端可能要承载的逻辑也会越来越多，而目前来说，我们的前端 js 代码都是 hardcode 写在了 node 中，不易于维护，所以我们需要将我们 js 、css 或者之后可能会有图片之类的以外链的形式来引入，于是我们就需要一个静态资源服务。

## 静态资源中间件

首先我们得针对静态资源设置个中间件，将 `/static/` 下的所有请求，都在静态资源中间件里拦掉并且处理。

```js
...
app.use(staticHandle); // 静态资源中间件
app.use(accountHandle); // 登录态判断
...

// 静态资源中间件
function staticHandle(ctx, next) {
  ...
}
```

可能有人会疑惑，我们不是有 `router` 功能吗，为什么要把静态资源处理写成一个中间件，而不是一个 controller 呢？因为静态资源不需要跟常规路由那样，经过账号系统中间件的处理，经过请求数据中间件的处理，因此直接将静态资源服务作为个中间件插入到业务处理中间件的最前面是最合适的，当然，更合适的是用另一个服务来专门承载静态资源，比如 `cdn` ，当然在本项目中就直接在当前服务用个中间件来处理就行了。

紧接着我们在项目目录下新建个目录就叫 `static` ，同时也在 static 目录下新建一个 js 文件 `index.js` 。

```js
// static/index.js

console.info('hello');
```

我们就可以写静态路由里的逻辑了。先创建一个对象存储我们需要支持的静态资源的所有 mime 类型。

```js
const mimes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};
```

基本上以上几个资源类型，就完全够我们这个系统用了，由于新增了类型，我们原来的 `ctx.type` 的逻辑也要做一些小修改了，改成允许其他类型。

```js
// 请求开始
async function startHandle(ctx, next) {
  ...

  // 写状态码
  ctx.res.writeHead(ctx.status, { 'Content-Type': `${mimes[ctx.type] || ctx.type}; charset=utf-8` });
  
  ...
}
```

再接下来就可以写中间件里的逻辑了

```js
// 静态资源路由
const staticDir = path.resolve(__dirname, './static/');
async function staticHandle(ctx, next) {
  if (!ctx.pathname.startsWith('/static/')) {
    return await next();
  }

  // 获取到资源路径
  const requestPath = ctx.pathname.substring('/static/'.length);
  const resourcePath = path.join(staticDir, requestPath);

  // 获取请求路径的后缀名
  const extname = path.extname(resourcePath);

  // 不支持的资源类型 或 文件不存在
  if (!mimes[extname] || !fs.existsSync(resourcePath)) {
    return;
  }

  // 将 type 设置为对应的资源类型
  ctx.type = mimes[extname];

  // 读文件
  ctx.body = fs.readFileSync(resourcePath, { encoding: 'utf-8' });
}
```

可以看到，我们通过 `path` 模块获取到请求的资源在 `static` 目录下的路径，同时根据 `pathname` 拿到资源的拓展名，判断一下 `mimes` 中有无支持该拓展名的类型，如果有就直接读文件写到 `body` 中即可。

然后我们就可以把博客编辑页里的 js 逻辑抽离成文件了，将原来编辑页里的提交数据的 js 逻辑抽离为 `static/submitBlog_1.js` ，然后改一下博客编辑页路由的逻辑，改成通过 script 标签外链引入这个 js 文件即可。

```js
// 博客编辑页
function showEditPage(ctx) {
  const id = ctx.params.id;
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog && ctx.userInfo.accountId !== blog.accountId) {
    return;
  }

  // 将 blogId 传成 window.blogId ，然后才能在外链 js 中获取
  ctx.body = `
    <script>window.blogId = ${blog ? blog.id : 'null'}</script>
    <script src="/static/submitBlog_1.js"></script>
    <p>标题：<input id="title" type="text" placeholder="输入博客标题" value="${blog ? blog.title : ''}"></p>
    <p>内容：<textarea id="content" placeholder="输入内容">${blog ? blog.content : ''}</textarea></p>
    <p><button onclick="submitBlog()">提交数据</button></p>
  `;
}
```

## 资源缓存

实现静态资源服务之后，我们访问上面更新为远链的博客编辑页，然后打开 devtool 里的 network 就可以看到 js 的加载了，但是我们会发现有个问题，其实很多时候我们的静态资源都是不变的，而每次打开页面都得重新去下载，这样效率未免太低了，因此我们可以在静态资源服务上加上 HTTP 缓存。

HTTP 缓存主要需要关注以下几个请求头/响应头

- **`If-Modified-Since`** 请求头，表示客户端里缓存的资源的更新时间（ 也就是此前服务端响应给客户端的 `Last-Modified` ） [详细文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since)
- **`If-None-Match`** 请求头，表示客户端里缓存的资源上次响应的 ETag 。[详细文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
- **`Cache-Control`** 作为请求头的时候，如果设置为 `no-cache` ，服务端响应的时候不做缓存判断，作为响应头的时候，可以告诉客户端该资源需要缓存多久 。[详细文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- **`Last-Modified`** 响应头，用于告诉客户端该资源的最后更新时间，然后客户端在下次发请求的时候会放到 `If-Modified-Since` 中。[详细文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified)
- **`ETag`** 响应头，表示资源特定版本的标识符，如果需要强校验，一般就是资源的 md5 ，如果是弱校验，则可以是资源的更改时间之类的。[详细文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)

简单梳理一下整个缓存的流程就是

1. 接收到静态资源请求;
2. 判断 `Cache-Control` ，如果是 `no-cache`，则跳过第三步，否则进入第三步；
3. 拿请求头里的 `If-None-Match` 来跟本地资源的 md5 做比较看是否一致，同时拿请求头里的 `If-Modified-Since` 来跟本地资源的最后更改时间做比较是否一致，两者只要有一个不一致的，则认为资源过期，进入第四步，如果都一致，则只需要返回响应码 304 ，响应结束;
4. 读取资源数据，计算 md5 并设置到响应头 `ETag` 中，获取资源的最后更改时间并设置到 `Last-Modified` 中，设置 `Cache-Control` 响应头为 `max-age=31536000, public` 让客户端缓存一年，写数据 & 设置响应码为 200 ，响应结束。

然后为了让逻辑更清晰，我们把上面的缓存流程单独成一个方法 `staticCache` 来处理。

```js
// http 缓存
async function staticCache(ctx, resourcePath) {
  const fileContent = fs.readFileSync(resourcePath);
  const fileStat = fs.statSync(resourcePath);

  // 计算文件 MD5
  const fileMd5 = crypto.createHash('md5').update(fileContent).digest('hex');
  const cacheControl = ctx.req.headers['cache-control'];

  // 判断是否 no-cache
  let isOutdated = cacheControl === 'no-cache';
  if (!isOutdated) {
    const reqETag = ctx.req.headers['if-none-match'];
    const mtime = ctx.req.headers['if-modified-since'];

    // 多个 etag 会用半角逗号相隔
    const etagIsMatch = reqETag && reqETag.split(/ *, */).includes(fileMd5);

    // 文件更新时间，由于保存到客户端的更新时间是精确到秒的
    // 所以判断之前也将文件的更新时间精确到秒
    const fileMTime = ~~(+fileStat.mtime / 1000);

    // 判断 mtime 是否过期
    const isNotModified = mtime && (+new Date(mtime) >= fileMTime);

    isOutdated = !etagIsMatch || !isNotModified;
  }

  if (!isOutdated) {
    // 如果资源未过期，直接设置 304
    ctx.status = 304;
    return;
  }

  // 设置相关响应
  ctx.res.setHeader('ETag', fileMd5);
  ctx.res.setHeader('Last-Modified', fileStat.mtime.toUTCString());
  ctx.res.setHeader('Cache-Control', 'max-age=31536000, public');
  ctx.body = fileContent;
}
```

上面的代码中涉及到了 Node 的一个内置模块 [crypto](https://nodejs.org/dist/latest-v10.x/docs/api/crypto.html) ，里面提供了非常多常用的加密算法，是经常需要用到的内置模块，而计算 md5 也就是用到了其中的 `crypto.createHash` 来创建一个 `md5` 的 hash 算法对象，根据文本内容计算出来个 128 位的散列值，就作为资源的版本标识了。

紧接着我们再改一下此前的 `staticHandle` 逻辑，改成调用 `staticCache` 即可

```js
// 静态资源中间件
async function staticHandle(ctx, next) {
  ...

  await staticCache(ctx, resourcePath);
}
```

完成以上功能之后，我们访问一下 `http://127.0.0.1:3000/static/submitBlog_1.js` ，打开 devtool 就可以看到，第一次请求是 200 ，刷新之后 `status` 就是 304 了。

上面的缓存功能，只是简单实现了 http 的缓存机制，但是也还是存在优化的点，比如每次都要读文件算 md5 以做一下缓存。有兴趣的自行实现。

## 资源压缩

平时为了提升我们静态资源服务的效率，还会使用 gzip 对静态资源进行压缩后再返回，一般情况下文本文件经过 gzip 后大概能压缩至原有体积的 1/3 ，因此我们也来给这个静态资源服务加一下资源压缩即可。

在 Node 的内置模块 `zlib` 中就提供了 `gzip` 的压缩功能，可以通过 [zlib.gzipSync](https://nodejs.org/dist/latest-v10.x/docs/api/zlib.html#zlib_zlib_gzipsync_buffer_options) 方法来进行压缩

```js
// http 缓存
async function staticCache(ctx, resourcePath) {
  ...

  // 添加 gzip
  const acceptEncoding = (ctx.req.headers['accept-encoding'] || '').split(/ *, */);
  if (acceptEncoding.includes('gzip')) {
    const gzipContent = zlib.gzipSync(fileContent);
    ctx.body = gzipContent;
    ctx.res.setHeader('Content-Encoding', 'gzip');
    return;
  }

  ctx.body = fileContent;
}
```

在使用资源压缩之前，需要先判断一下客户端支持的压缩类型，可以通过请求头中的 `Accept-Encoding` 来判断，如果支持多个压缩类型的话，就会用逗号相隔，比如

```
Accept-Encoding: gzip, deflate
```

上面的 deflate 压缩类型在 zlib 中也是有可以直接使用的方法的，在这里就先不实现了。而相应的，在响应头中也要通过 `Content-Encoding` 来告诉客户端这个资源是用的什么压缩类型。

## 大文件处理

我们的静态资源服务中，有可能会存一些很大的文件，比如一些几十上百 M 的图片，如果按照上面的逻辑，将这些资源全部读到内存中，然后再输出，当有大量并发请求不同的大图片的时候，服务器内存就得分分钟耗光了。所以我们可以通过流来缓解服务器的内存压力（ 对于流，可以看 [这篇文章](https://juejin.im/post/5940a9c3128fe1006a0ab176) ）。

所以我们可以对我们的资源服务进行优化，将读取的文件数据在算出来 MD5 之后就清掉，然后写到 body 的是一个可读流。

```js
// http 缓存
async function staticCache(ctx, resourcePath) {
  let fileContent = fs.readFileSync(resourcePath);
  const fileStat = fs.statSync(resourcePath);

  // 计算文件 MD5
  const fileMd5 = crypto.createHash('md5').update(fileContent).digest('hex');

  // 计算完就清掉 buffer
  fileContent = null;

  ...

  // 创建文件可读流
  const fileStream = fs.createReadStream(resourcePath);

  // 添加 gzip
  const acceptEncoding = (ctx.req.headers['accept-encoding'] || '').split(/ *, */);
  if (acceptEncoding.includes('gzip')) {
    const gzip = zlib.createGzip();

    // 将文件流 pipe 到 gzip 中
    ctx.body = fileStream.pipe(gzip);
    ctx.res.setHeader('Content-Encoding', 'gzip');
    return;
  }

  // body 设置为流
  ctx.body = fileStream;
}
```

当然，如果是更大的文件，我们可以在算 md5 那一块也用流来实现并计算，再或者直接不设置 etag ，或者设置 weak etag，再或者仅通过 `if-modified-since` 来实现简易缓存。


至此，我们的简易静态资源服务就已经做好了~

---

本文的代码可以看 [这里](./demo/httptest.5.js)，单测代码可以看 [这里](./demo/__tests__/httptest.5.js)

const http = require('http');
const url = require('url');
const stream = require('stream');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const querystring = require('querystring');

// mime
const mimes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};

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

function pathToRegexp(rule) {
  const keys = [];
  const regExpStr = rule
    .replace(/\(/, '(?:') // 将 (xxx) 转换成 (?:xxx)，以防被捕获
    .replace(/\/:(\w+)/, (_, k) => {
      // 将 /:id 转成 /(\\w+)
      keys.push(k); // 将 id 这个字符塞入到 keys 中，以便后面匹配到的值跟 key 对得上
      return '/(\\w+)';
    })
    .replace(/\*/, '.*'); // 将 * 转换成 .*

  return {
    ruleRE: new RegExp(`^${regExpStr}$`), // 将上面转换后的正则字符，转换成正则
    keys,
  };
}

// 获取 cookie
function getCookie(ctx, key) {
  if (!ctx.cookie) {
    // 用来保存 cookie 的 k-v
    ctx.cookie = {};

    // 拿到 cookie 的字符串
    const cookieStr = ctx.req.headers.cookie || '';

    // 通过 replace 收集 cookie 的 key 和 value
    cookieStr.replace(/([\w\.]+)=([^;]+)(?:;|$)/g, (_, key, value) => {
      ctx.cookie[key] = value;
    });
  }

  // 返回对应 value
  return ctx.cookie[key];
}

// 设置 cookie
function setCookie(ctx, key, val, opt = {}) {
  const setCookie = ctx.res.getHeader('Set-Cookie') || [];
  setCookie.push(
    [
      `${key}=${val}`,
      opt.path ? `path=${opt.path}` : '/',
      opt.expires ? `expires=${opt.expires}` : '',
      opt.httponly ? 'httponly' : '',
      opt.secure ? 'secure' : '',
      opt.domain ? `domain=${opt.domain}` : '',
      opt.maxAge ? `max-age=${opt.maxAge}` : '',
    ]
      .filter(k => !!k) // 过滤空参数
      .join(';')
  );
  ctx.res.setHeader('Set-Cookie', setCookie);
}

function redirect(ctx, url) {
  // 设置响应码为 302
  ctx.status = 302;

  // 设置重定向地址
  ctx.res.setHeader('Location', url);

  // 写一下响应数据为 Redirecting
  url = escapeHtml(url);
  ctx.body = `Redirecting to <a href="${url}">${url}</a>`;
}

// 博客列表，添加 accountId 区分用户
const blogs = [
  {
    id: '123',
    title: '我是标题',
    content: '666',
    accountId: '1',
  },
];

// 数组里的每一个值都代表一个账号，先随便加个账号
const accounts = [
  {
    accountId: '1', // 用户 id
    nickname: 'axes', // 用户昵称
    username: '123', // 用户名
    password: '123', // 密码
  },
  {
    accountId: '2', // 用户 id
    nickname: 'whx', // 用户昵称
    username: '111', // 用户名
    password: '123', // 密码
  },
];

// 登录信息，key 为 sessionId ，value 为用户信息
const sessionStore = {
  // 12312312: {
  //   accountId: '1',     // 用户 id
  //   createTime: 1542958796390, // 创建时间
  // }
};

class Router {
  constructor() {
    this.rules = [];

    // 支持的请求类型
    this.supportMethods = [ 'get', 'post', 'options', 'delete', 'put' ];

    // 给 Router 对象加上请求类型的方法
    this.supportMethods.forEach(method => {
      this[method] = this.register.bind(this, [ method ]);
    });

    // 加上 all 方法，代表支持所有请求
    this.all = this.register.bind(this, this.supportMethods);
  }

  register(methods, rule, controller) {
    // 将每个规则塞入数组
    this.rules.push({
      methods,
      controller,
      ...pathToRegexp(rule),
    });
  }

  async handle(ctx, next) {
    // 获取 pathname
    const pathname = ctx.pathname;

    // 遍历保存的路由规则
    for (let i = 0; i < this.rules.length; i++) {
      const { methods, ruleRE, keys, controller } = this.rules[i];

      // 当请求类型匹配，同时能匹配上路由规则的时候才继续
      const result = methods.includes(ctx.method) && ruleRE.exec(pathname);
      if (!result) {
        continue;
      }

      // 如果规则中是 /:id ，这里就将匹配到的值，跟 id 对应起来
      const params = {};
      keys.forEach((item, index) => {
        params[item] = result[index + 1];
      });

      // 调用保存的 controller ，然后退出循环
      ctx.params = params;
      await controller(ctx);
      break;
    }

    await next();
  }
}

// 中间件系统
const app = {
  middleware: [],

  use(mid) {
    // 添加一个中间件
    this.middleware.push(mid);
  },

  async handle(req, res) {
    // 创建个上下文对象
    const context = { req, res };

    // 开始对中间件的遍历
    let i = 0;
    const traverseMid = async () => {
      // 拿到当前遍历到的中间件
      const mid = this.middleware[i++];
      if (!mid) return;

      // 将当前上下文对象传入中间件，并且传入执行下一个中间件的 async 方法
      await mid(context, traverseMid);
    };

    await traverseMid();
  },
};

// 创建路由实例
const router = new Router();

// 配置中间件
app.use(startHandle); // 请求开始
app.use(errorHandle); // 错误处理
app.use(staticHandle); // 静态资源中间件
app.use(accountHandle); // 登录态判断
app.use(bodyHandle); // 请求/响应数据处理
app.use(router.handle.bind(router)); // 路由功能

// 静态资源中间件
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
  await staticCache(ctx, resourcePath);
}

// http 缓存
async function staticCache(ctx, resourcePath) {
  let fileContent = fs.readFileSync(resourcePath);
  const fileStat = fs.statSync(resourcePath);

  // 计算文件 MD5
  const fileMd5 = crypto.createHash('md5').update(fileContent).digest('hex');
  fileContent = null;
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

  // 添加 gzip
  const fileStream = fs.createReadStream(resourcePath);
  const acceptEncoding = (ctx.req.headers['accept-encoding'] || '').split(/ *, */);
  if (acceptEncoding.includes('gzip')) {
    const gzip = zlib.createGzip();
    ctx.res.setHeader('Content-Encoding', 'gzip');
    ctx.body = fileStream.pipe(gzip);
    return;
  }

  ctx.body = fileStream;
}

// 登录中间件
async function accountHandle(ctx, next) {
  // 获取 sessionId
  const sessionId = getCookie(ctx, '__session_id__');
  const sessionInfo = sessionId && sessionStore[sessionId];
  const userInfo = sessionInfo && accounts.find(user => user.accountId === sessionInfo.accountId);

  if (ctx.pathname !== '/login') {
    if (!userInfo) {
      // 未登录
      return redirect(ctx, '/login');
    }
  } else if (userInfo) {
    // 已登录又访问 login ，重定向到首页
    return redirect(ctx, '/');
  }

  // 保存用户数据到上下文对象
  ctx.userInfo = {
    ...userInfo,
    sessionId,
  };

  await next();
}

// 错误处理
async function errorHandle(ctx, next) {
  await next().catch(e => {
    console.error(e);
    ctx.status = 500;
    ctx.body = e.message;
  });
}

// 请求开始
async function startHandle(ctx, next) {
  const startTime = Date.now();
  ctx.status = null; // 用于记录响应码
  ctx.body = ''; // 用于记录响应数据
  ctx.method = ctx.req.method.toLowerCase(); // method 转成小写
  const urlObj = url.parse(ctx.req.url);
  ctx.pathname = urlObj.pathname; // 给上下文对象添加个 pathname 的属性
  ctx.query = urlObj.query; // 给上下文对象添加个 query 的属性
  ctx.type = 'html'; // 响应类型，默认为 html
  const mimes = { html: 'text/html', json: 'application/json', plain: 'text/plain' };

  await next();

  // 如果没有设置 body ，也没有设置 status ，默认为 404
  ctx.status = ctx.status ? ctx.status : ctx.body ? 200 : 404;

  // 写状态码
  ctx.res.writeHead(ctx.status, { 'Content-Type': `${mimes[ctx.type] || ctx.type}; charset=utf-8` });
  // 写响应
  if (ctx.body && ctx.body instanceof stream.Stream) {
    // body 可以直接设置为流
    ctx.body.pipe(ctx.res);
  } else {
    // 普通 json 对象或者字符串
    let body = '';
    try {
      // 防止 stringify 出错，start 中不能出错，因为 errorHandle 在该中间件后面
      body = ctx.body && ((typeof ctx.body === 'string' || ctx.body instanceof Buffer)
        ? ctx.body : JSON.stringify(ctx.body));
    } catch (e) {
      body = '';
      console.error(e);
    }
    ctx.res.end(body);
  }

  // 打印 accesslog
  console.info(`request ${ctx.pathname} ${ctx.status}, cost ${Date.now() - startTime}ms`);
}

// 请求数据处理
async function bodyHandle(ctx, next) {
  ctx.requestBody = ctx.req.method === 'POST' ? await getDataFromReq(ctx.req) : {};

  await next();
}

// 路由配置
router.get('/', indexController);
router.get('/detail/:id', detailController);
router.get('/edit(/:id)?', showEditPage);
router.post('/edit(/:id)?', submitBlog);
router.get('/login', loginPageController);
router.post('/login', loginController);
router.get('/logout', logoutController);

// 退出登录
function logoutController(ctx) {
  delete sessionStore[ctx.userInfo.sessionId];
  redirect(ctx, '/');
}

// 登录页
function loginPageController(ctx) {
  ctx.body = `
    <form action="/login" method="post">
      <p><input type="text" name="username" placeholder="请输入用户名" /></p>
      <p><input type="password" name="password" placeholder="请输入密码" /></p>
      <p><button type="submit">登录</button></p>
    </form>
  `;
}

// 登录逻辑
function loginController(ctx) {
  const { username, password } = ctx.requestBody;

  // 验证账号密码
  const user = accounts.find(account => account.username === username);
  if (!user || user.password !== password) {
    ctx.body = '用户名或密码错误';
    return;
  }

  // 登录成功，随机生成个 sessionId
  const sessionId = `${Date.now()}${Math.random() * 99999 + 10000}`;

  // 判断该账号是否已经有登陆态，有的话就删掉
  Object.keys(sessionStore).forEach(k => {
    if (sessionStore[k].accountId === user.accountId) {
      delete sessionStore[k];
    }
  });

  // 保存新的 session
  sessionStore[sessionId] = {
    accountId: user.accountId,
    createTime: Date.now(),
  };

  // 设置 cookie
  const oneDay = 24 * 60 * 60 * 1000;
  setCookie(ctx, '__session_id__', sessionId, {
    expires: new Date(Date.now() + oneDay).toUTCString(), // 过期时间
    httponly: true,
  });

  // 重定向到首页
  redirect(ctx, '/');
}

// 博客首页
function indexController(ctx) {
  ctx.body = '<h1>博客列表</h1>';

  if (blogs.length) {
    // 有博客的情况
    const html = blogs
      .map(blog => {
        // 获取作者信息
        const author = accounts.find(account => account.accountId === blog.accountId);
        // 博客标题
        const blogHtml = `<a href="/detail/${blog.id}">${escapeHtml(blog.title)}，作者：${escapeHtml(author.username)}</a>`;
        // 博客编辑
        const editHtml = blog.accountId === ctx.userInfo.accountId
          ? `<a href="/edit/${blog.id}">编辑</a>`
          : '';
        // 合并 html
        return `<p>${blogHtml} &nbsp;&nbsp; ${editHtml}</p>`;
      })
      .join('');

    ctx.body += html;
  } else {
    // 没有博客的情况
    ctx.body += '<p>暂无博客</p>';
  }

  // 结束响应，顺便加个添加博客入口
  ctx.body += '<p><a href="/edit">添加博客</a></p>';

  // 添加退出登录入口
  ctx.body += '<p><a href="/logout">退出登录</a></p>';
}

// 博客详情页
function detailController(ctx) {
  const id = ctx.params.id;
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog) {
    // 获取作者信息
    const author = accounts.find(account => account.accountId === blog.accountId);

    ctx.body = [
      '<p><a href="/">回首页</a></p>',
      `<h1>${escapeHtml(blog.title)}</h1>`,
      `<p>作者：${escapeHtml(author.nickname)}</p>`,
      `${escapeHtml(blog.content)}`,
    ].join('');
  }
}

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

    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      // form 表单提交
      return querystring.parse(text);
    } else if (contentType.startsWith('application/json')) {
      // post json 数据
      return JSON.parse(text);
    }

    return text;
  });
}

// 博客编辑接口
let uniqId = 0;
async function submitBlog(ctx) {
  const id = ctx.params.id;
  let blog = id && blogs.find(blog => blog.id === id);
  if (blog && ctx.userInfo.accountId !== blog.accountId) {
    return;
  }

  if (blog && blog.id) {
    // 有 id ，说明是更新博文
    blog.title = ctx.requestBody.title;
    blog.content = ctx.requestBody.content;
  } else {
    // 无 id，说明是添加新博文
    blog = {
      id: `${Date.now()}${uniqId++}`, // 以时间戳作为 id
      title: ctx.requestBody.title,
      content: ctx.requestBody.content,
      accountId: ctx.userInfo.accountId, // 添加用户 id
    };

    blogs.push(blog);
  }

  // 这里的 content-type 就是写 json 的 mime
  ctx.type = 'json';
  ctx.body = { id: blog.id };
}

const server = http.createServer((req, res) => {
  app.handle(req, res);
});

// 监听 3000 端口
server.listen(3000, () => {
  // 服务启动完成的时候会触发该回调，打印日志
  console.info('server listening in', server.address().port);
});

module.exports = server;

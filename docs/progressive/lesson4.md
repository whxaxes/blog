# 简易博客 - 账号系统

在此前的文章中，我们的博客系统已经具备了足够的路由能力，中间件能力，已经具备基础的拓展功能来方便我们为其拓展更多功能。因此这篇文章就来给它加一下账号系统。

## 数据结构

当需要新增登录态，我们就得重新制定一下此前用来保存博客的 `blogs` 对象的结构，得对博文新增一个 `accountId` 的参数用来标识该文章是哪个用户写的，还要增加两个变量用来存储账号信息，以及登录信息

```js
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
    accountId: '1',  // 用户 id
    nickname: 'axes', // 用户昵称
    username: '123', // 用户名
    password: '123', // 密码
  }
];

// 登录信息，key 为 sessionId ，value 为用户信息
const sessionStore = {
  // 12312312: {
  //   accountId: '1',     // 用户 id
  //   createTime: 1542958796390, // 创建时间
  // }
};
```

定好数据结构后，我们还需要新增两个路由，一个用于展示登录页，一个用于登录校验逻辑，先简单实现，后面再细讲

```js
router.get('/login', loginController);
router.post('/login', loginController);

// 登录页
function loginPageController(ctx) {
  ctx.body = '登录页';
}

// 登录逻辑
function loginController(ctx) {
  ctx.body = 'ok';
}
```

## 登录态中间件

除了登录页之外，我们还需要写个中间件来拦截没有登录态的请求，也就是除了 `/login` 之外的所有请求都需要拦掉，而怎么判断登录态呢？就是通过 `cookie` ，当我们登录成功的时候，会将 `sessionId` 种到 `cookie` 中，而中间件的拦截逻辑，就是判断请求中的 `cookie` 有无登录态的 `sessionId` ，同时也要判断该 `sessionId` 是有效的。

在实现中间件之前，我们先创建一个获取指定 `cookie` 的方法来方便复用，`cookie` 都是在请求的 header 中的，因此只要通过 `req.headers.cookie` 就可以拿到 `cookie` 的字符串，然后用正则匹配一下即可。

```js
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
```

有了拿 cookie 的方法，我们还需要再实现一个重定向的方法，因为当未登录用户访问需要登录态的页面的时候我们需要让他重定向到登录页，而重定向是什么意思呢？就是将当前请求转发到另一个 url 上，按照规范我们只要设置响应码为 `302` 或者 `301` ，并且在响应头中设置 `Location` 为要转发的 url，浏览器接收到响应后，就会重新对要转发的 url 发起请求。

实现如下

```js
function redirect(ctx, url) {
  // 设置响应码为 302
  ctx.status = 302;

  // 设置重定向地址
  ctx.res.setHeader('Location', url);

  // 写一下响应数据为 Redirecting
  url = escapeHtml(url);
  ctx.body = `Redirecting to <a href="${url}">${url}</a>`;
}
```

当设置为 302 ，浏览器就会重定向请求了，如果设置为 301 ，浏览器就会缓存该次重定向，因为 301 代表永久重定向，下次就直接请求新的。因为我们这个重定向是不需要浏览器记住的，因此直接用 302 即可。

完成重定向方法后，现在终于可以正式写我们的登录态判断的中间件了。

```js
app.use(errorHandle); // 错误处理
app.use(accountHandle); // 登录态判断，放在错误处理后面，路由中间件前面
...

// 登录中间件
async function accountHandle(ctx, next) {
  // 获取 sessionId
  const sessionId = getCookie(ctx, '__session_id__');
  const sessionInfo = sessionId && session[sessionId];

  // 获取用户信息
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
```

可以看到，如果用户访问的不是登录页，则判断是否登录了，如果未登录就重定向到登录页，如果已经登录又访问登录页就重定向到首页，然后就是正常已经登录的访问了，将拿到的用户信息保存在上下文对象中。

这下，根据上面更新的代码更改一下，发现只要访问非 `/login` 地址，都会被重定向到 `/login` 了，接下来就来实现登录页的登录逻辑。

## 登录页面

登录页面就跟博客首页一样，直接写 html 数据即可，为了简单，我们直接用个 `form` 做 post 表单提交。

```js
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
```

然后这个的提交地址，就是我们的登录逻辑处理页了，由于这个是表单，跟 [博客实战 1.0](./lesson2.md) 中的异步 post 请求数据的获取方式不太一样，我们需要改造一下 `getDataFromReq` 方法来支持获取 `form` 表单数据。

```js
const querystring = require('querystring');
...

function getDataFromReq(req) {
  ...

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
```

之前我们拿数据，判断了 contentType 是否为 `application/json`，现在 form 表单提交的话，`content-type` 又会是另一个，如果 `content-type` 是 `application/x-www-form-urlencoded`，就是这样的

```
username=11&password=11
```

也就是 `querystring` 的格式，所以我们用 Node 的官方库 `querystring` 来解析这个字符串。

当然，form 表单提交的数据还有其他很多很多种类型，比如如果是 `multipart/form-data` 就是另一种更复杂一些的数据类型，是用于文件上传的，之后如果做头像上传，再来细讲该类型，如果对 form 表单提交的数据类型有兴趣，可以自行网上搜索相关文档学习。

## 登录校验

当我们的数据获取功能支持表单数据解析之后，在我们的登录逻辑页里就可以拿到用户提交的 `username` 还有 `password` 进行身份校验了，具体逻辑如下

```js
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

  // 判断该账号是否已经有，有的话就删掉
  Object.keys(session).forEach(k => {
    if (session[k].accountId === user.accountId) {
      delete session[k];
    }
  });

  // 保存新的 session
  session[sessionId] = {
    accountId: user.accountId,
    createTime: Date.now(),
  };

  // 设置 cookie ，过期时间为一天
  const oneDay = 24 * 60 * 60 * 1000;
  const cookieValue = [
    `__session_id__=${sessionId}`, // cookie 的 k-v
    'path=/', // 有效路径
    'expires=' + new Date(Date.now() + oneDay).toUTCString(), // 过期时间
    'httponly', // 只有 http 请求才生效，即不用通过 js 拿到
  ].join(';');

  ctx.res.setHeader('Set-Cookie', cookieValue);

  // 重定向到首页
  redirect(ctx, '/');
}
```

可以看到上面的逻辑，根据请求数据拿到提交的用户名和密码，然后验证账号密码，如果验证通过，就随机生成个 sessionId ，用来存储用户的登录信息，同时也要判断一下账号是否在其他设备登录过，如果登录过就删掉原有的登录态，保存 session 之后就将 sessionId 写到 `cookie` 中。

写 cookie 就直接在 `response` 中设置 `Set-Cookie` 的响应头就行，然后每个 cookie 都可以设置一些参数，cookie 和这些参数都是 `k=v` 或者 `k` 的格式，然后用 `;` 号间隔起来。比如上面的登录态 cookie 就是

```
Set-Cookie: __session_id__=123123;path=/;expires=1542986661027;httponly
```

其中 `path` 是 cookie 的有效路径，`/` 代表所有路径都生效，expires 代表 cookie 的过期时间，`httponly` 代表该 cookie 仅在 http 请求下生效，也就是在前端用 `document.cookie` 拿不到。其实还有其他参数像 `secure` 代表该 cookie 仅在 https 下生效，还有 `domain` 代表该 cookie 生效的域（ 默认为当前域 ）等，可以自行翻阅[文档](https://developer.mozilla.org/fr/docs/Web/HTTP/Headers/Set-Cookie)了解更多

如果需要设置多个 `cookie` ，则在 setHeader 的时候传入个数组即可

```js
ctx.res.setHeader('Set-Cookie', [ cookie1, cookie2, cookie3 ]);
```

有一点注意的是，如果调用多次 `setHeader('Set-Cookie')` ，后调用的 cookie 设置会覆盖前面设置的，因为 Node 中的源码 header 是以 `k-v` 的形式保存的，因此后面调用就会覆盖前面的，然而很多时候，我们可能需要在各个中间件里，或者 controller 中设置 cookie ，因此需要先拿到当前 response header 中的 `Set-Cookie` 来做合并，因此这个设置 cookie 可以抽离出来一个单独的通用方法：

```js
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
      .join('; ')
  );
  ctx.res.setHeader('Set-Cookie', setCookie);
}
```

然后上面登录成功的 cookie 设置就可以改成这样

```js

// 登录逻辑
function loginController(ctx) {
  ...

  // 设置 cookie
  const oneDay = 24 * 60 * 60 * 1000;
  setCookie(ctx, '__session_id__', sessionId, {
    expires: new Date(Date.now() + oneDay).toUTCString(), // 过期时间
    httponly: true,
  });

  // 重定向到首页
  redirect(ctx, '/');
}
```

## 博文功能修改

完成上面的流程之后，我们还得对我们的博文读写要做一些小修改，因为目前的博文要绑定用户 id 了，所以我们展示博文以及添加博文的时候，都得加上一些用户的信息。

博客首页，在遍历 `blogs` 数组的时候，要加个判断，只有是当前用户的博客，才展示编辑按钮。同时所有博文都添加个用户名（不要忘记 escape 一下哦）。

```js
function indexController(ctx) {
  ...
    const html = blogs
      .map(blog => {
        // 获取作者信息
        const author = accounts.find(account => account.accountId === blog.accountId);
        // 博客标题，新增作者名
        const blogHtml = `<a href="/detail/${blog.id}">${escapeHtml(blog.title)}，作者：${escapeHtml(author.username)}</a>`;
        // 博客编辑
        const editHtml = blog.accountId === ctx.userInfo.accountId
          ? `<a href="/edit/${blog.id}">编辑</a>`
          : '';
        // 合并 html
        return `<p>${blogHtml} &nbsp;&nbsp; ${editHtml}</p>`;
      })
      .join('');
  ...
}
```

博客详情页也可以加一下用户名

```js
// 博客详情页
function detailController(ctx) {
  const id = ctx.params.id;
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog) {
    // 获取作者信息
    const author = accounts.find(account => account.accountId === blog.accountId);

    ctx.body = [
      `<h1>${escapeHtml(blog.title)}</h1>`,
      `<p>作者：${escapeHtml(author.nickname)}</p>`,
      `${escapeHtml(blog.content)}`,
    ].join('');
  }
}
```

博客编辑页则要判断一下这个文章是否当前用户的，不是的话直接不给访问

```js

// 博客编辑页
function showEditPage(ctx) {
  const id = ctx.params.id;
  const blog = id && blogs.find(blog => blog.id === id);
  if (blog && ctx.userInfo.accountId !== blog.accountId) {
    return;
  }

  ...
}
```

而博客文章提交/编辑也要加判断，同时在保存文章的时候还要加上用户信息

```js
// 博客编辑接口
let uniqId = 0;
async function submitBlog(ctx) {
  const id = ctx.params.id;
  let blog = id && blogs.find(blog => blog.id === id);
  if (blog && ctx.userInfo.accountId !== blog.accountId) {
    return;
  }

  ...
    // 无 id，说明是添加新博文
    blog = {
      id: `${Date.now()}${uniqId++}`, // 以时间戳作为 id
      title: ctx.requestBody.title,
      content: ctx.requestBody.content,
      accountId: ctx.userInfo.accountId, // 添加用户 id
    };

  ...
}
```

## 退出登录

最后，我们还得加个退出登录功能，退出登录直接再注册一个路由 `/logout`

```js
router.get('/logout', logoutController);

// 退出登录
function logoutController(ctx) {
  delete sessionStore[ctx.userInfo.sessionId];
  redirect(ctx, '/');
}
```

退出登录就很简单了，直接把当前的登录 session 删除掉即可，然后重定向到登录页。

当然，我们还要在首页加个 `logout` 的按钮

```js
// 添加退出登录入口
ctx.body += '<p><a href="/logout">退出登录</a></p>';
```

至此，博文系统的登录态功能就做好了，有没有发现少了个注册功能，这个就当作业，有兴趣的自行实现~

---

上面提及的所有代码，都可以在 [这里](./demo/httptest.4.js) 看到。单测则在 [这里](./demo/__tests__/httptest.4.js) 可以看到。


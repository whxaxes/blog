# 使用 electron 做个播放器

![](https://github.com/whxaxes/boom/raw/master/image.png)

## 前言

虽然 electron 已经出来好长时间了，但是最近才玩了一下，写篇博文记录一下，以便日后回顾。

electron 的入门可以说是相当简单，官方提供了一个 [quick start](https://electron.atom.io/docs/tutorial/quick-start/)，很流畅的就可以跑起来一个应用。

为啥要做个播放器呢，因为我在很久很久以前写过一个网页版的[音频可视化播放器](http://whxaxes.github.io/canvas-test/src/Funny-demo/musicPlayer/index.html)，但是因为是在页端，所以想播放本地音乐很麻烦，也没法保存。因此就想到用 electron 做个播放器 App，就可以读本地的网易云音乐目录了。

## 生成骨架

由于习惯用 vue，因此也准备用 vue 来实现这个应用。而目前就已经有个 [electron-vue](https://github.com/SimulatedGREG/electron-vue) 的 boilplate 可以用。因此就直接通过 vue-cli 来进行初始化即可。

```bash
vue init simulatedgreg/electron-vue boom
```

然后就可以生成项目骨架了，结构如下：

```
.
├── .electron-vue
│   ├── build.js
│   ├── dev-client.js
│   ├── dev-runner.js
│   ├── webpack.main.config.js
│   └── webpack.renderer.config.js
├── dist
├── src
│   ├── index.ejs
│   ├── main
│   │   ├── index.dev.js
│   │   ├── index.js
│   └── renderer
│       ├── assets
│       ├── components
|       ├── App.vue
│       ├── main.js
│       └── store.js
├── .eslintignore
├── .eslintrc.js
├── .travis.yml
├── appveyor.yml
├── .babelrc
├── package.json
├── README.md
```

生成好之后，就直接执行

```bash
yarn dev
```

就可以看到一个应用出现啦，然后就可以愉快的开始开发了。

## 主进程与渲染进程

在 electron 中有 main process 以及 renderer process 之分，简单来说，main process 就是用来创建窗口之类的，类似于后台，renderer process 就是跑在 webview 中的。两个进程中能调用的接口有部分是通用，也有一部分是独立的。不过不管是在哪个进程中，都可以调用 node 的常用模块，比如 fs、path 。

因此在 webview 跑的页面代码中，也可以通过 fs 模块读取本地文件，这点还是很方便的。

而且，就算在 renderer process 中想调用 main process 的接口也是可以的，可以通过 remote 模块。比如我需要监听当前窗口是否进入全屏，就可以这样写：

```js
import { remote } from 'electron';
const win = remote.app.getCurrentWindow();
win.on('enter-full-screen', () => {
 // do something
});
```

简直方便至极。

## 创建窗口

创建窗口的逻辑是在主进程中做的，逻辑很简单，就按照 electron 的 quick start 的方式进行创建即可。而且通过 electron-vue 生成的代码，其实也已经帮你把这块逻辑写好了。就自己进行一些小修改就可以了。

```js
import { app, BrowserWindow, screen } from 'electron'

app.on('ready', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    cosnt win = new BrowserWindow({
        height, width,
        useContentSize: true,
        titleBarStyle: 'hidden-inset',
        frame: false,
        transparent: true,
    });
    
    win.loadURL(`file://${__dirname}/index.html`);
})
```

由于我做的播放器，想全身是黑色风格的，因此在创建窗口时，传入 `titleBarStyle`，`frame`，`transparent`这几个参数，可以把顶部栏隐藏掉。当然，隐藏之后，窗口就没法拖动了。所以还要在页面上加个用来拖动的透明顶部栏，再给个 css 属性：

```css
-webkit-app-region: drag;
```

就可以实现窗口拖动了。

## 通信

主进程和渲染进程之间的通信是很常用的，通信是通过 IPC 通道实现的。代码逻辑写起来也很简单

main process 收发消息

```js
import { ipcMain } from 'electron';
ipcMain.on('init', (evt, arg) => {
    evt.sender.send('sync-config', { msg: 'hello' })
});
```

renderer process 收发消息

```js
import { ipcRenderer } from 'electron';
ipcRenderer.send('init');
ipcRenderer.on('sync-config', (evt, arg) => {
   console.log(arg.msg);
});
```

有一点要注意的就是，ipcMain 是没有 send 方法的，如果需要 ipcMain 主动推送消息到渲染进程，需要使用窗口对象实现：

```js
win.webContents.send('sync-config', { msg: 'hello' });
```

## 配置保存

每个应用肯定是有一些用户配置的，比如放音乐的目录需要保存到配置中，下次打开就可以直接读取那个目录的音乐列表即可。

electron 提供了获取相关路径的接口 `getPath` 用于给应用保存数据。在 getPath 接口中，传入相应名称即可获取到相应的路径。

```js
electron.app.getPath('home'); // 获取用户根目录
electron.app.getPath('userData'); // 用于存储 app 用户数据目录
electron.app.getPath('appData'); // 用于存储 app 数据的目录，升级会被福噶
electron.app.getPath('desktop'); // 桌面目录
...
```

由于我们这些配置数据不能保存在应用下，因为如果保存在应用下，应用升级后就会被覆盖掉，因此需要保存到 `userData` 下。

```js
const electron = require('electron');
const dataPath = (electron.app || electron.remote.app).getPath('userData');
const fileUrl = path.join(dataPath, 'config.json');
let config;

if(fs.existSync(fileUrl)) {
  config = JSON.parse(fs.readFileSync(fileUrl));
} else {
  config = {};
  fs.writeFileSync(fileUrl, '{}');
}
```

无论在 renderer process 中，还是在 main process 中，都是可以调用，在 main process 中就通过 electron.app 调用，否则就通过 remote 模块调用。

虽然无论在 main process 中还是在 renderer process 中都可以读到配置，但是考虑到两个进程中数据同步的问题，我个人觉得，这种配置读取与写入，还是统一在 main process 做好，renderer process 要保存数据就通过 IPC 消息通知 main process 进行数据的更改，保证配置数据的流向是单方向的，比如容易管理。

## 配置菜单

可以通过 Menu 类实现。

```js
import { Menu } from 'electron';
Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

template 的格式可直接看[官方文档](https://electron.atom.io/docs/api/menu/#main-process)，就是普通的 json 格式。

## 音频播放

讲完 electron 相关，然后就可以讲讲怎么播放音频了。

由于在 electron 中，在前端代码中也可以使用 node 的模块，因此，刚开始的想法是，直接用 fs 模块读取音频文件，然后再将读取的 Buffer 转成 Uint8Array 再转成 AudioBuffer ，然后连接到音频输出上进行播放就行了。大概逻辑如下：

```js
const AC = new window.AudioContext();
const analyser = AC.createAnalyser();
const buf = fs.readFileSync(music.url);
const uint8Buffer = Uint8Array.from(buf);

// 音频解码
AC.decodeAudioData(uint8Buffer.buffer)
    .then(audioBuf => {
         const bs = AC.createBufferSource();
         bs.buffer = audioBuf;
         bs.connect(analyser);
         analyser.connect(AC.destination);
         bs.start();
    });
```

但是，有个问题，音频解码很费时间，解码一个三四分钟的 mp3 文件就得 2 ~ 4 秒，这样的话我点击播放音乐都得等两秒以上，这简直不能忍，所以就考虑换种方法，比如用流的方式。

抱着这种想法就去查阅了文档，结果发现没有支持流的解码接口，再接着就想自己来模拟流的方式，读出来的 buffer 分成 N 段，然后逐段进行解码，解码完一段就播一段，嗯...想的挺好，但是发现这样做会导致解码失败，可能是粗暴的将 buffer 分段对解码逻辑有影响。

上面的方法行不通了，当然还有方法，audio 标签是支持流式播放的。于是就在启动应用的时候，建个音频服务。

```js
function startMusicServer(callback) {
  const server = http.createServer((req, res) => {
    const musicUrl = decodeURIComponent(req.url);
    const extname = path.extname(musicUrl);
    if (allowKeys.indexOf(extname) < 0) {
      return notFound(res);
    }

    const filename = path.basename(musicUrl);
    const fileUrl = path.join(store.get(constant.MUSIC_PATH), filename);
    if (!fs.existsSync(fileUrl)) {
      return notFound(res);
    }

    const stat = fs.lstatSync(fileUrl);
    const source = fs.createReadStream(fileUrl);
    res.writeHead(200, {
      'Content-Type': allowFiles[extname],
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=' + (365 * 24 * 60 * 60 * 1000),
      'Last-Modified': String(stat.mtime).replace(/\([^\x00-\xff]+\)/g, '').trim(),
    });
    source.pipe(res);
  }).listen(0, () => {
    callback(server.address().port);
  });

  return server;
}
```

然后在前端，直接更换 audio 标签的 src 即可，然后连接上音频输出：

```html
<audio ref="audio"
           :src="url"
           crossorigin="anonymous"></audio>
```

```js
const audio = this.$refs.audio;
const source = AC.createMediaElementSource(this.$refs.audio);
source.connect(analyser);
analyser.connect(AC.destination);
```

就这么愉快的实现了流式播放了。。。感觉白折腾了很久。

## 音频可视化

这个其实我在以前的博客里有说过了，不过再简单的说一下。在上一段中我会把音频连接到一个 `analyser` 中，其实这个是一个音频分析器，可以将音频数据转成频率数据。我们就可以用这些频率数据来做可视化。

只需要通过以下这段逻辑就可以获取到频率数据了，因为频率数据数据都是 0 ~ 255 的大小，长度总共 1024，因此用个 Uint8Array 来存储。

```js
const arrayLength = analyser.frequencyBinCount;
const array = new Uint8Array(arrayLength);
analyser.getByteFrequencyData(array);
```

然后获取到这个数据之后，就可以在 canvas 中把不同频率以图像的形式画出来即可。具体就不赘述了，有兴趣的可以看我以前写的[这篇博文](http://www.cnblogs.com/axes/p/3842812.html)。

## 打包

编写完代码之后，就可以使用 [electron-packager](https://github.com/electron-userland/electron-packager) 进行打包，在 Mac 上就会打包成 app，在 windows 应该会打成 exe 吧（没试过）。

安装 electron-packager （`npm install electron-packager -g`）之后就可以打包了。

```js
electron-packager .
```

## 总结

electron 还是相当方便的，让 web 开发者也可以轻松编写桌面应用。

上述代码均在：https://github.com/whxaxes/boom  ，有兴趣的可以 clone 下来跑一下玩玩。




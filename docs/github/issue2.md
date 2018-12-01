# 仿造slither.io第二步：加个地图，加点吃的

## 前言

[上一篇](https://github.com/whxaxes/blog/issues/1)博文讲了如何造一条蛇，现在蛇有了，要让它自由的活动起来，就得有个地图啊，而且只能走也不行呀，还得有点吃的，所以还得加点食物，这一篇博文就来讲讲如何添加地图和食物。
## 预览效果

当前项目最新效果：http://whxaxes.github.io/slither/ （由于代码一直在更新，效果可能会比本文所述的更多）
## 功能分析

slither.io的地图是类似于rpg游戏的大地图，所以，我们需要两个新的类，一个是地图类：Map，一个是视窗类：Frame，地图类就是整个大地图的抽象，视窗类就是可视界面的抽象。

而怎么做成蛇动的时候，绘制位置不动，而是地图动呢。其实原理也很简单，如果看过上一篇文章的读者，应该还记得<b>Base</b>类里有两个参数：`paintX`以及`paintY`，这两个是绘制坐标，跟蛇的坐标不同的就是，绘制坐标是蛇的实际坐标减去视窗的坐标。

``` javascript
  get paintX() {
    return this.x - frame.x;
  }

  get paintY() {
    return this.y - frame.y;
  }
```

每次render的时候，绘制的坐标就是用的这两个参数，同时适当的调整一下视窗的坐标，就可以做成相对于视窗中蛇没移动，但是看上去蛇移动了的效果。

Base类里还有一个参数叫visible：

``` javascript
/**
   * 在视窗内是否可见
   * @returns {boolean}
   */
  get visible() {
    const paintX = this.paintX;
    const paintY = this.paintY;
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    return (paintX + halfWidth > 0)
      && (paintX - halfWidth < frame.width)
      && (paintY + halfHeight > 0)
      && (paintY - halfHeight < frame.height);
  }
```

用于判断实例在视窗frame中是否可见，如果不可见，就不需要调用绘制接口了，从而提升游戏性能。

而食物类就比较简单了，继承Base类后，在地图中随机出一定数量，再进行一下蛇头与食物的碰撞检测即可。

接着再细讲一下各个类的实现。
## 视窗类

因为地图类也依赖视窗类，所以先看视窗类。代码量相当少，所以直接全部贴出：

``` javascript
// 视窗类
class Frame {
  init(options) {
    this.x = options.x;
    this.y = options.y;
    this.width = options.width;
    this.height = options.height;
  }

  /**
   * 跟踪某个对象
   */
  track(obj) {
    this.translate(
      obj.x - this.x - this.width / 2,
      obj.y - this.y - this.height / 2
    );
  }

  /**
   * 移动视窗
   * @param x
   * @param y
   */
  translate(x, y) {
    this.x += x;
    this.y += y;
  }
}

export default new Frame();
```

由于视窗在整个游戏中只有一个，所以做成了单例的。视窗类就只有几个属性，x坐标，y坐标，宽度和高度。x坐标和y坐标是相对于地图左上角的值，width和height一般就是canvas的大小。

track方法是跟踪某个对象，也就是视窗跟着对象的移动而移动。在main.js中调用跟踪蛇类：

``` javascript
// 让视窗跟随蛇的位置更改而更改
frame.track(snake);
```
## 地图类

地图类跟视窗类一样也是整个游戏里只有一个，所以也做成单例的，而且由于，整个游戏的元素，都是基于地图上的，所以我也把canvas的2d绘图对象挂载到了地图类上。先看地图类的部分代码：

``` javascript
  constructor() {
    // 背景块的大小
    this.block_w = 150;
    this.block_h = 150;
  }

  /**
   * 初始化map对象
   * @param options
   */
  init(options) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d');

    // 地图大小
    this.width = options.width;
    this.height = options.height;
  }

  /**
   * 清空地图上的内容
   */
  clear() {
    this.ctx.clearRect(0, 0, frame.width, frame.height);
  }
```

构造函数中，定义一下地图背景的方格块的大小，然后就是init方法，给外部初始化用的，因为地图的位置是固定的，所以不需要坐标值，只需要宽度和高度即可。clear是给外部调用用来清除画布。

再看地图类的渲染方法：

``` javascript
  /**
   * 渲染地图
   */
  render() {
    const beginX = (frame.x < 0) ? -frame.x : (-frame.x % this.block_w);
    const beginY = (frame.y < 0) ? -frame.y : (-frame.y % this.block_h);
    const endX = (frame.x + frame.width > this.width)
      ? (this.width - frame.x)
      : (beginX + frame.width + this.block_w);
    const endY = (frame.y + frame.height > this.height)
      ? (this.height - frame.y)
      : (beginY + frame.height + this.block_h);

    // 铺底色
    this.ctx.fillStyle = '#999';
    this.ctx.fillRect(beginX, beginY, endX - beginX, endY - beginY);

    // 画方格砖
    this.ctx.strokeStyle = '#fff';
    for (let x = beginX; x <= endX; x += this.block_w) {
      for (let y = beginY; y <= endY; y += this.block_w) {
        const cx = endX - x;
        const cy = endY - y;
        const w = cx < this.block_w ? cx : this.block_w;
        const h = cy < this.block_h ? cy : this.block_h;

        this.ctx.strokeRect(x, y, w, h);
      }
    }
  }
```

其实就是根据视窗的位置，来进行局部绘制，如果进行整个地图的绘制，会超级消耗性能。所以只绘制需要展示的那一块。

按照slither.io的功能，大地图有了，还得画个小地图：

``` javascript
  /**
   * 画小地图
   */
  renderSmallMap() {
    // 小地图外壳, 圆圈
    const margin = 30;
    const smapr = 50;
    const smapx = frame.width - smapr - margin;
    const smapy = frame.height - smapr - margin;

    // 地图在小地图中的位置和大小
    const smrect = 50;
    const smrectw = this.width > this.height ? smrect : (this.width * smrect / this.height);
    const smrecth = this.width > this.height ? (this.height * smrect / this.width) : smrect;
    const smrectx = smapx - smrectw / 2;
    const smrecty = smapy - smrecth / 2;

    // 相对比例
    const radio = smrectw / this.width;

    // 视窗在小地图中的位置和大小
    const smframex = frame.x * radio + smrectx;
    const smframey = frame.y * radio + smrecty;
    const smframew = frame.width * radio;
    const smframeh = frame.height * radio;

    this.ctx.save();
    this.ctx.globalAlpha = 0.8;

    // 画个圈先
    this.ctx.beginPath();
    this.ctx.arc(smapx, smapy, smapr, 0, Math.PI * 2);
    this.ctx.fillStyle = '#000';
    this.ctx.fill();
    this.ctx.stroke();

    // 画缩小版地图
    this.ctx.fillStyle = '#999';
    this.ctx.fillRect(smrectx, smrecty, smrectw, smrecth);

    // 画视窗
    this.ctx.strokeRect(smframex, smframey, smframew, smframeh);

    // 画蛇蛇位置
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(smframex + smframew / 2 - 1, smframey + smframeh / 2 - 1, 2, 2);

    this.ctx.restore();
  }
```

这个也没什么难度，就是叠图层而已。不再解释

最后再export出去：`export default new Map();`即可。
## 组合

在main.js中，直接初始化一下：

``` javascript
// 初始化地图对象
map.init({
  canvas,
  width: 5000,
  height: 5000
});

// 初始化视窗对象
frame.init({
  x: 1000,
  y: 1000,
  width: canvas.width,
  height: canvas.height
});
```

然后在动画循环中，让视窗跟随蛇的实例`snake`，然后再进行相应的render即可，render的顺序关系到元素的层级，所以小地图是最后才render ：

``` javascript
// 让视窗跟随蛇的位置更改而更改
frame.track(snake);

map.render();

snake.render();

map.renderSmallMap();
```
## 食物类

再讲一下食物类，也是非常的简单，直接继承Base类，然后做个简单的发光动画效果即可，代码量不多，也全部贴出：

``` javascript
export default class Food extends Base {
  constructor(options) {
    super(options);

    this.point = options.point;
    this.r = this.width / 2;        // 食物的半径, 发光半径
    this.cr = this.width / 2;       // 食物实体半径
    this.lightDirection = true;     // 发光动画方向
  }

  update() {
    const lightSpeed = 1;

    this.r += this.lightDirection ? lightSpeed : -lightSpeed;

    // 当发光圈到达一定值再缩小
    if (this.r > this.cr * 2 || this.r < this.cr) {
      this.lightDirection = !this.lightDirection;
    }
  }

  render() {
    this.update();

    if (!this.visible) {
      return;
    }

    map.ctx.fillStyle = '#fff';

    // 绘制光圈
    map.ctx.globalAlpha = 0.2;
    map.ctx.beginPath();
    map.ctx.arc(this.paintX, this.paintY, this.r, 0, Math.PI * 2);
    map.ctx.fill();

    // 绘制实体
    map.ctx.globalAlpha = 1;
    map.ctx.beginPath();
    map.ctx.arc(this.paintX, this.paintY, this.cr, 0, Math.PI * 2);
    map.ctx.fill();
  }
}
```

然后在main.js中，进行食物生成：

``` javascript
// 食物生成方法
const foodsNum = 100;
const foods = [];
function createFood(num) {
  for (let i = 0; i < num; i++) {
    const point = ~~(Math.random() * 30 + 50);
    const size = ~~(point / 3);

    foods.push(new Food({
      x: ~~(Math.random() * (map.width + size) - 2 * size),
      y: ~~(Math.random() * (map.height + size) - 2 * size),
      size, point
    }));
  }
}
```

然后在动画循环中进行循环并且渲染即可：

``` javascript
// 渲染食物, 以及检测食物与蛇头的碰撞
    foods.slice(0).forEach(food => {
      food.render();

      if (food.visible && collision(snake.header, food)) {
        foods.splice(foods.indexOf(food), 1);
        snake.eat(food);
        createFood(1);
      }
    });
```

渲染的同时，也跟蛇头进行一下碰撞检测，如果产生了碰撞，则从食物列表中删掉吃掉的实物，并且调用蛇类的eat方法，然后再随机生成一个食物补充。

因为食物是圆，蛇头也是圆，所以碰撞检测就很简单了：

``` javascript
/**
 * 碰撞检测
 * @param dom
 * @param dom2
 * @param isRect   是否为矩形
 */
function collision(dom, dom2, isRect) {
  const disX = dom.x - dom2.x;
  const disY = dom.y - dom2.y;

  if (isRect) {
    return Math.abs(disX) < (dom.width + dom2.width)
      && Math.abs(disY) < (dom.height + dom2.height);
  }

  return Math.hypot(disX, disY) < (dom.width + dom2.width) / 2;
}
```

然后再看一下蛇的eat方法：

``` javascript
/**
   * 吃掉食物
   * @param food
   */
  eat(food) {
    this.point += food.point;

    // 增加分数引起虫子体积增大
    const newSize = this.header.width + food.point / 50;
    this.header.setSize(newSize);
    this.bodys.forEach(body => {
      body.setSize(newSize);
    });

    // 同时每吃一个食物, 都增加身躯
    const lastBody = this.bodys[this.bodys.length - 1];
    this.bodys.push(new SnakeBody({
      x: lastBody.x,
      y: lastBody.y,
      size: lastBody.width,
      color: lastBody.color,
      tracer: lastBody
    }));
  }
```

调用该方法后，会使蛇的分数增加，同时增加体积，以及身躯长度。

至此，地图以及食物都做好了。

照例贴出github地址：[https://github.com/whxaxes/slither](https://github.com/whxaxes/slither)

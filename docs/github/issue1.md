# 仿造slither.io第一步：先画条蛇

## 前言

最近 [slither.io](http://slither.io/) 貌似特别火，中午的时候，同事们都在玩，包括我自己也是玩的不亦乐乎。

好久好久没折腾过canvas相关的我也是觉得是时候再折腾一番啦，所以就试着仿造一下吧。楼主也没写过网络游戏，所以实现逻辑完全靠自己YY。

而且楼主心里也有点发虚，因为有些逻辑还是不知道怎么实现呀，所以不立flag，实话实说：不一定会更新下去，如果写到不会写了，就不一定写了哈~

为啥取名叫先画条蛇，毕竟是做个游戏，功能还是蛮多蛮复杂的，一口气是肯定搞不完的，所以得一步一步来，第一步就是先造条蛇！！
## 预览效果

当前项目最新效果：http://whxaxes.github.io/slither/  （由于代码一直在更新，效果会比本文所述的更多）
## 实现基类

在这个游戏里，需要一个基类，也就是地图上的所有元素都会继承这个基类：`Base`

``` javascript
export default class Base {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.width = options.size || options.width;
    this.height = options.size || options.height;
  }

  /**
   * 绘制时的x坐标, 要根据视窗来计算位置
   * @returns {number}
   */
  get paintX() {
    return this.x - frame.x;
  }

  /**
   * 绘制时的y坐标, 要根据视窗来计算位置
   * @returns {number}
   */
  get paintY() {
    return this.y - frame.y;
  }

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
}
```

也就是地图上的元素，都会有几个基本属性：水平坐标x，垂直坐标y，宽度width，高度height，水平绘制坐标paintX，垂直绘制坐标paintY，在视窗内是否可见visible。

其中绘制坐标和视窗相关参数这一篇先不用管，这两个是涉及到地图的，会在下一篇文章再作解释。
## 蛇的构成

不像常见的那种以方格为运动单位的贪吃蛇，slither里的蛇动的动的更自由，先不说怎么动，先说一下蛇体的构成。

![image](https://cloud.githubusercontent.com/assets/5856440/14908332/7f898d70-0e08-11e6-860c-bc613f8def42.png)

这构造很显然易见，其实就是由一个又一个的圆构成的，可以分为构成身体的圆，以及构成头部的圆。所以，实现蛇这个类的时候，可以进行拆分，拆分成蛇的基类`SnakeBase`，继承蛇基类的蛇头类`SnakeHeader`，以及继承蛇基类的蛇身类`SnakeBody`，还有一个蛇类`Snake`用于组合蛇头和蛇身。

## 实现蛇基类

为什么要实现一个蛇基类，因为蛇头和蛇身其实是有很多相似的地方，也会有很多相同属性，所以实现一个蛇基类会方便方法的复用的。

蛇基类我命名为`SnakeBase`，继承基类`Base`：

``` javascript
// 蛇头和蛇身的基类
class SnakeBase extends Base {
  constructor(options) {
    super(options);

    // 皮肤颜色
    this.color = options.color;
    // 描边颜色
    this.color_2 = '#000';

    // 垂直和水平速度
    this.vx = 0;
    this.vy = 0;

    // 生成元素图片镜像
    this.createImage();
  }

  // 设置基类的速度
  set speed(val) {
    this._speed = val;

    // 重新计算水平垂直速度
    this.velocity();
  }

  get speed() {
    return this._speed
      ? this._speed
      : (this._speed = this.tracer ? this.tracer.speed : SPEED);
  }

  /**
   * 设置宽度和高度
   * @param width
   * @param height
   */
  setSize(width, height) {
    this.width = width;
    this.height = height || width;
    this.createImage();
  }

  /**
   * 生成图片镜像
   */
  createImage() {
    this.img = this.img || document.createElement('canvas');
    this.img.width = this.width + 10;
    this.img.height = this.height + 10;
    this.imgctx = this.img.getContext('2d');

    this.imgctx.lineWidth = 2;
    this.imgctx.save();
    this.imgctx.beginPath();
    this.imgctx.arc(this.img.width / 2, this.img.height / 2, this.width / 2, 0, Math.PI * 2);
    this.imgctx.fillStyle = this.color;
    this.imgctx.strokeStyle = this.color_2;
    this.imgctx.stroke();
    this.imgctx.fill();
    this.imgctx.restore();
  }

  /**
   * 更新位置
   */
  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  /**
   * 渲染镜像图片
   */
  render() {
    this.update();

    // 如果该元素在视窗内不可见, 则不进行绘制
    if (!this.visible) return;

    // 如果该对象有角度属性, 则使用translate来绘制, 因为要旋转
    if (this.hasOwnProperty('angle')) {
      map.ctx.save();
      map.ctx.translate(this.paintX, this.paintY);
      map.ctx.rotate(this.angle - BASE_ANGLE - Math.PI / 2);
      map.ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
      map.ctx.restore();
    } else {
      map.ctx.drawImage(
        this.img,
        this.paintX - this.img.width / 2,
        this.paintY - this.img.height / 2
      );
    }
  }
}
```

简单说明一下各个属性的意义：
- `x，y`  基类的坐标
- `r`  为基类的半径，因为这个蛇是由圆组成的，所以r就是圆的半径
- `color、color_2`  用于着色
- `vx，vy`  为基类的水平方向的速度，以及垂直方向的速度

再说明一下几个方法：
- `createImage`方法：用于创建基类的镜像，虽然基类只是画个圆，但是绘制操作还是不少，所以最好还是先创建镜像，之后每次绘制的时候就只需要调用一次`drawImage`即可，对提升性能还是有效的
- `update`方法：每次的动画循环都会调用的方法，根据基类的速度来更新其位置
- `render`方法：基类的绘制自身的方法，里面就只有一个绘制镜像的操作，不过会判断一下当前这个实例有无angle属性，如果有angle则需要用canvas的rotate方法进行转向后再绘制。
## 实现蛇头类

再接下来就是蛇头`SnakeHeader`类，蛇头类会继承蛇基类，而且，由于蛇的运动就是蛇头的运动，所以蛇头是运动的核心，而蛇身是跟着蛇头动而动。

蛇头怎么动呢，我代码里写的是，蛇会朝着鼠标移动，但是蛇的运动是不会停的，所以不以鼠标位置为终点来计算蛇的运动，而是以鼠标相对于蛇头的角度来计算蛇的运动方向，然后让蛇持续的往那个方向运动即可。

所以在蛇头类里，会新增两个属性：`angle`以及`toAngle`，angle是蛇头角度，toAngle是蛇头要转向的角度，请看蛇头的构造函数代码：

``` javascript
  constructor(options) {
    super(options);

    this.angle = BASE_ANGLE + Math.PI / 2;
    this.toAngle = this.angle;
  }
```

初始角度为一个基础角度加上90度，因为画布的rotate是从x轴正向开始的，而我想把y轴正向作为0度，那么就得加上90度，而基础角度BASE_ANGLE是一个很大的数值，但是都是360度的倍数：

``` javascript
const BASE_ANGLE = Math.PI * 200; // 用于保证蛇的角度一直都是正数
```

目的是保证蛇的运动角度一直是正数。

其次，蛇头需要眼睛，所以在蛇头的绘制镜像方法中，加入了绘制眼睛的方法：

``` javascript
  /**
   * 添加画眼睛的功能
   */
  createImage() {
    super.createImage();
    const self = this;
    const eyeRadius = this.width * 0.2;

    function drawEye(eyeX, eyeY) {
      self.imgctx.beginPath();
      self.imgctx.fillStyle = '#fff';
      self.imgctx.strokeStyle = self.color_2;
      self.imgctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      self.imgctx.fill();
      self.imgctx.stroke();

      self.imgctx.beginPath();
      self.imgctx.fillStyle = '#000';
      self.imgctx.arc(eyeX + eyeRadius / 2, eyeY, 3, 0, Math.PI * 2);
      self.imgctx.fill();
    }

    // 画左眼
    drawEye(
      this.img.width / 2 + this.width / 2 - eyeRadius,
      this.img.height / 2 - this.height / 2 + eyeRadius
    );

    // 画右眼
    drawEye(
      this.img.width / 2 + this.width / 2 - eyeRadius,
      this.img.height / 2 + this.height / 2 - eyeRadius
    );
  }
```

再者就是蛇头的运动，蛇头会根据鼠标与蛇头的角度来运动，所以需要一个derectTo方法来调整蛇头角度：

``` javascript
/**
   * 转向某个角度
   */
  directTo(angle) {
    // 老的目标角度, 但是是小于360度的, 因为每次计算出来的目标角度也是0 - 360度
    const oldAngle = Math.abs(this.toAngle % (Math.PI * 2));

    // 转了多少圈
    let rounds = ~~(this.toAngle / (Math.PI * 2));

    this.toAngle = angle;

    if (oldAngle >= Math.PI * 3 / 2 && this.toAngle <= Math.PI / 2) {
      // 角度从第四象限左划至第一象限, 增加圈数
      rounds++;
    } else if (oldAngle <= Math.PI / 2 && this.toAngle >= Math.PI * 3 / 2) {
      // 角度从第一象限划至第四象限, 减少圈数
      rounds--;
    }

    // 计算真实要转到的角度
    this.toAngle += rounds * Math.PI * 2;
  }
```

如果单纯根据鼠标与蛇头的角度，来给予蛇头运动方向，会有问题，因为计算出来的目标角度都是0-360的，也就是，当我的鼠标从340度，右划挪到10度。会出现蛇头变成左转弯，因为目标度数比蛇头度数小。

所以就引入了圈数`rounds`来计算蛇真正要去到的角度。还是当我的鼠标从340度右划到10度的时候，经过计算，我会认为蛇头的目标度数就是 `360度 + 10度`。就能保证蛇头的转向是符合常识的。

计算出目标角度，就根据目标角度来算出蛇头的水平速度vx，以及垂直速度vy：

``` javascript
// 根据蛇头角度计算水平速度和垂直速度
  velocity() {
    const angle = this.angle % (Math.PI * 2);
    const vx = Math.abs(this.speed * Math.sin(angle));
    const vy = Math.abs(this.speed * Math.cos(angle));

    if (angle < Math.PI / 2) {
      this.vx = vx;
      this.vy = -vy;
    } else if (angle < Math.PI) {
      this.vx = vx;
      this.vy = vy;
    } else if (angle < Math.PI * 3 / 2) {
      this.vx = -vx;
      this.vy = vy;
    } else {
      this.vx = -vx;
      this.vy = -vy;
    }
  }
```

之后再在每一次的重绘中进行转向的计算，以及移动的计算即可：

``` javascript
  /**
   * 蛇头转头
   */
  turnAround() {
    const angleDistance = this.toAngle - this.angle; // 与目标角度之间的角度差
    const turnSpeed = 0.045; // 转头速度

    // 当转到目标角度, 重置蛇头角度
    if (Math.abs(angleDistance) <= turnSpeed) {
      this.toAngle = this.angle = BASE_ANGLE + this.toAngle % (Math.PI * 2);
    } else {
      this.angle += Math.sign(angleDistance) * turnSpeed;
    }
  }

  /**
   * 增加蛇头的逐帧逻辑
   */
  update() {
    this.turnAround();

    this.velocity();

    super.update();
  }
```
## 实现蛇身类

蛇头类写好了，就可以写蛇身类`SnakeBody`了，蛇身需要跟着前面一截的蛇身或者蛇头运动，所以又新增了几个属性，先看部分代码：

``` javascript
constructor(options) {
    super(options);

    // 设置跟踪者
    this.tracer = options.tracer;

    this.tracerDis = this.distance;
    this.savex = this.tox = this.tracer.x - this.distance;
    this.savey = this.toy = this.tracer.y;
  }

  get distance() {
    return this.tracer.width * 0.2;
  }
```

新增了一个`tracer`跟踪者属性，也就是前一截的蛇头或者蛇身实例，蛇身和前一截实例会有一些位置差距，所以有个distance属性是用于此，还有就是计算蛇身的目标位置，也就是前一截蛇身的运动方向往后平移distance距离的点。让蛇身朝着这个方向移动，就可以有跟着动的效果了。

还有tracerDis是用于计算tracer的移动长度，this.savex和this.savey是用于保存tracer的运动轨迹坐标

再来就是计算水平速度，以及垂直速度，还有每一帧的更新逻辑了：

``` javascript
  /**
   * 根据目标点, 计算速度
   * @param x
   * @param y
   */
  velocity(x, y) {
    this.tox = x || this.tox;
    this.toy = y || this.toy;

    const disX = this.tox - this.x;
    const disY = this.toy - this.y;
    const dis = Math.hypot(disX, disY);

    this.vx = this.speed * disX / dis || 0;
    this.vy = this.speed * disY / dis || 0;
  }

 update() {
    if (this.tracerDis >= this.distance) {
      const tracer = this.tracer;

      // 计算位置的偏移量
      this.tox = this.savex + ((this.tracerDis - this.distance) * tracer.vx / tracer.speed);
      this.toy = this.savey + ((this.tracerDis - this.distance) * tracer.vy / tracer.speed);

      this.velocity(this.tox, this.toy);

      this.tracerDis = 0;

      // 保存tracer位置
      this.savex = this.tracer.x;
      this.savey = this.tracer.y;
    }

    this.tracerDis += this.tracer.speed;

    if (Math.abs(this.tox - this.x) <= Math.abs(this.vx)) {
      this.x = this.tox;
    } else {
      this.x += this.vx;
    }

    if (Math.abs(this.toy - this.y) <= Math.abs(this.vy)) {
      this.y = this.toy;
    } else {
      this.y += this.vy;
    }
  }
```

上面代码中，update方法，会计算tracer移动距离，当超过distance的时候，就让蛇身根据此前保存的运动轨迹，计算相应的速度，然后进行移动。这样就可以实现蛇身会跟着tracer的移动轨迹行动。
## 组合成蛇

蛇头、蛇身都写完了，是时候把两者组合起来了，所以再创建一个蛇类`Snake`。

先看构造函数，在创建实例的时候，实例化一个蛇头，再根据入参的长度，来增加蛇身的实例，并且把蛇身的tracer指向前一截蛇身或者蛇头实例。

``` javascript
constructor(options) {
    this.bodys = [];

    // 创建脑袋
    this.header = new SnakeHeader(options);

    // 创建身躯, 给予各个身躯跟踪目标
    options.tracer = this.header;
    for (let i = 0; i < options.length; i++) {
      this.bodys.push(options.tracer = new SnakeBody(options));
    }

    this.binding();
  }
```

还有就是鼠标事件绑定，包括根据鼠标位置，来调整蛇的运动方向，还有按下鼠标的时候，蛇会进行加速，松开鼠标则不加速的逻辑：

``` javascript
  /**
   * 蛇与鼠标的交互事件
   */
  binding() {
    const header = this.header;
    const bodys = this.bodys;

    // 蛇头跟随鼠标的移动而变更移动方向
    window.addEventListener('mousemove', (e = window.event) => {
      const x = e.clientX - header.paintX;
      const y = header.paintY - e.clientY;
      let angle = Math.atan(Math.abs(x / y));

      // 计算角度, 角度值为 0-360
      if (x > 0 && y < 0) {
        angle = Math.PI - angle;
      } else if (x < 0 && y < 0) {
        angle = Math.PI + angle;
      } else if (x < 0 && y > 0) {
        angle = Math.PI * 2 - angle;
      }

      header.directTo(angle);
    });

    // 鼠标按下让蛇加速
    window.addEventListener('mousedown', () => {
      header.speed = 5;
      bodys.forEach(body => {
        body.speed = 5;
      });
    });

    // 鼠标抬起停止加速
    window.addEventListener('mouseup', () => {
      header.speed = SPEED;
      bodys.forEach(body => {
        body.speed = SPEED;
      });
    });
  }
```

当然，最终还需要一个渲染方法，逐个渲染即可：

``` javascript
  // 渲染蛇头蛇身
  render() {
    for (let i = this.bodys.length - 1; i >= 0; i--) {
      this.bodys[i].render();
    }

    this.header.render();
  }
```
## 最后

至此，整个蛇类都写完了，再写一下动画循环逻辑即可：

``` javascript
import Snake from './snake';
import frame from './lib/frame';
import Stats from './third/stats.min';

const sprites = [];
const RAF = window.requestAnimationFrame
  || window.webkitRequestAnimationFrame
  || window.mozRequestAnimationFrame
  || window.oRequestAnimationFrame
  || window.msRequestAnimationFrame
  || function(callback) {
    window.setTimeout(callback, 1000 / 60)
  };

const canvas = document.getElementById('cas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = 'absolute';
stats.domElement.style.right = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild( stats.domElement );

function init() {
  const snake = new Snake({
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
    size: 40,
    length: 10,
    color: '#fff'
  });

  sprites.push(snake);

  animate();
}

let time = new Date();
let timeout = 0;
function animate() {
  const ntime = new Date();

  if(ntime - time > timeout) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sprites.forEach(function(sprite) {
      sprite.render();
    });

    time = ntime;
  }

  stats.update();

  RAF(animate);
}

init();
```

这一块的代码就很简单了，生成蛇的实例，通过`requestAnimationFrame`方法进行动画循环，并且在每次循环中进行画布的重绘即可。里面有个叫timeout的参数，用于降低游戏fps，用来debug的。

这个项目目前还是单机的，所以我放在了github，之后加上网络功能的话，估计就无法预览了。

github地址：[https://github.com/whxaxes/slither](https://github.com/whxaxes/slither)

> 本文我也有在博客园发布，若发现雷同，作者都是我 ~ 

<div class="my-info">
  <div class="avatar">
    <img src="https://avatars3.githubusercontent.com/u/5856440?s=460&v=4" alt="">
  </div>

  <div class="user-name">whxaxes</div>

  <div class="intro">
    花名：吖猩，前端，目前就职于阿里游戏，专注于 Web 开发。
  </div>

  <div class="panel-block">
    <div class="panel-block-title">
      博文分类
    </div>

    {% for item in allInfo %}
      <a class="panel-block-link {{ 'active' if ctx.url === item.docLink || ctx.url.startsWith(item.realLink) }}"
          href="{{ item.docLink }}">
        <i class="iconfont">&#xe646;</i>
        {{ item.title }}( {{ item.docLen }} )
      </a>
    {% endfor %}

    <a class="panel-block-link"
        href="https://www.cnblogs.com/axes/"
        target="_blank">
      <i class="iconfont">&#xe646;</i>
      其他文章
    </a>
  </div>

  <div class="panel-block follow-me">
    <div class="panel-block-title">
      Follow Me
    </div>

    <a href="https://github.com/whxaxes" target="_blank" class="iconfont">&#xf1b4;</a>
    {# <a href="https://www.pixiv.net/member_illust.php?id=5527518&type=illust" target="_blank" class="iconfont">&#xe66b;</a>
    <a href="https://twitter.com/wanghxs" target="_blank" class="iconfont">&#xe64b;</a>
    <a href="https://www.facebook.com/profile.php?id=100011176477646" target="_blank" class="iconfont">&#xe66e;</a> #}
  </div>
</div>
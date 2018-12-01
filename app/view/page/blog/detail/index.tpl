{% require '~/component/subHead' title='博客详情' pathname=docInfo.docLink %}
{% require '~/component/markdown' %}
{% require '~/component/panel' %}

<div class="content">
  <div class="markdown-body">
    {% require fileUrl %}

    <div class="bottom-tips">
      <p>
        本文为原创文章，发布于 <code>{{ ctx.helper.formatDate(ctime, 'YYYY-MM-DD') }}</code>，
        如要转载请注明出处，有相关疑问可以 <a href="mailto:whxaxes@gmail.com">邮件</a> 我。
      </p>

      <p>如果觉得我的文章对你有帮助的话，欢迎打赏我一杯咖啡~（<a href="/public/images/alipay.jpeg" target="_blank">支付宝</a> 或 <a href="/public/images/wechat.jpeg" target="_blank">微信</a>）</p>
    </div>
  </div>

  <div class="float-mod">
    <div class="float-mod-title"># 导航</div>

    <div class="toc-index"></div>

    <div class="float-mod-title"># {{ docInfo.title || '博客列表' }}</div>

    <div class="doc-list">
      {% for doc in docList %}
        <a href="{{ doc.link }}"
           class="{{ 'active' if loop.index0 === blogIndex }}">{{ doc.title }}</a>
      {% endfor %}
    </div>
  </div>

  {% if prev || next %}
    <div class="other-detail">
      {% if prev %}
        <a href="//{{ ctx.host }}{{ prev.link }}"
           class="prev-detail">上一篇：{{ prev.title }}</a>
      {% endif %}

      {% if next %}
        <a href="//{{ ctx.host }}{{ next.link }}" 
           class="next-detail">下一篇：{{ next.title }}</a>
      {% endif %}
    </div>
  {% endif %}

  {% require '~/component/comment' %}
</div>

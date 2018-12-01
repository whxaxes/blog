{% require '~/component/markdown' %}
{% require '//unpkg.com/clipboard@2.0.0/dist/clipboard.min.js' %}

<div class="content">
  <a class="copy-btn" data-clipboard-target="#code">拷贝代码</a>

  <div class="markdown-body">
    <pre>
      <code class="language-{{ lang }}" id="code">{{ code }}</code>
    </pre>
  </div>
</div>


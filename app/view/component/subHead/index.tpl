<div class="title">
  <div class="title-inner">
    <a href="{{ ctx.protocol }}://{{ ctx.host }}{{ pathname || '' }}">Axes Blog</a>
    &nbsp;
    {% if title %}
      |&nbsp;{{ title }}
    {% endif %}
  </div>
</div>

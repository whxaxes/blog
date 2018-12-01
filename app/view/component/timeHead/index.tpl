<div class="title">
  <h1>
    <a href="{{ ctx.protocol }}://{{ ctx.host }}">Axes Blog</a>
    &nbsp;
    {% if title %}
      <span class="sub-title">{{ title }}</span>
    {% endif %}
  </h1>

  {% require '~/component/time' %}
</div>
{% require '~/component/timeHead' title=docInfo.title %}
{% require '~/component/panel' %}

<div class="blog-list">
  <ul class="nav">
    {% for doc in docList %}
      <li class="item">
        <a href="//{{ ctx.host }}{{ doc.link }}">
          {{ doc.title }}
          <span class="time">{{ ctx.helper.formatDate(doc.ctime) }}</span>
        </a>
      </li>
    {% endfor %}

    <li class="item">
      <a href="//{{ ctx.host }}/blog">更多...</a>
    </li>
  </ul>
</div>

{% require '~/component/blogStyle' %}

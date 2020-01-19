{% html lang="en" %}
  {% head %}
    <meta charset="UTF-8">
    <meta name="applicable-device" content="mobile">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1"/>
    <meta name="apple-mobile-web-app-capable" content="yes"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black"/>
    <meta name="format-detection" content="telephone=no, email=no"/>
    <meta name="renderer" content="webkit">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="HandheldFriendly" content="true">
    <meta name="MobileOptimized" content="320">
    <meta name="screen-orientation" content="portrait">
    <meta name="x5-orientation" content="portrait">
    <meta name="msapplication-tap-highlight" content="no">
    <title>Axes Blog</title>
    {% block head %}{% endblock %}
  {% endhead %}
  {% body %}
    {% if ctx.isLocal %}
      {% require '~/component/hmr' %}
    {% endif %}

    {% require '~/component/global' %}

    {% block body %}{% endblock %}

    {% require '~/component/footer' %}

    {% if !ctx.isLocal %}
      {% script %}
      var cnzz_protocol = (("https:" == document.location.protocol) ? " https://" : " http://");document.write(unescape("%3Cspan id='cnzz_stat_icon_1275527222'%3E%3C/span%3E%3Cscript src='" + cnzz_protocol + "s5.cnzz.com/z_stat.php%3Fid%3D1275527222%26show%3Dpic1' type='text/javascript'%3E%3C/script%3E"));
      {% endscript %}
    {% endif %}
  {% endbody %}
{% endhtml %}
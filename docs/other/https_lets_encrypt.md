# 站点支持 HTTPS/HTTP2

最近给自己的网站配置了 https/http2 ，记录一下以备忘。

## HTTPS

现在给自己站点 https 越来越容易了，证书可以直接申请 Let's Encrypt 。申请及配置教程如下

- 中文版

https://foofish.net/https-free-for-lets-encrypt.html

- 英文版

https://github.com/diafygi/acme-tiny

根据文档照着做的时候，唯一可能遇到的坎就是可能会发现自己的 openssl 的目录跟教程里的不太一样，可以通过以下命令查到自己的 openssl 的目录

```bash
$ openssl version -a | grep OPENSSLDIR
```

配置好 https 之后，可以配置将 http 的流量全部 301 到 https 下

```
server {
  listen  80;
  server_name wanghx.cn www.wanghx.cn;
  return 301 https://$host$request_uri;
}
```


## HTTP2

网站成功开启 https 之后，那自然也要开启 http2 了。在开启 http2 之前先看一下自己的 nginx 版本支不支持 http2 ，跑一下以下命令

```bash
$ nginx -V
```

然后看 `configure arguments` 里有木有 `--with-http_v2_module` 这个模块，如果没有，那么升级一下 nginx 到最新版本即可，如果是 centos 系统并且 nginx 是用 `yum` 装的，那么就可以直接用 `yum` 升级。

```bash
$ yum upgrade nginx
```

升级好之后再跑一下上面的命令，就发现会有这个模块了。然后就改一下 nginx 配置，配置一下即可

```
server {
  listen 443 ssl http2;
  server_name wanghx.cn www.wanghx.cn;
}
```


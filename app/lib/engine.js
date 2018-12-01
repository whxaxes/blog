const fs = require('fs');
const { EventEmitter } = require('events');
const UglifyJS = require('uglify-js');
const babel = require('babel-core');
const postcss = require('postcss');
const autoMath = require('postcss-automath');
const autoprefixer = require('autoprefixer');
const precss = require('precss');
const clean = require('postcss-clean');
const { FileCache } = require('./cache');
const MarkdownIt = require('markdown-it');
const Mus = require('node-mus').Mus;
const path = require('path');
const utils = require('./utils');
const checkHttpRE = /^(?:https?:)?\/\//;

function initMarkdown(app) {
  const md = new MarkdownIt({ linkify: true });

  // heading add id/class
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const content = (tokens[idx + 1] || {}).content;
    content && tokens[idx].attrPush([ 'id', `heading-${content}` ]);
    tokens[idx].attrPush([ 'class', 'markdown-head' ]);
    return self.renderToken(tokens, idx, options);
  };

  // link add target
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrPush([ 'target', '_blank' ]);
    const aIndex = token.attrIndex('href');
    const jsUrl = utils.join(path.dirname(env.resUrl), token.attrs[aIndex][1]);
    if (jsUrl.endsWith('.js') && jsUrl.startsWith(app.config.biz.docDir)) {
      const jsFile = jsUrl.substring(app.config.biz.docDir.length);
      token.attrs[aIndex][1] = `/blog/code?url=${encodeURIComponent(jsFile)}`;
    }
    return self.renderToken(tokens, idx, options);
  };

  // update image url
  md.renderer.rules.image = (tokens, idx, options, env) => {
    const token = tokens[idx];
    let src = token.attrs[token.attrIndex('src')][1];
    const imgUrl = utils.join(path.dirname(env.resUrl), src);
    if (imgUrl.startsWith(app.config.biz.docDir)) {
      src = path.join(app.config.static.prefix, imgUrl.substring(app.config.biz.docDir.length));
    }
    return `<a href="${src}" class="img-link" target="_blank" rel="noopener noreferrer"><img src="${src}"></a>`;
  };

  return md;
}

class PowerMus extends Mus {
  constructor(app, options) {
    super(options);
    this.app = app;
    this.evt = new EventEmitter();
    this.logger = app.logger;
    this.isLocal = app.config.env === 'local';
    this.resource = {};
    this.manifest = {};
    this.md = initMarkdown(app);
    this.fileCache = new FileCache({ file: options.resourceCacheFile });

    // register custom tags
    this.addPowerTags();
  }

  // render page
  async renderPage(ctx, file, options) {
    // init resource
    this.resource.pre = '';
    this.resource.after = '';
    this.resource.body = [];
    this.resource.head = [];
    this.resource.style = [];
    this.resource.script = [];
    this.resource.sources = [];

    // render
    super.renderString(
      `{% extends './layout.tpl' %}{% block body %}{% require './page/${file}' %}{% endblock %}`,
      options
    );

    // for hmr
    this.evt.emit('update-source', {
      reqPath: ctx.path,
      sources: this.resource.sources,
    });

    // head/body html
    const head = this.resource.head.map(({ code }) => code).join('');
    const body = this.resource.body.map(({ code }) => code).join('');

    // create styles
    const style = await Promise.all(
      this.resource.style.map(async ({ fileUrl, isRemote, code }) => {
        return isRemote
          ? `<link rel="stylesheet" href='${fileUrl}'>`
          : `<style>${code || (await this.readResource(fileUrl))}</style>`;
      })
    );

    // create scripts
    const script = await Promise.all(
      this.resource.script.map(async ({ fileUrl, isRemote, attr, code }) => {
        attr = attr || {};
        return isRemote
          ? `<script ${attr.async ? 'async ' : ''}src='${fileUrl}'></script>`
          : `<script>${await (code ? this.parseJs(code) : this.readResource(fileUrl))}</script>`;
      })
    );

    // combine all fragment
    ctx.body =
      this.resource.pre +
      `<head>${head}${style.join('\n')}</head>` +
      `<body>${body}${script.join('\n')}</body>` +
      this.resource.after;
  }

  // read resource
  async readResource(fileUrl) {
    return await this.fileCache.wrap(fileUrl, async () => {
      let code = fs.readFileSync(fileUrl, { encoding: 'utf8' });
      const extname = path.extname(fileUrl);
      if (extname === '.js') {
        code = await this.parseJs(code, fileUrl);
      } else if (extname === '.scss') {
        code = await this.parseScss(code, fileUrl);
      }

      return code;
    });
  }

  // parse scss
  async parseScss(code, fileUrl) {
    return await postcss([
      autoprefixer({
        browsers: [ 'iOS >= 7', 'Android >= 4.0' ],
      }),
      precss(),
      autoMath(),
      ...this.isLocal ? [] : [ clean() ],
    ])
      .process(code, { from: fileUrl })
      .then(({ content }) => content)
      .catch(e => {
        this.logger.error(e);
        return '';
      });
  }

  // parse js
  async parseJs(code) {
    if (this.isLocal) {
      return code;
    }

    let newCode = babel.transform(code, { presets: 'env' }).code;
    const result = UglifyJS.minify(newCode, {
      compress: { drop_console: true },
    });

    if (result.code) {
      newCode = result.code;
    } else if (result.error) {
      this.logger.error(result.error);
      return '';
    }

    return newCode;
  }

  getAstByUrl(templateUrl) {
    this.resource.sources.push(templateUrl);
    return super.getAstByUrl(templateUrl);
  }

  // resolve path
  resolvePath(fromUrl, toUrl) {
    if (path.isAbsolute(toUrl)) {
      return toUrl;
    }

    let dir;
    if (toUrl.startsWith('~/')) {
      toUrl = toUrl.substring(2);
      dir = this.baseDir;
    } else {
      dir = fromUrl ? path.dirname(fromUrl) : this.baseDir;
    }

    return path.resolve(dir, toUrl);
  }

  // add resource
  addSources(url) {
    if (this.resource.sources.includes(url)) {
      return false;
    }

    this.resource.sources.push(url);
    return true;
  }

  // add custom tags
  addPowerTags() {
    // compose html
    this.setTag('html', {
      render: (attr, scope, { compile, el }) => {
        this.resource.pre = `<!DOCTYPE html><html lang="${attr.lang}">`;
        this.resource.after = '</html>';

        // compile subnode
        compile(el.children, scope);

        return '';
      },
    });

    // collect inline codes
    [ 'head', 'body', 'style', 'script' ].forEach(tag => {
      this.setTag(tag, {
        render: (attr, scope, { compile, el }) => {
          const code = compile(el.children, scope);
          this.resource[tag].push({ code });
        },
      });
    });

    // require js/css/tpl/component/md ...
    this.setTag('require', {
      unary: true,
      attrName: 'href',
      render: (attr, scope, { fileUrl, include }) => {
        const isRemote = checkHttpRE.test(attr.href);
        const resUrl = isRemote ? attr.href : this.resolvePath(fileUrl, attr.href);
        const handleUrl = resUrl => {
          // collect all url
          const addResult = this.addSources(resUrl);
          const extname = path.extname(resUrl);
          const resourceObj = { fileUrl: resUrl, isRemote, attr };

          if (extname === '.tpl') {
            // require template
            return include(resUrl, { ...scope, ...attr });
          } else if (addResult && [ '.css', '.scss' ].includes(extname)) {
            // require css|scss
            this.resource.style.push(resourceObj);
          } else if (addResult && extname === '.js') {
            // require js
            this.resource.script.push(resourceObj);
          } else if (extname === '.md') {
            // require markdown
            const code = fs.readFileSync(resUrl, { encoding: 'utf8' });
            return this.fileCache.wrap(resUrl, () => this.md.render(code, { resUrl }));
          } else if (fs.existsSync(resUrl) && fs.statSync(resUrl).isDirectory()) {
            // require component
            return [ '.tpl', '.css', '.scss', '.js' ]
              .map(ext => {
                const fsUrl = path.resolve(resUrl, `index${ext}`);
                if (fs.existsSync(fsUrl)) return handleUrl(fsUrl) || '';
                return '';
              })
              .join('');
          }
        };

        return handleUrl(resUrl) || '';
      },
    });
  }
}

module.exports = app => {
  return new PowerMus(app, app.config.mus);
};

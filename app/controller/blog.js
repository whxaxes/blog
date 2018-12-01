const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { Controller } = require('egg');
const readFile = promisify(fs.readFile);

class ProgressiveController extends Controller {
  async index() {
    const { ctx, app } = this;
    const visitUrl = app.config.biz.docForwardUrl[ctx.url] || ctx.url;
    const mdPath = visitUrl.substring(app.config.biz.docPrefix.length);
    const extname = path.extname(mdPath);
    const docDir = app.config.biz.docDir;

    if (!extname) {
      const dirPath = path.resolve(docDir, mdPath);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return;
      }

      const { docList, docInfo } = await this.service.blog.getDocInfo(dirPath);
      if (!docList.length) return;

      const allInfo = await this.service.blog.readAllInfo();
      await ctx.render('blog/list', {
        docList,
        docInfo,
        allInfo,
      });
    } else if (extname === '.html') {
      const fileUrl = path.resolve(docDir, `${mdPath.replace(/\.html$/, '.md')}`);
      if (!fs.existsSync(fileUrl)) {
        return;
      }

      const { docList, docInfo } = await this.service.blog.getDocInfo(path.dirname(fileUrl));
      const index = docList.findIndex(doc => doc.fileUrl === fileUrl);
      const allInfo = await this.service.blog.readAllInfo();
      await ctx.render('blog/detail', {
        prev: docList[index + 1],
        next: docList[index - 1],
        blogIndex: index,
        docInfo,
        docList,
        allInfo,
        ...docList[index],
      });
    } else if (extname === '.md') {
      ctx.status = 301;
      ctx.redirect(ctx.url.replace(/\.md$/, '.html'));
    }
  }

  async dashboard() {
    const allInfo = await this.service.blog.readAllInfo();
    await this.ctx.render('blog/index', { allInfo });
  }

  async code() {
    const codeUrl = this.ctx.query.url;
    const fileUrl = codeUrl && path.join(this.app.config.biz.docDir, codeUrl.substring(1));
    const lang = path.extname(fileUrl).substring(1);
    if (
      !fileUrl.startsWith(this.app.config.biz.docDir) ||
      !fs.existsSync(fileUrl) ||
      ![ 'js', 'css' ].includes(lang)
    ) {
      return;
    }

    await this.ctx.render('blog/code', {
      lang,
      code: await readFile(fileUrl, { encoding: 'utf-8' }),
    });
  }
}

module.exports = ProgressiveController;

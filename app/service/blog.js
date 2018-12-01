const Service = require('egg').Service;
const { FileCache } = require('../lib/cache');
const utils = require('../lib/utils');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const readFile = promisify(fs.readFile);
let fileCache;

module.exports = class BlogService extends Service {
  constructor(ctx) {
    super(ctx);
    fileCache = fileCache || new FileCache();
    this.docDir = this.app.config.biz.docDir;
    this.docForward = {};
    Object.keys(this.app.config.biz.docForwardUrl).forEach(k => {
      this.docForward[this.app.config.biz.docForwardUrl[k]] = k;
    });
  }

  async getDocInfo(dirPath) {
    const mdList = fileCache.wrap(dirPath, () =>
      fs.readdirSync(dirPath).filter(name => name.endsWith('.md'))
    );

    const docInfo = await this.readInfo(dirPath);
    const metaInfo = docInfo.meta || {};
    let docList = await Promise.all(
      mdList.map(name => {
        const fileUrl = path.resolve(dirPath, name);
        return fileCache.wrap(fileUrl, async () => {
          const mdInfo = await utils.getMdInfo(fileUrl);
          const fileName = path.basename(name, '.md');
          return {
            fileUrl,
            link: `${this.app.config.biz.docPrefix}${fileUrl
              .substring(this.docDir.length + 1)
              .replace(/\.md$/, '.html')}`,
            ctime: +fs.statSync(fileUrl).mtime,

            // markdown file info
            ...mdInfo,

            // merge meta info
            ...metaInfo[fileName],
          };
        });
      })
    );

    if (!this.ctx.isLocal) {
      // do not show blog which is WIP
      docList = docList.filter(doc => !doc.isWIP);
    }

    return {
      docList: docList.sort((a, b) => b.ctime - a.ctime),
      docInfo,
    };
  }

  async readAllInfo() {
    const allInfo = await Promise.all(
      fs.readdirSync(this.docDir).map(async dir => {
        return await this.readInfo(path.resolve(this.docDir, dir));
      })
    );

    return allInfo
      .filter(info => info && info.title && !!info.docLen)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  async readInfo(dirPath) {
    let docInfo;
    const docInfoPath = path.resolve(dirPath, 'info.json');
    if (fs.existsSync(docInfoPath)) {
      docInfo = await fileCache.wrap(docInfoPath, async () => {
        const info = JSON.parse(await readFile(docInfoPath, { encoding: 'utf-8' }));
        const meta = info.meta || {};
        info.docLen = Object.keys(meta).filter(k => !!meta[k].ctime).length;
        const link = `${this.app.config.biz.docPrefix}${dirPath.substring(this.docDir.length + 1)}`;
        info.docLink = this.docForward[link] || link;
        info.realLink = link;
        return info;
      });
    }
    return docInfo;
  }
};

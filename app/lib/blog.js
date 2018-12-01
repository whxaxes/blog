const path = require('path');
const Github = require('./github');
const { promisify } = require('util');
const fs = require('fs');
const assert = require('assert');
const glob = require('fast-glob');
const chokidar = require('chokidar');
const utils = require('./utils');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

module.exports = class Blog {
  constructor(app) {
    this.app = app;
    this.logger = app.logger;
    this.loading = false;
    this.config = this.app.config.github;
    this.github = new Github(app);
    this.githubDir = path.resolve(this.app.config.biz.docDir, './github');
    this.githubInfoPath = path.resolve(this.githubDir, './info.json');

    // only sync in local
    if (app.config.env === 'local') {
      setTimeout(async () => {
        await this.syncMdMeta();
        const watcher = chokidar.watch(this.app.config.biz.docDir);
        watcher
          .on('add', this.syncMdMeta.bind(this))
          .on('change', this.syncMdMeta.bind(this))
          .on('unlink', this.syncMdMeta.bind(this));
      }, 100);
    }
  }

  getMetaInfo(content) {
    const matches = content.match(/^\s*#\s*([^\n]+)\n+/);
    return matches
      ? {
        title: matches[1],
        body: content.substring(matches[0].length),
      }
      : {};
  }

  async syncMdMeta(file) {
    let files;
    if (file && path.extname(file) === '.md') {
      files = [ file ];
    } else if (!file) {
      files = await glob(path.resolve(this.app.config.biz.docDir, './**/*.md'));
    }

    if (!files || !files.length) {
      return;
    }

    const needUpdate = {};
    const infoCache = {};
    await Promise.all(
      files.map(async url => {
        const dirname = path.dirname(url);
        const fileName = path.basename(url, '.md');
        const infoPath = path.resolve(dirname, 'info.json');
        infoCache[infoPath] =
          infoCache[infoPath] ||
          (fs.existsSync(infoPath)
            ? JSON.parse(fs.readFileSync(infoPath, { encoding: 'utf-8' }) || '{}')
            : {});

        const meta = (infoCache[infoPath].meta = infoCache[infoPath].meta || {});

        if (fs.existsSync(url)) {
          meta[fileName] = meta[fileName] || {};
          const { isWIP } = await utils.getMdInfo(url);
          if (!isWIP && !meta[fileName].ctime) {
            meta[fileName].ctime = +fs.statSync(url).mtime;
          } else if (isWIP && meta[fileName].ctime) {
            delete meta[fileName].ctime;
          } else {
            return;
          }
        } else if (meta[fileName]) {
          delete meta[fileName];
        } else {
          return;
        }

        needUpdate[infoPath] = true;
      })
    );

    await Object.keys(needUpdate).map(p => {
      this.logger.info('update info ' + p);
      return writeFile(p, JSON.stringify(infoCache[p], null, 2));
    });
  }

  // sync github issue to local
  async syncIssueToLocal() {
    const startTime = Date.now();
    const issueList = await this.github.issue();
    const myIssueList = issueList
      .filter(issue => issue.user.login === this.app.config.github.name)
      .reverse();

    const docInfo = {
      type: 'github',
      meta: {},
    };

    await Promise.all(
      myIssueList.map(async (issue, index) => {
        const mdTitle = issue.title;
        const mdBody = issue.body;
        const mdContent = `# ${mdTitle}\n${mdBody}`;
        const fileName = `issue${index + 1}`;
        await writeFile(path.resolve(this.githubDir, `./${fileName}.md`), mdContent);
        docInfo.meta[fileName] = this.getMetaByIssue(issue);
      })
    );

    await writeFile(this.githubInfoPath, JSON.stringify(docInfo, null, 2));

    this.logger.info(
      `sync success, sync count ${myIssueList.length}, sync time ${Date.now() - startTime}ms`
    );
  }

  getMetaByIssue(issue) {
    return {
      originUrl: issue.html_url,
      issueId: issue.number,
      // make sure sync time later than mtime
      syncTime: Date.now() + 100,
      ctime: +new Date(issue.created_at),
    };
  }

  // sync local issue to github
  async syncIssueToRemote() {
    let docInfo;
    try {
      docInfo = JSON.parse(await readFile(this.githubInfoPath, { encoding: 'utf-8' }));
      assert(!!docInfo.meta, 'meta 为空');
    } catch (e) {
      this.syncIssueToLocal();
      return this.logger.error(e);
    }

    let hasUpdate = false;
    const meta = docInfo.meta;
    const issueList = await glob(path.resolve(this.githubDir, '*.md'));
    await Promise.all(
      issueList.map(async fileUrl => {
        const name = path.basename(fileUrl, '.md');
        const issueMeta = meta[name] || {};
        const fileStat = fs.statSync(fileUrl);
        const isNewer =
          !issueMeta.syncTime || !issueMeta.issueId || +fileStat.mtime > issueMeta.syncTime;

        // no need to update
        if (!isNewer) return null;

        // get title body from md
        const { title, body, isWIP } = await utils.getMdInfo(fileUrl);

        // work in progress
        if (!title || isWIP || body.trim().length < 100) return null;

        // replace img url to remote
        const newBody = body.replace(/\!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
          src = path.join(
            `//${this.app.config.github.webHost}${this.app.config.static.prefix}`,
            utils.join(path.dirname(fileUrl), src).substring(this.app.config.biz.docDir.length)
          );

          return `![${alt || ''}](${src})`;
        });

        // update issue to remote
        const issue = await this.github.issue(title, newBody, issueMeta.issueId);
        meta[name] = this.getMetaByIssue(issue);
        hasUpdate = true;
        this.logger.info(`update [${fileUrl}] to issue ${meta[name].issueId}`);
        return true;
      })
    );

    if (hasUpdate) {
      await writeFile(this.githubInfoPath, JSON.stringify(docInfo, null, 2));
    }
  }

  async sync() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    await this.syncIssueToRemote().catch(e => {
      this.logger.error(e);
    });

    this.loading = false;
  }
};

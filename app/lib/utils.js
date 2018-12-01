const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const checkHttpRE = /^(?:https?:)?\/\//;

exports.checkHttp = url => {
  return checkHttpRE.exec(url);
};

exports.join = (dir, pathname) => {
  return exports.checkHttp(pathname) ? pathname : path.join(dir, pathname);
};

exports.isWorkInProgress = title => {
  return title.match(/^\[wip]/i);
};

exports.getMdInfo = async fileUrl => {
  if (!fs.existsSync(fileUrl)) {
    return {};
  }

  const content = await readFile(fileUrl, { encoding: 'utf8' });
  const matches = content.match(/^\s*#\s*([^\n]+)\n+/);
  if (!matches) {
    return {};
  }

  const title = matches[1];
  return {
    title,
    body: content.substring(matches[0].length),
    isWIP: exports.isWorkInProgress(title),
  };
};

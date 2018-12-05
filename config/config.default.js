

const fs = require('fs');
const path = require('path');
const conf = require('../conf');

/**
 * @param {import('egg').EggAppInfo} appInfo
 */
module.exports = appInfo => {
  const config = (exports = {});
  const cacheDir = path.resolve(__dirname, '../.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1506566428836_4857';

  // add your config here
  config.middleware = [ 'accesslog' ];

  config.access = {
    ignore: [],
  };

  config.github = {
    ...conf.github,
  };

  config.logrotator = {
    maxDays: 7,
  };

  config.security = {
    csrf: {
      ignore: '/sync/',
    },
  };

  config.mus = {
    resourceCacheFile: path.resolve(cacheDir, './resources.json'),
    baseDir: path.resolve(__dirname, '../app/view'),
    compress: true,
  };

  config.whistle = {
    ...conf.whistleConfig,
  };

  config.static = {
    prefix: '/public/',
    dir: [
      path.resolve(appInfo.baseDir, './docs'),
      path.resolve(appInfo.baseDir, './app/view/static'),
    ],
    filter: file => file.match(/\.(png|jpe?g|eot|ttf|svg)$/i),
  };

  return {
    ...config,

    biz: {
      docDir: path.resolve(appInfo.baseDir, './docs'),
      docPrefix: '/blog/',
      docForwardUrl: {
        '/': '/blog/github',
      },
      startTime: '2018-04-06 02:30:00',
    },
  };
};

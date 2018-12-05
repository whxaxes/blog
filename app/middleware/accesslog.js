

const util = require('util');
const moment = require('moment');

/**
 * @returns {(ctx: import('egg').Context, next: any) => Promise<any>}
 */
module.exports = () => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();

    const ignoreList = ctx.app.config.access.ignore || [];
    if (ignoreList.find(pathname => ctx.url.startsWith(pathname))) {
      return;
    }

    const ip = ctx.get('X-Real-IP') || ctx.ip;
    const port = ctx.get('X-Real-Port');
    const timestamp = ctx.get('X-Timestamp') || '-';
    const time = moment().format('MM-DD HH:mm:ss');
    const responseTime = Date.now() - start;
    const protocol = ctx.protocol.toUpperCase();
    const method = ctx.method;
    const url = ctx.url;
    const version = ctx.req.httpVersionMajor + '.' + ctx.req.httpVersionMinor;
    const status = ctx.status;
    const contentLength = ctx.length || '-';
    const referrer = ctx.get('referrer') || '-';
    const ua = ctx.get('user-agent') || '-';
    const message = util.format(
      '[accesslog] %s:%s - [%s] "%s %s %s/%s" %s %s "%s" "%s" %sms %s',
      ip,
      port,
      time,
      method,
      url,
      protocol,
      version,
      status,
      contentLength,
      referrer,
      ua,
      responseTime,
      timestamp
    );

    ctx.logger.info(message);
  };
};

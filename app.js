/**
 * @param {import('egg').Application} app
 */
module.exports = app => {
  if (app.config.env === 'local') {
    require('./app/lib/hmr')(app);
  }
};

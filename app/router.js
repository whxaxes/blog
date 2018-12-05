/**
 * @param {import('egg').Application} app egg app
 */
module.exports = app => {
  const { controller, router } = app;

  // home
  router.post('/sync', controller.home.sync);

  // blog
  router.get('/', controller.blog.index);
  router.get('/blog', controller.blog.dashboard);
  router.get('/blog/code', controller.blog.code);
  router.get('/blog/*', controller.blog.index);
};

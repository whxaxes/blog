

module.exports = app => {
  // home
  app.post('/sync', 'home.sync');
  // app.post('/sync/local', 'home.syncLocal');

  // blog
  app.get('/', 'blog.index');
  app.get('/blog', 'blog.dashboard');
  app.get('/blog/code', 'blog.code');
  app.get('/blog/*', 'blog.index');
};

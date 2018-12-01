

const Blog = require('./app/lib/blog');

module.exports = app => {
  const blog = new Blog(app);

  // subscribe
  blog.github.sub();

  // sync local data to github
  app.messenger.on('sync_data', blog.sync.bind(blog));

  // sync github data to local
  app.messenger.on('sync_data_local', blog.syncIssueToLocal.bind(blog));
};

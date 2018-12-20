/**
 * @param {import('egg').Agent} app
 */
module.exports = app => {
  const blog = app.blog;

  // sync local data to github
  app.messenger.on('sync_data', () => {
    blog.sync();
  });

  // sync github data to local
  // app.messenger.on('sync_data_local', () => {
  //   blog.syncIssueToLocal();
  // });
};

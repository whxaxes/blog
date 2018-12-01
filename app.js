module.exports = app => {
  if (app.config.env === 'local') {
    require('./app/lib/hmr')(app);
  }
};

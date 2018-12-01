module.exports = {
  get isLocal() {
    return this.app.config.env === 'local';
  },

  async render(file, options) {
    await this.app.mus.renderPage(this, file, {
      ...options,
      ...this.locals,
      ctx: this,
      now: new Date(),
    });
  },
};

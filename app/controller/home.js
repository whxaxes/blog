

const { Controller } = require('egg');

class HomeController extends Controller {
  async sync() {
    this.app.messenger.sendToAgent('sync_data');
    this.ctx.body = '';
  }

  async syncLocal() {
    this.app.messenger.sendToAgent('sync_data_local');
    this.ctx.body = '';
  }
}

module.exports = HomeController;

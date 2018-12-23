const mm = require('egg-mock').default;
const sleep = require('co-sleep');

describe('app.test.js', () => {
  let app;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    await mm.restore();
    await sleep(1000);
  });

  it('should use hmr in local', async () => {
    mm(process.env, 'EGG_SERVER_ENV', 'local');
    app = mm.app();
    await app.ready();
    expect(!!app.hmrInstalled).toBe(true);
  }, 10000);

  it('should not use hmr in unittest', async () => {
    app = mm.app();
    await app.ready();
    expect(!!app.hmrInstalled).toBe(false);
  });
});

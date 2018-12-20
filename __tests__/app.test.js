const mm = require('egg-mock').default;

describe('app.test.js', () => {
  afterEach(mm.restore);

  // it('should use hmr in local', async () => {
  //   mm(process.env, 'EGG_SERVER_ENV', 'local');
  //   const app = mm.app();
  //   await app.ready();
  //   expect(!!app.hmrInstalled).toBe(true);
  //   await app.close();
  // });

  it('should not use hmr in unittest', async () => {
    const app = mm.app();
    await app.ready();
    expect(!!app.hmrInstalled).toBe(false);
    await app.close();
  });
});

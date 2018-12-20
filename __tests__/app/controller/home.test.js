const mm = require('egg-mock').default;

describe('controller/home.test.js', () => {
  const app = mm.app();

  beforeAll(() => app.ready());
  afterAll(() => app.close());
  afterEach(mm.restore);

  it('should visit /sync without error', async done => {
    /** @type {import('egg').Agent} */
    const agent = app.agent;
    mm(agent.blog, 'sync', done);

    await app
      .httpRequest()
      .post('/sync')
      .expect(200);
  });
});

const mm = require('egg-mock').default;

describe('controller/blog.test.js', () => {
  const app = mm.app();
  beforeAll(() => app.ready());
  afterAll(() => app.close());

  it('should visit / without error', async () => {
    await app
      .httpRequest()
      .get('/')
      .expect(200);
  });

  it('should visit blog list without error', async () => {
    await app
      .httpRequest()
      .get('/blog/progressive')
      .expect(200);
  });

  it('should visit blog detail without error', async () => {
    await app
      .httpRequest()
      .get('/blog/progressive/lesson1.html')
      .expect(200);
  });

  it('should redirect to *.html if visit *.md', async () => {
    await app
      .httpRequest()
      .get('/blog/progressive/lesson1.md')
      .expect(301);
  });

  it('should visit /blog without error', async () => {
    await app
      .httpRequest()
      .get('/blog')
      .expect(200);
  });

  it('should visit /code with js without error', async () => {
    await app
      .httpRequest()
      .get('/blog/code?url=' + encodeURIComponent('/progressive/demo/httptest.1.js'))
      .expect(200);
  });

  it('should visit file which is not exist without error', async () => {
    await app
      .httpRequest()
      .get('/blog/code?url=' + encodeURIComponent('/progressive/demo/httptest.1.css'))
      .expect(404);
  });

  it('should visit danger files 404', async () => {
    await app
      .httpRequest()
      .get('/blog/code?url=' + encodeURIComponent('../config/config.default.js'))
      .expect(404);
  });
});

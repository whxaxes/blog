const request = require('supertest');

describe('httptest.5.js', () => {
  let server;

  beforeAll(() => {
    server = require('../httptest.5');
  });

  afterAll(() => {
    server.close();
  });

  describe('notLogin', () => {
    it('should redirect to login page', async () => {
      await request(server)
        .get('/')
        .expect(302)
        .expect(/login/);
    });
  });

  describe('hasLogin', () => {
    let cookie;

    beforeAll(async () => {
      const resp = await request(server)
        .post('/login')
        .send('username=123&password=123');
      cookie = resp.header['set-cookie'][0].split(';')[0];
    });

    it('should visit / without error', async () => {
      await request(server)
        .get('/')
        .set('Cookie', cookie)
        .expect(200)
        .expect(/博客列表/);
    });

    it('should 404 when visit unknown url', async () => {
      await request(server)
        .get('/asd')
        .set('Cookie', cookie)
        .expect(404);
    });

    it('should visit /detail without error', async () => {
      await request(server)
        .get('/detail/123')
        .set('Cookie', cookie)
        .expect(200)
        .expect(/我是标题/);

      await request(server)
        .get('/detail/111')
        .set('Cookie', cookie)
        .expect(404);
    });

    it('should visit /edit without error', async () => {
      await request(server)
        .get('/edit/123')
        .set('Cookie', cookie)
        .expect(200)
        .expect(/提交数据/);

      await request(server)
        .post('/edit/123')
        .set('Cookie', cookie)
        .send({ title: 'jest', content: 'jest test' })
        .expect(200);

      await request(server)
        .get('/detail/123')
        .set('Cookie', cookie)
        .expect(200)
        .expect(/jest/)
        .expect(/jest test/);

      await request(server)
        .post('/edit')
        .send({ title: 'newBlog', content: 'new blog' })
        .set('Cookie', cookie)
        .expect(200);

      await request(server)
        .get('/')
        .set('Cookie', cookie)
        .expect(/newBlog/);
    });

    it('should visit logout without error', async () => {
      await request(server)
        .get('/logout')
        .set('Cookie', cookie)
        .expect(302);

      await request(server)
        .get('/')
        .set('Cookie', cookie)
        .expect(302)
        .expect(/login/);
    });
  });

  describe('static server', () => {
    it('should visit /static/submitBlog_1 without error', async () => {
      const resp = await request(server)
        .get('/static/submitBlog_1.js')
        .expect(200);

      expect(resp.header.etag).toMatch(/\w+/);
      expect(!!resp.header['last-modified']).toBe(true);
      expect(resp.header['cache-control']).toMatch(/max-age=\d+, public/);
      expect(resp.header['content-encoding']).toBe('gzip');

      await request(server)
        .get('/static/submitBlog_1.js')
        .set('If-None-Match', resp.header.etag)
        .set('If-Modified-Since', resp.header['last-modified'])
        .expect(304);

      await request(server)
        .get('/static/submitBlog_1.js')
        .set('If-None-Match', resp.header.etag)
        .set('If-Modified-Since', resp.header['last-modified'])
        .set('Cache-Control', 'no-cache')
        .expect(200);
    });
  });
});

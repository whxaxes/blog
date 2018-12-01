const request = require('supertest');

describe('httptest.2.js', () => {
  let server;

  beforeAll(() => {
    server = require('../httptest.2');
  });

  afterAll(() => {
    server.close();
  });

  it('should visit / without error', async () => {
    await request(server)
      .get('/')
      .expect(200)
      .expect(/博客列表/);
  });

  it('should 404 when visit unknown url', async () => {
    await request(server)
      .get('/asd')
      .expect(404);
  });

  it('should visit /detail without error', async () => {
    await request(server)
      .get('/detail/123')
      .expect(200)
      .expect(/我是标题/);

    await request(server)
      .get('/detail/111')
      .expect(404);
  });

  it('should visit /edit without error', async () => {
    await request(server)
      .get('/edit/123')
      .expect(200)
      .expect(/提交数据/);

    await request(server)
      .post('/edit/123')
      .send({ title: 'jest', content: 'jest test' })
      .expect(200);

    await request(server)
      .get('/detail/123')
      .expect(200)
      .expect(/jest/)
      .expect(/jest test/);

    await request(server)
      .post('/edit')
      .send({ title: 'newBlog', content: 'new blog' })
      .expect(200);

    await request(server)
      .get('/')
      .expect(/newBlog/);
  });
});

const request = require('supertest');

describe('progressive/demo/httptest.1.js', () => {
  let server;

  beforeAll(() => {
    server = require('../httptest.1');
  });

  afterAll(() => {
    server.close();
  });

  it('should visit / without error', async () => {
    await request(server)
      .get('/')
      .expect(/hello nodejs/);
  });

  it('should visit /whx without error', async () => {
    await request(server)
      .get('/whx')
      .expect(/hello whx/);
  });
});

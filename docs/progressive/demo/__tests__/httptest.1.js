const request = require('supertest');
let server;

beforeAll(() => {
  server = require('../httptest.1');
});

afterAll(() => {
  server.close();
});

test('should visit / without error', async () => {
  await request(server)
    .get('/')
    .expect(/hello nodejs/);
});

test('should visit /whx without error', async () => {
  await request(server)
    .get('/whx')
    .expect(/hello whx/);
});

// This file is created by egg-ts-helper
// Do not modify this file!!!!!!!!!

import 'egg';
import ExportAccesslog = require('../../../app/middleware/accesslog');

declare module 'egg' {
  interface IMiddleware {
    accesslog: typeof ExportAccesslog;
  }
}

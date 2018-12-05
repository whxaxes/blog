// This file is created by egg-ts-helper
// Do not modify this file!!!!!!!!!

import 'egg';
import ExportBlog = require('../../../app/service/blog');

declare module 'egg' {
  interface IService {
    blog: ExportBlog;
  }
}

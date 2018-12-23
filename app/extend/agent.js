const Blog = require('../lib/blog');
const { watch } = require('./application');
const BLOG_SYMBOL = Symbol('Agent#blog');

module.exports = {
  /**
   * @type {Blog}
   */
  get blog() {
    if (!this[BLOG_SYMBOL]) {
      this[BLOG_SYMBOL] = new Blog(this);
    }

    return this[BLOG_SYMBOL];
  },

  watch,
};

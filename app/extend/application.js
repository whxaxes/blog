const MUS_SYMBOL = Symbol('Application#mus');
const engine = require('../lib/engine');

module.exports = {
  /**
   * @type {ReturnType<typeof engine>}
   */
  get mus() {
    if (!this[MUS_SYMBOL]) {
      this[MUS_SYMBOL] = engine(this);
    }

    return this[MUS_SYMBOL];
  },
};

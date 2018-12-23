const MUS_SYMBOL = Symbol('Application#mus');
const engine = require('../lib/engine');
const chokidar = require('chokidar');

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

  /**
   * @param {import('chokidar').WatchedPaths} paths
   * @param {import('chokidar').WatchOptions} [options]
   * @returns {import('chokidar').FSWatcher}
   */
  watch(paths, options) {
    const watcher = chokidar.watch(paths, options);
    this.once('close', () => watcher.close());
    return watcher;
  },
};

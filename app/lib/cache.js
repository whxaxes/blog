const { EventEmitter } = require('events');
const fs = require('fs');

class FileCache extends EventEmitter {
  constructor(options = {}) {
    super();

    this.file = options.file;
    this.store = fs.existsSync(this.file) ? require(this.file) : {};

    // clean files which is not exist
    Object.keys(this.store).forEach(file => {
      if (!fs.existsSync(file)) delete this.store[file];
    });
  }

  // sync resource to local
  syncToLocal() {
    if (!this.file) return;
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      if (fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(this.store));
      }
    }, 2000);
  }

  // wrap file cache
  wrap(fileUrl, fn) {
    const cache = this.store[fileUrl];
    if (cache && cache.data && fs.statSync(fileUrl).mtime < cache.getTime) {
      // only read cache when outdated
      return cache.data;
    }

    // update cache
    const updateCache = cacheData => {
      // cache
      this.store[fileUrl] = {
        data: cacheData || '',
        getTime: Date.now(),
      };

      this.syncToLocal();

      return cacheData;
    };

    const result = fn(fileUrl);
    if (result && typeof result.then === 'function') {
      return result.then(updateCache);
    }

    return updateCache(result);
  }
}

exports.FileCache = FileCache;

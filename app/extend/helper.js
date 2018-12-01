const moment = require('moment');

module.exports = {
  formatDate(time, format) {
    if (!time) {
      return '';
    }

    const date = new Date();
    date.setTime(time);
    if (format) {
      return moment(date).format(format);
    }

    const now = new Date();
    if (now.getFullYear() === date.getFullYear()) {
      return moment(date).format('MM-DD');
    }

    return moment(date).format('YYYY-MM-DD');
  },
};

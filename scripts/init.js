const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const configPath = path.resolve(__dirname, '../conf.js');
const initConf = `
module.exports = {
  // github config
  github: {
    name: '',
    token: '',
    webHost: '',
    repo: '',
  },

  // ssh config
  sshConfig: {
    host: '',
    port: 22,
    username: '',
    privateKey: '',
    distDir: '',
  },

  // nginx config
  nginxConfig: {
    dist: '',
    serverName: '',
    sslCert: '',
    sslCertKey: '',
    challenges: '',
  },

  // whistle config
  whistleConfig: {},
};
`;

// write conf.js
if (!fs.existsSync(configPath)) {
  console.info('save file' + configPath);
  fs.writeFileSync(configPath, initConf);
} else {
  console.info('file exist, skip ' + configPath);
}

// create typings
shell.exec('ets');

// init completed
console.info('init completed');

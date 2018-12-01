const fs = require('fs');
const getPort = require('get-port');
const conf = require('../conf');
const assert = require('assert');
const shell = require('shelljs');
const path = require('path');
const mus = require('node-mus');
const urllib = require('urllib');
const REGEX = /^\w+\s*(\d+)\s+(.*)/;
const PORT_REGEX = /"port":"(\d+)"/;
const pkgInfo = require('../package.json');

// get egg pid list
function getEggRunningInfo() {
  const { stdout } = shell.exec('ps aux | grep node', { silent: true });
  const pidList = [];
  let port;

  stdout.split('\n').forEach(line => {
    if (!line.includes('node ')) {
      return;
    }

    const m = line.match(REGEX);
    if (!m) return;

    const pid = m[1];
    const cmd = m[2];
    if (cmd.includes(`"title":"egg-server-${pkgInfo.name}"`)) {
      pidList.push(pid);

      if (!port && PORT_REGEX.test(cmd)) {
        port = RegExp.$1;
      }
    }
  });

  return {
    pidList,
    port,
  };
}

// nginx reload
function nginxReload(port) {
  if (!port) {
    throw new Error('nginx reload fail, port is not exist');
  }

  const nginxConf = fs.readFileSync(path.resolve(__dirname, '../config/nginx.conf')).toString();

  // update nginx config
  const nginxInfo = mus.renderString(nginxConf, {
    port,
    ...conf.nginxConfig,
  });

  // write to dir
  fs.writeFileSync(conf.nginxConfig.dist, nginxInfo);

  // reload nginx
  shell.exec('nginx -s reload');
}

async function restart() {
  const { pidList, port: oldPort } = getEggRunningInfo();

  // reload nginx only
  if (process.env.ONLY_NGINX) {
    return nginxReload(oldPort);
  }

  // restart server
  const port = await getPort();
  const { stdout } = shell.exec('npm start', {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      EGG_SERVER_ENV: 'prod',
      PORT: port,
    },
  });

  const appUrl = `http://127.0.0.1:${port}`;
  if (!stdout.includes(`started on ${appUrl}`)) {
    throw new Error('app start not success');
  }

  // check server status
  const resp = await urllib.curl(appUrl);
  assert(resp.status === 200, 'app start not success');
  console.info('app started success in ' + appUrl);

  // update nginx config
  nginxReload(port);

  // kill egg server pid
  pidList.forEach(pid => {
    shell.exec('kill -9 ' + pid);
    console.info('kill process ' + pid);
  });
}

restart().catch(e => {
  console.error(e);
});

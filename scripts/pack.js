const fs = require('fs');
const shell = require('shelljs');
const Client = require('ssh2').Client;
const pkgInfo = require('../package.json');
const { sshConfig } = require('../conf');
const vinyl = require('vinyl-fs');
const path = require('path');
const miss = require('mississippi');
const assert = require('assert');

console.time('update cost');
const packDir = path.resolve(process.cwd(), './pack');
const cmdIndex = process.argv.findIndex(arg => arg === '--cmd');
const cmd = cmdIndex < 0 ? '' : process.argv[cmdIndex + 1];
const cleanCache = process.argv.includes('--no-cache');
const skipDeps = process.argv.includes('--skip-deps');
shell.exec('rm -rf ' + packDir);

console.info('packing...');
console.time('packing cost');
miss.pipe(
  [
    vinyl
      .src([
        '**/*',
        '!node_modules/**/*',
        '!coverage/**/*',
        '!run/**/*',
        '!logs/**/*',
        '!.cache/**/*',
        '!.vscode/**/*',
      ])
      .pipe(vinyl.dest(packDir)),
    miss.concat(assert),
  ],
  () => {
    shell.cd(packDir);
    shell.exec('zip -qr ./pack.zip ./*');
    shell.exec(`scp ./pack.zip ${sshConfig.username}@${sshConfig.host}:${sshConfig.distDir}`);
    shell.exec('rm -rf ' + packDir);
    console.info('packing success');
    console.timeEnd('packing cost');
    sshToRemote();
  }
);

// get clean files
function getCleanFiles() {
  const files = [
    './app/controller',
    './app/extend',
    './app/service',
    './app/middleware',
    './config',
    './*.js',
    './package-lock.json',
    './scripts/',
  ];
  if (cleanCache) files.push('./.cache/*', './docs/', './app/view');
  return files;
}

// ssh to server
function sshToRemote() {
  console.info('connect to ' + sshConfig.host);
  const conn = new Client();
  conn
    .on('ready', async () => {
      console.info('connect success');
      conn.shell(async (err, stream) => {
        if (err) {
          console.error(err);
          return conn.end();
        }

        const isRestart = cmd.startsWith('restart');
        const exec = cmd => stream.write(`${cmd}\n`);
        const endSymbol = '>>ConnectEnd<<';
        stream.stdout.on('data', chunk => {
          process.stdout.write(chunk);
          if (chunk.toString().includes(`\n${endSymbol}`)) {
            console.timeEnd('update cost');
            stream.end();
            conn.end();
          }
        });
        stream.stderr.pipe(process.stderr);

        exec('ls');
        exec('cd blog');
        exec('ls');

        // clean files
        exec(`rm -rf ${getCleanFiles().join(' ')}`);

        // unzip new file
        exec('unzip -uo ./pack.zip');

        if (isRestart && !skipDeps) {
          // reinstall deps
          exec('rm -rf ./node_modules/');
          exec('npm install --production');
        }

        // execute command
        if (cmd && pkgInfo.scripts[cmd]) {
          exec(`time npm run ${cmd}\n`);
        }

        // show process
        isRestart && exec(`ps aux | grep ${pkgInfo.name}`);

        // end
        exec(`echo '${endSymbol}'`);
      });
    })
    .connect({
      host: sshConfig.host,
      port: sshConfig.port,
      privateKey: fs.readFileSync(sshConfig.privateKey),
      username: sshConfig.username,
    });
}

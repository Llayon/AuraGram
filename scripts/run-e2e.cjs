'use strict';
// Own the Node server directly: Playwright's shell process-tree shutdown can
// hang on Windows. Each run uses a free loopback port and always stops its server.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const server = spawn(process.execPath, [path.join(root,'tests/static-server.cjs'),'0'], {
    cwd:root, windowsHide:true, stdio:['ignore','pipe','inherit']
  });
  let runner;
  const stop=()=>{if(runner)runner.kill();server.kill();};
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  try {
    const baseURL=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Static server startup timed out')),15000);
      let output='';
      server.stdout.on('data',chunk=>{
        output+=chunk;
        const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if(match){clearTimeout(timer);resolve(match[0]);}
      });
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error('Static server exited '+code));});
    });
    runner=spawn(process.execPath,[path.join(root,'node_modules/@playwright/test/cli.js'),'test',...process.argv.slice(2)],{
      cwd:root, windowsHide:true, stdio:'inherit', env:{...process.env,AURAGRAM_TEST_BASE_URL:baseURL}
    });
    process.exitCode=await new Promise((resolve,reject)=>{
      runner.once('error',reject);runner.once('exit',code=>resolve(code??1));
    });
  } finally {
    stop();
    process.removeListener('SIGINT',stop);
    process.removeListener('SIGTERM',stop);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

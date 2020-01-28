'use strict';

const { spawn } = require('child_process');
const ethers = require('ethers');

it('start the nodes', async function () {
  // check if we need to start the node(s)
  try {
    await ethers.utils.fetchJson('http://localhost:8000', JSON.stringify({ method: 'ping' }));
    console.log('Using existing node(s)');
  } catch (e)  {
    console.log('spawning the node(s) - logFile: nodes.log');

    const proc = spawn('scripts/debug.js', [], { env: Object.assign({ LOG_FILE: './nodes.log' }, process.env) });
    proc.on('exit', () => process.exit(1));
    process.on('exit', () => proc.kill());

    while (true) {
      try {
        await ethers.utils.fetchJson('http://localhost:8000', JSON.stringify({ method: 'ping' }));
        break;
      } catch (e) {
      }
    }
  }
});

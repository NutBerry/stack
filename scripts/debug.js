#!/usr/bin/env node
'use strict';

const fs = require('fs');
const spawn = require('child_process').spawn;
const ethers = require('ethers');

const deployBridge = require('./deploy.js');

const privKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200';
const rpcUrl = `http://localhost:${process.env.RPC_PORT}`;
const rootProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
const rootWallet = new ethers.Wallet(privKey, rootProvider);

(async function () {
  let logFile = process.stdout;
  if (process.env.LOG_FILE) {
    logFile = fs.createWriteStream(process.env.LOG_FILE);
  }

  function onException (e) {
    logFile.write(`${e.stack || e}\n`);
    process.exit(1);
  }

  const { contract } = await deployBridge(rootWallet, {}, logFile);
  process.on('uncaughtException', onException);
  process.on('unhandledRejection', onException);

  const env = Object.assign(
    {
      BRIDGE_ADDRESS: contract.address,
      ROOT_RPC_URL: rpcUrl,
      DEBUG_MODE: 1,
      EVENT_CHECK_MS: 30,
    },
    process.env
  );

  for (let i = 0; i < 2; i++) {
    // TODO: use getSigner()
    function startNode () {
      const PRIV_KEY = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120' + i;
      const _env = Object.assign({ PORT: 8000 + i, PRIV_KEY, BAD_NODE_MODE: (i % 2 !== 0) ? 1 : 0 }, env);
      const proc = spawn('node', [`${__dirname}/../js/bin.js`], { env: _env });

      function onData (buf) {
        let str = buf.toString().split('\n');
        let color = 31 + i;

        for (let x = 0; x < str.length; x++) {
          if (!str[x]) {
            return;
          }
          logFile.write(`\x1B[1;${color}mnode-${i}: ${str[x]}\x1B[0m\n`);
        }
      }
      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);

      proc.on('exit',
        function (val) {
          logFile.write(`node-${i} did exit with code = ${val}\n`);
          startNode();
        }
      );
    }

    startNode();
  }
})();

#!/usr/bin/env node
'use strict';

const { Server } = require('./index.js');

const bridgeAddress = process.env.BRIDGE_ADDRESS;
const privKey = process.env.PRIV_KEY;
const rpcPort = parseInt(process.env.PORT);
const host = process.env.HOST || 'localhost';
const rpcUrl = process.env.ROOT_RPC_URL;

// TODO: implement feedback for the user
(async function () {
  function onException (e) {
    process.stderr.write(`${e.stack || e}\n`);
    process.exit(1);
  }

  process.on('uncaughtException', onException);
  process.on('unhandledRejection', onException);

  const config = {
    host: host,
    port: rpcPort,
    rootRpcUrl: rpcUrl,
    contract: bridgeAddress,
    privKey: privKey,
    debugMode: process.env.DEBUG_MODE === '1',
    badNodeMode: process.env.BAD_NODE_MODE === '1',
  };

  new Server(config);
})();

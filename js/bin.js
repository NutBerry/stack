#!/usr/bin/env node
'use strict';

const { Server } = require('./index.js');

const OPTIONS = [
  {
    env: 'BRIDGE_ADDRESS',
    key: 'contract',
    type: String,
    required: true,
    help: 'The contract address of the Bridge on the root-chain.',
  },
  {
    env: 'PRIV_KEY',
    key: 'privKey',
    type: String,
    default: '',
    help: 'The private key for a root-chain account. That account should have some ether to be useful. ' +
    'Required to participate in the network.',
  },
  {
    env: 'PORT',
    key: 'rpcPort',
    type: Number,
    required: true,
    help: 'The port to listen on for the JSON-RPC interface.',
  },
  {
    env: 'HOST',
    key: 'host',
    type: String,
    default: 'localhost',
    help: 'The address to listen on for the JSON-RPC interface.',
  },
  {
    env: 'ROOT_RPC_URL',
    key: 'rootRpcUrl',
    type: String,
    required: true,
    help: 'The URL for the root-chain JSON-RPC provider.',
  },
  {
    env: 'EVENT_CHECK_MS',
    key: 'eventCheckMs',
    type: Number,
    default: 15000,
    help: 'Time in milliseconds to check for Bridge event updates.',
  },
  {
    env: 'DEBUG_MODE',
    key: 'debugMode',
    type: Number,
    default: 0,
    help: 'Debug mode, for development purposes.',
  },
  {
    env: 'BAD_NODE_MODE',
    key: 'badNodeMode',
    type: Number,
    default: 0,
    help: 'For development purposes, simulates a rogue node.',
  },
];

function printHelp () {
  OPTIONS.forEach(
    function (option) {
      console.log(`Option: ${option.env}\n  Type: ${option.type.name}`);
      if (option.default !== undefined) {
        console.log(`  Default: ${option.default}`);
      }
      if (option.required) {
        console.log('  Required: true');
      }
      if (option.help) {
        console.log(`  ${option.help}`);
      }
    }
  );
}

function onException (e) {
  process.stderr.write(`${e.stack || e}\n`);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);
process.on('SIGTERM', function () {
  process.exit(0);
});

(async function () {
  const config = {};

  OPTIONS.forEach(
    function (option) {
      const v = process.env[option.env] || option.default;

      if (option.required && v === undefined) {
        printHelp();
        throw new Error(`${option.env} is a required argument.`);
      }
      config[option.key] = option.type(v);
    }
  );

  new Server(config);
})();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const spawn = require('child_process').spawn;
const ethers = require('ethers');

const privKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200';
const rpcUrl = `http://localhost:${process.env.RPC_PORT}`;
const rootProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
const rootWallet = new ethers.Wallet(privKey, rootProvider);

(async function () {
  let logFile = process.stdout;
  if (process.env.LOG_FILE) {
    logFile = fs.createWriteStream(process.env.LOG_FILE);
  }

  async function deployBridge (wallet) {
    const GatedComputing = require('./../build/contracts/GatedComputing.json');
    let _factory = new ethers.ContractFactory(
      [],
      GatedComputing.bytecode,
      wallet
    );
    let contract = await _factory.deploy();
    let tx = await contract.deployTransaction.wait();
    let gatedComputingAddr = contract.address;


    const artifact = require('./../build/contracts/Bridge.json');
    let bytecode = artifact.bytecode;

    const meta = 'a265627a7a72305820';
    const tmp = bytecode.indexOf(meta);
    if (tmp !== -1) {
      bytecode = bytecode.substring(0, tmp);
      logFile.write(`stripped bytecode ${(artifact.bytecode.length - 2) / 2, (bytecode.length -2 ) / 2}\n`);
    }

    while (true) {
      let n = bytecode.replace(
        'abcdef0123456789abcdef0123456789abcdef01',
        gatedComputingAddr.replace('0x', '').toLowerCase()
      );
      if (bytecode === n) {
        break;
      }
      bytecode = n;
    }

    _factory = new ethers.ContractFactory(
      artifact.abi,
      bytecode,
      wallet
    );
    contract = await _factory.deploy();
    tx = await contract.deployTransaction.wait();

    logFile.write(`\n
Contract: ${artifact.contractName}
  Address: ${contract.address}
  Transaction Hash: ${tx.transactionHash}
  Deployer: ${tx.from}
  Gas used: ${tx.cumulativeGasUsed.toString()}
  Gas fee in Ether: ${ethers.utils.formatUnits(contract.deployTransaction.gasPrice.mul(tx.cumulativeGasUsed), 'ether')}
  Gated Computing contract: ${gatedComputingAddr}
  \n`);

    return contract;
  }

  function onException (e) {
    logFile.write(`${e.stack || e}\n`);
    process.exit(1);
  }

  const bridge = await deployBridge(rootWallet);
  const { Server } = require('./index.js');
  process.on('uncaughtException', onException);
  process.on('unhandledRejection', onException);

  const env = Object.assign(
    {
      BRIDGE_ADDRESS: bridge.address,
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
      const proc = spawn('node', [`${__dirname}/bin.js`], { env: _env });

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

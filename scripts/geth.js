#!/usr/bin/env node

'use strict';

const urlParse = require('url').parse;
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const http = require('http');

const GENESIS = {
  'config': {
    'chainId': 99,
    'homesteadBlock': 0,
    'eip150Block': 0,
    'eip150Hash': '0x0000000000000000000000000000000000000000000000000000000000000000',
    'eip155Block': 0,
    'eip158Block': 0,
    'byzantiumBlock': 0,
    'constantinopleBlock': 0,
    'petersburgBlock': 0,
    'istanbulBlock': 0,
    'clique': {
      'period': 0,
      'epoch': 30000,
    },
  },
  'nonce': '0x0',
  'timestamp': '0x5c564c23',
  'extraData': '0x0000000000000000000000000000000000000000000000000000000000000000' +
    'df08f82de32b8d460adbe8d72043e3a7e25a3b39' +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '000000000000000000000000000000000000000000000000000000000000000000',
  'gasLimit': '9000000',
  'difficulty': '0x1',
  'mixHash': '0x0000000000000000000000000000000000000000000000000000000000000000',
  'coinbase': '0x0000000000000000000000000000000000000000',
  'alloc': {
    '0000000000000000000000000000000000000000': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000001': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000002': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000003': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000004': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000005': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000006': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000007': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000008': {
      'balance': '0x1',
    },
    '0000000000000000000000000000000000000009': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000a': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000b': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000c': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000d': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000e': {
      'balance': '0x1',
    },
    '000000000000000000000000000000000000000f': {
      'balance': '0x1',
    },
    'df08f82de32b8d460adbe8d72043e3a7e25a3b39': {
      'balance': '0x200000000000000000000000000000000000000000000000000000000000000',
    },
    '6704fbfcd5ef766b287262fa2281c105d57246a6': {
      'balance': '0x200000000000000000000000000000000000000000000000000000000000000',
    },
    '9e1ef1ec212f5dffb41d35d9e5c14054f26c6560': {
      'balance': '0x200000000000000000000000000000000000000000000000000000000000000',
    },
    'ce42bdb34189a93c55de250e011c68faee374dd3': {
      'balance': '0x200000000000000000000000000000000000000000000000000000000000000',
    },
    '97a3fc5ee46852c1cf92a97b7bad42f2622267cc': {
      'balance': '0x200000000000000000000000000000000000000000000000000000000000000',
    },
  },
  'number': '0x0',
  'gasUsed': '0x0',
  'parentHash': '0x0000000000000000000000000000000000000000000000000000000000000000',
};

const fetchOptions = urlParse(`http://localhost:${process.env.RPC_PORT}`);
fetchOptions.method = 'POST';
fetchOptions.headers = { 'Content-Type': 'application/json' };

async function fetch (obj) {
  return new Promise(
    function (resolve, reject) {
      const req = http.request(fetchOptions);
      let body = Buffer.alloc(0);

      req.on('error', reject);
      req.on('response', function (resp) {
        resp.on('data', function (buf) {
          body = Buffer.concat([body, buf]);
        });
        resp.on('end', function () {
          resolve(JSON.parse(body.toString()));
        });
      });

      req.end(JSON.stringify(obj));
    }
  );
}

(async function () {
  try {
    let res = await fetch(
      {
        'jsonrpc': '2.0',
        'method': 'web3_clientVersion',
        'params': [],
        'id': 42,
      }
    );

    console.log(res);
    console.log('RPC port reachable, doing nothing');
    return;
  } catch (e) {
    console.log('starting geth...');

    const args = [
      '--datadir=/tmp/geth',
      '--networkid=99',
      '--maxpeers=0',
      '--nodiscover',
      '--nousb',
      '--targetgaslimit=9000000',
      '--gasprice=0x01',
      '--rpc',
      `--rpcport=${process.env.RPC_PORT}`,
      '--rpcapi=eth,net,web3,debug,personal,miner',
      '--allow-insecure-unlock',
    ];

    spawnSync('rm', ['-rf', '/tmp/geth']);
    fs.mkdirSync('/tmp/geth');
    fs.writeFileSync('/tmp/geth/genesis.json', JSON.stringify(GENESIS));

    spawnSync('geth', args.concat(['init', '/tmp/geth/genesis.json']));
    spawn('geth', args, { detached: true, stdio: ['ignore', 'ignore', 'ignore'] });

    while (true) {
      try {
        await fetch(
          {
            'jsonrpc': '2.0',
            'method': 'web3_clientVersion',
            'params': [],
            'id': 42,
          }
        );
        break;
      } catch (e) {
      }
      console.log('waiting for geth');
      await new Promise((resolve) => setTimeout(resolve, 100));

    }
    console.log('Importing and unlocking accounts');

    for (let i = 0; i < 5; i++) {
      const key = '2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120' + i.toString();
      let res = await fetch(
        {
          'jsonrpc': '2.0',
          'method': 'personal_importRawKey',
          'params': [key, null],
          'id': 42,
        }
      );

      console.log(res);
      res = await fetch(
        {
          'jsonrpc': '2.0',
          'method': 'personal_unlockAccount',
          'params': [res.result, '', ~0 >>> 0],
          'id': 42,
        }
      );
      console.log(res);
    }

    console.log('Start mining');
    const res = await fetch(
      {
        'jsonrpc': '2.0',
        'method': 'miner_start',
        'params': [],
        'id': 42,
      }
    );
    console.log(res);
    console.log('ready');

    process.exit(0);
  }
})();

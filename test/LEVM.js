'use strict';

const ethers = require('ethers');
const assert = require('assert');

const Utils = require('./../js/Utils.js');
const TestLEVM = require('./../build/contracts/TestLEVM.json');
const PRIV_KEY_ALICE = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203';

function _BigInt (a) {
  return BigInt(a).toString(16);
}

describe('LEVM', async function () {
  let provider;
  let wallet;
  let mock;

  function testWithNonce (i, calldata, invalidateSig) {
    calldata = calldata || '0x';

    it(`test w/ nonce = 0x${i.toString(16)} / data size = ${(calldata.length - 2) / 2}`, async () => {
      const obj = {
        to: mock.address,
        nonce: i,
        data: calldata,
        chainId: 0,
      };

      const signed = await wallet.sign(obj);
      const parsed = ethers.utils.parseTransaction(signed);
      const encoded = Utils.encodeTx(parsed);
      let raw = encoded.replace('0x', '');
      if (invalidateSig) {
        raw = raw.slice(-6) + 'fcacac';
      }
      const tx = await (await wallet.sendTransaction(
        {
          to: mock.address,
          data: '0xc26ae2a6' + raw,
          gasLimit: 6000000,
        }
      )).wait();

      if (invalidateSig) {
        // ignore
        return;
      }

      const params = tx.logs[tx.logs.length - 1];
      assert.equal(obj.data, params.data, 'data should match');
      assert.equal(_BigInt(params.topics[1]), _BigInt(obj.to), 'to');
      assert.equal(_BigInt(params.topics[2]), _BigInt(obj.nonce), 'nonce');
      assert.equal(_BigInt(params.topics[0]), _BigInt(wallet.address), 'from');
    });
  }

  before('Prepare contracts', async () => {
    provider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);
    wallet = new ethers.Wallet(PRIV_KEY_ALICE, provider);

    let _factory = new ethers.ContractFactory(
      TestLEVM.abi,
      TestLEVM.bytecode,
      wallet,
    );
    mock = await _factory.deploy();
    await mock.deployTransaction.wait();
  });

  describe('parseTx', async () => {
    it('no logs', async () => {
      const raw = ''.padStart(12048, 'fa');
      const tx = await (await wallet.sendTransaction(
        {
          to: mock.address,
          data: '0xc26ae2a6' + raw,
          gasLimit: 6000000,
        }
      )).wait();

      assert.equal(tx.logs, 0, 'should be zero');
    });

    for (let i = 0; i < 0xff; i++) {
      testWithNonce(i);
    }

    for (let i = 0xff; i < 0x104; i++) {
      testWithNonce(i);
    }

    for (let i = 0xff1ac0; i < 0xff1ac1; i++) {
      testWithNonce(i);
    }

    for (let i = 0; i < 0xff; i++) {
      testWithNonce(i, '0x' + Buffer.alloc(i).fill(i).toString('hex'));
    }

    for (let i = 0xff; i < 0x104; i++) {
      testWithNonce(i, '0x' + Buffer.alloc(i).fill(i).toString('hex'));
    }

    for (let i = 0x7f00; i < 0x7f01; i++) {
      testWithNonce(i, '0x' + Buffer.alloc(i).fill(i).toString('hex'));
    }

    // test with invalid sig
    testWithNonce(0xffff, '0x', true);
  });
});

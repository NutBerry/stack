'use strict';

const ethers = require('ethers');
const assert = require('assert');

const NutBerryRuntime = require('./../js/NutBerryRuntime.js');
const Inventory = require('./../js/Inventory.js');
const Utils = require('./../js/Utils.js');
const TestContract = require('./../build/contracts/TestContract.json');

describe('NutBerryRuntime', function () {
  const TOKEN = '0x0101010101010101010101010101010101010101';
  const ALICE = '0x1111111111111111111111111111111111111111';
  const BOB = '0x2222222222222222222222222222222222222222';
  const CONTRACT_STR = '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6';
  const CONTRACT = Buffer.from('0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6', 'hex');

  const testContract = new ethers.utils.Interface(TestContract.abi);
  const code = Utils.toUint8Array(TestContract.deployedBytecode);

  it('should fail with empty inventory', async () => {
    const runtime = new NutBerryRuntime();
    const customEnvironment = new Inventory();
    const data = Utils.toUint8Array(testContract.functions.test.encode(
      [TOKEN, [ALICE, BOB], ['0xfa', '0xff']]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should revert');
  });

  it('test ERC20', async () => {
    const runtime = new NutBerryRuntime();
    const value = '0x00000000000000000000000000000000000000000000000000000000000000ff';
    let customEnvironment = new Inventory();
    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
      }
    );
    customEnvironment.addToken(
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
      },
    );
    // approve
    customEnvironment.handleCall(
      ALICE,
      TOKEN,
      '095ea7b3' +
      '0000000000000000000000000f572e5295c57f15886f9b263e2f6d2d6c7b5ec6' +
      '00000000000000000000000000000000000000000000000000000000000000fa'
    );

    const copy = customEnvironment.clone();
    const data = Utils.toUint8Array(testContract.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, value]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');

    copy.storage['0xed56a34d8d586dba3e75a7b52c225703b406033d644d9c90343ea1374e59aefb'] =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    copy.storage['0x040e4eb11bdac20e22459c04866d3c7fe2a969d69118b7ab0c9a6e7ccea75f22'] =
      '0x0000000000000000000000000000000000000000000000000000000000000005';
    copy.storage['0x2fa162cb4731588cb51a4a3812ebf24915d915fe739cd61ec38d6ec5bebf9012'] =
      '0x00000000000000000000000000000000000000000000000000000000000000fe';

    copy.addToken(
      {
        address: TOKEN,
        owner: BOB,
        value: '0x00000000000000000000000000000000000000000000000000000000000000fa',
      }
    );
    copy.addToken(
      {
        address: TOKEN,
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec5',
        value: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }
    );

    state.customEnvironment.storageKeys = {};
    copy.storageKeys = {};
    assert.deepEqual(state.customEnvironment.toJSON(), copy.toJSON(), 'inventory should be correct');
  });

  it('test ERC20 - no allowance', async () => {
    const runtime = new NutBerryRuntime();
    const value = '0x00000000000000000000000000000000000000000000000000000000000000ff';
    let customEnvironment = new Inventory();

    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
      }
    );
    customEnvironment.addToken(
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
      }
    );
    const data = Utils.toUint8Array(testContract.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, value]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should REVERT');
  });


  it('test ERC721', async () => {
    const runtime = new NutBerryRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = new Inventory();

    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        isERC721: true,
      }
    );
    const copy = customEnvironment.clone();
    copy.storageKeys = {};
    customEnvironment.handleCall(
      ALICE,
      TOKEN,
      '095ea7b3' +
      '0000000000000000000000000f572e5295c57f15886f9b263e2f6d2d6c7b5ec6' +
      '0000000000000000000000000000000000000000000000000000000000000001'
    );

    const data = Utils.toUint8Array(testContract.functions.testERC721.encode(
      [TOKEN, ALICE, BOB, tokenId]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    // owner = BOB
    copy.storage['0xdacee017b34c7d486e8a9b7dbaa3a24346ceee11b5ccf3de1aad887ab496371a'] =
      '0x0000000000000000000000002222222222222222222222222222222222222222';
    // set approval for this tokenId to zero
    copy.storage['0x84682d67198ca249cbc098d4b287163a8d92530e1c225adbd2de7ad3d2e41654'] =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    state.customEnvironment.storageKeys = {};
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'inventory should be correct');
  });
});

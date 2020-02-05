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

  it('should fail with empty hofmann struct', async () => {
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

    copy.storage['0x1d4aab2b372f685fa1501b8804177f266ee4c99a9494cb9fab2104280f88eac4'] =
      '0x00000000000000000000000000000000000000000000000000000000000000fe';
    copy.storage['0xd8fd6a673ff825e021ff13b97d5034ed538d352adbef52622a488fde319e8187'] =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    copy.storage['0xa7fc4f9c24dc079d7451e0ae638eec1666247511d29df863809b9a0dc9d0d335'] =
      '0x0000000000000000000000000000000000000000000000000000000000000005';

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
    assert.deepEqual(state.customEnvironment.toJSON(), copy.toJSON(), 'hofmann struct should be correct');
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
    copy.storage['0xfa6f0abc27d7a5cfc6bf5858857bfc1aa6d1c5de1c988524dd1f24a392e86b7a'] =
      '0x0000000000000000000000002222222222222222222222222222222222222222';
    // set approval for this tokenId to zero
    copy.storage['0xb37d6e072d0d9a8f7f24d340ae8e09481f884c19e7c78b773ff8a02695a26dc8'] =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    state.customEnvironment.storageKeys = {};
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });
});

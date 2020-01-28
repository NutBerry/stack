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
    customEnvironment.testing = true;
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
    customEnvironment.testing = true;
    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      }
    );
    customEnvironment.addToken(
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    );
    customEnvironment.addAllowance(TOKEN, ALICE, CONTRACT_STR, '0xfa');

    const copy = customEnvironment.clone();
    const data = Utils.toUint8Array(testContract.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, value]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    // value - allowance + value from contract
    // (0xff - 0xfa + 0xff - 1)
    let tmp = copy.getERC20(TOKEN, ALICE);
    tmp.value = tmp.value.replace('00ff', '0103');
    copy.setAllowance(
      TOKEN, ALICE, CONTRACT_STR, '0x0000000000000000000000000000000000000000000000000000000000000000'
    );

    tmp = copy.getERC20(TOKEN, '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6');
    tmp.value = tmp.value.replace('ff', '00');

    copy.addToken(
      {
        address: TOKEN,
        owner: BOB,
        value: '0x00000000000000000000000000000000000000000000000000000000000000fa',
        isERC20: true,
      }
    );
    copy.addToken(
      {
        address: TOKEN,
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec5',
        value: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isERC20: true,
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
    customEnvironment.testing = true;

    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      }
    );
    customEnvironment.addToken(
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
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
    customEnvironment.testing = true;

    customEnvironment.addToken(
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        isERC721: true,
      }
    );
    const copy = customEnvironment.toJSON();
    customEnvironment.addAllowance(TOKEN, ALICE, CONTRACT_STR, '0x01');

    const data = Utils.toUint8Array(testContract.functions.testERC721.encode(
      [TOKEN, ALICE, BOB, tokenId]
    ));
    const state = await runtime.run({ address: CONTRACT, origin: CONTRACT, code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    copy.bag[0].owner = BOB;
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });
});

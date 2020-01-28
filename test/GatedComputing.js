'use strict';

const ethers = require('ethers');
const assert = require('assert');

const GatedComputing = require('./../build/contracts/GatedComputing.json');
const TestGatedComputing = require('./../build/contracts/TestGatedComputing.json');
const TestContract = require('./../build/contracts/TestContract.json');

describe('GatedComputing', async function () {
  const TOKEN = '0x0101010101010101010101010101010101010101';
  const ALICE = '0x1111111111111111111111111111111111111111';
  const BOB = '0x2222222222222222222222222222222222222222';
  const ACCOUNT_BALANCE = '0x00000000000000000000000000000000000000000000000000000000000000ff';
  const gasLimit = '0x' + (8000000).toString(16);
  const testContractInterface = new ethers.utils.Interface(TestContract.abi);
  const testGatedInterface = new ethers.utils.Interface(TestGatedComputing.abi);
  let provider;
  let wallet;
  let gated;
  let testGatedContract;
  let patchedAddress;
  let testContractPatched;
  let testContract;

  before('Prepare', async () => {
    provider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);
    wallet = await provider.getSigner(0);

    let _factory = new ethers.ContractFactory(
      GatedComputing.abi,
      GatedComputing.bytecode,
      wallet,
    );
    gated = await _factory.deploy();
    await gated.deployTransaction.wait();

    _factory = new ethers.ContractFactory(
      TestGatedComputing.abi,
      TestGatedComputing.bytecode,
      wallet,
    );
    testGatedContract = await _factory.deploy();
    await testGatedContract.deployTransaction.wait();

    _factory = new ethers.ContractFactory(
      TestContract.abi,
      TestContract.bytecode,
      wallet,
    );
    testContract = await _factory.deploy();
    await testContract.deployTransaction.wait();

    let bytecode = TestGatedComputing.deployedBytecode;
    patchedAddress = await provider.send('eth_call', [{ to: gated.address, data: bytecode }, 'latest']);
    let tx = await(await wallet.sendTransaction(
      {
        to: gated.address,
        data: bytecode,
        gasLimit,
      }
    )).wait();

    bytecode = TestContract.deployedBytecode;
    testContractPatched = await provider.send('eth_call', [{ to: gated.address, data: bytecode }, 'latest']);
    tx = await(await wallet.sendTransaction(
      {
        to: gated.address,
        data: bytecode,
        gasLimit,
      }
    )).wait();
  });

  function round (i, bytecode, callData) {
    it(`Round ${i} patching jumps and simple opcodes should work`, async () => {
      const bytecodeLength = (bytecode.length - 2) / 2;
      const addr = await provider.send('eth_call', [{ to: gated.address, data: bytecode }, 'latest']);
      let tx = await(await wallet.sendTransaction(
        {
          to: gated.address,
          data: bytecode,
          gasLimit,
        }
      )).wait();

      const gasUsed = tx.cumulativeGasUsed.toNumber();
      const patchedBytecode = await provider.getCode(addr);
      const patchedBytecodeLength = (patchedBytecode.length - 2) / 2;

      tx = await(await testGatedContract.testCall(addr, callData || '0x', { gasLimit })).wait();

      assert.equal(
        tx.events[tx.events.length - 2].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000'
      );
      assert.equal(
        tx.events[tx.events.length - 1].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001'
      );

      console.log({ gasUsed, addr, patchedBytecodeLength, bytecodeLength });
    });
  }

  let bytecode = TestGatedComputing.deployedBytecode;
  round(1, bytecode, testGatedInterface.functions.simple.encode([]));

  bytecode = bytecode + Buffer.alloc(6000).fill(0xff).toString('hex');
  round(2, bytecode, testGatedInterface.functions.simple.encode([]));

  bytecode = TestContract.deployedBytecode;
  round(3, bytecode, testContractInterface.functions.ping.encode([]));

  [
    'BALANCE',
    'GASPRICE',
    'EXTCODECOPY',
    'EXTCODEHASH',
    'BLOCKHASH',
    'COINBASE',
    'TIMESTAMP',
    'NUMBER',
    'DIFFICULTY',
    'GASLIMIT',
    'SLOAD',
    'SSTORE',
    'CREATE',
    'CALLCODE',
    'DELEGATECALL',
    'CREATE2',
    'SELFDESTRUCT',
  ].forEach(
    (e) => {
      it(`${e} should revert`, async () => {
        const calldata = testGatedContract.interface.functions[e].encode([]);
        let reverted = false;
        try {
          await (await wallet.sendTransaction(
            {
              to: patchedAddress,
              data: calldata,
              gasLimit,
            }
          )).wait();
        } catch (e) {
          reverted = true;
        }

        assert.ok(reverted, 'should revert');
      });
    }
  );

  [
    { address: '0x0000000000000000000000000000000000000000', data: ''.padStart(256, '0'), throws: true },
    { address: '0x0000000000000000000000000000000000000001',
      data: 'ab8656bf3b36e693ac8f062f75eac871becae7676e69837cab98fad6e87c6dee' +
            '000000000000000000000000000000000000000000000000000000000000001c' +
            '06394c2c6b398998e134933736600208e90c5f4f096e2ea4ae903735f796fafd' +
            '0257d5ccc65a6a65aa32dceec1ca19c8fe7b5d0652d00ef034aebdbcd8c39982',
    },
    { address: '0x0000000000000000000000000000000000000002', data: ''.padStart(256, '0') },
    { address: '0x0000000000000000000000000000000000000003', data: ''.padStart(256, '0') },
    { address: '0x0000000000000000000000000000000000000004', data: ''.padStart(256, '0') },
    { address: '0x0000000000000000000000000000000000000005',
      data: '0000000000000000000000000000000000000000000000000000000000000020' +
            '0000000000000000000000000000000000000000000000000000000000000020' +
            '0000000000000000000000000000000000000000000000000000000000000020' +
            '0000000000000000000000000000000000000000000000000000000000000003' +
            '000000000000000000000000000000000000000000000000000000000000ffff' +
            '8000000000000000000000000000000000000000000000000000000000000000',
    },
    { address: '0x0000000000000000000000000000000000000006', data: ''.padStart(256, '0') },
    { address: '0x0000000000000000000000000000000000000007', data: ''.padStart(256, '0') },
    { address: '0x0000000000000000000000000000000000000008', data: ''.padStart(192 * 2, '0') },
    { address: '0x0000000000000000000000000000000000000009', data: ''.padStart(213 * 2, '0'), throws: true },
    { address: '0x000000000000000000000000000000000000000a', data: ''.padStart(256, '0'), throws: true },
  ].forEach(
    ({ address, data, throws }) => {
      it(`STATICCALL ${address}`, async () => {
        const calldata = testGatedContract.interface.functions.doSTATICCALL.encode([address, `0x${data}`]);
        let reverted = false;
        try {
          await (await wallet.sendTransaction(
            {
              to: patchedAddress,
              data: calldata,
              gasLimit,
            }
          )).wait();
        } catch (e) {
          reverted = true;
        }

        assert.equal(reverted, throws || false);
      });
    }
  );

  it('TestContract.test()', async () => {
    const data = testContractInterface.functions.test.encode(
      [TOKEN, [ALICE, BOB], ['0xfa', '0xff']]
    );
    const tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit })).wait();

    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(tx.events[1].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001');
  });

  it('TestContract.testERC20() should fail', async () => {
    const data = testContractInterface.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, ACCOUNT_BALANCE]
    );
    const tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit })).wait();

    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(tx.events[1].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('TestContract.testERC20()', async () => {
    const data = testContractInterface.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, ACCOUNT_BALANCE]
    );
    let tx = await(await testGatedContract.addToken(
      TOKEN,
      ALICE,
      ACCOUNT_BALANCE
    )).wait();
    tx = await(await testGatedContract.addToken(
      TOKEN,
      testGatedContract.address,
      ACCOUNT_BALANCE
    )).wait();
    tx = await(await testGatedContract.addAllowance(
      TOKEN,
      ALICE,
      testGatedContract.address,
      '0xfa'
    )).wait();

    tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit })).wait();
    console.log({ gasUsed: tx.cumulativeGasUsed.toString() });
    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(tx.events[1].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001');
  });

  it('deployAndCall: TestContract.testERC20()', async () => {
    const data = testContractInterface.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, ACCOUNT_BALANCE]
    );
    let tx = await(await testGatedContract.addToken(
      TOKEN,
      ALICE,
      ACCOUNT_BALANCE
    )).wait();
    tx = await(await testGatedContract.addToken(
      TOKEN,
      BOB,
      0
    )).wait();
    tx = await(await testGatedContract.addToken(
      TOKEN,
      testGatedContract.address,
      ACCOUNT_BALANCE
    )).wait();
    tx = await(await testGatedContract.addAllowance(
      TOKEN,
      ALICE,
      testGatedContract.address,
      '0xfa'
    )).wait();

    tx = await(
      await testGatedContract.deployAndCall(
        gated.address, testContract.address, data, { gasLimit }
      )
    ).wait();
    console.log({ gasUsed: tx.cumulativeGasUsed.toString() });
    // success ?
    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001');
  });
});

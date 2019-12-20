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
        gasLimit: 0xffffffff,
      }
    )).wait();

    bytecode = TestContract.deployedBytecode;
    testContractPatched = await provider.send('eth_call', [{ to: gated.address, data: bytecode }, 'latest']);
    tx = await(await wallet.sendTransaction(
      {
        to: gated.address,
        data: bytecode,
        gasLimit: 0xffffffff,
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
          gasLimit: 0xffffffff,
        }
      )).wait();

      const gasUsed = tx.cumulativeGasUsed.toNumber();
      const patchedBytecode = await provider.getCode(addr);
      const patchedBytecodeLength = (patchedBytecode.length - 2) / 2;

      tx = await(await testGatedContract.testCall(addr, callData || '0x', { gasLimit: 0xfffffff })).wait();

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
    'CODESIZE',
    'CODECOPY',
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
              gasLimit: 0xfffff,
            }
          )).wait();
        } catch (e) {
          reverted = true;
        }

        assert.ok(reverted, 'should revert');
      });
    }
  );

  it('TestContract.test()', async () => {
    const data = testContractInterface.functions.test.encode(
      [TOKEN, [ALICE, BOB], ['0xfa', '0xff']]
    );
    const tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit: 0xfffffff })).wait();

    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(tx.events[1].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001');
  });

  it('TestContract.testERC20() should fail', async () => {
    const data = testContractInterface.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, ACCOUNT_BALANCE]
    );
    const tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit: 0xfffffff })).wait();

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

    tx = await(await testGatedContract.call(testContractPatched, data, { gasLimit: 0xfffffff })).wait();
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
        gated.address, testContract.address, data, { gasLimit: 0xfffffff }
      )
    ).wait();
    console.log({ gasUsed: tx.cumulativeGasUsed.toString() });
    // success ?
    assert.equal(tx.events[0].topics[0], '0x0000000000000000000000000000000000000000000000000000000000000001');
  });
});

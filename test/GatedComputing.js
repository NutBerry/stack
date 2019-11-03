'use strict';

const ethers = require('ethers');
const assert = require('assert');

const GatedComputing = require('./../build/contracts/GatedComputing.json');
const TestContract = require('./../build/contracts/TestGatedComputing.json');
const Runtime = require('./../js/NutBerryRuntime.js');

describe('GatedComputing', async function () {
  const provider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);

  it('patching jumps and simple opcodes should work', async () => {
    const wallet = await provider.getSigner(0);
    const _factory = new ethers.ContractFactory(
      GatedComputing.abi,
      GatedComputing.bytecode,
      wallet,
    );
    const contract = await _factory.deploy();
    await contract.deployTransaction.wait();

    let bytecode = TestContract.deployedBytecode;

    const addr = await provider.send('eth_call', [{ to: contract.address, data: bytecode }, 'latest']);
    const tx = await(await wallet.sendTransaction(
      {
        to: contract.address,
        data: bytecode,
        gasLimit: 0xffffffff,
      }
    )).wait();

    const gasUsed = tx.cumulativeGasUsed.toNumber();
    const patchedBytecode = await provider.getCode(addr);
    const patchedBytecodeLength = (patchedBytecode.length - 2) / 2;
    const runState = await new Runtime().run({ code: ethers.utils.arrayify(patchedBytecode), data: [] });

    assert.equal(runState.opName, 'RETURN', 'return-opcode');
    assert.equal(runState.returnValue.toString('hex'), Buffer.alloc(32).toString('hex'), 'returnValue');

    console.log({ gasUsed, addr, patchedBytecodeLength });
  });
});
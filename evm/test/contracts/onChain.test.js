'use strict';

const assert = require('assert');

const { getCodeWithStep, deployContract, deployCode, toBN } = require('./../helpers/utils');
const onChainFixtures = require('./../fixtures/onChain');
const Runtime = require('./../helpers/EthereumRuntimeAdapter');

const OP = require('./../../utils/constants');
const EthereumRuntime = require('./../../build/contracts/EthereumRuntime.json');

describe('Runtime', function () {
  let rt;

  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('execute - stop - execute one step - compare', () => {
    onChainFixtures.forEach(fixture => {
      const { code, step, opcodeUnderTest } = getCodeWithStep(fixture);
      const data = fixture.data || '0x';

      it(opcodeUnderTest, async () => {
        const codeContract = await deployCode(code);
        // 1. export the state right before the target opcode (this supposed to be off-chain)
        const beforeState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: 0,
            stepCount: step,
          }
        );

        // 2. export state right after the target opcode (this supposed to be off-chain)
        const afterState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: 0,
            stepCount: step + 1,
          }
        );

        // 3. init with beforeState and execute just one step (target opcode) (this supposed to be on-chain)
        const onChainState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: beforeState.pc,
            stepCount: 1,
            stack: beforeState.stack,
            mem: beforeState.mem,
          }
        );

        // 4. check that on-chain state is the same as off-chain
        // checking hashValue is enough to say that states are same
        assert.equal(onChainState.hashValue, afterState.hashValue, 'State Hash');
      });
    });
  });
});

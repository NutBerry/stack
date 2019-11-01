'use strict';

const fs = require('fs');
const assert = require('assert');

const { getCode, deployContract, deployCode } =
  require('./../helpers/utils');
const fixtures = require('./../fixtures/runtime');
const runtimeGasUsed = require('./../fixtures/runtimeGasUsed');
const Runtime = require('./../helpers/EthereumRuntimeAdapter');
const OP = require('./../../utils/constants');

const EthereumRuntime = require('./../../build/contracts/EthereumRuntime.json');

describe('Runtime', function () {
  let rt;

  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('executeAndStop', () => {
    it('should allow to run a specific number of steps', async () => {
      // codepointers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A, B, C
      // execution order: 0, 1, 2, 8, 9, A, B, 3, 4, 5, 6, 7, C
      const code = [
        OP.PUSH1, '08', OP.JUMP, // jump to 0x08
        OP.JUMPDEST, OP.GASLIMIT, OP.PUSH1, '0C', OP.JUMP, // 0x03. Jump to 0x0c
        OP.JUMPDEST, OP.PUSH1, '03', OP.JUMP, // 0x08. Jump to 0x03
        OP.JUMPDEST, // 0x0c
      ];
      const data = '0x';
      const codeContract = await deployCode(code);
      const executeStep = async (stepCount) =>
        (await rt.execute(
          {
            code: codeContract.address,
            data: data,
            pc: 0,
            stepCount: stepCount,
          }
        )).pc;
      assert.equal(await executeStep(1), 2, 'should be at 2 JUMP');
      assert.equal(await executeStep(2), 8, 'should be at 8 JUMPDEST');
      assert.equal(await executeStep(3), 9, 'should be at 9 PUSH1');
      assert.equal(await executeStep(4), 11, 'should be at 11 JUMP');
      assert.equal(await executeStep(5), 3, 'should be at 3 JUMPDEST');
    });
  });

  describe('initAndExecute', () => {
    it('can continue from non-zero program counter', async () => {
      const code = [OP.PUSH1, '03', OP.PUSH1, '05', OP.ADD];
      const codeContract = await deployCode(code);
      const res = await rt.execute(
        {
          code: codeContract.address,
          pc: 0,
          stepCount: 2,
        }
      );
      const { stack } = await rt.execute(
        {
          code: codeContract.address,
          pc: 4,
          stepCount: 0,
          stack: res.stack,
          mem: res.mem,
        }
      );
      assert.deepEqual(stack, ['0x0000000000000000000000000000000000000000000000000000000000000008']);
    });

    const gasUsedValues = [];
    let totalGasUsed = 0;
    let totalGasUsedBaseline = 0;

    fixtures.forEach(async (fixture, index) => {
      const { code, pc, opcodeUnderTest } = getCode(fixture);
      const testName = fixture.description || opcodeUnderTest;

      it(testName, async () => {
        const stack = fixture.stack || [];
        const mem = fixture.memory || [];
        const data = fixture.data || '0x';
        const codeContract = await deployCode(code);
        const args = {
          code: codeContract.address,
          data,
          pc,
          stack,
          mem,
          errno: 0,
          stepCount: 0,
          returnData: '0x',
        };
        const res = await rt.execute(args);
        const gasUsed = (await rt.execute(args, true)).gasUsed.toNumber();

        totalGasUsed += gasUsed;
        gasUsedValues[index] = gasUsed;
        console.log(testName, 'gasUsed', gasUsed);

        const gasUsedBaseline = runtimeGasUsed[index];

        if (gasUsedBaseline !== undefined) {
          // The max increase in gas usage
          const maxAllowedDiff = 5000;

          // Skip gas accounting if we do coverage.
          // Ther other hack is for ganache. It has wrong gas accounting with some precompiles 🤦
          if (process.env.COVERAGE || gasUsed >= 0xf810000000000) {
            console.log(
              `Skipping gas accounting for ${testName} because of broken gas accounting (ganache) or coverage`
            );
          } else {
            totalGasUsedBaseline += gasUsedBaseline;

            assert.ok(
              gasUsed <= (gasUsedBaseline + maxAllowedDiff),
              `gasUsed(${gasUsed}) should be not more than baseline(${gasUsedBaseline}) + ${maxAllowedDiff}`
            );
          }
        } else {
          console.log(`*** No gasUsed-baseline for ${testName} ***`);
        }

        if (fixture.result.pc !== undefined) {
          assert.equal(res.pc.toNumber(), fixture.result.pc, 'pc');
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.errno, fixture.result.errno, 'errno');
        }
        if (fixture.result.stack) {
          assert.deepEqual(res.stack, fixture.result.stack, 'stack');
        }
        if (fixture.result.memory) {
          assert.deepEqual(res.mem, fixture.result.memory, 'memory');
        }

        if (index + 1 === fixtures.length) {
          console.log(`totalGasUsed new: ${totalGasUsed} old: ${totalGasUsedBaseline}`);

          if (totalGasUsed < totalGasUsedBaseline || fixtures.length !== runtimeGasUsed.length) {
            const path = __dirname + '/../fixtures/runtimeGasUsed.js';

            console.log(`*** New fixtures or low gas usage record. Writing results to ${path}. ***`);
            fs.writeFileSync(path, `'use strict';\nmodule.exports = ${JSON.stringify(gasUsedValues, null, 2)};`);
          }
        }
      });
    });
  });

  it('should stack overflow', async function () {
    const code = [OP.PUSH1, '00'];
    const stack = Array(1024).fill(OP.ZERO_HASH);
    const codeContract = await deployCode(code);
    const res = await rt.execute({ code: codeContract.address, stack });
    assert.equal(res.errno, OP.ERROR_STACK_OVERFLOW);
  });
});

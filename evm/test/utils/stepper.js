'use strict';

const { getCode, arrayify } = require('./../helpers/utils');
const { Constants, HydratedRuntime } = require('./../../utils/');
const fixtures = require('./../fixtures/runtime');

const assert = require('assert');

describe('JS Stepper', function () {
  describe('fixtures', async () => {
    fixtures.forEach(fixture => {
      const { pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const stepper = new HydratedRuntime();
        const code = arrayify('0x' + (typeof fixture.code === 'object' ? fixture.code.join('') : fixture.code));
        const stack = fixture.stack || [];
        const mem = fixture.memory || '';
        const data = arrayify(fixture.data || '0x');
        const args = {
          code,
          data,
          stack,
          mem,
          pc,
        };
        const steps = (await stepper.run(args)).steps;
        const res = steps[steps.length - 1];

        if (fixture.result.stack) {
          assert.deepEqual(res.stack, fixture.result.stack, 'stack');
        }
        if (fixture.result.memory) {
          assert.deepEqual(
            res.mem,
            arrayify('0x' + fixture.result.memory.map(e => e.replace('0x', '')).join('')),
            'mem'
          );
        }
        if (fixture.result.pc !== undefined) {
          assert.equal(res.pc, fixture.result.pc, 'pc');
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.errno, fixture.result.errno, 'errno');
        }
      });
    });
  });
});

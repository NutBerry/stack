'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

const OPCODES = require('./Opcodes.js');

const PRECOMPILED = {
  '1': require('./precompiled/01-ecrecover.js'),
  '2': require('./precompiled/02-sha256.js'),
  '3': require('./precompiled/03-ripemd160.js'),
  '4': require('./precompiled/04-identity.js'),
  '5': require('./precompiled/05-modexp.js'),
  '6': require('./precompiled/06-ecadd.js'),
  '7': require('./precompiled/07-ecmul.js'),
  '8': require('./precompiled/08-ecpairing.js'),
};

const ERRNO_MAP =
  {
    'stack overflow': 0x01,
    'stack underflow': 0x02,
    'invalid opcode': 0x04,
    'invalid JUMP': 0x05,
    'instruction not supported': 0x06,
    'revert': 0x07,
    'static state change': 0x0b,
    'out of gas': 0x0d,
    'internal error': 0xff,
  };

const ERROR = {
  OUT_OF_GAS: 'out of gas',
  STACK_UNDERFLOW: 'stack underflow',
  STACK_OVERFLOW: 'stack overflow',
  INVALID_JUMP: 'invalid JUMP',
  INSTRUCTION_NOT_SUPPORTED: 'instruction not supported',
  INVALID_OPCODE: 'invalid opcode',
  REVERT: 'revert',
  STATIC_STATE_CHANGE: 'static state change',
  INTERNAL_ERROR: 'internal error',
};

function VmError (error) {
  this.error = error;
  this.errorType = 'VmError';
};

const ADDRESS_ZERO_BUF = Buffer.alloc(20);

function NumToBuf32 (val) {
  val = val.toString(16);

  while (val.length !== 64) {
    val = '0' + val;
  }

  return Buffer.from(val, 'hex');
}

function NumToHex (val) {
  val = val.toString(16).replace('0x', '');

  if (val.length % 2 !== 0) {
    val = '0' + val;
  }

  return val;
}

// Find Ceil(`this` / `num`)
function divCeil (a, b) {
  const div = a.div(b);
  const mod = a.mod(b);

  // Fast case - exact division
  if (mod.isZero()) {
    return div;
  }

  // Round up
  return div.isNeg() ? div.isubn(1) : div.iaddn(1);
}

module.exports = class EVMRuntime {
  constructor () {
  }

  async runNextStep (runState) {
    let exceptionError;
    try {
      const opCode = runState.code[runState.programCounter];
      const opInfo = OPCODES[opCode] || ['INVALID', 0, 0, 0];
      const opName = opInfo[0];

      runState.opName = opName;
      runState.opCode = opCode;
      runState.stackIn = opInfo[2];
      runState.stackOut = opInfo[3];

      if (runState.stack.length < runState.stackIn) {
        throw new VmError(ERROR.STACK_UNDERFLOW);
      }

      if ((runState.stack.length - runState.stackIn + runState.stackOut) > 1024) {
        throw new VmError(ERROR.STACK_OVERFLOW);
      }

      runState.programCounter++;

      await this['handle' + opName](runState);
    } catch (e) {
      exceptionError = e;
    }

    let errno = 0;
    if (exceptionError) {
      errno = ERRNO_MAP[exceptionError.error] || 0xff;
      runState.vmError = true;
    }

    if (errno !== 0 || runState.stopped) {
      // pc should not be incremented, reverse the above
      runState.programCounter--;
    }

    runState.errno = errno;
  }

  async initRunState (obj) {
    const runState = {
      code: obj.code,
      callData: obj.data,
      // caller & origin are the same in our case
      caller: obj.caller || obj.origin || ADDRESS_ZERO_BUF,
      origin: obj.origin || ADDRESS_ZERO_BUF,
      address: obj.address || ADDRESS_ZERO_BUF,
      memory: [],
      stack: [],
      memoryWordCount: new BN(0),
      stackIn: 0,
      stackOut: 0,
      programCounter: obj.pc | 0,
      errno: 0,
      vmError: false,
      stopped: false,
      returnValue: Buffer.alloc(0),
      validJumps: {},
    };

    const len = runState.code.length;

    for (let i = 0; i < len; i++) {
      const op = OPCODES[runState.code[i]] || ['INVALID'];

      if (op[0] === 'PUSH') {
        i += runState.code[i] - 0x5f;
      }

      if (op[0] === 'JUMPDEST') {
        runState.validJumps[i] = true;
      }
    }

    if (obj.stack) {
      const len = obj.stack.length;

      for (let i = 0; i < len; i++) {
        runState.stack.push(new BN(obj.stack[i].replace('0x', ''), 'hex'));
      }
    }

    if (obj.mem) {
      const len = obj.mem.length;

      for (let i = 0; i < len; i++) {
        const memSlot = obj.mem[i];

        runState.memoryWordCount.iaddn(1);

        for (let x = 2; x < 66;) {
          const hexVal = memSlot.substring(x, x += 2);

          runState.memory.push(hexVal ? parseInt(hexVal, 16) : 0);
        }
      }
    }

    return runState;
  }

  async run (args) {
    // TODO: Support EVMParameters
    const runState = await this.initRunState(args);
    let stepCount = args.stepCount | 0;

    while (!runState.stopped && !runState.vmError && runState.programCounter < runState.code.length) {
      await this.runNextStep(runState);

      if (stepCount !== 0) {
        if (--stepCount === 0) {
          break;
        }
      }
    }

    return runState;
  }

  async handleSTOP (runState) {
    runState.stopped = true;
  }

  async handleADD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.add(b).mod(utils.TWO_POW256));
  }

  async handleMUL (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.mul(b).mod(utils.TWO_POW256));
  }

  async handleSUB (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.sub(b).toTwos(256));
  }

  async handleDIV (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      r = a.div(b);
    }
    runState.stack.push(r);
  }

  async handleSDIV (runState) {
    let a = runState.stack.pop();
    let b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      a = a.fromTwos(256);
      b = b.fromTwos(256);
      r = a.div(b).toTwos(256);
    }
    runState.stack.push(r);
  }

  async handleMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      r = a.mod(b);
    }
    runState.stack.push(r);
  }

  async handleSMOD (runState) {
    let a = runState.stack.pop();
    let b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      a = a.fromTwos(256);
      b = b.fromTwos(256);
      r = a.abs().mod(b.abs());
      if (a.isNeg()) {
        r = r.ineg();
      }
      r = r.toTwos(256);
    }
    runState.stack.push(r);
  }

  async handleADDMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const c = runState.stack.pop();
    let r;

    if (c.isZero()) {
      r = new BN(c);
    } else {
      r = a.add(b).mod(c);
    }
    runState.stack.push(r);
  }

  async handleMULMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const c = runState.stack.pop();
    let r;

    if (c.isZero()) {
      r = new BN(c);
    } else {
      r = a.mul(b).mod(c);
    }
    runState.stack.push(r);
  }

  async handleEXP (runState) {
    const base = runState.stack.pop();
    const exponent = runState.stack.pop();

    if (exponent.isZero()) {
      runState.stack.push(new BN(1));
      return;
    }

    const byteLength = exponent.byteLength();

    if (byteLength < 1 || byteLength > 32) {
      throw new VmError(ERROR.OUT_OF_RANGE);
    }

    if (base.isZero()) {
      runState.stack.push(new BN(0));
      return;
    }

    const m = BN.red(utils.TWO_POW256);
    const redBase = base.toRed(m);
    const r = redBase.redPow(exponent);

    runState.stack.push(r.fromRed());
  }

  async handleSIGNEXTEND (runState) {
    const k = runState.stack.pop();
    let val = runState.stack.pop();

    if (k.ltn(31)) {
      const signBit = k
        .muln(8)
        .iaddn(7)
        .toNumber();
      const mask = new BN(1).ishln(signBit).isubn(1);
      if (val.testn(signBit)) {
        val = val.or(mask.notn(256));
      } else {
        val = val.and(mask);
      }
    } else {
      val = new BN(val);
    }
    runState.stack.push(val);
  }

  async handleLT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.lt(b) ? 1 : 0));
  }

  async handleGT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.gt(b) ? 1 : 0));
  }

  async handleSLT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.fromTwos(256).lt(b.fromTwos(256)) ? 1 : 0));
  }

  async handleSGT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.fromTwos(256).gt(b.fromTwos(256)) ? 1 : 0));
  }

  async handleEQ (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.eq(b) ? 1 : 0));
  }

  async handleISZERO (runState) {
    const a = runState.stack.pop();

    runState.stack.push(new BN(a.isZero() ? 1 : 0));
  }

  async handleAND (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.and(b));
  }

  async handleOR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.or(b));
  }

  async handleXOR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.xor(b));
  }

  async handleNOT (runState) {
    const a = runState.stack.pop();

    runState.stack.push(a.notn(256));
  }

  async handleBYTE (runState) {
    const pos = runState.stack.pop();
    const word = runState.stack.pop();

    if (pos.gten(32)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(new BN(word.shrn((31 - pos.toNumber()) * 8).andln(0xff)));
  }

  async handleSHL (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    if (a.gten(256)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(b.shln(a.toNumber()).iand(utils.MAX_INTEGER));
  }

  async handleSHR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    if (a.gten(256)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(b.shrn(a.toNumber()));
  }

  async handleSAR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const isSigned = b.testn(255);
    let r;

    if (a.gten(256)) {
      if (isSigned) {
        r = new BN(utils.MAX_INTEGER);
      } else {
        r = new BN(0);
      }
      runState.stack.push(r);
      return;
    }

    const c = b.shrn(a.toNumber());
    if (isSigned) {
      const shiftedOutWidth = 255 - a.toNumber();
      const mask = utils.MAX_INTEGER.shrn(shiftedOutWidth).shln(shiftedOutWidth);

      r = c.ior(mask);
    } else {
      r = c;
    }
    runState.stack.push(r);
  }

  async handleSHA3 (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();
    let data = Buffer.alloc(0);

    if (!length.isZero()) {
      data = this.memLoad(runState, offset, length);
    }

    runState.stack.push(new BN(utils.keccak256(data)));
  }

  async handleADDRESS (runState) {
    runState.stack.push(new BN(runState.address));
  }

  async handleBALANCE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleORIGIN (runState) {
    runState.stack.push(new BN(runState.origin));
  }

  async handleCALLER (runState) {
    runState.stack.push(new BN(runState.caller));
  }

  async handleCALLVALUE (runState) {
    runState.stack.push(new BN(0));
  }

  async handleCALLDATALOAD (runState) {
    const pos = runState.stack.pop();

    if (pos.gtn(runState.callData.length)) {
      runState.stack.push(new BN(0));
      return;
    }

    const s = pos.toNumber();
    const buf = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      if (s + i < runState.callData.length) {
        buf[i] = runState.callData[s + i];
      }
    }

    runState.stack.push(new BN(buf));
  }

  async handleCALLDATASIZE (runState) {
    runState.stack.push(new BN(runState.callData.length));
  }

  async handleCALLDATACOPY (runState) {
    const memOffset = runState.stack.pop();
    const dataOffset = runState.stack.pop();
    const dataLength = runState.stack.pop();

    this.memStore(runState, memOffset, runState.callData, dataOffset, dataLength);
  }

  async handleCODESIZE (runState) {
    runState.stack.push(new BN(runState.code.length));
  }

  async handleCODECOPY (runState) {
    const memOffset = runState.stack.pop();
    const codeOffset= runState.stack.pop();
    const length = runState.stack.pop();

    this.memStore(runState, memOffset, runState.code, codeOffset, length);
  }

  async handleEXTCODESIZE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleEXTCODECOPY (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleEXTCODEHASH (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleRETURNDATASIZE (runState) {
    runState.stack.push(new BN(runState.returnValue.length));
  }

  async handleRETURNDATACOPY (runState) {
    const memOffset = runState.stack.pop();
    const returnDataOffset = runState.stack.pop();
    const length = runState.stack.pop();

    // TODO: check if this the desired behaviour
    if ((returnDataOffset.add(length)).gtn(runState.returnValue.length)) {
      throw new VmError(ERROR.OUT_OF_GAS);
    }

    this.memStore(runState, memOffset, utils.toBuffer(runState.returnValue), returnDataOffset, length);
  }

  async handleGASPRICE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleBLOCKHASH (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCOINBASE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleTIMESTAMP (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleNUMBER (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleDIFFICULTY (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleGASLIMIT (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handlePOP (runState) {
    runState.stack.pop();
  }

  async handleMLOAD (runState) {
    const pos = runState.stack.pop();

    runState.stack.push(new BN(this.memLoad(runState, pos, new BN(32))));
  }

  async handleMSTORE (runState) {
    const offset = runState.stack.pop();
    let word = runState.stack.pop();

    word = word.toArrayLike(Buffer, 'be', 32);
    this.memStore(runState, offset, word, new BN(0), new BN(32));
  }

  async handleMSTORE8 (runState) {
    const offset = runState.stack.pop();
    let byte = runState.stack.pop();

    // NOTE: we're using a 'trick' here to get the least significant byte
    byte = Buffer.from([ byte.andln(0xff) ]);
    this.memStore(runState, offset, byte, new BN(0), new BN(1));
  }

  async handleSLOAD (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSSTORE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleJUMP (runState) {
    const dest = runState.stack.pop();

    if (dest.gtn(runState.code.length)) {
      throw new VmError(ERROR.INVALID_JUMP);
    }

    const destNum = dest.toNumber();

    if (!runState.validJumps[destNum]) {
      throw new VmError(ERROR.INVALID_JUMP);
    }

    runState.programCounter = destNum;
  }

  async handleJUMPI (runState) {
    const dest = runState.stack.pop();
    const cond = runState.stack.pop();

    if (!cond.isZero()) {
      if (dest.gtn(runState.code.length)) {
        throw new VmError(ERROR.INVALID_JUMP);
      }

      const destNum = dest.toNumber();

      if (!runState.validJumps[destNum]) {
        throw new VmError(ERROR.INVALID_JUMP);
      }

      runState.programCounter = destNum;
    }
  }

  async handlePC (runState) {
    runState.stack.push(new BN(runState.programCounter - 1));
  }

  async handleMSIZE (runState) {
    runState.stack.push(runState.memoryWordCount.muln(32));
  }

  async handleGAS (runState) {
    runState.stack.push(new BN(0));
  }

  async handleJUMPDEST (runState) {
  }

  async handlePUSH (runState) {
    // needs to be right-padded with zero
    const numToPush = runState.opCode - 0x5f;
    const t = new Uint8Array(numToPush);
    for (let i = 0; i < numToPush; i++) {
      const val = runState.programCounter + i;

      if (val < runState.code.length) {
        t[i] = runState.code[val];
      }
    }
    const result = new BN(t);
    //
    //  runState.code.slice(
    //    runState.programCounter, runState.programCounter + numToPush
    //  ).toString('hex').padEnd(numToPush * 2, '0')
    //);

    runState.programCounter += numToPush;
    runState.stack.push(result);
  }

  async handleDUP (runState) {
    const stackPos = runState.opCode - 0x7f;

    if (stackPos > runState.stack.length) {
      throw new VmError(ERROR.STACK_UNDERFLOW);
    }

    runState.stack.push(new BN(runState.stack[runState.stack.length - stackPos]));
  }

  async handleSWAP (runState) {
    const stackPos = runState.opCode - 0x8f;
    const swapIndex = runState.stack.length - stackPos - 1;

    if (swapIndex < 0) {
      throw new VmError(ERROR.STACK_UNDERFLOW);
    }

    const topIndex = runState.stack.length - 1;
    const tmp = runState.stack[topIndex];

    runState.stack[topIndex] = runState.stack[swapIndex];
    runState.stack[swapIndex] = tmp;
  }

  async handleLOG (runState) {
    const val = (runState.opCode - 0xa0) + 2;

    // TODO: support for logs
    runState.stack.splice(runState.stack.length - val);
  }

  async handleCREATE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCREATE2 (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCALL (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCALLCODE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleDELEGATECALL (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSTATICCALL (runState) {
    const target = runState.stack[runState.stack.length - 2] || new BN(0xff);

    if (target.gten(0) && target.lten(8)) {
      // gasLimit
      runState.stack.pop();
      const toAddress = runState.stack.pop();
      const inOffset = runState.stack.pop();
      const inLength = runState.stack.pop();
      const outOffset = runState.stack.pop();
      const outLength = runState.stack.pop();
      const data = this.memLoad(runState, inOffset, inLength);

      const precompile = PRECOMPILED[toAddress.toString()];
      const r = await precompile(data);

      this.memStore(runState, outOffset, r.returnValue, new BN(0), outLength);

      runState.returnValue = r.returnValue;
      runState.stack.push(new BN(r.exception));

      return;
    }

    runState.returnValue = Buffer.alloc(0);
    runState.stack = runState.stack.slice(0, runState.stack.length - 6);
    runState.stack.push(new BN(0));

    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleRETURN (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();

    runState.stopped = true;
    runState.returnValue = this.memLoad(runState, offset, length);
  }

  async handleREVERT (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();

    runState.returnValue = this.memLoad(runState, offset, length);
    throw new VmError(ERROR.REVERT);
  }

  async handleSELFDESTRUCT (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleINVALID (runState) {
    throw new VmError(ERROR.INVALID_OPCODE);
  }

  memStore (runState, offset, val, valOffset, length) {
    if (length.isZero()) {
      return;
    }

    const words = divCeil(offset.add(length), new BN(32));

    if (words.gt(runState.memoryWordCount)) {
      runState.memoryWordCount = words;
    }

    let safeLen = 0;
    if (valOffset.add(length).gtn(val.length)) {
      if (valOffset.gten(val.length)) {
        safeLen = 0;
      } else {
        valOffset = valOffset.toNumber();
        safeLen = val.length - valOffset;
      }
    } else {
      valOffset = valOffset.toNumber();
      safeLen = val.length;
    }

    let i = 0;

    offset = offset.toNumber();
    length = length.toNumber();
    if (safeLen > 0) {
      safeLen = safeLen > length ? length : safeLen;
      for (; i < safeLen; i++) {
        runState.memory[offset + i] = val[valOffset + i];
      }
    }

    if (val.length > 0 && i < length) {
      for (; i < length; i++) {
        runState.memory[offset + i] = 0;
      }
    }
  }

  memLoad (runState, offset, length) {
    if (length.isZero()) {
      return Buffer.alloc(0);
    }

    const words = divCeil(offset.add(length), new BN(32));

    if (words.gt(runState.memoryWordCount)) {
      runState.memoryWordCount = words;
    }

    offset = offset.toNumber();
    length = length.toNumber();

    const loaded = runState.memory.slice(offset, offset + length);

    for (let i = loaded.length; i < length; i++) {
      loaded[i] = 0;
    }

    return Buffer.from(loaded);
  }
};

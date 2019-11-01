'use strict';

const OP = require('./constants');
const EVMRuntime = require('./EVMRuntime');
const RangeProofHelper = require('./RangeProofHelper');
const Merkelizer = require('./Merkelizer');
const Keccak = require('./keccak256');

const toHex = arr => arr.map(e => '0x' + e.toString(16).padStart(64, '0'));
const toHexFromBN = arr => arr.map(e => e.toArray('be', 32));

const OP_SWAP1 = parseInt(OP.SWAP1, 16);
const OP_SWAP16 = parseInt(OP.SWAP16, 16);
const OP_DUP1 = parseInt(OP.DUP1, 16);
const OP_DUP16 = parseInt(OP.DUP16, 16);

module.exports = class HydratedRuntime extends EVMRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);
    const stack = toHexFromBN(runState.stack);

    runState.steps = [];
    runState.prevStack = stack;
    runState.stackHashes = Merkelizer.stackHashes(stack);

    runState.memProof = new RangeProofHelper(runState.memory);
    runState.callDataProof = new RangeProofHelper(runState.callData);
    runState.callData = runState.callDataProof.proxy;
    runState.memory = runState.memProof.proxy;

    return runState;
  }


  async run (args) {
    const runState = await super.run(args);

    // a temporay hack for our unit tests :/
    if (runState.steps.length > 0) {
      runState.steps[runState.steps.length - 1].stack = toHex(runState.stack);
    }

    return runState;
  }

  async runNextStep (runState) {
    let pc = runState.programCounter;
    const callDataProof = runState.callDataProof;

    callDataProof.reset();

    await super.runNextStep(runState);

    const opcode = runState.opCode;

    // if we have no errors and opcode is not RETURN or STOP, update pc
    if (runState.errno === 0 && (opcode !== 0xf3 && opcode !== 0x00)) {
      pc = runState.programCounter;
    }

    const step = {
      callDataReadLow: callDataProof.readLow,
      callDataReadHigh: callDataProof.readHigh,
      returnData: runState.returnValue,
      pc: pc,
      errno: runState.errno,
      opname: runState.opName,
    };

    this.calculateMemProof(runState, step);
    this.calculateStackProof(runState, step);

    runState.steps.push(step);
  }

  calculateMemProof (runState, step) {
    const memProof = runState.memProof;
    const prevMemHash = runState.prevMemHash;
    const prevMemSize = runState.prevMemSize | 0;
    const prevMem = runState.prevMem;
    const memSize = runState.memoryWordCount.toNumber();

    // serialize the memory if it changed
    if (memProof.writeHigh !== -1 || !prevMemHash || prevMemSize !== memSize) {
      const mem = new Uint8Array(memSize * 32);
      const memStore = runState.memProof.data;

      for (let i = 0; i < memStore.length; i++) {
        mem[i] = memStore[i];
      }

      const memHash = new Keccak().update(mem).digest();

      runState.prevMem = mem;
      runState.prevMemHash = memHash;
      runState.prevMemSize = memSize;
      step.memSize = memSize;
      step.memHash = memHash;
      step.mem = mem;
    } else {
      step.mem = prevMem;
      step.memSize = prevMemSize;
      step.memHash = prevMemHash;
    }

    step.memReadLow = memProof.readLow;
    step.memReadHigh = memProof.readHigh;
    step.memWriteLow = memProof.writeLow;
    step.memWriteHigh = memProof.writeHigh;

    memProof.reset();
  }

  calculateStackProof (runState, step) {
    const opcode = runState.opCode;
    let stackIn = runState.stackIn | 0;

    if (opcode >= OP_SWAP1 && opcode <= OP_SWAP16) {
      stackIn = (16 - (OP_SWAP16 - opcode)) * 2;
    }

    if (opcode >= OP_DUP1 && opcode <= OP_DUP16) {
      stackIn = 16 - (OP_DUP16 - opcode);
    }

    // can happen on error - clip here
    if (stackIn > runState.prevStack.length) {
      stackIn = runState.prevStack.length;
    }

    // if stack changed
    if (stackIn !== 0 || runState.prevStack.length !== runState.stack.length) {
      // elements needed
      step.compactStack = new Array(stackIn);

      // remove the number of 'consumed' elements - if any
      while (stackIn--) {
        step.compactStack[stackIn] = runState.prevStack.pop();
        runState.stackHashes.pop();
      }

      // add the new/changed elements - if any
      const newElements = [];
      for (let i = runState.prevStack.length; i < runState.stack.length; i++) {
        const val = runState.stack[i].toArray('be', 32);

        runState.prevStack.push(val);
        newElements.push(val);
      }
      step.compactStackHash = runState.stackHashes[runState.stackHashes.length - 1];

      const partialHashes = Merkelizer.stackHashes(newElements, step.compactStackHash);
      // first element of partialHash is alread in the list
      runState.stackHashes = runState.stackHashes.concat(partialHashes.slice(1, partialHashes.length));
    } else {
      step.compactStackHash = runState.stackHashes[runState.stackHashes.length - 1];
      step.compactStack = [];
    }

    step.stackHash = runState.stackHashes[runState.stackHashes.length - 1];
    step.stackSize = runState.stack.length;
  }
};

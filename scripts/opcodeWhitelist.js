#!/usr/bin/env node
'use strict';

const { Constants } = require('../evm/utils/');
const allowed = [
  Constants.STOP,
  Constants.ADD,
  Constants.MUL,
  Constants.SUB,
  Constants.DIV,
  Constants.SDIV,
  Constants.MOD,
  Constants.SMOD,
  Constants.ADDMOD,
  Constants.MULMOD,
  Constants.EXP,
  Constants.SIGNEXTEND,
  Constants.LT,
  Constants.GT,
  Constants.SLT,
  Constants.SGT,
  Constants.EQ,
  Constants.ISZERO,
  Constants.AND,
  Constants.OR,
  Constants.XOR,
  Constants.NOT,
  Constants.BYTE,
  Constants.SHL,
  Constants.SHR,
  Constants.SAR,
  Constants.SHA3,
  Constants.ADDRESS,
  Constants.ORIGIN,
  Constants.CALLER,
  Constants.CALLVALUE,
  Constants.CALLDATALOAD,
  Constants.CALLDATASIZE,
  Constants.CALLDATACOPY,
  Constants.EXTCODESIZE,
  Constants.RETURNDATASIZE,
  Constants.RETURNDATACOPY,
  Constants.POP,
  Constants.MLOAD,
  Constants.MSTORE,
  Constants.MSTORE8,
  //Constants.SLOAD,
  //Constants.SSTORE,
  Constants.JUMP,
  Constants.JUMPI,
  Constants.PC,
  Constants.MSIZE,
  Constants.GAS,
  Constants.JUMPDEST,
  Constants.PUSH1,
  Constants.PUSH2,
  Constants.PUSH3,
  Constants.PUSH4,
  Constants.PUSH5,
  Constants.PUSH6,
  Constants.PUSH7,
  Constants.PUSH8,
  Constants.PUSH9,
  Constants.PUSH10,
  Constants.PUSH11,
  Constants.PUSH12,
  Constants.PUSH13,
  Constants.PUSH14,
  Constants.PUSH15,
  Constants.PUSH16,
  Constants.PUSH17,
  Constants.PUSH18,
  Constants.PUSH19,
  Constants.PUSH20,
  Constants.PUSH21,
  Constants.PUSH22,
  Constants.PUSH23,
  Constants.PUSH24,
  Constants.PUSH25,
  Constants.PUSH26,
  Constants.PUSH27,
  Constants.PUSH28,
  Constants.PUSH29,
  Constants.PUSH30,
  Constants.PUSH31,
  Constants.PUSH32,
  Constants.DUP1,
  Constants.DUP2,
  Constants.DUP3,
  Constants.DUP4,
  Constants.DUP5,
  Constants.DUP6,
  Constants.DUP7,
  Constants.DUP8,
  Constants.DUP9,
  Constants.DUP10,
  Constants.DUP11,
  Constants.DUP12,
  Constants.DUP13,
  Constants.DUP14,
  Constants.DUP15,
  Constants.DUP16,
  Constants.SWAP1,
  Constants.SWAP2,
  Constants.SWAP3,
  Constants.SWAP4,
  Constants.SWAP5,
  Constants.SWAP6,
  Constants.SWAP7,
  Constants.SWAP8,
  Constants.SWAP9,
  Constants.SWAP10,
  Constants.SWAP11,
  Constants.SWAP12,
  Constants.SWAP13,
  Constants.SWAP14,
  Constants.SWAP15,
  Constants.SWAP16,
  Constants.LOG0,
  Constants.LOG1,
  Constants.LOG2,
  Constants.LOG3,
  Constants.LOG4,
  Constants.CALL,
  Constants.RETURN,
  Constants.STATICCALL,
  Constants.REVERT,
  Constants.INVALID,
];

let allowedVal = BigInt(0);
allowed.forEach(
  (opcode, i) => {
    if (opcode === undefined) {
      throw new Error(`undefined opcode at position: ${i}`);
    }
    const n = parseInt(opcode, 16);
    allowedVal |= BigInt(1) << BigInt(n);
  }
);
console.log({ allowed: `0x${allowedVal.toString(16).padStart('0', 64)}` });

const reverse = {};
Object.keys(Constants).forEach(
  (key) => {
    reverse[Constants[key]] = key;
  }
);
for (let i = 0; i <= 0xff; i++) {
  const enabled = allowedVal & (BigInt(1) << BigInt(i));
  const rev = reverse[i.toString(16).padStart('0', 2)];
  if (!enabled && rev) {
    console.log(`disallowed: ${i} ${rev}`);
  }
}

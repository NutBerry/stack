'use strict';

const { Constants } = require('../evm/utils');

function deployCode (code) {
  code = code.replace('0x', '');
  let codeLen = (code.length / 2).toString(16);

  if (codeLen.length % 2 === 1) {
    codeLen = '0' + codeLen;
  }

  let codeOffset = (10 + codeLen.length / 2).toString(16);
  if (codeOffset.length % 2 === 1) {
    codeOffset = '0' + codeOffset;
  }
  let codeCopy = [
    Constants[`PUSH${codeLen.length / 2}`], codeLen,
    Constants.DUP1,
    Constants.PUSH1, codeOffset,
    Constants.PUSH1, '00',
    Constants.CODECOPY,
    Constants.PUSH1, '00',
    Constants.RETURN,
  ];

  return '0x' + codeCopy.join('') + code;
}

this.DEFAULT_CONTRACT = '0x' + [
  Constants.CALLDATASIZE,
  Constants.PUSH1, '00',
  Constants.DUP1,
  Constants.CALLDATACOPY,
  Constants.PUSH1, '00',
  Constants.DUP1,
  Constants.CALLDATASIZE,
  Constants.PUSH1, '00',
  Constants.DUP1,
  Constants.ADDRESS,
  Constants.GAS,
  Constants.CALL,
  Constants.RETURNDATASIZE,
  Constants.PUSH1, '00',
  Constants.DUP1,
  Constants.RETURNDATACOPY,
  Constants.DUP1,
  Constants.ISZERO,
  Constants.ISZERO,
  Constants.PUSH1, '1e',
  Constants.JUMPI,
  Constants.RETURNDATASIZE,
  Constants.PUSH1, '00',
  Constants.REVERT,
  Constants.JUMPDEST,
  Constants.RETURNDATASIZE,
  Constants.PUSH1, '00',
  Constants.RETURN,
  Constants.INVALID,
].join('');

this.DEFAULT_CONTRACT_CODE = deployCode(this.DEFAULT_CONTRACT);

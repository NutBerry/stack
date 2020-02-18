'use strict';

// TODO
// cleanup and improve all those helper functions
const ethers = require('ethers');
const ABI = new ethers.utils.AbiCoder();

// Transaction(address to,uint256 nonce,bytes data)
const TRANSACTION_TYPE_HASH = '0x174ead53e7b62242b648b7bb2a954244aaa3af2f55517ec670f9801d2dea09e5';
// EIP712Domain(string name,string version)
// const DOMAIN_TYPEHASH = '0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3';
// const DOMAIN_STRUCT_HASH = ethers.utils.keccak256(
//  ABI.encode(
//    ['bytes32', 'bytes32', 'bytes32'],
//    [DOMAIN_TYPEHASH, ethers.utils.keccak256(Buffer.from('NutBerry')), ethers.utils.keccak256(Buffer.from('2'))]
//  )
// );
const DOMAIN_STRUCT_HASH = '0f74ffb7207f25d4ae678c8841affcefd13e0c34b475ef7dd5773791690ba137';

function arrayify (val) {
  const res = [];

  if (typeof val === 'object') {
    return Array.from(val);
  }

  if (typeof val !== 'string') {
    val = val.toString(16);
    if (val.length % 2 !== 0) {
      val = val.padStart(val.length + 1, '0');
    }
  }
  val = val.replace('0x', '');

  const vLength = val.length;

  for (let i = 0; i < vLength; i += 2) {
    res.push(parseInt(val.substring(i, i + 2), 16));
  }
  return res;
}

module.exports = class Utils {
  static toUint8Array (hexStr) {
    hexStr = hexStr.replace('0x', '');

    const len = hexStr.length;
    const buf = new Uint8Array(len / 2);

    for (let i = 0; i < len; i += 2) {
      buf[i / 2] = parseInt(hexStr.substring(i, i + 2), 16);
    }

    return buf;
  }

  static bufToHex (buf, start, end) {
    let res = '0x';

    for (let i = start; i < end; i++) {
      res += (buf[i] | 0).toString(16).padStart(2, '0');
    }

    return res;
  }

  static dumpLogs (logs, _interface) {
    const topics = {};
    const keys = Object.keys(_interface.events);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const obj = _interface.events[key];

      topics[obj.topic] = obj;
    }

    logs.forEach(
      function (log) {
        const obj = topics[log.topics[0]];

        console.log(obj ? obj.decode(log.data) : log);
      }
    );
  }

  static encodeTxToArray (tx) {
    const nonceBytes = arrayify(tx.nonce);
    const calldataBytes = arrayify(tx.data);
    let enc = arrayify(tx.v)
      .concat(arrayify(tx.r))
      .concat(arrayify(tx.s));

    if (nonceBytes.length > 1 || nonceBytes[0] > 0xde) {
      enc.push(0xff - nonceBytes.length);
      enc = enc.concat(nonceBytes);
    } else {
      enc = enc.concat(nonceBytes);
    }

    enc = enc.concat(arrayify(tx.to));

    if (calldataBytes.length >= 0xff) {
      enc.push(0xff);
      enc.push(calldataBytes.length >> 8);
      enc.push(calldataBytes.length & 0xff);
    } else {
      enc.push(calldataBytes.length);
    }

    return enc.concat(calldataBytes);
  }

  static decodeTransactionLength (bytes, start) {
    // TODO
    // check bounds
    let offset = start | 0;
    let orig = offset;

    // v, r, s
    offset += 1;
    offset += 32;
    offset += 32;

    if (bytes[offset] < 0xdf) {
      offset += 1;
    } else {
      const l = 0xff - bytes[offset];
      offset += 1;
      offset += l;
    }

    offset += 20;

    if (bytes[offset] === 0xff) {
      const l = (bytes[offset += 1] << 8) | (bytes[offset += 1]);
      offset += 1;
      offset += l;
    } else {
      const l = bytes[offset];
      offset += 1;
      offset += l;
    }

    return (offset - orig) || 87;
  }

  static decodeTxFromArray (bytes, start) {
    // TODO
    // check bounds
    let offset = start | 0;

    const v = this.bufToHex(bytes, offset, offset += 1);
    const r = this.bufToHex(bytes, offset, offset += 32);
    const s = this.bufToHex(bytes, offset, offset += 32);

    let nonce;
    if (bytes[offset] < 0xdf) {
      nonce = BigInt(bytes[offset]);
      offset += 1;
    } else {
      const l = 0xff - bytes[offset];
      nonce = BigInt(this.bufToHex(bytes, offset += 1, offset += l));
    }

    const to = this.bufToHex(bytes, offset, offset += 20);

    let dataLength = bytes[offset];
    if (dataLength === 0xff) {
      dataLength = (bytes[offset += 1] << 8) | (bytes[offset += 1]);
    }
    const data = this.bufToHex(bytes, offset += 1, offset += dataLength);

    return { nonce, to, data, r, s, v };
  }

  static encodeTx (tx) {
    const encoded = this.encodeTxToArray(tx);

    return this.bufToHex(encoded, 0, encoded.length);
  }

  static parseTransaction (rawStringOrArray) {
    const bytes = arrayify(rawStringOrArray);
    const v = bytes[0];

    let tx;
    // that should be our internal encoding
    if (v === 0x1b || v === 0x1c || v === 0x80 || v === 0x81) {
      tx = this.decodeTxFromArray(bytes);

      if (v === 0x80 || v === 0x81) {
        // ERC-712
        let { r, s, v } = tx;
        v = parseInt(v, 16) - 101;
        const typedDataHash = this.typedDataHash(tx);

        tx.from = ethers.utils.recoverAddress(typedDataHash, { r, s, v }).toLowerCase();
        tx.hash = ethers.utils.keccak256(bytes);
      } else {
        const tmp = {
          to: tx.to,
          nonce: '0x' + tx.nonce.toString(16),
          data: tx.data,
          gasLimit: 0,
          gasPrice: 0,
          value: 0,
          chainId: 0,
        };
        // naive way to recover signer and tx hash
        const signed = ethers.utils.parseTransaction(
          ethers.utils.serializeTransaction(tmp, tx)
        );
        tx.hash = signed.hash;
        tx.from = signed.from.toLowerCase();
      }

      tx.value = 0;
      tx.gasPrice = 0;
      tx.gasLimit = 0;
      tx.chainId = 0;
    } else {
      tx = ethers.utils.parseTransaction(bytes);

      tx.gasPrice = tx.gasPrice.toNumber();
      tx.gasLimit = tx.gasLimit.toNumber();
      tx.value = tx.value.toNumber();

      tx.from = tx.from.toLowerCase();
      tx.to = tx.to.toLowerCase();
      tx.nonce = BigInt(tx.nonce);
    }

    return tx;
  }

  static typedDataHash (tx) {
    const data = ABI.encode(
      ['bytes32', 'address', 'uint256', 'bytes32'],
      [TRANSACTION_TYPE_HASH, tx.to, tx.nonce.toString(), ethers.utils.keccak256(tx.data)]
    );
    const transactionStructHash = ethers.utils.keccak256(data).replace('0x', '');

    return ethers.utils.keccak256(
      '0x1901' + DOMAIN_STRUCT_HASH + transactionStructHash
    );
  }
};

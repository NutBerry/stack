'use strict';

// TODO
// cleanup and improve all those helper functions

function arrayify (val) {
  const res = [];

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

function toHex (ary) {
  return ary.map(
    function (e) {
      return e.toString(16).padStart(2, '0');
    }
  ).join('');
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

  static encode (nonce, to, calldata) {
    const nonceBytes = arrayify(nonce);
    const calldataBytes = arrayify(calldata);
    let enc = [];

    if (nonceBytes.length > 1 || nonceBytes[0] > 0xde) {
      enc.push(0xff - nonceBytes.length);
      enc = enc.concat(nonceBytes);
    } else {
      enc = nonceBytes;
    }

    enc = enc.concat(arrayify(to));

    if (calldataBytes.length >= 0xff) {
      enc.push(0xff);
      enc.push(calldataBytes.length >> 8);
      enc.push(calldataBytes.length & 0xff);
    } else {
      enc.push(calldataBytes.length);
    }

    return enc.concat(calldataBytes);
  }

  static decode (ary, start) {
    let nonce;
    let offset = start | 0;
    let orig = offset;

    if (ary[offset] < 0xdf) {
      nonce = [ary[offset]];
      offset += 1;
    } else {
      const l = 0xff - ary[offset];
      nonce = ary.slice(offset += 1, offset += l);
    }

    const to = ary.slice(offset, offset += 20);

    let calldata = [];
    if (ary[offset] === 0xff) {
      const l = (ary[offset += 1] << 8) | (ary[offset += 1]);
      calldata = ary.slice(offset += 1, offset += l);
    } else {
      const l = ary[offset];
      calldata = ary.slice(offset += 1, offset += l);
    }

    return { nonce, to, calldata, len: (offset - orig) || 3 };
  }

  static encodeTx (tx) {
    const encoded =
      this.encode(tx.nonce, tx.to, tx.data)
        .concat(arrayify(tx.r))
        .concat(arrayify(tx.s))
        .concat(arrayify(tx.v));

    return toHex(encoded);
  }
};

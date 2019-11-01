'use strict';

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
        console.log(topics[log.topics[0]].decode(log.data));
      }
    );
  }
};

'use strict';

const Inventory = require('./Inventory.js');

module.exports = class BerryInventory extends Inventory {
  constructor (bridgeAddr) {
    super();

    if (bridgeAddr) {
      this._bridgeAddr = bridgeAddr.toLowerCase();
    }
  }

  clone () {
    const ret = super.clone();
    ret._bridgeAddr = this._bridgeAddr;
    return ret;
  }
};

'use strict';

const Inventory = require('./Inventory.js');

module.exports = class BerryInventory extends Inventory {
  constructor () {
    super();
  }

  // Used for adding deposits into our inventory.
  addTokenFromBridge (data, bridgeAddr) {
    const obj = Object.assign({}, data);
    obj.owner = bridgeAddr;
    this.addToken(obj);
    this.addAllowance(obj.address, obj.owner, data.owner, obj.value);
  }
};

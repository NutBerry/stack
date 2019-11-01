#!/usr/bin/env node
'use strict';

const ethers = require('ethers');
const { DEFAULT_CONTRACT_CODE } = require('../js/DefaultContract.js');

(async function () {
  const mnemonic = process.env.MNEMONIC;
  const privKey = process.env.PRIV_KEY;
  const rpcUrl = process.env.RPC_URL;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const gasPrice = process.env.GAS_GWEI;
  const txOverrides = {
  };

  if (gasPrice) {
    txOverrides.gasPrice = ethers.utils.parseUnits(gasPrice, 'gwei');
  }

  let wallet;
  if (privKey) {
    wallet = new ethers.Wallet(privKey, provider);
  } else if (mnemonic) {
    wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
  } else {
    wallet = provider.getSigner();
  }

  let _factory = new ethers.ContractFactory(
    [],
    DEFAULT_CONTRACT_CODE,
    wallet
  );
  let contract = await _factory.deploy(txOverrides);
  console.log('Deploying default contract...');
  let tx = await contract.deployTransaction.wait();
  let defaultContractAddr = contract.address;

  let artifact;

  try {
    artifact = require('./../build/contracts/Bridge.json');
  } catch (e) {
    console.log(e);
    console.log('Did you forgot to run `yarn compile`? 😊');
    process.exit(1);
  }
  let bytecode = artifact.bytecode;

  // stripping metadata from the bytecode
  const meta = 'a265627a7a72305820';
  const tmp = bytecode.indexOf(meta);
  if (tmp !== -1) {
    bytecode = bytecode.substring(0, tmp);
  }

  while (true) {
    let n = bytecode.replace(
      'abcdef0123456789abcdef0123456789abcdef01',
      defaultContractAddr.replace('0x', '').toLowerCase()
    );
    if (bytecode === n) {
      break;
    }
    bytecode = n;
  }
  _factory = new ethers.ContractFactory(
    artifact.abi,
    bytecode,
    wallet
  );
  contract = await _factory.deploy(txOverrides);
  console.log('Deploying Bridge contract...');
  tx = await contract.deployTransaction.wait();

  console.log(`\n
Contract: ${artifact.contractName}
  Address: ${contract.address}
  Transaction Hash: ${tx.transactionHash}
  Deployer: ${tx.from}
  Gas used: ${tx.cumulativeGasUsed.toString()}
  Gas fee in Ether: ${ethers.utils.formatUnits(contract.deployTransaction.gasPrice.mul(tx.cumulativeGasUsed), 'ether')}
  Default contract: ${defaultContractAddr}
  `);
})();

#!/usr/bin/env node
'use strict';

const ethers = require('ethers');

async function deployBridge (wallet, txOverrides, logFile) {
  const GatedComputing = require('./../build/contracts/GatedComputing.json');
  let _factory = new ethers.ContractFactory(
    [],
    GatedComputing.bytecode,
    wallet
  );

  logFile.write('deploying GatedComputing\n');

  let contract = await _factory.deploy(txOverrides);
  let tx = await contract.deployTransaction.wait();
  let gatedComputingAddr = contract.address;
  const artifact = require('./../build/contracts/Bridge.json');
  let bytecode = artifact.bytecode;

  // ebzzr
  const meta = '65627a7a72';
  const tmp = bytecode.indexOf(meta);
  if (tmp !== -1) {
    bytecode = bytecode.substring(0, tmp - 2);
    logFile.write(`stripped bytecode: -${((artifact.bytecode.length - 2) / 2) - ((bytecode.length - 2) / 2)} bytes\n`);
  }

  while (true) {
    let n = bytecode.replace(
      'abcdef0123456789abcdef0123456789abcdef01',
      gatedComputingAddr.replace('0x', '').toLowerCase()
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

  logFile.write('deploying Bridge\n');
  contract = await _factory.deploy(txOverrides);
  tx = await contract.deployTransaction.wait();

  logFile.write(`\n
Contract: ${artifact.contractName}
  Address: ${contract.address}
  Transaction Hash: ${tx.transactionHash}
  Deployer: ${tx.from}
  Gas used: ${tx.cumulativeGasUsed.toString()}
  Gas fee in Ether: ${ethers.utils.formatUnits(contract.deployTransaction.gasPrice.mul(tx.cumulativeGasUsed), 'ether')}
  Gated Computing contract: ${gatedComputingAddr}
  \n`);

  return { contract, tx, artifact, gatedComputingAddr };
}

module.exports = deployBridge;

if (!module.parent) {
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

    const { contract, tx, artifact, gatedComputingAddr } = await deployBridge(wallet, txOverrides, process.stdout);
  })();
}

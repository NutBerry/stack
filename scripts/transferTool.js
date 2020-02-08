#!/usr/bin/env node
'use strict';

const ethers = require('ethers');

const ERC20 = require('./../build/contracts/ERC20.json');
const BRIDGE_ABI = require('./../js/BridgeAbi.js');

async function printBalances (bridge, erc20Root, erc20, wallet) {
  console.log(
    {
      token: erc20Root.address,
      symbol: await erc20Root.symbol(),
      Layer1Balance: (await erc20Root.balanceOf(wallet.address)).toString(),
      Layer2Balance: (await erc20.balanceOf(wallet.address)).toString(),
      availableOnBridge: (await erc20.allowance(bridge.address, wallet.address)).toString(),
      availableOnBridgeForExit: (await bridge.getERC20Exit(erc20.address, wallet.address)).toString(),
    }
  );
}

(async function () {
  const commando = process.argv[2];
  const env = process.env;

  if (!env.PRIV_KEY || !env.ROOT_RPC_URL || !env.RPC || commando !== 'deploy-erc20' && !env.ERC20) {
    console.log(
      `I need the following environment variables:
      PRIV_KEY: 0x... the private key of the account to use
      ROOT_RPC_URL: root rpc url
      RPC: NutBerry rpc url
      ERC20: (Optional) The address of a ERC20 contract.
             You can also deploy one with the command \`deploy-erc20\`
      `
    );
    return;
  }

  const rootProvider = new ethers.providers.JsonRpcProvider(env.ROOT_RPC_URL);
  const provider = new ethers.providers.JsonRpcProvider(env.RPC);
  const wallet = new ethers.Wallet(env.PRIV_KEY, provider);
  console.log({ account: wallet.address });

  const bridgeAddress = await provider.send('web3_clientVersion', []);
  console.log({ bridgeAddress });

  const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, wallet.connect(rootProvider));
  let erc20Root;
  let erc20;

  if (env.ERC20) {
    erc20 = new ethers.Contract(env.ERC20, ERC20.abi, wallet);
    erc20Root = erc20.connect(wallet.connect(rootProvider));
  }

  if (commando === 'deposit') {
    const amount = process.argv[3];
    let tx = await erc20Root.approve(bridge.address, amount);
    console.log(`approve txHash: ${tx.hash}`);
    tx = await tx.wait();

    tx = await bridge.deposit(erc20Root.address, amount);
    console.log(`deposit txHash: ${tx.hash}`);
    tx = await tx.wait();

    console.log(tx);
    return;
  }

  if (commando === 'withdraw') {
    let tx = await bridge.withdraw(erc20Root.address, 0);
    tx = await tx.wait();

    console.log(tx);
    return;
  }

  if (commando === 'transfer') {
    const to = process.argv[3];
    const amount = process.argv[4];
    let tx = await erc20.transfer(to, amount);
    tx = await tx.wait();
    console.log(tx.transactionHash);
    return;
  }

  if (commando === 'transferLoop') {
    const to = process.argv[3];
    const amount = process.argv[4];
    while (1) {
      let tx = await erc20.transfer(to, amount);
      tx = await tx.wait();
      console.log(tx.transactionHash);
    }
    return;
  }

  if (commando === 'exit') {
    const amount = process.argv[3];
    let tx = await erc20.transfer('0x0000000000000000000000000000000000000000', amount);
    tx = await tx.wait();
    return;
  }

  if (commando === 'transferFrom') {
    const from = process.argv[3];
    const to = process.argv[4];
    const amount = process.argv[5];

    let tx = await erc20.transferFrom(from, to, amount);
    tx = await tx.wait();
    console.log(tx);
    return;
  }

  if (commando === 'txcount') {
    console.log(await wallet.getTransactionCount());
    return;
  }

  if (commando === 'balances') {
    await printBalances(bridge, erc20Root, erc20, wallet);
    return;
  }

  if (commando === 'produce') {
    let count = parseInt(process.argv[3]);
    while (count--) {
      await (await erc20Root.transfer(wallet.address, 1)).wait();
    }
    return;
  }

  if (commando === 'deploy-erc20') {
    const _factory = new ethers.ContractFactory(
      ERC20.abi,
      ERC20.bytecode,
      wallet.connect(rootProvider)
    );
    const contract = await _factory.deploy();
    await contract.deployTransaction.wait();

    console.log(contract.address);
    return;
  }

  console.log(
    `available commands:
      deposit: <amount>
      withdraw: exit from bridge
      transfer: <to> <amount>
      transferFrom: <from> <to> <amount>
      balances: print balances
      deploy-erc20: deploys a ERC20 contract
      produce: <count> produce blocks on the root-chain via transfer to self (test geth)
      `
  );
})();

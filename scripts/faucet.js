#!/usr/bin env node
'use strict';

const ethers = require('ethers');

async function deploy () {
  const FAUCET = require('./build/contracts/Faucet.json');
  const provider = ethers.getDefaultProvider('ropsten');
  const wallet = new ethers.Wallet(
    '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200'
  ).connect(provider);

  const contract = new ethers.ContractFactory(FAUCET.abi, FAUCET.bytecode, wallet);
  const faucet = await contract.deploy();
  const tx = await faucet.deployTransaction.wait();
  console.log(wallet.address);
  console.log(faucet.address);
}

(async function () {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8000');
  const wallet = ethers.Wallet.createRandom().connect(provider);
  const faucet = new ethers.Contract(
    // Faucet contract on ropsten
    '0x0ab5ca008a524fa5160ddb0323f8632ec357a0db',
    [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      // get some tokens
      'function drain()',
      // register a token
      'function sink(address)',
    ],
    wallet
  );

  console.log(wallet.address);

  // this gets us one (10 ** 18) token for every registered ERC20 (if the faucet has enough balance)
  const tx = await (await faucet.drain()).wait();
  console.log(tx);
  tx.events.forEach(
    function (event) {
      console.log(event.eventSignature);
      console.log(event.args);
    }
  );

  // this registers a token
  // const tx = await (await faucet.sink('0xD7b0AB25D3A4Fc649A60C22D6c67110eC8e49dE0')).wait();
})();

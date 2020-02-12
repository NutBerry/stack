'use strict';

const http = require('http');
const Socket = require('net').Socket;
const ethers = require('ethers');
const assert = require('assert');

const ERC20_ABI = require('./../build/contracts/ERC20.json').abi;
const ERC721_ABI = require('./../build/contracts/ERC721.json').abi;
const BRIDGE_ABI = require('./../js/BridgeAbi.js');
const BRIDGE = require('./../build/contracts/Bridge.json');

const ERC20 = require('./../build/contracts/ERC20.json');
const ERC721 = require('./../build/contracts/ERC721.json');
const TestContract = require('./../build/contracts/TestContract.json');

const NODE_ADDR = '0xDf08F82De32B8d460adbE8D72043E3a7e25A3B39';
const PRIV_KEY_ALICE = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203';
const PRIV_KEY_BOB = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204';
const PRIV_KEY_CHARLIE = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205';
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

async function assertRevert (tx) {
  let reverted = false;

  try {
    await (await tx).wait();
  } catch (e) {
    reverted = e.code === 'CALL_EXCEPTION';
  }

  assert.ok(reverted, 'Expected revert');
}

async function waitForValueChange (oldValue, getNewValue) {
  while (true) {
    if (oldValue.toString() !== (await getNewValue()).toString()) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// TODO: way more tests ;)
describe('Bridge/RPC', async function () {
  const transactions = [];
  const addressToName = {};
  let bridge;
  let erc20;
  let erc20Root;
  let erc721;
  let erc721Root;
  let rootProvider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);
  let provider;
  let nodes;
  let rootWalletAlice;
  let rootWalletBob;
  let walletAlice;
  let walletBob;
  let walletCharlie;
  let testContract;
  let erc20TransferCount = 0;
  let erc721TransferCount = 0;
  let mintedTokens = 0;
  let rounds = 0;

  function sleep (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForNewBlock () {
    const oldValue = await provider.getBlockNumber();
    while (true) {
      if (oldValue.toString() !== (await provider.getBlockNumber()).toString()) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function tryHaltSecondaryNodes (val) {
    for (let i = 1; i < nodes.length; i++) {
      try {
        await nodes[i].send('debug_haltEvents', [val]);
      } catch (e) {
        // oops. node not available?
        // try again
        console.log(`trying to halt/resume nodes[${i}] failed. Retrying...`);
        await sleep(100);
        i--;
      }
    }
  }

  async function erc20Transfer (...args) {
    let tx = await erc20.transfer(...args);
    transactions.push(tx.hash);
    erc20TransferCount++;

    tx = await tx.wait();
    assert.equal(tx.logs.length, 1, 'logs emitted');

    return tx;
  }

  async function erc20TransferFrom (...args) {
    let tx = await erc20.transferFrom(...args);
    transactions.push(tx.hash);
    erc20TransferCount++;

    tx = await tx.wait();
    assert.equal(tx.logs.length, 1, 'logs emitted');

    return tx;
  }

  async function erc721TransferFrom (...args) {
    let tx = await erc721.transferFrom(...args);
    transactions.push(tx.hash);
    erc721TransferCount++;

    tx = await tx.wait();
    assert.equal(tx.logs.length, 1, 'logs emitted');
    return tx;
  }

  before('Prepare contracts', async () => {
    provider = new ethers.providers.JsonRpcProvider('http://localhost:8000');
    nodes = [provider, new ethers.providers.JsonRpcProvider('http://localhost:8001')];
    rootWalletAlice = new ethers.Wallet(PRIV_KEY_ALICE, rootProvider);
    rootWalletBob = new ethers.Wallet(PRIV_KEY_BOB, rootProvider);
    walletAlice = new ethers.Wallet(PRIV_KEY_ALICE, provider);
    walletBob = new ethers.Wallet(PRIV_KEY_BOB, provider);
    walletCharlie = new ethers.Wallet(PRIV_KEY_CHARLIE, provider);

    addressToName[walletAlice.address] = 'Alice';
    addressToName[walletBob.address] = 'Bob';
    addressToName[walletCharlie.address] = 'Charlie';

    const addr = await provider.send('web3_clientVersion', []);

    bridge = new ethers.Contract(addr, BRIDGE_ABI, rootWalletAlice);
    addressToName[bridge.address] = 'Bridge';

    let _factory = new ethers.ContractFactory(
      ERC20.abi,
      ERC20.bytecode,
      rootWalletAlice,
    );
    erc20Root = await _factory.deploy();
    await erc20Root.deployTransaction.wait();

    erc20 = new ethers.Contract(erc20Root.address, ERC20_ABI, walletAlice);

    _factory = new ethers.ContractFactory(
      ERC721.abi,
      ERC721.bytecode,
      rootWalletAlice,
    );
    erc721Root = await _factory.deploy('FOO', 'FOO');
    await erc721Root.deployTransaction.wait();
    erc721 = new ethers.Contract(erc721Root.address, ERC721_ABI, walletAlice);

    _factory = new ethers.ContractFactory(
      TestContract.abi,
      TestContract.bytecode,
      rootWalletAlice,
    );
    testContract = await _factory.deploy();
    await testContract.deployTransaction.wait();
    testContract = new ethers.Contract(testContract.address, TestContract.abi, walletAlice);

    for (let i = 0; i < 50; i++) {
      let tx = await erc721Root.mint(walletAlice.address, i);
      tx = await tx.wait();
    }
  });

  function doRound () {
    it('Alice: ERC20 deposit', async () => {
      rounds++;

      const value = '0xffff';
      let balance = await erc20.balanceOf(walletAlice.address);

      assert.equal(balance.toString(), '0', 'balance');

      let tx = await erc20Root.approve(bridge.address, 0xfffffffffff);
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'logs emitted');

      tx = await bridge.deposit(erc20Root.address, value);
      tx = await tx.wait();

      await waitForValueChange(balance, () => erc20.balanceOf(walletAlice.address));

      balance = await erc20.balanceOf(walletAlice.address);
      assert.equal(balance.toHexString(), value, 'balance');
    });

    it('Alice: ERC721 deposit', async () => {
      const tokenId = ++mintedTokens;

      let tx = await erc721Root.approve(bridge.address, tokenId);
      tx = await tx.wait();

      tx = await bridge.deposit(erc721Root.address, tokenId);
      tx = await tx.wait();

      await waitForNewBlock();

      const owner = await erc721.ownerOf(tokenId);
      assert.equal(owner, walletAlice.address);
    });

    it('Alice: ERC721 deposit 2', async () => {
      const tokenId = ++mintedTokens;

      let tx = await erc721Root.approve(bridge.address, tokenId);
      tx = await tx.wait();

      tx = await bridge.deposit(erc721Root.address, tokenId);
      tx = await tx.wait();

      await waitForNewBlock();

      const owner = await erc721.ownerOf(tokenId);
      assert.equal(owner, walletAlice.address);
    });

    it('deposits: debug_directReplay', async () => {
      const pendingHeight = (await provider.getBlockNumber()) - 1;
      let finalizedHeight = await bridge.finalizedHeight();

      while (!finalizedHeight.eq(pendingHeight)) {
        try {
          await provider.send('debug_directReplay', [finalizedHeight.add(1).toHexString()]);
        } catch (e) {
          console.log(e);
        }
        finalizedHeight = await bridge.finalizedHeight();
      }
    });

    it('debug_forwardChain', async () => {
      const pendingHeight = (await provider.getBlockNumber()) - 1;
      let finalizedHeight = await bridge.finalizedHeight();

      while (!finalizedHeight.eq(pendingHeight)) {
        try {
          await provider.send('debug_forwardChain', []);
          await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()));
        } catch (e) {
          console.log(e);
        }
        finalizedHeight = await bridge.finalizedHeight();
      }
    });

    it('Alice: ERC721 transfer', async () => {
      const tx = await erc721TransferFrom(walletAlice.address, walletBob.address, mintedTokens - 1);

      const owner = await erc721.ownerOf(mintedTokens - 1);
      assert.equal(owner, walletBob.address);
    });

    it('TestContract.test', async () => {
      let tx = await erc20.approve(testContract.address, '0xff');
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'logs emitted');

      tx = await testContract.test(erc20.address, [], []);
      tx = await tx.wait();
      assert.equal(tx.logs.length, 0, 'logs emitted');
    });

    it('TestContract.testERC20', async () => {
      const balanceBefore = await erc20.balanceOf(walletAlice.address);
      let tx = await erc20.approve(testContract.address, '0xff');
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'logs emitted');

      tx = await testContract.testERC20(erc20.address, walletAlice.address, testContract.address, 0);
      tx = await tx.wait();
      const balanceAfter = await erc20.balanceOf(walletAlice.address);

      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - 1, 'balance of Alice');
      assert.equal(tx.logs.length, 7, 'logs emitted');
    });

    it('TestContract.testERC721', async () => {
      const tokenId = mintedTokens;

      let tx = await erc721.approve(testContract.address, tokenId);
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'approve - logs emitted');

      tx = await testContract.testERC721(erc721.address, walletAlice.address, walletBob.address, tokenId);
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'logs emitted');
    });

    it('TestContract.testRipemd160 - should not throw', async () => {
      let tx = await testContract.testRipemd160();
      tx = await tx.wait();
    });

    it('TestContract.testGAS - should not throw', async () => {
      let tx = await testContract.testGAS();
      tx = await tx.wait();
    });

    it('TestContract.doLoop - should throw', async () => {
      await assertRevert(testContract.doLoop(0xffffffff));
    });

    it('TestContract.partialFail', async () => {
      const balanceBefore = await erc20.balanceOf(walletAlice.address);

      let tx = await erc20.approve(testContract.address, '0xff');
      tx = await tx.wait();
      assert.equal(tx.logs.length, 1, 'logs emitted');

      assertRevert(testContract.partialFail(erc20.address, walletAlice.address, testContract.address));

      const balanceAfter = await erc20.balanceOf(walletAlice.address);

      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber(), 'balance of Alice');
    });

    it('unknown method', async () => {
      let err;

      try {
        await provider.send('foobar', []);
      } catch (e) {
        err = e;
      }

      assert.equal(err, 'Error: The method foobar does not exist/is not available');
    });

    it('net_version', async () => {
      const r = await provider.getNetwork();
      assert.equal(r.chainId, 0);
    });

    it('eth_gasPrice', async () => {
      const r = await provider.getGasPrice();
      assert.equal(r.toString(), '0');
    });

    it('eth_blockNumber', async () => {
      const r = await provider.getBlockNumber();
      assert.ok(r >= 0);
    });

    it('eth_getBlockByNumber', async () => {
      const blockNumber = await provider.getBlockNumber();
      const block = await provider.getBlock(blockNumber);

      assert.ok(blockNumber >= 0);
      assert.equal(block.number, blockNumber);
    });

    it('eth_getBalance', async () => {
      const r = await provider.getBalance(walletAlice.address);
      assert.equal(r.toString(), '0');
    });

    it('Alice: ERC20 balanceOf', async () => {
      const r = await erc20.balanceOf(walletAlice.address);
      assert.ok(r.toNumber() > 0);
    });

    it('Alice: ERC20 allowance', async () => {
      // TODO
      const r = await erc20.allowance(walletAlice.address, walletBob.address);
      assert.equal(r.toString(), '0');
    });

    it('Alice: ERC20 transfer', async () => {
      const balanceBefore = await erc20.balanceOf(walletBob.address);
      let tx = await erc20Transfer(walletBob.address, '0x01');

      assert.equal(tx.from, walletAlice.address);
      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 0x01, 'balance of Bob');
    });

    it('Alice: ERC20 transferFrom', async () => {
      const balanceBefore = await erc20.balanceOf(walletBob.address);
      let tx = await erc20TransferFrom(walletAlice.address, walletBob.address, '0x40');

      assert.equal(tx.from, walletAlice.address);
      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 0x40, 'balance of Bob');

      tx = await erc20.connect(walletBob).transferFrom(walletBob.address, walletAlice.address, '0x01');
      tx = await tx.wait();
    });

    it('Alice: ERC20 transfer to TestContract', async () => {
      const balanceBefore = await erc20.balanceOf(testContract.address);
      let tx = await erc20Transfer(testContract.address, 2);
      assert.equal(tx.from, walletAlice.address);
      const balanceAfter = await erc20.balanceOf(testContract.address);
      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 2, 'balance of TestContract');
    });

    it('TestContract.storage{Load,Store}', async () => {
      const oldValue = await testContract.storageLoad(0);

      let tx = await testContract.storageStore(0, oldValue.add(1));
      tx = await tx.wait();

      const newValue = await testContract.storageLoad(0);
      assert.equal(newValue.toString(), oldValue.add(1).toString());
    });

    it('TestContract.deposit', async () => {
      const oldValue = await testContract.deposits(walletAlice.address);

      let tx = await erc20.approve(testContract.address, 3);
      tx = await tx.wait();

      tx = await testContract.deposit(erc20.address, 3, testContract.address);
      tx = await tx.wait();

      const newValue = await testContract.deposits(walletAlice.address);
      assert.equal(newValue.toString(), oldValue.add(3).toString());
    });

    it('TestContract.withdraw', async () => {
      const balanceBefore = await erc20.balanceOf(walletAlice.address);
      const oldValue = await testContract.deposits(walletAlice.address);

      let tx = await testContract.withdraw(erc20.address, testContract.address);
      tx = await tx.wait();

      const newValue = await testContract.deposits(walletAlice.address);
      const balanceAfter = await erc20.balanceOf(walletAlice.address);

      assert.equal(newValue.toString(), '0');
      assert.equal(balanceAfter.toString(), balanceBefore.add(4).toString());
    });

    it('Alice: ERC20 transfer exit', async () => {
      const balance = await erc20.balanceOf(walletAlice.address);
      const tx = await erc20Transfer(ADDRESS_ZERO, balance);

      const balanceAfter = await erc20.balanceOf(walletAlice.address);
      assert.equal(balanceAfter.toNumber(), 0, 'balance of Alice');
    });

    it('Bob: ERC20 transfer exit', async () => {
      const balance = await erc20.balanceOf(walletBob.address);

      let tx = await erc20.connect(walletBob).transfer(ADDRESS_ZERO, 1);
      tx = await tx.wait();

      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balance.toNumber() - 1, 'balance of Bob');
    });

    it('Bob: ERC721 received via transferFrom -  exit', async () => {
      let tx = await erc721.connect(walletBob).transferFrom(walletBob.address, ADDRESS_ZERO, mintedTokens - 1);
      tx = await tx.wait();
    });

    it('Bob: ERC721 received via smart contract -  exit', async () => {
      let tx = await erc721.connect(walletBob).transferFrom(walletBob.address, ADDRESS_ZERO, mintedTokens);
      tx = await tx.wait();
    });

    it('Alice: can not replay transactions', async () => {
      const balanceBefore = await erc20.balanceOf(walletAlice.address);

      for (let i = 0; i < transactions.length; i++) {
        const tx = await provider.getTransaction(transactions[i]);
        try {
          await provider.send('eth_sendRawTransaction', [tx.raw]);
        } catch (e) {
          assert.equal(e.code, -32000, 'invalid transaction');
        }
      }

      const balanceAfter = await erc20.balanceOf(walletAlice.address);

      assert.equal(balanceAfter.toString(), balanceBefore.toString());
    });
  }

  function doExit () {
    it('Alice: Exit', async () => {
      const value = '0xffbd';
      const balanceBefore = await erc20Root.balanceOf(walletAlice.address);
      const exitBalance = await bridge.getERC20Exit(erc20Root.address, walletAlice.address);

      assert.equal(exitBalance.toHexString(), value, 'exitBalance');

      let tx = await bridge.withdraw(erc20Root.address, value);
      tx = await tx.wait();

      const balanceAfter = await erc20Root.balanceOf(walletAlice.address);

      assert.equal(balanceAfter.toHexString(), balanceBefore.add(value).toHexString(), 'Alice root-chain balance');
    });

    it('Bob: Exit', async () => {
      const exitValueBob = await bridge.getERC20Exit(erc20.address, walletBob.address);
      assert.equal(exitValueBob.toString(), (1 * rounds).toString(), 'Bob\'s exit balance should accumulate');
    });

    it('Bob: Exit ERC721 - received via transferFrom', async () => {
      const tokenId = mintedTokens - 1;

      let owner = await bridge.getERC721Exit(erc721.address, tokenId);
      assert.equal(owner, walletBob.address, 'exit owner');

      let tx = await bridge.connect(rootWalletBob).withdraw(erc721.address, tokenId);
      tx = await tx.wait();

      owner = await erc721Root.ownerOf(tokenId);
      assert.equal(owner, walletBob.address, 'root-chain owner');
    });

    it('Bob: Exit ERC721 - received via smart contract', async () => {
      const tokenId = mintedTokens;

      let owner = await bridge.getERC721Exit(erc721.address, tokenId);
      assert.equal(owner, walletBob.address, 'exit owner');

      // try to exit bob's nft via alice
      await assertRevert(bridge.withdraw(erc721.address, tokenId, { gasLimit: 6000000 }));

      let tx = await bridge.connect(rootWalletBob).withdraw(erc721.address, tokenId);
      tx = await tx.wait();

      owner = await erc721Root.ownerOf(mintedTokens);
      assert.equal(owner, walletBob.address, 'root-chain owner');
    });

    it('Bob: Exit invalid ERC721', async () => {
      const tokenId = mintedTokens + 1000;

      await assertRevert(bridge.connect(rootWalletBob).withdraw(erc721.address, tokenId, { gasLimit: 6000000 }));
    });
  }

  async function produceBlocks (t) {
    for (let i = 0; i < t; i++) {
      const tx = await rootWalletAlice.sendTransaction({ to: rootWalletAlice.address });
      await tx.wait();
    }
  }

  describe('Misc', async () => {
    [
      'VERSION',
      'MAX_BLOCK_SIZE',
      'MAX_SOLUTION_SIZE',
      'BOND_AMOUNT',
      'createdAtBlock',
      'finalizedHeight',
    ].forEach(
      (e) => {
        it(`${e} should not throw`, async () => {
          const calldata = bridge.interface.functions[e].encode([]);
          await (await rootWalletAlice.sendTransaction(
            {
              to: bridge.address,
              data: calldata,
              gasLimit: 0xffff,
            }
          )).wait();
        });
      }
    );

    it('Submitting block from a contract should fail', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: testContract.address,
            data: '0xf2357055' + bridge.address.replace('0x', '').padStart(64, '0') + '25ceb4b2'.padEnd(512, 'f'),
            gasLimit: 6000000,
          }
        )
      );
    });

    it('check function signatures', async () => {
      Object.keys(bridge.interface.functions).forEach(
        (k) => {
          assert.ok(
            bridge.interface.functions[k].sighash.startsWith('0x00') === false,
            'function signature must not have a leading zero byte due to call forwarding in GatedComputing'
          );
        }
      );
    });
  });

  describe('Deposit/Withdraw', async () => {
    it('haltSecondaryNodes', async () => {
      await tryHaltSecondaryNodes(true);
    });

    it('approve', async () => {
      let tx = await erc20Root.approve(bridge.address, 0xfffffffffff);
      tx = await tx.wait();
    });

    it('lock', async () => {
      let tx = await erc20Root.lock(true);
      tx = await tx.wait();
    });

    it('deposit - should throw', async () => {
      await assertRevert(bridge.deposit(erc20Root.address, 1, { gasLimit: 6000000 }));
    });

    it('unlock', async () => {
      let tx = await erc20Root.lock(false);
      tx = await tx.wait();
    });

    it('deposit - should not throw', async () => {
      let tx = await bridge.deposit(erc20Root.address, 1, { gasLimit: 6000000 });
      tx = await tx.wait();
      await waitForNewBlock();
    });

    it('exit transfer', async () => {
      await erc20Transfer(ADDRESS_ZERO, 1);
    });

    it('finalize exit', async () => {
      const exitBalance = await bridge.getERC20Exit(erc20Root.address, erc20Root.signer.address);

      await waitForValueChange(
        exitBalance,
        async function () {
          try {
            await provider.send('debug_forwardChain', []);
          } catch (e) {
            // this can return an error, ignore it
          }
          await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()));

          return await bridge.getERC20Exit(erc20Root.address, erc20Root.signer.address);
        }
      );
    });

    it('exit balance', async () => {
      const exitBalance = await bridge.getERC20Exit(erc20Root.address, erc20Root.signer.address);
      assert.equal(exitBalance.toString(), '1');
    });

    it('lock', async () => {
      let tx = await erc20Root.lock(true);
      tx = await tx.wait();
    });

    it('withdraw - should throw', async () => {
      await assertRevert(bridge.withdraw(erc20Root.address, 0, { gasLimit: 6000000 }));
    });

    it('unlock', async () => {
      let tx = await erc20Root.lock(false);
      tx = await tx.wait();
    });

    it('withdraw - should not throw', async () => {
      let tx = await bridge.withdraw(erc20Root.address, 0, { gasLimit: 6000000 });
      tx = await tx.wait();
    });
  });

  describe('Nodes', function () {
    it('halt event processing', async () => {
      nodes.forEach(
        async (provider) => {
          const val = true;
          const ret = await provider.send('debug_haltEvents', [val]);
          assert.equal(ret, val);
        }
      );
    });
  });

  describe('Invalid Block', async () => {
    const raw = '0123456789abcdef';
    const solution = Buffer.alloc(64).fill(0xff).toString('hex');
    const solutionHash = ethers.utils.keccak256('0x' + solution);
    let blockHash;
    let blockNonce;

    before(async () => {
      blockNonce = (await bridge.finalizedHeight()).add(1).toHexString().replace('0x', '').padStart(64, '0');
      blockHash = ethers.utils.keccak256('0x' + blockNonce + raw);
    });

    // TODO: once new bond support lands
    /*
    it('submitBlock should throw - wrong BOND_AMOUNT', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + raw,
            value: 1,
            gasLimit: 6000000,
          }
        )
      );
    });
    */

    it('submitBlock should throw - special block', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + (new Array(72).fill('cc')).join(''),
            value: await bridge.BOND_AMOUNT(),
            gasLimit: 6000000,
          }
        )
      );
    });

    it('submitBlock should throw - block too large', async () => {
      const blockSize = await bridge.MAX_BLOCK_SIZE();
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + ''.padStart((blockSize * 2) + 2, 'ac'),
            value: await bridge.BOND_AMOUNT(),
            gasLimit: 6000000,
          }
        )
      );
    });

    it('submitBlock should not throw', async () => {
      const tx = await (
        await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + raw,
            value: await bridge.BOND_AMOUNT(),
            gasLimit: 6000000,
          }
        )
      ).wait();
    });

    it('submitSolution - wrong blockNumber', async () => {
      await assertRevert(
        bridge.submitSolution('0x10000000000000000000000000000000000000000000000000000000000000cc', solutionHash,
          { gasLimit: 6000000 }
        )
      );
    });

    it('submitSolution', async () => {
      const tx = await (
        await bridge.submitSolution(blockNonce, solutionHash)
      ).wait();
    });

    it('finalizeSolution throw', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' + blockNonce + solution,
            gasLimit: 6000000,
          }
        )
      );
    });

    it('finalizeSolution should not throw', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);

      const canFinalize = await bridge.canFinalizeBlock(blockNonce);
      assert.ok(canFinalize, 'canFinalizeBlock');

      const tx = await (
        await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' + blockNonce + solution,
            gasLimit: 6000000,
          }
        )
      ).wait();
    });
  });

  describe('Block w/ invalid signature & dup. transactions, solution too big & dispute', async () => {
    const raw =
      'fdffffd68ef2f339154b2dbcc8ed12263481688adc9b7900ec467a1a9615' +
      '46ff24f07129cf95016048b7cebcaaa6c7c31d1e8d06510d9c1748c328de' +
      '28ba314353d9bc1f0c50b7e6233e589204b49b9d53fb966756ae000000' +
      '00f8373282bebae9f128b9b3e16816a76a5865c03900e2e4712e409fe6de' +
      '32d86f84897903011fae40f6d05daa45c955f27c5c40ca362cbbfae42595' +
      '2fc51661ec2beebea4134d1dff1505f7e570aa614579918e10851c' +
      '00f8373282bebae9f128b9b3e16816a76a5865c03900e2e4712e409fe6de' +
      '32d86f84897903011fae40f6d05daa45c955f27c5c40ca362cbbfae42595' +
      '2fc51661ec2beebea4134d1dff1505f7e570aa614579918e10851c';

    let solution;
    let solutionHash;
    let blockHash;
    let blockNonce;

    before(async () => {
      const maxSize = await bridge.MAX_SOLUTION_SIZE();
      solution = Buffer.alloc(maxSize + 1).fill(0xff).toString('hex');
      solutionHash = ethers.utils.keccak256('0x' + solution);

      blockNonce = (await bridge.finalizedHeight()).add(1).toHexString().replace('0x', '').padStart(64, '0');
      blockHash = ethers.utils.keccak256('0x' + blockNonce + raw);
    });

    it('submitBlock should not throw', async () => {
      const tx = await (
        await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + raw,
            value: await bridge.BOND_AMOUNT(),
          }
        )
      ).wait();
    });

    it('submitSolution', async () => {
      const tx = await (
        await bridge.submitSolution(blockNonce, solutionHash)
      ).wait();
    });

    it('finalizeSolution should throw - solution too large', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);

      const canFinalize = await bridge.canFinalizeBlock(blockNonce);
      assert.ok(canFinalize, 'canFinalizeBlock');

      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' + blockNonce + solution,
            gasLimit: 6000000,
          }
        )
      );
    });

    it('dispute', async () => {
      for (let i = 0; i < 3; i++) {
        const tx = await (
          await rootWalletAlice.sendTransaction(
            {
              to: bridge.address,
              data: '0xf240f7c3' + raw,
            }
          )
        ).wait();
      }
    });
  });

  describe('Invalid Block, solution & dispute', async () => {
    const raw = '0123456789abcdef';
    let solution;
    let solutionHash;
    let blockHash;
    let blockNonce;

    before(async () => {
      solution =
        '0000000000000000000000000000000000000000000000000000000000000001' +
        '00000000000000000000000000000000000000000000000000000000000000ff';
      solutionHash = ethers.utils.keccak256('0x' + solution);

      blockNonce = (await bridge.finalizedHeight()).add(1).toHexString().replace('0x', '').padStart(64, '0');
      blockHash = ethers.utils.keccak256('0x' + blockNonce + raw);
    });

    it('submitBlock should not throw', async () => {
      const tx = await (
        await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0x25ceb4b2' + raw,
            value: await bridge.BOND_AMOUNT(),
          }
        )
      ).wait();
    });

    it('submitSolution', async () => {
      const tx = await (
        await bridge.submitSolution(blockNonce, solutionHash)
      ).wait();
    });

    it('finalizeSolution - should throw', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);

      const canFinalize = await bridge.canFinalizeBlock(blockNonce);
      assert.ok(canFinalize, 'canFinalizeBlock');

      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' + blockNonce + solution,
            gasLimit: 6000000,
          }
        )
      );
    });

    it('dispute', async () => {
      const tx = await (
        await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xf240f7c3' + raw,
          }
        )
      ).wait();
    });
  });

  describe('flagSolution', async () => {
    const raw = '0123456789abcdef';
    const solution = '';
    let solutionHash;
    let blockNumber;

    before(async () => {
      solutionHash = ethers.utils.keccak256('0x' + solution);
      blockNumber = (await bridge.finalizedHeight()).add(1);
    });

    it('submitBlock x 512 - should not throw', async () => {
      for (let i = 0; i < 512; i++) {
        const tx = await (
          await rootWalletAlice.sendTransaction(
            {
              to: bridge.address,
              data: '0x25ceb4b2' + raw,
              value: await bridge.BOND_AMOUNT(),
            }
          )
        ).wait();
      }
    });

    it('submitSolution - should throw', async () => {
      const invalidSolHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      await assertRevert(bridge.submitSolution(blockNumber, invalidSolHash, { gasLimit: 6000000 }));
    });

    it('submitSolution x 256', async () => {
      for (let i = 0; i < 256; i++) {
        const tx = await (
          await bridge.submitSolution(blockNumber.add(i), solutionHash)
        ).wait();
      }
    });

    it('submitSolution - should throw', async () => {
      await assertRevert(bridge.submitSolution(blockNumber.add(256), solutionHash, { gasLimit: 6000000 }));
    });

    it('produceBlocks', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);
    });

    it('flagSolution', async () => {
      await (await bridge.flagSolution(blockNumber.add(211))).wait();
    });

    it('finalizeSolution - should throw', async () => {
      let canFinalize = await bridge.canFinalizeBlock(blockNumber.add(211));
      assert.equal(canFinalize, false, 'canFinalizeBlock');

      await assertRevert(rootWalletAlice.sendTransaction(
        {
          to: bridge.address,
          data: '0xd5bb8c4b' +
          blockNumber.add(211).toHexString().replace('0x', '').padStart(64, '0') +
          solution,
          gasLimit: 6000000,
        }
      ));

      canFinalize = await bridge.canFinalizeBlock(blockNumber.add(211));
      assert.equal(canFinalize, false, 'canFinalizeBlock');
    });

    it('canFinalizeBlock', async () => {
      for (let i = 0; i < 1; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, true, 'canFinalizeBlock');
      }

      for (let i = 1; i < 512; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, false, 'canFinalizeBlock');
      }
    });

    it('finalizeSolution', async () => {
      for (let i = 0; i < 211; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.ok(canFinalize, 'canFinalizeBlock');

        await (await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' +
                  blockNumber.add(i).toHexString().replace('0x', '').padStart(64, '0') +
                  solution,
            gasLimit: 6000000,
          }
        )).wait();
      }
    });

    it('finalizeSolution - should throw', async () => {
      await (await rootWalletAlice.sendTransaction(
        {
          to: bridge.address,
          data: bridge.interface.functions.canFinalizeBlock.encode([blockNumber.add(211)]),
          gasLimit: 6000000,
        }
      )).wait();

      for (let i = 211; i < 256; i++) {
        let canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, false, 'canFinalizeBlock');

        await assertRevert(rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' +
                  blockNumber.add(i).toHexString().replace('0x', '').padStart(64, '0') +
                  solution,
            gasLimit: 6000000,
          }
        ));

        canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, false, 'canFinalizeBlock');
      }
    });

    it('canFinalizeBlock', async () => {
      for (let i = 0; i < 512; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, false, 'canFinalizeBlock');
      }
    });

    it('dispute', async () => {
      // once the first one is resolved, everything else can be finalized normaly
      const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(211));
      assert.equal(canFinalize, false, 'canFinalizeBlock');

      await (await rootWalletAlice.sendTransaction(
        {
          to: bridge.address,
          data: '0xf240f7c3' + raw,
          gasLimit: 6000000,
        }
      )).wait();
    });

    it('finalizeSolution', async () => {
      for (let i = 212; i < 256; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.ok(canFinalize, 'canFinalizeBlock');

        await (await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' +
            blockNumber.add(i).toHexString().replace('0x', '').padStart(64, '0') +
            solution,
            gasLimit: 6000000,
          }
        )).wait();
      }
    });

    it('submitSolution x 256', async () => {
      for (let i = 256; i < 512; i++) {
        const tx = await (
          await bridge.submitSolution(blockNumber.add(i), solutionHash)
        ).wait();
      }
    });

    it('produceBlocks', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);
    });

    it('finalizeSolution', async () => {
      for (let i = 256; i < 512; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.ok(canFinalize, 'canFinalizeBlock');

        await (await rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xd5bb8c4b' +
            blockNumber.add(i).toHexString().replace('0x', '').padStart(64, '0') +
            solution,
            gasLimit: 6000000,
          }
        )).wait();
      }
    });

    it('canFinalizeBlock', async () => {
      for (let i = 0; i < 512; i++) {
        const canFinalize = await bridge.canFinalizeBlock(blockNumber.add(i));
        assert.equal(canFinalize, false, 'canFinalizeBlock');
      }
    });
  });

  describe('Nodes', function () {
    it('resume event processing', async () => {
      nodes.forEach(
        async (provider) => {
          const val = false;
          const ret = await provider.send('debug_haltEvents', [val]);
          assert.equal(ret, val);
        }
      );
    });
  });

  describe('Round 1 - submitBlock & directReplay', async () => {
    doRound();

    let blockNonce;

    it('submitBlock', async () => {
      await tryHaltSecondaryNodes(true);

      blockNonce = await provider.send('debug_submitBlock', []);
    });

    it('directReplay', async () => {
      let found = false;
      while (!found) {
        found = await provider.send('debug_directReplay', [blockNonce]);
      }

      await tryHaltSecondaryNodes(false);
    });

    doExit();

    it('Restart nodes[1]', async () => {
      await nodes[1].send('debug_kill',  []);
    });
  });

  describe('Round 2 - submitBlock > submitSolution > finalizeSolution', async () => {
    doRound();

    let blockNonce;

    it('submitBlock', async () => {
      await tryHaltSecondaryNodes(true);

      blockNonce = await provider.send('debug_submitBlock', []);
    });

    it('submitSolution', async () => {
      let found = false;
      while (!found) {
        found = await provider.send('debug_submitSolution', [blockNonce]);
      }
    });

    it('finalizeSolution', async () => {
      const balanceBefore = await rootProvider.getBalance(NODE_ADDR);
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()));
      await provider.send('debug_finalizeSolution', [blockNonce]);
      await produceBlocks(1);

      const balanceAfter = await rootProvider.getBalance(NODE_ADDR);
      const diff = balanceBefore.sub(balanceAfter);
      const bridgeBalance = await rootProvider.getBalance(bridge.address);
      // TODO: this needs to take the gas costs into account once the Bridge supports that
      // console.log(diff.toString(), balanceBefore, balanceAfter);
      // console.log({bridgeBalance});
      // const bondAmount = BigInt(await bridge.BOND_AMOUNT()) / BigInt(2);
      // assert.ok((BigInt(balanceAfter) - BigInt(balanceBefore)) >= bondAmount, 'balance - bond returned');

      await tryHaltSecondaryNodes(false);
    });

    doExit();
  });

  describe('Round 3 - submitBlock > submitSolution > directReplay', async () => {
    doRound();

    it('submitBlock', async () => {
      await tryHaltSecondaryNodes(true);

      const blockNonce = await provider.send('debug_submitBlock', []);

      let found = false;
      while (!found) {
        found = await provider.send('debug_submitSolution', [blockNonce]);
      }

      let canFinalize = await bridge.canFinalizeBlock(blockNonce);
      assert.equal(canFinalize, false);

      await produceBlocks(1);

      // finalize block
      await provider.send('debug_directReplay', [blockNonce]);
      canFinalize = await bridge.canFinalizeBlock(blockNonce);
      assert.equal(canFinalize, false);

      await tryHaltSecondaryNodes(false);
    });

    doExit();
  });

  describe('Round 4 - forwardChain', async () => {
    doRound();

    it('forwardChain', async () => {
      await tryHaltSecondaryNodes(false);

      const exitBalance = await bridge.getERC20Exit(erc20.address, walletBob.address);
      await waitForValueChange(
        exitBalance,
        async function () {
          try {
            await nodes[0].send('debug_forwardChain', []);
            await nodes[1].send('debug_forwardChain', []);
          } catch (e) {
            // this can return an error, ignore it
          }

          return await bridge.getERC20Exit(erc20.address, walletBob.address);
        }
      );
    });

    doExit();
  });

  describe('RPC', () => {
    it('bad request', async () => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port: 8000,
            method: 'POST',
            path: '/',
            headers: {
              'content-length': 1,
            },
          }
        );
        req.on('error', reject);
        req.on('response', function (resp) {
          assert.equal(resp.statusCode, 400, 'should return 400');
          resolve();
        });

        req.end('1');
      });
    });

    it('request too large', async () => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port: 8000,
            method: 'POST',
            path: '/',
            headers: {
              'content-length': (8 << 20) + 1,
            },
          }
        );
        // may also abort first if the connection
        // closed before we had the chance to upload everything
        req.on('error', resolve);
        req.on('response', function (resp) {
          assert.equal(resp.statusCode, 413, 'should return 413');
          resolve();
        });
        req.end(Buffer.alloc((8 << 20) + 1));
      });
    });

    it('request too large - wrong content-length header', async () => {
      return new Promise((resolve, reject) => {
        const sock = new Socket();
        const req = sock.connect(8000, 'localhost');
        req.on('error', function (e) {
          assert.ok(e, 'should abort connection');
          resolve();
        });
        req.on('response', function (resp) {
          reject();
        });
        req.write('POST / HTTP/1.0\r\ncontent-length: 1\r\n\r\n');
        req.end(Buffer.alloc((8 << 20) + 1));
      });
    });

    it('eth_getLogs - ERC20 Transfer', async () => {
      const logCount = await new Promise(async (resolve) => {
        const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        const filter = erc20.filters.Transfer(erc20.signer.address);
        let count = 0;

        setTimeout(() => {
          resolve(count);
        }, 5000);

        erc20.on(filter, async (from, to, value, evt) => {
          assert.equal(evt.topics[0], topic, 'topic must be correct');
          count++;
        });
        erc20.provider.resetEventsBlock(1);
      });

      assert.equal(logCount, erc20TransferCount, 'logCount should match erc20TransferCount');
    });

    it('eth_getLogs - ERC721 Transfer', async () => {
      const logCount = await new Promise(async (resolve) => {
        const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        const filter = erc721.filters.Transfer(erc721.signer.address);
        let count = 0;

        setTimeout(() => {
          resolve(count);
        }, 5000);

        erc721.on(filter, async (from, to, value, evt) => {
          assert.equal(evt.topics[0], topic, 'topic must be correct');
          count++;
        });
        erc721.provider.resetEventsBlock(1);
      });

      assert.equal(logCount, erc721TransferCount, 'logCount should match erc721TransferCount');
    });
  });
});

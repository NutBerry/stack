'use strict';

const http = require('http');
const Socket = require('net').Socket;
const ethers = require('ethers');
const assert = require('assert');

const ERC20_ABI = require('./../build/contracts/ERC20.json').abi;
const ERC721_ABI = require('./../build/contracts/ERC721.json').abi;
const ERC1948_ABI = require('./../build/contracts/ERC1948.json').abi;
const ERC1949_ABI = require('./../build/contracts/ERC1949.json').abi;
const BRIDGE_ABI = require('./../build/contracts/Bridge.json').abi;
const BRIDGE = require('./../build/contracts/Bridge.json');

const ERC20 = require('./../build/contracts/ERC20.json');
const ERC721 = require('./../build/contracts/ERC721.json');
const ERC1948 = require('./../build/contracts/ERC1948.json');
const ERC1949 = require('./../build/contracts/ERC1949.json');
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
  const ERC721_TOKEN_ID = '0x01';
  const transactions = [];
  const addressToName = {};
  let bridge;
  let erc20;
  let erc20Root;
  let erc721;
  let erc721Root;
  let erc1948;
  let erc1948Root;
  let erc1949;
  let erc1949Root;
  let rootProvider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);
  let provider;
  let nodes;
  let rootWalletAlice;
  let walletAlice;
  let walletBob;
  let walletCharlie;
  let testContract;

  async function erc20Transfer (...args) {
    const tx = await erc20.transfer(...args);
    transactions.push(tx.hash);
    return tx;
  }

  async function erc20TransferFrom (...args) {
    const tx = await erc20.transferFrom(...args);
    transactions.push(tx.hash);
    return tx;
  }

  before('Prepare contracts', async () => {
    provider = new ethers.providers.JsonRpcProvider('http://localhost:8000');
    nodes = [provider, new ethers.providers.JsonRpcProvider('http://localhost:8001')];
    rootWalletAlice = new ethers.Wallet(PRIV_KEY_ALICE, rootProvider);
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
    let tx = await erc721Root.mint(walletAlice.address, ERC721_TOKEN_ID);
    await tx.wait();

    _factory = new ethers.ContractFactory(
      ERC1948.abi,
      ERC1948.bytecode,
      rootWalletAlice,
    );
    erc1948Root = await _factory.deploy();
    await erc1948Root.deployTransaction.wait();
    erc1948 = new ethers.Contract(erc1948Root.address, ERC1948_ABI, walletAlice);

    _factory = new ethers.ContractFactory(
      ERC1949.abi,
      ERC1949.bytecode,
      rootWalletAlice,
    );
    erc1949Root = await _factory.deploy('ERC1949 Token', 'ERC1949');
    await erc1949Root.deployTransaction.wait();
    erc1949 = new ethers.Contract(erc1949Root.address, ERC1949_ABI, walletAlice);

    _factory = new ethers.ContractFactory(
      TestContract.abi,
      TestContract.bytecode,
      rootWalletAlice,
    );
    testContract = await _factory.deploy();
    await testContract.deployTransaction.wait();
    testContract = new ethers.Contract(testContract.address, TestContract.abi, walletAlice);
  });

  function doRound () {
    it('Alice: ERC20 deposit', async () => {
      const value = '0xffff';
      let balance = await erc20.balanceOf(walletAlice.address);

      assert.equal(balance.toString(), '0', 'balance');

      let tx = await erc20Root.approve(bridge.address, 0xfffffffffff);
      tx = await tx.wait();
      tx = await bridge.deposit(erc20Root.address, value);
      tx = await tx.wait();

      await waitForValueChange(balance, () => erc20.balanceOf(walletAlice.address));

      balance = await erc20.balanceOf(walletAlice.address);
      assert.equal(balance.toHexString(), value, 'balance');
    });

    it('TestContract.test', async () => {
      let tx = await erc20.approve(testContract.address, '0xff');
      tx = await tx.wait();
      tx = await testContract.test(erc20.address, [], []);
      tx = await tx.wait();
    });

    it('TestContract.testERC20', async () => {
      const balanceBefore = await erc20.balanceOf(walletAlice.address);
      let tx = await erc20.approve(testContract.address, '0xff');
      tx = await tx.wait();
      tx = await testContract.testERC20(erc20.address, walletAlice.address, testContract.address, 0);
      tx = await tx.wait();
      const balanceAfter = await erc20.balanceOf(walletAlice.address);

      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - 1, 'balance of Alice');
      assert.equal(tx.logs.length, 4, 'logs emitted');
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
      tx = await tx.wait();

      assert.equal(tx.from, walletAlice.address);
      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 0x01, 'balance of Bob');
    });

    it('Alice: ERC20 transferFrom', async () => {
      const balanceBefore = await erc20.balanceOf(walletBob.address);
      let tx = await erc20TransferFrom(walletAlice.address, walletBob.address, '0x40');
      tx = await tx.wait();

      assert.equal(tx.from, walletAlice.address);
      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() + 0x40, 'balance of Bob');

      tx = await erc20.connect(walletBob).transferFrom(walletBob.address, walletAlice.address, '0x01');
      tx = await tx.wait();
    });

    it('Alice: ERC20 transfer exit', async () => {
      let balance = await erc20.balanceOf(walletAlice.address);
      let tx = await erc20Transfer(ADDRESS_ZERO, balance);
      tx = await tx.wait();

      const balanceAfter = await erc20.balanceOf(walletAlice.address);
      assert.equal(balanceAfter.toNumber(), 0, 'balance of Alice');
    });

    it('Bob: ERC20 transfer exit', async () => {
      let balance = await erc20.balanceOf(walletBob.address);
      let tx = await erc20.connect(walletBob).transfer(ADDRESS_ZERO, 1);
      tx = await tx.wait();

      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), balance.toNumber() - 1, 'balance of Bob');
    });

    /*
    it('Bob: ERC20 transfer exit loop', async () => {
      let balance = await erc20.balanceOf(walletBob.address);

      const len = balance.toNumber();
      for (let i = 0; i < len; i++) {
        let tx = await erc20.connect(walletBob).transfer(ADDRESS_ZERO, 1);
        tx = await tx.wait();
      }

      const balanceAfter = await erc20.balanceOf(walletBob.address);
      assert.equal(balanceAfter.toNumber(), 0, 'balance of Bob');
    });
    */

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

  async function doExit () {
    const value = '0xffbe';
    const balanceBefore = await erc20Root.balanceOf(walletAlice.address);
    const exitBalance = await bridge.getExitValue(erc20Root.address, walletAlice.address);

    assert.equal(exitBalance.toHexString(), value, 'exitBalance');

    let tx = await bridge.withdraw(erc20Root.address, value);
    tx = await tx.wait();

    const balanceAfter = await erc20Root.balanceOf(walletAlice.address);

    assert.equal(balanceAfter.toHexString(), balanceBefore.add(value).toHexString(), 'Alice root-chain balance');
  }

  async function produceBlocks (t) {
    for (let i = 0; i < t; i++) {
      const tx = await rootWalletAlice.sendTransaction({ to: rootWalletAlice.address });
      await tx.wait();
    }
  }

  function sleep (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  describe('Misc', async () => {
    [
      'VERSION',
      'MAX_BLOCK_SIZE',
      'MAX_SOLUTION_SIZE',
      'createdAtBlock',
      'currentBlock',
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
  });

  describe('Invalid Block', async () => {
    it('halt event processing', async () => {
      nodes.forEach(
        async (provider) => {
          const val = true;
          const ret = await provider.send('debug_haltEvents', [val]);
          assert.equal(ret, val);
        }
      );
    });

    const raw = '0123456789abcdef';
    const solution = Buffer.alloc(64);
    const solutionHash = ethers.utils.keccak256(solution);
    let blockHash;

    before(async () => {
      const blockNonce = (await bridge.currentBlock()).add(1).toHexString().replace('0x', '').padStart(64, '0');
      blockHash = ethers.utils.keccak256('0x' + blockNonce + raw);
    });

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
            data: '0x25ceb4b2' + ''.padStart((blockSize.toNumber() * 2) + 2, 'ac'),
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

    it('submitSolution without bond', async () => {
      await assertRevert(
        bridge.submitSolution(blockHash, solutionHash, { gasLimit: 6000000 })
      );
    });

    it('submitSolution - wrong blockHash', async () => {
      await assertRevert(
        bridge.submitSolution('0x00000000000000000000000000000000000000000000000000000000000000cc', solutionHash,
          { value: await bridge.BOND_AMOUNT(), gasLimit: 6000000 }
        )
      );
    });

    it('submitSolution', async () => {
      const tx = await (
        await bridge.submitSolution(blockHash, solutionHash, { value: await bridge.BOND_AMOUNT() })
      ).wait();
    });

    it('finalizeSolution throw', async () => {
      await assertRevert(
        bridge.finalizeSolution(blockHash, solution, { gasLimit: 6000000 })
      );
    });

    it('finalizeSolution should not throw', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);

      const canFinalize = await bridge.canFinalizeBlock(blockHash);
      assert.ok(canFinalize, 'canFinalizeBlock');

      const tx = await (
        await bridge.finalizeSolution(blockHash, solution)
      ).wait();
    });
  });

  describe('Invalid Block, solution too big & dispute', async () => {
    const raw = '0123456789abcdef';
    let solution;
    let solutionHash;
    let blockHash;

    before(async () => {
      const maxSize = await bridge.MAX_SOLUTION_SIZE();
      solution = Buffer.alloc(maxSize.toNumber() + 1);
      solutionHash = ethers.utils.keccak256(solution);

      const blockNonce = (await bridge.currentBlock()).add(1).toHexString().replace('0x', '').padStart(64, '0');
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

    it('dispute throw - no solution submitted', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xf240f7c3' + raw,
            value: await bridge.BOND_AMOUNT(),
            gasLimit: 6000000,
          }
        )
      );
    });

    it('submitSolution', async () => {
      const tx = await (
        await bridge.submitSolution(blockHash, solutionHash, { value: await bridge.BOND_AMOUNT() })
      ).wait();
    });

    it('finalizeSolution should throw - solution too large', async () => {
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()) + 1);

      const canFinalize = await bridge.canFinalizeBlock(blockHash);
      assert.ok(canFinalize, 'canFinalizeBlock');

      await assertRevert(bridge.finalizeSolution(blockHash, solution, { gasLimit: 6000000 }));
    });

    it('dispute throw - bond', async () => {
      await assertRevert(
        rootWalletAlice.sendTransaction(
          {
            to: bridge.address,
            data: '0xf240f7c3' + raw,
            value: 1,
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
            value: await bridge.BOND_AMOUNT(),
          }
        )
      ).wait();
    });

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

    let blockHash;

    it('submitBlock', async () => {
      blockHash = await provider.send('debug_submitBlock', []);
    });

    it('directReplay', async () => {
      let found = false;
      while (!found) {
        found = await provider.send('debug_directReplay', [blockHash]);
      }
    });

    it('Alice: Exit', async () => {
      await doExit();
    });

    it('Restart nodes[1]', async () => {
      await nodes[1].send('debug_kill',  []);
    });
  });

  describe('Round 2 - submitBlock > submitSolution > finalizeSolution', async () => {
    doRound();

    let blockHash;

    it('submitBlock', async () => {
      blockHash = await provider.send('debug_submitBlock', []);
    });

    it('submitSolution', async () => {
      let found = false;
      while (!found) {
        found = await provider.send('debug_submitSolution', [blockHash]);
      }
    });

    it('finalizeSolution', async () => {
      const balanceBefore = await rootProvider.getBalance(NODE_ADDR);
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()));
      await provider.send('debug_finalizeSolution', [blockHash]);
      await produceBlocks(1);
      const balanceAfter = await rootProvider.getBalance(NODE_ADDR);
      const bondAmount = BigInt(await bridge.BOND_AMOUNT());
      assert.ok((BigInt(balanceAfter) - BigInt(balanceBefore)) >= bondAmount, 'balance - bond returned');
    });

    it('Alice: Exit', async () => {
      await doExit();
    });
  });

  describe('Round 3 - submitBlock > submitSolution > dispute > finalizeSolution', async () => {
    doRound();

    it('submitBlock', async () => {
      const blockHash = await provider.send('debug_submitBlock', []);

      let found = false;
      while (!found) {
        found = await provider.send('debug_submitSolution', [blockHash]);
      }

      const solverWon = await new Promise(
        (resolve) => {
          const listener = bridge.once(bridge.filters.Slashed(),
            (disputeId, solverWon) => {
              resolve(solverWon);
            }
          );
        }
      );

      assert.ok(solverWon, 'solver should win the dispute');

      // finalize block
      await produceBlocks(parseInt(await bridge.INSPECTION_PERIOD()));
      await provider.send('debug_finalizeSolution', [blockHash]);
    });
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
  });
});

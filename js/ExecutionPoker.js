'use strict';

const Utils = require('./Utils.js');
const ProofHelper = require('./../evm/utils/ProofHelper.js');
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = class ExecutionPoker {
  constructor (verifier, disputeId, tree) {

    this.disputeId = disputeId;
    this.verifier = verifier;
    this.gasLimit = 0xfffffffffffff;
    this.logTag = disputeId;

    this.initDispute(disputeId, tree);

    this.verifier.on(
      this.verifier.filters.DisputeNewRound(disputeId),
      (disputeId, timeout, solverPath, challengerPath, tx) => {
        this.log(`dispute(${disputeId}) new round`);
        this.submitRound(disputeId, tree);
      }
    );

    this.verifier.on(
      this.verifier.filters.Slashed(),
      (disputeId, solverWon, tx) => {
        this.log(`dispute(${disputeId}) Slashed solverWon: ${solverWon}`);
      }
    );

    setTimeout(this.checkDisputeTimeout.bind(this), 3000);
  }

  log (...args) {
    console.log(this.logTag, ':', ...args);
  }

  async checkDisputeTimeout () {
    // TODO: make it nicer
    const dispute = await this.verifier.disputes(this.disputeId);

    if (dispute.timeout.eq(0)) {
      this.log('Dispute resolved');
      return;
    }

    const currentBlock = await this.verifier.provider.getBlock();
    const timedOut = dispute.timeout.lt(currentBlock.timestamp);
    this.log({ timedOut });

    if (timedOut) {
      let tx = await this.verifier.claimTimeout(this.disputeId);
      tx = await tx.wait();
    }

    setTimeout(this.checkDisputeTimeout.bind(this), 3000);
  }

  async initDispute (disputeId, merkle) {
    this.log('initDispute', disputeId);

    const dispute = await this.verifier.disputes(disputeId);

    if (dispute.solverPath === merkle.root.hash) {
      this.logTag += ':solver';
      this.isSolver = true;
    } else {
      this.logTag += ':challenger';
      this.isSolver = false;
    }

    const executionDepth = dispute.treeDepth.toNumber();

    this.log('depth', executionDepth, merkle.depth);
    if (executionDepth !== merkle.depth) {
      this.log('tree size mismatch error');
      return;
    }

    const obj = {
      merkle: merkle,
      depth: merkle.depth,
      computationPath: merkle.root,
    };

    this.result = obj;

    this.submitRound(disputeId);
  }

  async submitRound (disputeId) {
    const obj = this.result;

    if (obj.computationPath.isLeaf) {
      this.log('reached leaves');
      this.log('submitting for l=' +
        obj.computationPath.left.hash + ' r=' + obj.computationPath.right.hash);

      await this.submitProof(disputeId, obj);
      return;
    }

    const dispute = await this.verifier.disputes(disputeId);
    const targetPath = this.isSolver ? dispute.solverPath : dispute.challengerPath;
    const path = this.isSolver ? dispute.solver : dispute.challenger;
    const nextPath = obj.merkle.getNode(targetPath);

    if (!nextPath) {
      this.log('Next node not found. Submission already made by another party?');
      obj.computationPath = obj.merkle.getPair(path.left, path.right);
      return;
    }

    if (obj.computationPath.left.hash === targetPath) {
      this.log('goes left from ' +
        obj.computationPath.hash.substring(2, 6) + ' to ' +
        obj.computationPath.left.hash.substring(2, 6)
      );
    } else if (obj.computationPath.right.hash === targetPath) {
      this.log('goes right from ' +
        obj.computationPath.hash.substring(2, 6) + ' to ' +
        obj.computationPath.right.hash.substring(2, 6)
      );
    }

    let witnessPath;

    if (dispute.witness !== ZERO_HASH) {
      const path = obj.merkle.getNode(dispute.witness);

      witnessPath = { left: path.left.hash, right: path.right.hash };
    } else {
      witnessPath = { left: ZERO_HASH, right: ZERO_HASH };
    }

    this.log(
      'responding', nextPath.left.hash, nextPath.right.hash, 'for', targetPath
    );

    try {
      let tx = await this.verifier.respond(
        disputeId,
        nextPath.left.hash,
        nextPath.right.hash,
        witnessPath.left,
        witnessPath.right,
        { gasLimit: this.gasLimit }
      );

      tx = await tx.wait();

      this.log('respond() gas used', tx.gasUsed.toString());
      obj.computationPath = nextPath;
    } catch (e) {
      console.log(e.code);
      setTimeout(() => {
        this.submitRound(disputeId);
      }, 1000);
    }
  }

  async submitProof (disputeId, disputeObj) {
    const args = ProofHelper.constructProof(disputeObj.computationPath, disputeObj);

    //this.log('submitting proof - proofs', args.proofs);
    //this.log('submitting proof - executionState', args.executionInput);
    this.log('submitting proof - index', disputeObj.computationPath.left.index);

    let tx;
    try {
      // TODO
      function concat (array) {
        let res = [];
        for (let i = 0; i < array.length; i++) {
          const val = array[i];
          if (typeof val === 'string') {
            for (let x = val.startsWith('0x') ? 2: 0; x < val.length; x += 2) {
              res.push(parseInt(val.substring(x, x + 2), 16));
            }
            continue;
          }
          res = res.concat(Array.from(val));
        }

        return res;
      }

      const callData = concat([
        // functionSig
        'c201be23',
        disputeId,
        // TODO: maybe remove those?
        args.proofs.dataHash,
        args.proofs.stackHash,
        args.proofs.memHash,
        args.executionInput.stackSize.toString(16).padStart(64, '0'),
        args.executionInput.memSize.toString(16).padStart(64, '0'),
        args.executionInput.pc.toString(16).padStart(64, '0'),
        args.executionInput.data.length.toString(16).padStart(64, '0'),
        args.executionInput.data,
        args.executionInput.stack.length.toString(16).padStart(64, '0'),
        ...args.executionInput.stack,
        (args.executionInput.mem.length / 32).toString(16).padStart(64, '0'),
        args.executionInput.mem,
        args.executionInput.returnData.length.toString(16).padStart(64, '0'),
        args.executionInput.returnData,
      ]);
      this.log(`callData size: ${callData.length} bytes`);

      tx = await this.verifier.signer.sendTransaction(
        { to: this.verifier.address, gasLimit: this.gasLimit, data: callData }
      );
      tx = await tx.wait();

      this.log('submitting proof - gas used', tx.gasUsed.toString());
      Utils.dumpLogs(tx.logs, this.verifier.interface);
    } catch (e) {
      if (!e.code) {
        console.log(e);
      }

      console.log(e.code);
      // retry if error is not a call exception
      if (e.code !== 'CALL_EXCEPTION') {
        setTimeout(
          () => {
            this.submitProof(disputeId, disputeObj);
          },
          1000
        );
      }
    }

    return tx;
  }
};

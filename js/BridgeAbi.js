'use strict';

module.exports = [
  {
    'constant': true,
    'inputs': [],
    'name': 'createdAtBlock',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'blockHash',
        'type': 'bytes32',
      },
      {
        'name': 'solutionHash',
        'type': 'bytes32',
      },
      {
        'name': 'pathRoot',
        'type': 'bytes32',
      },
      {
        'name': 'executionDepth',
        'type': 'uint256',
      },
      {
        'name': 'resultProof',
        'type': 'bytes32[]',
      },
    ],
    'name': 'submitSolution',
    'outputs': [],
    'payable': true,
    'stateMutability': 'payable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '',
        'type': 'bytes32',
      },
    ],
    'name': 'disputes',
    'outputs': [
      {
        'name': 'initialStateHash',
        'type': 'bytes32',
      },
      {
        'name': 'solverPath',
        'type': 'bytes32',
      },
      {
        'name': 'challengerPath',
        'type': 'bytes32',
      },
      {
        'name': 'treeDepth',
        'type': 'uint256',
      },
      {
        'name': 'witness',
        'type': 'bytes32',
      },
      {
        'name': 'solverLeft',
        'type': 'bytes32',
      },
      {
        'name': 'solverRight',
        'type': 'bytes32',
      },
      {
        'name': 'challengerLeft',
        'type': 'bytes32',
      },
      {
        'name': 'challengerRight',
        'type': 'bytes32',
      },
      {
        'name': 'state',
        'type': 'uint8',
      },
      {
        'name': 'timeout',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'target',
        'type': 'address',
      },
    ],
    'name': 'getNonce',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'target',
        'type': 'address',
      },
      {
        'name': 'owner',
        'type': 'address',
      },
    ],
    'name': 'getExit',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '',
        'type': 'bytes32',
      },
    ],
    'name': 'timeOfSubmission',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'blockHash',
        'type': 'bytes32',
      },
      {
        'name': 'solutionHash',
        'type': 'bytes32',
      },
      {
        'name': 'pathRoot',
        'type': 'bytes32',
      },
    ],
    'name': 'dispute',
    'outputs': [],
    'payable': true,
    'stateMutability': 'payable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'version',
    'outputs': [
      {
        'name': '',
        'type': 'uint16',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [],
    'name': 'offroadReplay',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'disputeId',
        'type': 'bytes32',
      },
      {
        'name': 'computationPathLeft',
        'type': 'bytes32',
      },
      {
        'name': 'computationPathRight',
        'type': 'bytes32',
      },
      {
        'name': 'witnessPathLeft',
        'type': 'bytes32',
      },
      {
        'name': 'witnessPathRight',
        'type': 'bytes32',
      },
    ],
    'name': 'respond',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [],
    'name': 'submitBlock',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'MAX_BLOCK_SIZE',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'MAX_SOLUTION_SIZE',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'target',
        'type': 'address',
      },
      {
        'name': 'owner',
        'type': 'address',
      },
    ],
    'name': 'getExitValue',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'target',
        'type': 'address',
      },
      {
        'name': 'owner',
        'type': 'address',
      },
      {
        'name': 'spender',
        'type': 'address',
      },
    ],
    'name': 'getAllowanceValue',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '_pathRoot',
        'type': 'bytes32',
      },
      {
        'name': '_resultProof',
        'type': 'bytes32[]',
      },
      {
        'name': '_returnDataHash',
        'type': 'bytes32',
      },
    ],
    'name': 'verifyResultProof',
    'outputs': [
      {
        'name': '',
        'type': 'bool',
      },
    ],
    'payable': false,
    'stateMutability': 'pure',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'timeoutDuration',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'disputeId',
        'type': 'bytes32',
      },
    ],
    'name': 'claimTimeout',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [],
    'name': 'replay',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'BOND_AMOUNT',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [],
    'name': 'submitProof',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'blockHash',
        'type': 'bytes32',
      },
      {
        'name': '',
        'type': 'bytes',
      },
    ],
    'name': 'finalizeSolution',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'solutionHash',
        'type': 'bytes32',
      },
    ],
    'name': 'canFinalizeSolution',
    'outputs': [
      {
        'name': '',
        'type': 'bool',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'currentBlock',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': 'target',
        'type': 'address',
      },
      {
        'name': 'owner',
        'type': 'address',
      },
      {
        'name': 'spender',
        'type': 'address',
      },
    ],
    'name': 'getAllowance',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'INSPECTION_PERIOD',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'token',
        'type': 'address',
      },
      {
        'name': 'tokenId',
        'type': 'uint256',
      },
    ],
    'name': 'withdraw',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'token',
        'type': 'address',
      },
      {
        'name': 'amountOrId',
        'type': 'uint256',
      },
      {
        'name': 'depositProof',
        'type': 'bytes20[]',
      },
    ],
    'name': 'deposit',
    'outputs': [],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': false,
        'name': 'token',
        'type': 'address',
      },
      {
        'indexed': false,
        'name': 'owner',
        'type': 'address',
      },
      {
        'indexed': false,
        'name': 'value',
        'type': 'uint256',
      },
    ],
    'name': 'Deposit',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [],
    'name': 'BlockBeacon',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': false,
        'name': 'blockHash',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'solutionHash',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'pathRoot',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'depth',
        'type': 'uint256',
      },
    ],
    'name': 'Solution',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': false,
        'name': 'blockHash',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'solverPath',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'challengerPath',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'disputeId',
        'type': 'bytes32',
      },
    ],
    'name': 'NewDispute',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': false,
        'name': 'id',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'solverWon',
        'type': 'bool',
      },
    ],
    'name': 'Slashed',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': true,
        'name': 'disputeId',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'timeout',
        'type': 'uint256',
      },
      {
        'indexed': false,
        'name': 'solverPath',
        'type': 'bytes32',
      },
      {
        'indexed': false,
        'name': 'challengerPath',
        'type': 'bytes32',
      },
    ],
    'name': 'DisputeNewRound',
    'type': 'event',
  },
];

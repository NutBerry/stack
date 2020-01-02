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
    ],
    'name': 'submitSolution',
    'outputs': [],
    'payable': true,
    'stateMutability': 'payable',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': 'blockHash',
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
    'name': 'VERSION',
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
        'name': 'blockHash',
        'type': 'bytes32',
      },
    ],
    'name': 'canFinalizeBlock',
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
    ],
    'name': 'NewDispute',
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
        'name': 'solverWon',
        'type': 'bool',
      },
    ],
    'name': 'Slashed',
    'type': 'event',
  },
];

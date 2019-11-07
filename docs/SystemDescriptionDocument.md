# Notes
This document represents an overview about the current specification and is work in progress.

## A list of (perhaps) planned changes
- Support for `chainId` to guard against possible cross-chain transaction replay attacks.
  (Not perfect and other malicious chains can just use a already used chainId)
- Introduce additonal limits for block submissions.
  Require a bond on block submission?
- Switch to using state-roots.
- Use gated computing instead of the Verification Game to resolve a dispute.
  https://ethresear.ch/t/on-chain-gated-computing-by-patching-the-control-flow-of-arbitrary-smart-contracts/6387
- Allow multiple blocks to be finalized at a time.
  This requires knowledge of state dependencies...

# Bridge
## Terminology
### Parameters
```
uint16 public constant version = 1;
uint256 public constant MAX_BLOCK_SIZE = 8096;
uint256 public constant MAX_SOLUTION_SIZE = 8096;
uint256 public constant BOND_AMOUNT = 1000000000000000000;
// In Blocks
uint256 public constant INSPECTION_PERIOD = 60;
```

### Transaction
Transaction encoding is the same as on Ethereum (RLP encoded) with the following rules for the fields:

- `gasPrice` must be always zero
- `gasLimit` must be always zero
- `value` must be always zero
- `to` must be always 20 bytes

Additionally, `chainId` is currently fixed to zero.

Transactions inside a Block must be in the unsigned form and must have 7 fields, in this order:

- <length of transaction>
- `nonce`
- `gasPrice`
- `gasLimit`
- `to`
- `value`
- `data`

After the RLP encoded unsigned transaction comes the 65 bytes signature:

- `v` fixed to 1 byte - TODO: this can be larger if we support `chainId`
- `r` 32 bytes
- `s` 32 bytes

### Block
A Block consists of a arbitrary number of transactions and must not exceed
`MAX_BLOCK_SIZE`.

`0x64ef39ca` is prepended to every Block and the block hash is `keccak256(block)`.

## Deposit

`function deposit (address token, uint256 amountOrId, bytes20[] memory depositProof) public`

Deposit ERC20 `token` with `amountOrId` into the Bridge.

`depositProof` is a `bytes20`-array of all accounts that currently `drain` from the Bridge in the current Block that needs finalization.

Example:

If `Alice` has a `transferFrom(bridge, alice, value)` in the currently not finalized Block,
then `Alice` are not allowed to deposit until that block is finalized.
The reason is that `Alice` can submit a Block that drains a arbitrary amount from the Bridge without having anything deposited.
But `Alice` submits a `Solution` that does exactly that - this is of course invalid and needs to be challenged.
If (inside a challenge) the dispute in the Verification Game arrives at the point of execution that validates
the deposited balance of `Alice` and `Alice` deposits the correct amount into the Bridge before that step is
called at the time the Verification Game is running, then `Alice` wrongly wins the challenge.

To avoid that, the Bridge creates a `depositWitness` for each submitted block and requires the `depositProof` on every deposit.

A deposit increases the `allowance` for the depositor by `amount` from the Bridge address.
That means if a user wants to use any balance for a token, it first needs to be drained from the Bridge with
`transferFrom(bridgeAdress, to/depositor, amount)`. After that, the user `owns` it and can do normal `transfer()` or retrieve `balanceOf()`.

## Withdraw

`function withdraw (address token, uint256 tokenId) public`

Withdraw `token` and `amountOrId` from bridge.
`tokenId` is a placeholder until NutBerry supports ERC721-like tokens.

A user has to do a `token.transfer(bridge, amountOrId)` to take it out of the layer-2 system
and thus makes it available to the Bridge so that the user can `withdraw` the available amount back to the root-chain.

## Block submission
Rules:

- Anyone can submit a block.
- Only one block can be finalized at a time and in the correct order.

There is currently no time limit between Block submissions or any cap on the number of pending blocks.

## Solutions
```
function submitSolution (
  bytes32 blockHash,
  bytes32 solutionHash,
  bytes32 pathRoot,
  uint256 executionDepth,
  bytes32[] memory resultProof
) public payable
```

- `blockHash` must the currently pending block.
- `solutionHash` is the `keccak256()` hash of `bytes32 key`-`bytes32 value` set of storage values.
- `pathRoot` is the root hash of the execution tree.
- `executionDepth` is the depth of the execution tree.
- `resultProof` is used to verify that `solutionHash` is indeed the `returnData` of the last execution step in the execution tree.

Submitting a solution requires `BOND_AMOUNT` and must not be larger than `MAX_SOLUTION_SIZE`.

## Disputes

`function dispute (bytes32 blockHash, bytes32 solutionHash, bytes32 pathRoot) public payable`

Any solution can be challenged if `block.number <= timeOfSubmission + INSPECTION_PERIOD` and requires `BOND_AMOUNT`.


The details of the Verification Game will not be described here as it will be replaced in the future but can be revisited
[here](https://github.com/leapdao/solEVM-enforcer/blob/master/docs/SystemDescriptionDocument.md).

## Block finalization
`function finalizeSolution (bytes32 blockHash, bytes calldata) external`

- `blockHash` must be the hash of the currently pending Block.
- `bytes calldata` is the `key`-`value` that must match to a given `solutionHash`.

A solution can only finalized if `block.number > timeOfSubmission + INSPECTION_PERIOD` is true for the solution
and `openDisputeCount[solutionHash]` is zero (has no open challenges).

If the solution can be finalized then:

- All open disputes getting cancelled and the bonds returned.
- The submitter of the solution gets all remaining bonds from any open solutions. (If any)

The Bridge applies all the storage `key`-`value`'s and moves to the next pending Block.

## Direct replay
Additonally, any block can be finalized directly for the currently pending block.
If so, the behaviour is the same as in `finalizeSolution` except all open solutions and challenges
are cancelled and the bonds are returned to the their owners.


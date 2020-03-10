# Notes

This document represents an overview about the current specification and is work in progress.

# Consensus

* Anyone can submit, challenge and finalize a Block.
* Submitting a Block requires a bond. The bond is used to repay finalization / challenge gas costs.
* There can be any number of Block submissions inside a Layer-1 (root-)Block.
* Blocks are sequenced and are being processed in order.
* Solutions for submitted blocks can be submitted in advance. This is limited for up to 256 blocks.
* Solutions can be disputed, disputed blocks needs to verified on Layer-1 once all blocks before the disputed block are finalized.
* TODO: Blocks can have a `deadline` parameter, the block is skipped if it is not finalized before the `deadline`.
* TODO: Require a smaller bond on `challenge` that gets burned or returned depending if the solution was indeed wrong or not.

# Bridge parameters

Take a look at the definitions [here](contracts/_Bridge.sol).

# Internal Transaction encoding

* `Signature.v` is either `0x1b` or `0x1c` for RLP transactions.
* For EIP-712 transactions, `0x65` is added to `Signature.v`.
  * Thus, `signature.v` is either `0x80` or `0x81`.

```
if (signature.v === 0x80 || signature.v === 0x81) {
  // EIP-712
}

if (signature.v === 0x1b || signature.v === 0x1c) {
  // RLP
}
```

```
<signature.v - 1 byte>
<signature.r - 32 bytes>
<signature.s - 32 bytes>
<nonce - variable>
<to - 20 bytes>
<data - variable>

const nonceBytes = arrayify(tx.nonce);
const calldataBytes = arrayify(tx.data);
let enc = arrayify(tx.v)
  .concat(arrayify(tx.r))
  .concat(arrayify(tx.s));

  if (nonceBytes.length > 1 || nonceBytes[0] > 0xde) {
    enc.push(0xff - nonceBytes.length);
    enc = enc.concat(nonceBytes);
  } else {
    enc = enc.concat(nonceBytes);
  }

  enc = enc.concat(arrayify(tx.to));

  if (calldataBytes.length >= 0xff) {
    enc.push(0xff);
    enc.push(calldataBytes.length >> 8);
    enc.push(calldataBytes.length & 0xff);
  } else {
    enc.push(calldataBytes.length);
  }

return enc.concat(calldataBytes);
```

## RLP

Transaction encoding is the same as on Ethereum (RLP encoded) with the following rules for the fields:

- `gasPrice` must be always zero
- `gasLimit` must be always zero
- `value` must be always zero
- `to` must be always 20 bytes

Additionally, `chainId` is currently fixed to zero.

## EIP-712 Signature scheme

```
const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    Transaction: [
      { name: 'to', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
  },
  primaryType: 'Transaction',
  domain: {
    name: 'NutBerry',
    version: '2',
  },
  message: {
    to: '0x0000000000000000000000000000000000000000',
    nonce: 1,
    data: '0xff',
  },
};
```

`0x65` is added to `signature.v` and the transaction's encoding is the [Internal Transaction Encoding](#internal-transaction-encoding).

# Block

A Block consists of a arbitrary number of internal encoded transactions and must not exceed `MAX_BLOCK_SIZE`.
The block nonce is the `uint256` block number for that block, thus block hash is `keccak256(nonce + block)`.

# Deposit

`function deposit(address token, uint256 amountOrId)`

Deposit ERC-20/ERC-721 `token` with `amountOrId` into the Bridge.
This creates a new `Deposit-Block`.

# Withdraw

`function withdraw(address token, uint256 tokenId)`

Withdraw `token` and `tokenId` from the Bridge.
`tokenId` is zero for ERC-20 tokens.

A user has to do a `token.transfer(to(0), amount)` for ERC-20 and `token.transferFrom(from, to(0), tokenId)` for ERC-721 tokens - on Layer-2 - to take it out for exit.
This makes it available to the Bridge so that the user can `withdraw` the accumulated amount or `tokenId` back to the root-chain.

# Block submission

Rules:

* Anyone can submit a block.
* Must not exceed `MAX_BLOCK_SIZE`.
* Blocks are ordered in sequence; in the order they arrive.
* Only one block can be finalized at a time and in the correct order.

There is currently no time limit between Block submissions or any cap on the number of pending blocks.

# Solutions

* A solution must not be larger than `MAX_SOLUTION_SIZE`.
* Up to 256 solutions can be submitted and being marked as invalid in advance.

# Disputes

Any block can be directly finalized even if the correspond solution are not marked invalid.
However, block solutions marked as invalid needs to be finalized on-chain.

# Block finalization

A block solution can only be finalized if:

* `block.number > timeOfSubmission + INSPECTION_PERIOD` is true for the solution,
* the solution is not marked as invalid,
* if there are no open disputes,
* the previous block is finalized.

If the solution can be finalized, then the Bridge applies all the storage `key`-`value`'s and moves to the next pending Block.

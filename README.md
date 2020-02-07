[![codecov](https://codecov.io/gh/NutBerry/stack/branch/master/graph/badge.svg)](https://codecov.io/gh/NutBerry/stack)
[![Continuous Integration](https://github.com/NutBerry/stack/workflows/Continuous%20Integration/badge.svg?branch=master)](https://github.com/NutBerry/stack/actions?query=workflow%3A%22Continuous+Integration%22+branch%3Amaster)
[![Join Chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/NutBerry/community)

# NutBerry - Offroading Ethereum Transactions
`A NutBerry a day keeps the sunshine your way.`

![Meme](https://nutberry.github.io/assets/minion.jpg)

The goal of the NutBerry project is a permissionless optimistic rollup layer-2 solution with support for stateful smart contracts.
NutBerry intentionally has the same transaction encoding and signing scheme as Ethereum transactions to be one-to-one compatible with the existing ecosystem.

* No special/additional tooling for developers necessary.
* No special interfaces in smart contracts.

Interacting with ERC20/ERC721 tokens works exactly as on the ethereum root-chain.

In a nutshell, NutBerry improves the latency of trustless interactions(smart contracts) and improves transaction throughput.

The most anticipated feature is the possibility for on-chain EVM verification, that makes it possible to
run smart contracts on a permissionless / trustless layer 2 solution.
Though, the runtime has some restrictions like not be able to call other contracts.
That is; a state-minimized EVM or LEVM - Lean Ethereum Virtual Machine.

Data availability is fully achieved on the root-chain and the contract is able verify and replay
all transactions either through directly finalizing a Block of transactions on-chain or via non-interactive fraud proofs to enforce correctness on-chain for any given block.

# Rough Roadmap

*Non-exhaustive list. NutBerry is WIP*

- [x] Support the ERC20 token standard.
- [x] Support arbitrary stateless smart contracts.
- [x] Support the ERC721 standard.
- [ ] Stateful smart contracts, aka smart contracts with support for storage.
- [ ] State-roots / merkelized state.
- [ ] Additional signing schemes (ERC712) and BLS aggregates.
- [ ] NutBerry-node: P2P Connectivity/Exchange via JSON RPC - Simple HTTP (pub-key, node-id) exchange with switch to https.
- [ ] Recursive Gated Computing.


# How to get started

To install the dependencies:
```
yarn
```
This project uses `geth` to run the integration tests.
Make sure that you have at least `geth v1.8.21 ` available in your environment.
You can run the tests with `yarn test`.

## Deployment
### Bridge

`scripts/deploy.js` - is a little deployment helper script.

You can run it like this:
```
GAS_GWEI=3 RPC_URL=http://localhost:8222 PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200 ./scripts/deploy.js
```
This script also supports passing `MNEMONIC` instead of a private key.
In addition, you can leave both `PRIV_KEY` and `MNEMONIC` if `RPC_URL` allows signing.

### Client

The `nutberry-node` (`js/bin.js`) supports the following environment variables:

* Option: BRIDGE_ADDRESS
  Type: String
  Required: true
  The contract address of the Bridge on the root-chain.
* Option: PRIV_KEY
  Type: String
  Default:
  The private key for a root-chain account. That account should have some ether to be useful. Required to participate in the network.
* Option: PORT
  Type: Number
  Required: true
  The port to listen on for the JSON-RPC interface.
* Option: HOST
  Type: String
  Default: localhost
  The address to listen on for the JSON-RPC interface.
* Option: ROOT_RPC_URL
  Type: String
  Required: true
  The URL for the root-chain JSON-RPC provider.
* Option: EVENT_CHECK_MS
  Type: Number
  Default: 15000
  Time in milliseconds to check for Bridge event updates.
* Option: DEBUG_MODE
  Type: Number
  Default: 0
  Debug mode, for development purposes.
* Option: BAD_NODE_MODE
  Type: Number
  Default: 0
  For development purposes, simulates a rogue node.

# Documentation

The [System Description Document](https://github.com/NutBerry/stack/blob/master/docs/SystemDescriptionDocument.md).

Additionaly, taking a look at `contracts/Bridge.sol` and `tests/Bridge.js` will give you an idea how things fit together.

# Communication

Join the [Gitter chat](https://gitter.im/NutBerry/community) to ask questions, harvest NutBerries and to hang out.

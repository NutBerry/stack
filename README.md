[![codecov](https://codecov.io/gh/NutBerry/stack/branch/master/graph/badge.svg)](https://codecov.io/gh/NutBerry/stack)
[![Continuous Integration](https://github.com/NutBerry/stack/actions?query=workflow%3A%22Continuous+Integration%22)](https://github.com/NutBerry/stack/workflows/Continuous%20Integration/badge.svg)
[![Join Chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/NutBerry/community)

# NutBerry - Offroading Ethereum Transactions
`A NutBerry a day keeps the sunshine your way.`

![Meme](https://nutberry.github.io/assets/minion.jpg)

The goal of this project is a permissionless layer-2 solution with support for stateful smart contracts.
The design is similiar to what we generally call rollups but it intentionally has the same transaction encoding
and signing scheme as Ethereum transactions to be one-to-one compatible with the existing ecosystem.

The most anticipated feature is the possibility for on-chain EVM verification, that makes it possible to
run smart contracts on a permissionless / trustless layer 2 solution.
Though, the runtime has some restrictions like not be able to call other contracts.
That is; a state-minimized EVM or LEVM - Lean Ethereum Virtual Machine.

Data availibilty is fully archieved on the root-chain and the contract is able verify and replay
all transactions either through directly finalizing a Block of transactions on-chain or via
an interactive computation verification game to offload the computation and to enforce correctness on-chain for any given block.

# Rough Roadmap

1st Milestone
Support the ERC20 token standard.

2nd Milestone
Support the ERC721 standard.

3rd Milestone
Support arbitray stateless smart contracts.

4th Milestone
Stateful smart contracts, aka smart contracts with support for storage.

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

The NutBerry client-node `js/bin.js` needs the following environment variables:

* `BRIDGE_ADDRESS` - 0x... The contract address of the Bridge on the root-chain.
* `PRIV_KEY` - 0x... The private key for a root-chain account. That account should have some ether to be useful.
* `PORT` - The port to listen on for the RPC interface.
* `ROOT_RPC_URL` - The URL of the root-chain rpc provider.

Optional:
* `HOST` - The address to listen on for the RPC interface. Defaults to `localhost`.
* `DEBUG_MODE` - Used for testing, if `=1` enables additional RPC methods and other things meant for development.
* `BAD_NODE_MODE` - Used for testing, if `=1` it will compute wrong solutions to trigger the verification game.

# Documentation

The [System Description Document](https://github.com/NutBerry/stack/blob/master/docs/SystemDescriptionDocument.md).

Additionaly, taking a look at `contracts/Bridge.sol` and `tests/Bridge.js` will give you an idea how things fit together.

# Communication

Join the [Gitter chat](https://gitter.im/NutBerry/community) to ask questions, harvest NutBerries and to hang out.

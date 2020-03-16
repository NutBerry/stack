# Public testnet(s)

## Notes

[Minimal UI for deposit & withdraw](https://nutberry.github.io/testnet/).

Make sure to change / or add...
* ...an Infura API key in the examples below.
* ...your own PRIV_KEY.

## v0.3.1

v0.3.1 includes client improvements and switches to docker hub for images.
For example:

```
docker run \
  -e BRIDGE_ADDRESS=0x50B7b4A0bFCB91123248f464d501fC12cE24886C \
  -e ROOT_RPC_URL=https://ropsten.infura.io/v3/API_KEY \
  -e PORT=8000 \
  -e HOST=localhost \
  -e PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201 \
  -p 8000:8000 \
  nutberry/stack:v0.3.1
```

## v0.3.0

### Using Docker

```
docker run \
  -e BRIDGE_ADDRESS=0x50B7b4A0bFCB91123248f464d501fC12cE24886C \
  -e ROOT_RPC_URL=https://ropsten.infura.io/v3/API_KEY \
  -e PORT=8000 \
  -e HOST=localhost \
  -e PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201 \
  -p 8000:8000 \
  docker.pkg.github.com/nutberry/stack/node:v0.3.0
```

### Without Docker

Inside the NutBerry project root:

```
export BRIDGE_ADDRESS=0x50B7b4A0bFCB91123248f464d501fC12cE24886C
export ROOT_RPC_URL=https://ropsten.infura.io/v3/API_KEY
export PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201
export RPC=http://localhost:8000
export PORT=8000
./nutberry-node.js
```

### Faucet

Take a look at [faucet.js](../scripts/faucet.js). You can instantly get some tokens on Layer-2!

## v0.2.2

```
export BRIDGE_ADDRESS=0xcE7D44F4FBde85239e51d8d1C77E2476189a5652
```

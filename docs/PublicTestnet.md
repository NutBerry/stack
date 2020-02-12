# Public testnet(s)

## v0.2.2

[Minimal UI for deposit & withdraw](https://nutberry.github.io/testnet/).

Make sure to change / or add...
* ...an Infura API key in the examples below.
* ...your own PRIV_KEY.

### Using Docker

```
docker run \
  -e BRIDGE_ADDRESS=0xcE7D44F4FBde85239e51d8d1C77E2476189a5652 \
  -e ROOT_RPC_URL=https://ropsten.infura.io/v3/API_KEY \
  -e PORT=8000 \
  -e HOST=localhost \
  -e PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201 \
  -p 8000:8000 \
  docker.pkg.github.com/nutberry/stack/node:v0.2.2
```

### Without Docker

Inside the NutBerry project root:

```
export BRIDGE_ADDRESS=0xcE7D44F4FBde85239e51d8d1C77E2476189a5652
export ROOT_RPC_URL=https://ropsten.infura.io/v3/API_KEY
export PRIV_KEY=0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201
export RPC=http://localhost:8000
export PORT=8000
./nutberry-node.js
```

module.exports = {
  testCommand: 'RPC_PORT=8333 yarn mocha --exit --bail --timeout 900000 test/',
  artifactsPath: 'build/contracts',
  proxyPort: 8333,
  rpcUrl: 'http://localhost:8222',
};

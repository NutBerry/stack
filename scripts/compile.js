#!/usr/bin/env node

'use strict';

const fs = require('fs');
const { basename } = require('path');
const solc = require('solc');

const contractsDir = 'contracts';
const files = fs.readdirSync(contractsDir);
const sources = {};
let outputDir = '';

['build/', 'contracts'].forEach(
  function (dir) {
    outputDir += dir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
  }
);

const sha256 = require('crypto').createHash('sha256');

while (files.length) {
  const file = files.pop();
  const path = `${contractsDir}/${file}`;
  const stat = fs.statSync(path);

  if (stat.isFile() && (file.endsWith('.sol') || file.endsWith('.slb') || file.endsWith('.yul'))) {
    const source = fs.readFileSync(path).toString();

    sources[path] = { content: source };
    sha256.update(source);
    process.stdout.write(`> Compiling ${path}\n`);
  }

  if (stat.isDirectory()) {
    fs.readdirSync(path).forEach(
      function (p) {
        files.push(`${file}/${p}`);
      }
    );
  }
}

const hashFile = 'build/.hash';
const hashBuf = sha256.digest();
try {
  const buf = fs.readFileSync(hashFile);

  if (buf.equals(hashBuf)) {
    process.stdout.write('No changes. Not compiling\n');
    process.exit(0);
  }
} catch (e) {
}
fs.writeFileSync(hashFile, hashBuf);

const compilerInput = {
  language: 'Solidity',
  sources: sources,
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 2,
      /*
      details: {
        peephole: true,
        jumpdestRemover: true,
        orderLiterals: false,
        deduplicate: false,
        cse: true,
        constantOptimizer: false,
        yul: true,
        yulDetails: {
          stackAllocation: true,
        },
      },
      */
    },
    outputSelection: {
      '*': {
        '': [
          'ast',
        ],
        '*': [
          'abi',
          'metadata',
          'evm.bytecode.object',
          'evm.bytecode.sourceMap',
          'evm.deployedBytecode.object',
          'evm.deployedBytecode.sourceMap',
          'userdoc',
          'devdoc',
        ],
      },
    },
  },
};

function fileCallback (path) {
  const source = fs.readFileSync(path).toString();

  sources[path] = { content: source };

  return { contents: source };
}

const output = JSON.parse(solc.compile(JSON.stringify(compilerInput), fileCallback));

if (output.errors) {
  output.errors.forEach((obj) => process.stderr.write(obj.formattedMessage));
}

if (!output.contracts) {
  fs.unlinkSync(hashFile);
  process.exit(1);
}

for (const file in output.contracts) {
  const contract = output.contracts[file];
  const sourceObj = output.sources[file];
  const source = sources[file].content;

  for (const contractName in contract) {
    const obj = contract[contractName];

    obj.id = sourceObj.id;
    obj.ast = sourceObj.ast;
    obj.legacyAST = sourceObj.legacyAST;
    obj.source = source;

    const evm = obj.evm;
    delete obj.evm;

    obj.contractName = contractName;
    obj.bytecode = `0x${evm.bytecode.object}`;
    obj.sourceMap = evm.bytecode.sourceMap;
    obj.deployedBytecode = `0x${evm.deployedBytecode.object}`;
    obj.deployedSourceMap = evm.deployedBytecode.sourceMap;

    const artifactPath = `${outputDir}/${contractName}.json`;

    fs.writeFileSync(artifactPath, JSON.stringify(obj, null, 2));
    process.stdout.write(`> Artifact for ${contractName} written to ${artifactPath}\n`);
  }
}

process.stdout.write(`> Compiled successfully using solc ${solc.version()}\n`);

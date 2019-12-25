#!/usr/bin/env node
'use strict';

const fs = require('fs');

const RED = '31';
const GREEN = '32';
const ORANGE = '33';

const report = JSON.parse(fs.readFileSync('./coverage-report.json')).coverage;

function log (str, color) {
  process.stdout.write(`\x1B[1;${color}m${str}\x1B[0m\n`);
}

log('Color legend:', ORANGE);
log('GREEN - line hit', GREEN);
log('RED - line miss', RED);
log('ORANGE - line ignored (nor hit or miss)', ORANGE);
log('---', RED);

for (const path in report) {
  const source = fs.readFileSync(path).toString().split('\n');
  for (let i = 0; i < source.length; i++) {
    const lineNum = i + 1;
    const coverage = report[path];
    const lineHits = coverage[lineNum];
    const ignore = coverage[lineNum] === undefined;

    let color = lineHits ? GREEN : RED;
    if (ignore) {
      color = ORANGE;
    }

    const line = source[i];
    log(`${path}:${lineNum}:${line}`, color);
  }
}

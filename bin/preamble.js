#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err.stack ?? String(err));
    process.exit(1);
  }
);

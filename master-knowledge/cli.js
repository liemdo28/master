#!/usr/bin/env node
'use strict';

const { route } = require('./query-router');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Usage: node cli.js "<question>"\n\n' +
    'Examples:\n' +
    '  node cli.js "How many projects?"\n' +
    '  node cli.js "Largest project?"\n' +
    '  node cli.js "Projects using Playwright?"\n' +
    '  node cli.js "Projects with Docker?"\n' +
    '  node cli.js "Projects modified this week?"\n' +
    '  node cli.js "Show payroll dependencies"'
  );
  process.exit(1);
}

const question = args.join(' ');

try {
  const result = route(question);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  const errorResult = {
    question,
    answer: 'ERROR',
    evidence: { message: err.message },
    source: 'MASTER_INDEX.json',
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(errorResult, null, 2));
  process.exit(1);
}

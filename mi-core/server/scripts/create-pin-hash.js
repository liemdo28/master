#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const readline = require('readline');

function hashPin(pin) {
  if (!pin) return '';
  return crypto.createHash('sha256').update(pin + 'mi-salt-2024').digest('hex');
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || !output.isTTY) {
      reject(new Error('This helper requires an interactive terminal.'));
      return;
    }

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    let value = '';
    output.write(prompt);

    function cleanup() {
      input.setRawMode(false);
      input.removeListener('keypress', onKeypress);
      output.write('\n');
    }

    function onKeypress(str, key) {
      if (key?.name === 'return' || key?.name === 'enter') {
        cleanup();
        resolve(value);
        return;
      }
      if (key?.name === 'escape' || (key?.ctrl && key?.name === 'c')) {
        cleanup();
        reject(new Error('PIN entry cancelled.'));
        return;
      }
      if (key?.name === 'backspace') {
        value = value.slice(0, -1);
        return;
      }
      if (str && !key?.ctrl && !key?.meta) value += str;
    }

    input.on('keypress', onKeypress);
  });
}

async function main() {
  const pin = await readHidden('Enter new Mi PIN: ');
  if (pin.length < 6) {
    console.error('PIN must be at least 6 characters.');
    process.exit(1);
  }
  const confirm = await readHidden('Confirm new Mi PIN: ');
  if (pin !== confirm) {
    console.error('PIN entries did not match.');
    process.exit(1);
  }
  console.log(`MI_PIN_HASH=${hashPin(pin)}`);
}

main().catch(err => {
  console.error(err.message || String(err));
  process.exit(1);
});

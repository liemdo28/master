const fs = require('fs'); const path = require('path'); const lines = []; function L(s) { lines.push(s); } function write(f) { fs.writeFileSync(f, lines.join('\n')); lines.length = 0; }
L('#!/usr/bin/env node');
L('const fs = require(\\'fs\\');');
console.log('test');
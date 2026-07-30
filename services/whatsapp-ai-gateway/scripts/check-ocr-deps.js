const { checkOcrDeps } = require('../src/template-ocr/dependency-check');

const result = checkOcrDeps();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

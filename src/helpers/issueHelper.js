const fs = require('fs');
// function critical() { eval('console.log("bad")'); } // DISABLED: Use of eval() can lead to code execution vulnerabilities.
function medium() { fs.readFileSync('file.txt'); }
function low() { let a = 1; }
module.exports = { critical, medium, low };
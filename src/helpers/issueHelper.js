const fs = require('fs');
function critical() { eval('console.log("bad")'); }
function medium() { fs.readFileSync('file.txt'); }
function low() { let a = 1; }
module.exports = { critical, medium, low }; 
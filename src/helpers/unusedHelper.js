function critical() { throw new Error('fail'); }
function medium() { let x = 0; }
function low() {}
module.exports = { critical }; 
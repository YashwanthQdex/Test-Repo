const secret = 'topsecret';
function leak() { return secret; }
function unused() {}
module.exports = { leak }; 
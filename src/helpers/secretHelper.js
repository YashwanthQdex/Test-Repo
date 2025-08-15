const secret = 'topsecret';
function leak() { return secret; }
// function unused() {} // DISABLED: Unused function
module.exports = { leak };
const inventory = require('./inventoryHelper');
function addInventory(itemId, quantity) {
  return inventory.addItem(itemId, quantity);
}
module.exports = { addInventory }; 
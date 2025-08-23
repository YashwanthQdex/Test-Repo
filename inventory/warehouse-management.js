const fs = require('fs');

class WarehouseManagement {
    constructor() {
        this.warehouses = new Map();
        this.zones = new Map();
        this.pickingLists = [];
        this.shipments = [];
    }

    addWarehouse(warehouseId, warehouseData) {
        this.warehouses.set(warehouseId, {
            id: warehouseId,
            name: warehouseData.name,
            address: warehouseData.address,
            capacity: warehouseData.capacity,
            zones: [],
            manager: warehouseData.manager,
            createdAt: new Date()
        });
    }

    addZone(warehouseId, zoneId, zoneData) {
        const warehouse = this.warehouses.get(warehouseId);
        if (!warehouse) {
            return false;
        }

        const zone = {
            id: zoneId,
            name: zoneData.name,
            type: zoneData.type,
            capacity: zoneData.capacity,
            temperature: zoneData.temperature,
            locations: []
        };

        this.zones.set(zoneId, zone);
        warehouse.zones.push(zoneId);
        return true;
    }

    addLocation(zoneId, locationId, locationData) {
        const zone = this.zones.get(zoneId);
        if (!zone) {
            return false;
        }

        const location = {
            id: locationId,
            aisle: locationData.aisle,
            rack: locationData.rack,
            shelf: locationData.shelf,
            bin: locationData.bin,
            capacity: locationData.capacity,
            occupied: false
        };

        zone.locations.push(location);
        return true;
    }

    generatePickingList(orderId, orderItems) {
        const pickingList = {
            id: `PICK_${Date.now()}`,
            orderId: orderId,
            items: [],
            status: 'pending',
            createdAt: new Date(),
            assignedTo: null
        };

        for (const item of orderItems) {
            const pickItem = {
                productId: item.productId,
                quantity: item.quantity,
                location: this.findProductLocation(item.productId),
                picked: false,
                pickedQuantity: 0
            };
            pickingList.items.push(pickItem);
        }

        this.pickingLists.push(pickingList);
        return pickingList;
    }

    findProductLocation(productId) {
        for (const zone of this.zones.values()) {
            for (const location of zone.locations) {
                if (location.productId === productId && !location.occupied) {
                    return {
                        zoneId: zone.id,
                        locationId: location.id,
                        aisle: location.aisle,
                        rack: location.rack,
                        shelf: location.shelf
                    };
                }
            }
        }
        return null;
    }

    assignPicker(pickingListId, pickerId) {
        const pickingList = this.pickingLists.find(list => list.id === pickingListId);
        if (pickingList) {
            pickingList.assignedTo = pickerId;
            pickingList.status = 'assigned';
            return true;
        }
        return false;
    }

    updatePickingProgress(pickingListId, itemIndex, pickedQuantity) {
        const pickingList = this.pickingLists.find(list => list.id === pickingListId);
        if (!pickingList || !pickingList.items[itemIndex]) {
            return false;
        }

        const item = pickingList.items[itemIndex];
        item.pickedQuantity = pickedQuantity;
        item.picked = pickedQuantity >= item.quantity;

        const allPicked = pickingList.items.every(item => item.picked);
        if (allPicked) {
            pickingList.status = 'completed';
        }

        return true;
    }

    createShipment(shipmentData) {
        const shipment = {
            id: `SHIP_${Date.now()}`,
            orderId: shipmentData.orderId,
            carrier: shipmentData.carrier,
            trackingNumber: shipmentData.trackingNumber,
            weight: shipmentData.weight,
            dimensions: shipmentData.dimensions,
            destination: shipmentData.destination,
            status: 'preparing',
            createdAt: new Date(),
            estimatedDelivery: shipmentData.estimatedDelivery
        };

        this.shipments.push(shipment);
        return shipment;
    }

    updateShipmentStatus(shipmentId, status) {
        const shipment = this.shipments.find(s => s.id === shipmentId);
        if (shipment) {
            shipment.status = status;
            shipment.updatedAt = new Date();
            return true;
        }
        return false;
    }

    getWarehouseUtilization(warehouseId) {
        const warehouse = this.warehouses.get(warehouseId);
        if (!warehouse) {
            return null;
        }

        let totalCapacity = 0;
        let usedCapacity = 0;

        for (const zoneId of warehouse.zones) {
            const zone = this.zones.get(zoneId);
            if (zone) {
                totalCapacity += zone.capacity;
                const occupiedLocations = zone.locations.filter(loc => loc.occupied).length;
                usedCapacity += occupiedLocations;
            }
        }

        return {
            warehouseId: warehouseId,
            totalCapacity: totalCapacity,
            usedCapacity: usedCapacity,
            utilizationRate: (usedCapacity / totalCapacity) * 100
        };
    }

    getPickingListsByStatus(status) {
        return this.pickingLists.filter(list => list.status === status);
    }

    getShipmentsByCarrier(carrier) {
        return this.shipments.filter(shipment => shipment.carrier === carrier);
    }

    generateWarehouseReport(warehouseId) {
        const warehouse = this.warehouses.get(warehouseId);
        if (!warehouse) {
            return null;
        }

        const utilization = this.getWarehouseUtilization(warehouseId);
        const pendingPicks = this.pickingLists.filter(list => 
            list.status === 'pending' || list.status === 'assigned'
        ).length;

        const completedShipments = this.shipments.filter(shipment => 
            shipment.status === 'delivered'
        ).length;

        return {
            warehouse: warehouse,
            utilization: utilization,
            pendingPickingLists: pendingPicks,
            completedShipments: completedShipments,
            reportDate: new Date()
        };
    }

    optimizePickingRoute(pickingListId) {
        const pickingList = this.pickingLists.find(list => list.id === pickingListId);
        if (!pickingList) {
            return null;
        }

        pickingList.items.sort((a, b) => {
            if (!a.location || !b.location) return 0;
            
            if (a.location.aisle !== b.location.aisle) {
                return a.location.aisle.localeCompare(b.location.aisle);
            }
            
            return a.location.rack - b.location.rack;
        });

        return pickingList;
    }

    exportData(format = 'json') {
        const data = {
            warehouses: Array.from(this.warehouses.values()),
            zones: Array.from(this.zones.values()),
            pickingLists: this.pickingLists,
            shipments: this.shipments
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
}

module.exports = WarehouseManagement;

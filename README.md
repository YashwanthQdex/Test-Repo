# Inventory Service (Go)

This is a small, self-contained Go HTTP service that models core ecommerce inventory flows with a business-first perspective.

## Business Context

Inventory is the real-time promise of what a storefront can sell. This service focuses on three critical lifecycle stages:

- Reservation: hold stock during checkout to prevent overselling.
- Fulfillment: convert a reservation into an outbound shipment and decrement on-hand units.
- Replenishment: adjust stock up/down (receiving, cycle counts, shrinkage).

The service surfaces a low-stock alert signal so merchandisers and planners can react before stockouts. Alerts are computed from available units: `available = onHand - reserved` and compared to a configurable threshold.

## Endpoints

- `GET /health` — liveness probe.
- `GET /products` — list products and inventory records.
- `GET /products/{sku}` — inventory record by SKU.
- `POST /stock/adjust` — body: `{ sku, delta }` to receive or correct stock.
- `POST /stock/reserve` — body: `{ sku, quantity }` to hold units for checkout.
- `POST /stock/release` — body: `{ reservationId }` to release a hold.
- `POST /stock/fulfill` — body: `{ reservationId }` to ship units and decrement on-hand.
- `GET /alerts` — current low-stock alerts based on available vs. threshold.

## Configuration

Environment variables (with defaults):

- `PORT` (default: `8080`)
- `LOW_STOCK_THRESHOLD` (default: `5`)
- `RESERVATION_TTL_MINUTES` (default: `30`)

Reservations expire logically (checked at operation time). Expired reservations cannot be released or fulfilled and are reported with status `EXPIRED`.

## Run

```bash
go run .
```

Then hit for example:

```bash
curl http://localhost:8080/products
curl -X POST http://localhost:8080/stock/reserve -H 'Content-Type: application/json' -d '{"sku":"SKU-PS5-DISC","quantity":2}'
curl http://localhost:8080/alerts
```

## Data Model

- Product: `{ sku, name }`
- InventoryRecord: `{ sku, onHand, reserved }`
- Reservation: `{ id, sku, quantity, expiresAt, status }`

## Business Rules

- Cannot reserve more than `available = onHand - reserved`.
- Cannot adjust stock to negative or below current `reserved`.
- Fulfillment decrements both `reserved` and `onHand` atomically.
- Reservations beyond `expiresAt` are invalid for operations.
- Low-stock alert when `available <= LOW_STOCK_THRESHOLD`.



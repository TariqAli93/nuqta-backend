# Nuqta Backend — RBAC Permission Matrix

> **Generated**: 2026-03-03  
> **Roles**: `admin`, `manager`, `cashier`, `viewer`

---

## Role Hierarchy

| Role      | Description                                             | Inherits From |
| --------- | ------------------------------------------------------- | ------------- |
| `admin`   | Full system access. User management, backups, settings. | —             |
| `manager` | All business operations. No system admin.               | —             |
| `cashier` | POS, sales, inventory reads.                            | —             |
| `viewer`  | Read-only access to reports and data.                   | —             |

---

## Permission Keys

```
Format: <domain>:<action>
Examples: sales:create, products:read, users:manage
```

---

## Endpoint × Role Matrix

### Auth

| Endpoint                     | Permission      | admin | manager | cashier | viewer | Notes                                 |
| ---------------------------- | --------------- | :---: | :-----: | :-----: | :----: | ------------------------------------- |
| `POST /auth/login`           | _public_        |  ✅   |   ✅    |   ✅    |   ✅   | No auth required                      |
| `GET /auth/setup-status`     | _public_        |  ✅   |   ✅    |   ✅    |   ✅   | No auth required                      |
| `POST /auth/register`        | _public_        |  ✅   |   ✅    |   ✅    |   ✅   | Only works when no users exist        |
| `GET /auth/me`               | _authenticated_ |  ✅   |   ✅    |   ✅    |   ✅   | Any authenticated user                |
| `POST /auth/change-password` | _authenticated_ |  ✅   |   ✅    |   ✅    |   ✅   | Own password only                     |
| `POST /auth/refresh`         | _public_        |  ✅   |   ✅    |   ✅    |   ✅   | No auth required (uses refresh token) |
| `POST /auth/logout`          | _authenticated_ |  ✅   |   ✅    |   ✅    |   ✅   | Any authenticated user                |

### Products

| Endpoint                                    | Permission         | admin | manager | cashier | viewer |
| ------------------------------------------- | ------------------ | :---: | :-----: | :-----: | :----: |
| `GET /products`                             | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /products/:id`                         | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /products`                            | `products:create`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `PUT /products/:id`                         | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /products/:id`                      | `products:delete`  |  ✅   |   ❌    |   ❌    |   ❌   |
| `GET /products/:id/purchase-history`        | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /products/:id/sales-history`           | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /products/:id/units`                   | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /products/:id/units`                  | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `PUT /products/units/:id`                   | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /products/units/:id`                | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /products/:id/units/:uid/set-default` | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `GET /products/:id/batches`                 | `products:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /products/:id/batches`                | `products:update`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /products/:id/adjust-stock`           | `inventory:adjust` |  ✅   |   ✅    |   ❌    |   ❌   |

### Sales

| Endpoint                   | Permission      | admin | manager | cashier | viewer |
| -------------------------- | --------------- | :---: | :-----: | :-----: | :----: |
| `GET /sales`               | `sales:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /sales/:id`           | `sales:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /sales`              | `sales:create`  |  ✅   |   ✅    |   ✅    |   ❌   |
| `POST /sales/:id/payments` | `sales:payment` |  ✅   |   ✅    |   ✅    |   ❌   |
| `POST /sales/:id/cancel`   | `sales:cancel`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /sales/:id/refund`   | `sales:refund`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `GET /sales/:id/receipt`   | `sales:read`    |  ✅   |   ✅    |   ✅    |   ✅   |

### POS

| Endpoint              | Permission     | admin | manager | cashier | viewer |
| --------------------- | -------------- | :---: | :-----: | :-----: | :----: |
| `POST /pos/after-pay` | `sales:create` |  ✅   |   ✅    |   ✅    |   ❌   |

### Categories

| Endpoint                 | Permission          | admin | manager | cashier | viewer |
| ------------------------ | ------------------- | :---: | :-----: | :-----: | :----: |
| `GET /categories`        | `categories:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /categories`       | `categories:create` |  ✅   |   ✅    |   ❌    |   ❌   |
| `PUT /categories/:id`    | `categories:update` |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /categories/:id` | `categories:delete` |  ✅   |   ❌    |   ❌    |   ❌   |

### Customers

| Endpoint                | Permission         | admin | manager | cashier | viewer |
| ----------------------- | ------------------ | :---: | :-----: | :-----: | :----: |
| `GET /customers`        | `customers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /customers/:id`    | `customers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /customers`       | `customers:create` |  ✅   |   ✅    |   ✅    |   ❌   |
| `PUT /customers/:id`    | `customers:update` |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /customers/:id` | `customers:delete` |  ✅   |   ❌    |   ❌    |   ❌   |

### Customer Ledger

| Endpoint                                | Permission         | admin | manager | cashier | viewer |
| --------------------------------------- | ------------------ | :---: | :-----: | :-----: | :----: |
| `GET /customer-ledger/:customerId`      | `customers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /customer-ledger/:id/payments`    | `ledger:payment`   |  ✅   |   ✅    |   ✅    |   ❌   |
| `POST /customer-ledger/:id/adjustments` | `ledger:adjust`    |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /customer-ledger/reconcile`       | `ledger:reconcile` |  ✅   |   ❌    |   ❌    |   ❌   |

### Suppliers

| Endpoint                | Permission         | admin | manager | cashier | viewer |
| ----------------------- | ------------------ | :---: | :-----: | :-----: | :----: |
| `GET /suppliers`        | `suppliers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /suppliers/:id`    | `suppliers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /suppliers`       | `suppliers:create` |  ✅   |   ✅    |   ❌    |   ❌   |
| `PUT /suppliers/:id`    | `suppliers:update` |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /suppliers/:id` | `suppliers:delete` |  ✅   |   ❌    |   ❌    |   ❌   |

### Supplier Ledger

| Endpoint                             | Permission         | admin | manager | cashier | viewer |
| ------------------------------------ | ------------------ | :---: | :-----: | :-----: | :----: |
| `GET /supplier-ledger/:supplierId`   | `suppliers:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /supplier-ledger/:id/payments` | `ledger:payment`   |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /supplier-ledger/reconcile`    | `ledger:reconcile` |  ✅   |   ❌    |   ❌    |   ❌   |

### Purchases

| Endpoint                       | Permission          | admin | manager | cashier | viewer |
| ------------------------------ | ------------------- | :---: | :-----: | :-----: | :----: |
| `GET /purchases`               | `purchases:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /purchases/:id`           | `purchases:read`    |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /purchases`              | `purchases:create`  |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /purchases/:id/payments` | `purchases:payment` |  ✅   |   ✅    |   ❌    |   ❌   |

### Inventory

| Endpoint                       | Permission            | admin | manager | cashier | viewer |
| ------------------------------ | --------------------- | :---: | :-----: | :-----: | :----: |
| `GET /inventory/dashboard`     | `inventory:read`      |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /inventory/movements`     | `inventory:read`      |  ✅   |   ✅    |   ✅    |   ✅   |
| `GET /inventory/expiry-alerts` | `inventory:read`      |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /inventory/reconcile`    | `inventory:reconcile` |  ✅   |   ✅    |   ❌    |   ❌   |

### Accounting

| Endpoint                              | Permission          | admin | manager | cashier | viewer |
| ------------------------------------- | ------------------- | :---: | :-----: | :-----: | :----: |
| `GET /accounting/accounts`            | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/journal-entries`     | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/journal-entries/:id` | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/trial-balance`       | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/profit-loss`         | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/balance-sheet`       | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `GET /accounting/status`              | `accounting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `POST /accounting/initialize`         | `accounting:manage` |  ✅   |   ❌    |   ❌    |   ❌   |

### Posting

| Endpoint                            | Permission       | admin | manager | cashier | viewer |
| ----------------------------------- | ---------------- | :---: | :-----: | :-----: | :----: |
| `POST /posting/entries/:id/post`    | `posting:manage` |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /posting/entries/:id/unpost`  | `posting:manage` |  ✅   |   ✅    |   ❌    |   ❌   |
| `POST /posting/period`              | `posting:manage` |  ✅   |   ✅    |   ❌    |   ❌   |
| `GET /posting/batches`              | `posting:read`   |  ✅   |   ✅    |   ❌    |   ✅   |
| `POST /posting/batches/:id/reverse` | `posting:manage` |  ✅   |   ❌    |   ❌    |   ❌   |
| `POST /posting/batches/:id/lock`    | `posting:manage` |  ✅   |   ❌    |   ❌    |   ❌   |
| `POST /posting/batches/:id/unlock`  | `posting:manage` |  ✅   |   ❌    |   ❌    |   ❌   |

### Audit

| Endpoint           | Permission   | admin | manager | cashier | viewer |
| ------------------ | ------------ | :---: | :-----: | :-----: | :----: |
| `GET /audit/trail` | `audit:read` |  ✅   |   ❌    |   ❌    |   ❌   |

### Backup

| Endpoint                      | Permission       | admin | manager | cashier | viewer |
| ----------------------------- | ---------------- | :---: | :-----: | :-----: | :----: |
| `POST /backup`                | `backup:create`  |  ✅   |   ❌    |   ❌    |   ❌   |
| `GET /backup`                 | `backup:read`    |  ✅   |   ❌    |   ❌    |   ❌   |
| `POST /backup/generate-token` | `backup:create`  |  ✅   |   ❌    |   ❌    |   ❌   |
| `POST /backup/restore`        | `backup:restore` |  ✅   |   ❌    |   ❌    |   ❌   |
| `DELETE /backup/:backupName`  | `backup:delete`  |  ✅   |   ❌    |   ❌    |   ❌   |
| `GET /backup/stats`           | `backup:read`    |  ✅   |   ❌    |   ❌    |   ❌   |

### Barcode

| Endpoint                        | Permission       | admin | manager | cashier | viewer |
| ------------------------------- | ---------------- | :---: | :-----: | :-----: | :----: |
| `GET /barcode/templates`        | `barcode:read`   |  ✅   |   ✅    |   ✅    |   ✅   |
| `POST /barcode/templates`       | `barcode:manage` |  ✅   |   ✅    |   ❌    |   ❌   |
| `DELETE /barcode/templates/:id` | `barcode:manage` |  ✅   |   ✅    |   ❌    |   ❌   |
| `GET /barcode/print-jobs`       | `barcode:read`   |  ✅   |   ✅    |   ✅    |   ❌   |
| `POST /barcode/print-jobs`      | `barcode:print`  |  ✅   |   ✅    |   ✅    |   ❌   |

### Dashboard

| Endpoint               | Permission       | admin | manager | cashier | viewer |
| ---------------------- | ---------------- | :---: | :-----: | :-----: | :----: |
| `GET /dashboard/stats` | `dashboard:read` |  ✅   |   ✅    |   ✅    |   ✅   |

### Settings

| Endpoint                      | Permission        | admin | manager | cashier | viewer | Notes                |
| ----------------------------- | ----------------- | :---: | :-----: | :-----: | :----: | -------------------- |
| `GET /settings/:key`          | `settings:read`   |  ✅   |   ✅    |   ✅    |   ✅   | Public for some keys |
| `PUT /settings/:key`          | `settings:update` |  ✅   |   ❌    |   ❌    |   ❌   |                      |
| `GET /settings/typed`         | `settings:read`   |  ✅   |   ✅    |   ✅    |   ✅   |                      |
| `PUT /settings/typed`         | `settings:update` |  ✅   |   ❌    |   ❌    |   ❌   |                      |
| `GET /settings/currency`      | _public_          |  ✅   |   ✅    |   ✅    |   ✅   | No auth needed       |
| `GET /settings/company`       | _public_          |  ✅   |   ✅    |   ✅    |   ✅   | No auth needed       |
| `PUT /settings/company`       | `settings:update` |  ✅   |   ❌    |   ❌    |   ❌   |                      |
| `GET /system/capabilities`    | _public_          |  ✅   |   ✅    |   ✅    |   ✅   | No auth needed       |
| `GET /settings/modules`       | `settings:read`   |  ✅   |   ✅    |   ✅    |   ✅   |                      |
| `POST /settings/setup-wizard` | _public_          |  ✅   |   ✅    |   ✅    |   ✅   | Only during setup    |

### Users

| Endpoint         | Permission     | admin | manager | cashier | viewer |
| ---------------- | -------------- | :---: | :-----: | :-----: | :----: |
| `GET /users`     | `users:read`   |  ✅   |   ❌    |   ❌    |   ❌   |
| `POST /users`    | `users:create` |  ✅   |   ❌    |   ❌    |   ❌   |
| `PUT /users/:id` | `users:update` |  ✅   |   ❌    |   ❌    |   ❌   |

---

## Default Permission Sets per Role

### admin

```json
[
  "products:read",
  "products:create",
  "products:update",
  "products:delete",
  "sales:read",
  "sales:create",
  "sales:payment",
  "sales:cancel",
  "sales:refund",
  "categories:read",
  "categories:create",
  "categories:update",
  "categories:delete",
  "customers:read",
  "customers:create",
  "customers:update",
  "customers:delete",
  "suppliers:read",
  "suppliers:create",
  "suppliers:update",
  "suppliers:delete",
  "purchases:read",
  "purchases:create",
  "purchases:payment",
  "inventory:read",
  "inventory:adjust",
  "inventory:reconcile",
  "accounting:read",
  "accounting:manage",
  "posting:read",
  "posting:manage",
  "ledger:payment",
  "ledger:adjust",
  "ledger:reconcile",
  "dashboard:read",
  "settings:read",
  "settings:update",
  "users:read",
  "users:create",
  "users:update",
  "audit:read",
  "backup:read",
  "backup:create",
  "backup:restore",
  "backup:delete",
  "barcode:read",
  "barcode:manage",
  "barcode:print"
]
```

### manager

```json
[
  "products:read",
  "products:create",
  "products:update",
  "sales:read",
  "sales:create",
  "sales:payment",
  "sales:cancel",
  "sales:refund",
  "categories:read",
  "categories:create",
  "categories:update",
  "customers:read",
  "customers:create",
  "customers:update",
  "suppliers:read",
  "suppliers:create",
  "suppliers:update",
  "purchases:read",
  "purchases:create",
  "purchases:payment",
  "inventory:read",
  "inventory:adjust",
  "inventory:reconcile",
  "accounting:read",
  "posting:read",
  "posting:manage",
  "ledger:payment",
  "ledger:adjust",
  "dashboard:read",
  "settings:read",
  "barcode:read",
  "barcode:manage",
  "barcode:print"
]
```

### cashier

```json
[
  "products:read",
  "sales:read",
  "sales:create",
  "sales:payment",
  "categories:read",
  "customers:read",
  "customers:create",
  "suppliers:read",
  "purchases:read",
  "inventory:read",
  "ledger:payment",
  "dashboard:read",
  "barcode:read",
  "barcode:print"
]
```

### viewer

```json
[
  "products:read",
  "sales:read",
  "categories:read",
  "customers:read",
  "suppliers:read",
  "purchases:read",
  "inventory:read",
  "accounting:read",
  "posting:read",
  "dashboard:read",
  "settings:read",
  "barcode:read"
]
```

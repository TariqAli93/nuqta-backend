# Nuqta Backend

A modern POS (Point of Sale) and inventory management system built with TypeScript, Fastify, and PostgreSQL.

## 🏗️ Architecture

This is a **PNPM monorepo** with a clean architecture approach:

```
nuqta-backend/
├── packages/
│   ├── core/          # Business logic layer (use-cases, services, entities)
│   └── data/          # Data access layer (repositories, Drizzle ORM)
├── src/
│   ├── app.ts         # Fastify application entry point
│   ├── plugins/       # Fastify plugins
│   └── routes/        # API route handlers
└── test/              # Comprehensive test suite
```

### Key Features

- **Sales & Purchases**: Complete transaction management with multi-item support
- **Inventory Tracking**: Real-time stock levels with FIFO depletion
- **Customer & Supplier Management**: Contact management with ledger tracking
- **Product Management**: Categories, barcodes, units, and batch tracking
- **Accounting**: Double-entry bookkeeping with posting batches
- **User Management**: Role-based permissions (Admin, Manager, Cashier)
- **Audit Logging**: Comprehensive activity tracking

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 10.28.0+ (`npm install -g pnpm`)
- **PostgreSQL** 14+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nuqta-backend

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
pnpm --filter=@nuqta/data run db:migrate

# (Optional) Seed the database with sample data
pnpm --filter=@nuqta/data run db:seed
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nuqtaplus

# JWT Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Server
PORT=3000
HOST=0.0.0.0
```

## 📜 Available Scripts

### Development

```bash
# Start development server with hot-reload
pnpm dev

# Watch TypeScript compilation only
pnpm watch:ts
```

The server will start at [http://localhost:3000](http://localhost:3000)

### Production

```bash
# Build all packages
pnpm build

# Start production server
pnpm start
```

### Testing

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests across all packages
pnpm test:all

# Type checking only
pnpm typecheck
```

### Database Management

```bash
# Generate new migration from schema changes
pnpm --filter=@nuqta/data run db:generate

# Run pending migrations
pnpm --filter=@nuqta/data run db:migrate

# Seed database with sample data
pnpm --filter=@nuqta/data run db:seed
```

### Utilities

```bash
# Clean build artifacts and node_modules
pnpm clean

# Build individual package
pnpm --filter=@nuqta/core run build
pnpm --filter=@nuqta/data run build
```

## 🧪 Testing

The project includes a comprehensive test suite with:

- **Unit Tests**: Business logic validation (use-cases, services)
- **Integration Tests**: Repository and API endpoint testing
- **~270 Test Cases**: Covering authentication, CRUD operations, edge cases, and error handling

See [test/README.md](test/README.md) for detailed testing documentation.

```bash
# Quick start
pnpm test

# Watch mode for TDD
pnpm test:watch
```

## 📦 Package Structure

### `@nuqta/core`

Business logic layer with domain entities, use-cases, and services. Zero dependencies on framework or database.

**Key modules:**

- `entities/` - Domain models
- `use-cases/` - Application business logic
- `services/` - Shared services (JWT, permissions, audit)
- `interfaces/` - Repository contracts

### `@nuqta/data`

Data access layer using Drizzle ORM with PostgreSQL.

**Key modules:**

- `repositories/` - Data access implementations
- `schema/` - Database schema definitions
- `migrations/` - SQL migration files

## 🔐 API Authentication

Most endpoints require JWT authentication:

```bash
# Register first user (admin)
POST /auth/register
{
  "username": "admin",
  "password": "secure-password",
  "role": "admin"
}

# Login
POST /auth/login
{
  "username": "admin",
  "password": "secure-password"
}

# Use returned token in subsequent requests
Authorization: Bearer <token>
```

## 🛠️ Tech Stack

- **Runtime**: Node.js + TypeScript
- **Web Framework**: Fastify 5
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Testing**: Vitest
- **Validation**: Zod
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

## 📖 API Documentation

Main API endpoints:

- `POST /auth/register` - Register new user
- `POST /auth/login` - Authenticate user
- `GET /auth/setup-status` - Check if initial setup is complete

- `GET|POST /products` - Product management
- `GET|POST /categories` - Category management
- `GET|POST /customers` - Customer management
- `GET|POST /suppliers` - Supplier management
- `GET|POST /sales` - Sales transactions
- `GET|POST /purchases` - Purchase orders
- `GET /dashboard/statistics` - Dashboard metrics
- `GET /inventory/movements` - Stock movement history
- `GET /accounting/journal-entries` - Accounting entries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`pnpm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

ISC

## 🔗 Learn More

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vitest Documentation](https://vitest.dev/)
- [PNPM Workspaces](https://pnpm.io/workspaces)

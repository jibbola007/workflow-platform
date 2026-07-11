# Simply Workflow

A lean Agile workflow management MVP built as a TypeScript monorepo.

## Stack

- Next.js frontend with Tailwind CSS and shadcn-style UI primitives
- NestJS REST API with JWT authentication
- Prisma ORM with PostgreSQL
- Docker Compose for frontend, backend, and database

## Structure

```text
apps/
  frontend/
  backend/
packages/
  database/
  shared/
```

## Run Locally

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Run With Docker

```bash
docker compose up --build
```

The frontend runs on `http://localhost:3000` and the API runs on `http://localhost:4000`.

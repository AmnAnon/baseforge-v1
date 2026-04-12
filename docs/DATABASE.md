# Database Migrations (Drizzle ORM)

BaseForge uses [Drizzle ORM](https://orm.drizzle.team/) with Neon Postgres for persistent storage. This document explains how to manage schema changes safely.

## Current Schema

Defined in `src/lib/db/schema.ts`:

| Table | Purpose |
|---|---|
| `protocols` | Protocol registry (name, slug, category, chain) |
| `historical_tvl` | Time-series TVL data per protocol |
| `markets` | Lending market data (supply/borrow APY, TVL) |
| `alert_rules` | User-defined alert conditions |
| `alert_events` | Triggered alert history |
| `frame_interactions` | Farcaster Frame click analytics |
| `user_preferences` | Favorite protocols, settings |
| `api_cache` | Optional persistent cache |

## Migration Commands

```bash
# Generate migration SQL from schema changes
npm run db:generate

# Push schema directly to database (dev only — no migration files)
npm run db:push

# Apply pending migrations
npm run db:migrate

# Open visual database browser
npm run db:studio
```

## Migration Workflow

### Development (fast iteration)

Use `db:push` for rapid prototyping. It compares your schema file against the database and applies changes directly — no migration files generated.

```bash
# Edit src/lib/db/schema.ts
# Then push changes directly
npm run db:push
```

⚠️ `db:push` can be destructive (drops columns/tables). Only use in development.

### Production (safe migrations)

Always use `db:generate` + `db:migrate` for production.

#### Step 1: Make schema changes

Edit `src/lib/db/schema.ts`:

```typescript
// Example: add a new column
export const protocols = pgTable("protocols", {
  // ... existing columns
  riskScore: integer("risk_score").default(50),  // ← new column
});
```

#### Step 2: Generate migration

```bash
npm run db:generate
```

This creates a new SQL file in `src/lib/db/migrations/`:
```
src/lib/db/migrations/
├── 0000_military_iron_lad.sql    # Initial schema
├── 0001_your_new_migration.sql   # ← generated
└── meta/
    ├── _journal.json
    ├── 0000_snapshot.json
    └── 0001_snapshot.json
```

#### Step 3: Review the SQL

Always review generated SQL before applying:

```bash
cat src/lib/db/migrations/0001_*.sql
```

Check for:
- Unintended `DROP` statements
- Missing `DEFAULT` values on non-nullable columns
- Index changes that could lock tables

#### Step 4: Apply migration

```bash
npm run db:migrate
```

#### Step 5: Commit migration files

```bash
git add src/lib/db/migrations/
git commit -m "db: add risk_score column to protocols"
```

## Drizzle Configuration

`drizzle.config.ts`:

```typescript
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/baseforge",
  },
  out: "./src/lib/db/migrations",
  verbose: true,   // Log SQL statements
  strict: true,    // Fail on ambiguous changes
});
```

## Safety Rules

### Do

- ✅ Always generate migrations for production changes
- ✅ Review generated SQL before applying
- ✅ Add `DEFAULT` values for new non-nullable columns
- ✅ Test migrations on a staging database first
- ✅ Commit migration files to git
- ✅ Back up the database before destructive changes

### Don't

- ❌ Don't use `db:push` in production
- ❌ Don't manually edit migration SQL files after generation
- ❌ Don't delete migration files from the `migrations/` directory
- ❌ Don't rename columns (use add + migrate data + drop instead)
- ❌ Don't add `NOT NULL` columns without a `DEFAULT` (will fail on existing rows)

## Common Patterns

### Adding a column

```typescript
// In schema.ts:
export const protocols = pgTable("protocols", {
  // ... existing
  newField: text("new_field").default(""),
});
```

```bash
npm run db:generate
npm run db:migrate
```

### Adding an index

```typescript
export const protocols = pgTable("protocols", {
  // ... existing
}, (table) => ({
  newIdx: index("protocols_new_idx").on(table.newField),
}));
```

### Adding a new table

```typescript
export const newTable = pgTable("new_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Removing a column (safe rollout)

1. Stop reading the column in application code
2. Deploy the code change
3. Generate and apply migration to drop the column
4. This ensures zero-downtime deployment

### Adding an enum value

Postgres enums can't have values removed, only added:

```typescript
// Add new value to existing enum
export const severityEnum = pgEnum("severity", ["critical", "warning", "info", "debug"]);
```

```bash
npm run db:generate  # Will generate ALTER TYPE ... ADD VALUE
npm run db:migrate
```

## Neon-Specific Notes

### Branching

Neon supports database branching for testing migrations:

```bash
# Create a branch from production
neon branch create --name test-migration

# Test migration on branch
DATABASE_URL=<branch-url> npm run db:migrate

# If successful, apply to production
DATABASE_URL=<production-url> npm run db:migrate

# Delete branch
neon branch delete test-migration
```

### Connection Pooling

Neon uses connection pooling by default. Drizzle's `neon-http` driver is pooler-compatible. No special configuration needed.

### Serverless Considerations

- Connections are short-lived (one per request on Vercel)
- The lazy DB client (`src/lib/db/client.ts`) only connects when actually needed
- Connection overhead is minimal (~15ms via Neon's HTTP driver)

## Rollback Strategy

Drizzle doesn't generate down migrations automatically. For rollbacks:

1. **Schema rollback:** Revert the schema change in git, generate a new migration
2. **Data rollback:** Write a manual SQL script if data was transformed
3. **Neon time travel:** Neon supports point-in-time restore (last 7 days on free tier)

```bash
# Revert schema change in code
git revert <commit-hash>

# Generate migration that undoes the change
npm run db:generate

# Apply
npm run db:migrate
```

# Dira OS financial production snapshot workflow

Financial diagnostics and migration planning must run against a controlled read-only snapshot or clone.

```text
production database
  -> provider-managed point-in-time snapshot or isolated clone
  -> read-only credentials and separate database name
  -> financial:diagnostic
  -> financial:migration:plan
  -> financial:reconcile
  -> reviewed, guarded migration/repair on the controlled copy
  -> post-migration diagnostic and reconciliation
```

## Safety rules

- Never place a connection string in source, scripts, logs, or reports.
- Set `MONGODB_URI` only in the shell/secret manager for the snapshot session.
- Use `MONGODB_TEST_URI` only for a disposable replica-set test database.
- Diagnostic, migration-plan, and reconcile commands are read-only.
- Migration apply requires `FINANCIAL_MIGRATION_CONFIRM=true` and `FINANCIAL_MIGRATION_VERSION=financial-v1`.
- Review duplicate groups before creating or validating unique indexes.
- Preserve all source records and retain an audit/checkpoint record for approved repairs.

## Commands

```bash
pnpm --filter @vbo/api financial:diagnostic > financial-diagnostic.json
pnpm --filter @vbo/api financial:migration:plan > financial-migration-plan.json
pnpm --filter @vbo/api financial:reconcile > financial-reconciliation.json
```

Only after written approval on the controlled copy:

```bash
FINANCIAL_MIGRATION_CONFIRM=true FINANCIAL_MIGRATION_VERSION=financial-v1 pnpm --filter @vbo/api financial:migration:apply
```

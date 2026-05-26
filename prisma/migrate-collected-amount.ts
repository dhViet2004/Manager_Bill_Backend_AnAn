/**
 * Migration script: map collected_amount from bills → collection_history_entries
 *
 * Run AFTER `prisma db push` or migration that created collection_history_entries table.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx prisma/migrate-collected-amount.ts
 *   # or
 *   npm run migrate:collected-amount
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  const result = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(result[0]?.cnt) > 0;
}

async function checkTableExists(table: string): Promise<boolean> {
  const result = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
  `;
  return Number(result[0]?.cnt) > 0;
}

async function main() {
  console.log('=== Migration: collected_amount → collection_history_entries ===\n');

  // 1. Verify the new table exists
  const tableExists = await checkTableExists('collection_history_entries');
  if (!tableExists) {
    console.error(
      '❌ Table collection_history_entries does not exist.\n' +
      '   Please run `prisma db push` or a migration to create it first, then re-run this script.'
    );
    process.exit(1);
  }
  console.log('✓ Table collection_history_entries exists');

  // 2. Check if old column still exists
  const oldColumnExists = await checkColumnExists('bills', 'collected_amount');

  if (!oldColumnExists) {
    console.log('✓ Column bills.collected_amount no longer exists — nothing to migrate.');
    process.exit(0);
  }
  console.log('✓ Column bills.collected_amount found — proceeding with migration\n');

  // 3. Fetch all bills with collected_amount > 0
  const billsWithCollection = await prisma.$queryRaw<
    { id: number; collected_amount: number; updated_at: Date }[]
  >`
    SELECT id, collected_amount, updated_at
    FROM bills
    WHERE collected_amount > 0
  `;

  console.log(`Found ${billsWithCollection.length} bill(s) with collected_amount > 0\n`);

  if (billsWithCollection.length === 0) {
    console.log('No data to migrate. You can now drop the collected_amount column manually.');
    process.exit(0);
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (const bill of billsWithCollection) {
    // Get the first row of this bill to link the history entry to
    const firstRow = await prisma.$queryRaw<
      { id: number }[]
    >`
      SELECT id FROM bill_rows WHERE bill_id = ${bill.id} LIMIT 1
    `;

    if (firstRow.length === 0) {
      console.warn(
        `  ⚠ Bill #${bill.id} has collected_amount=${bill.collected_amount} but has no rows — skipping.`
      );
      skippedCount++;
      continue;
    }

    const rowId = firstRow[0].id;
    const amount = Math.round(Number(bill.collected_amount));
    const timestamp = bill.updated_at;

    await prisma.$executeRaw`
      INSERT INTO collection_history_entries (bill_row_id, amount, timestamp)
      VALUES (${rowId}, ${amount}, ${timestamp})
    `;

    console.log(
      `  ✓ Bill #${bill.id}: created CollectionHistoryEntry ` +
      `{ amount=${amount}, timestamp=${timestamp.toISOString()} } → bill_row_id=${rowId}`
    );
    migratedCount++;
  }

  console.log(`\n✅ Migrated ${migratedCount} entry(ies). Skipped ${skippedCount}.\n`);

  // 4. Drop the old column
  try {
    await prisma.$executeRaw`ALTER TABLE bills DROP COLUMN collected_amount`;
    console.log('✓ Dropped column bills.collected_amount\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('⚠ Failed to drop column bills.collected_amount:', msg);
    console.warn('   Data has been migrated. Please drop the column manually or retry migration.');
    console.warn('   Continuing anyway — app can start without dropping the column.\n');
  }

  console.log('=== Migration complete ===');
}

main()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  backupSnapshots,
  categories,
  companies,
  companyMembers,
  companyReputationProfiles,
  companyUnits,
  competitors,
  customerReviews,
  evidenceCards,
  financialCostRecords,
  financialExpenseRecords,
  financialSalesRecords,
  geoSavedEntities,
  geoSearchLogs,
  integrations,
  internalMetrics,
  inventoryControlItems,
  lgpdRecords,
  products,
  simulations,
  strategicItems,
  subscriptions,
} from '../db/schema.ts';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const MAX_RETAINED_SNAPSHOTS = 14;

function ensureSecureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  }
  try {
    fs.chmodSync(BACKUP_DIR, 0o700);
  } catch {
    // ignore chmod on filesystems that don't support POSIX modes
  }
}

function pruneOldBackups(): void {
  try {
    ensureSecureBackupDir();
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('gemeo-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (const obsolete of files.slice(MAX_RETAINED_SNAPSHOTS)) {
      const target = path.join(BACKUP_DIR, obsolete);
      fs.unlinkSync(target);
    }
  } catch (err) {
    console.warn('Backup pruning warning:', err instanceof Error ? err.message : err);
  }
}

export async function createDatabaseBackupSnapshot(
  triggerType: 'scheduled' | 'manual' = 'scheduled'
): Promise<{
  id: number;
  fileName: string;
  integritySha256: string;
  sizeBytes: number;
  recordCounts: Record<string, number>;
}> {
  ensureSecureBackupDir();

  const [
    companiesRows,
    unitsRows,
    membersRows,
    subsRows,
    catsRows,
    prodsRows,
    metricsRows,
    compsRows,
    reviewsRows,
    strategicRows,
    salesRows,
    costsRows,
    expensesRows,
    inventoryRows,
    geoEntitiesRows,
    lgpdRows,
  ] = await Promise.all([
    db.select().from(companies),
    db.select().from(companyUnits),
    db.select().from(companyMembers),
    db.select().from(subscriptions),
    db.select().from(categories),
    db.select().from(products),
    db.select().from(internalMetrics),
    db.select().from(competitors),
    db.select().from(customerReviews),
    db.select().from(strategicItems),
    db.select().from(financialSalesRecords),
    db.select().from(financialCostRecords),
    db.select().from(financialExpenseRecords),
    db.select().from(inventoryControlItems),
    db.select().from(geoSavedEntities),
    db.select().from(lgpdRecords),
  ]);

  const recordCounts: Record<string, number> = {
    companies: companiesRows.length,
    companyUnits: unitsRows.length,
    companyMembers: membersRows.length,
    subscriptions: subsRows.length,
    categories: catsRows.length,
    products: prodsRows.length,
    internalMetrics: metricsRows.length,
    competitors: compsRows.length,
    customerReviews: reviewsRows.length,
    strategicItems: strategicRows.length,
    financialSalesRecords: salesRows.length,
    financialCostRecords: costsRows.length,
    financialExpenseRecords: expensesRows.length,
    inventoryControlItems: inventoryRows.length,
    geoSavedEntities: geoEntitiesRows.length,
    lgpdRecords: lgpdRows.length,
  };

  const payload = {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    triggerType,
    recordCounts,
    data: {
      companies: companiesRows,
      companyUnits: unitsRows,
      companyMembers: membersRows,
      subscriptions: subsRows,
      categories: catsRows,
      products: prodsRows,
      internalMetrics: metricsRows,
      competitors: compsRows,
      customerReviews: reviewsRows,
      strategicItems: strategicRows,
      financialSalesRecords: salesRows,
      financialCostRecords: costsRows,
      financialExpenseRecords: expensesRows,
      inventoryControlItems: inventoryRows,
      geoSavedEntities: geoEntitiesRows,
      lgpdRecords: lgpdRows,
    },
  };

  const serialized = JSON.stringify(payload, null, 2);
  const integritySha256 = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `gemeo-backup-${stamp}.json`;
  const targetPath = path.join(BACKUP_DIR, fileName);

  fs.writeFileSync(targetPath, serialized, { encoding: 'utf8', mode: 0o600 });
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  const [recorded] = await db
    .insert(backupSnapshots)
    .values({
      fileName,
      triggerType,
      integritySha256,
      sizeBytes,
      recordCountsJson: recordCounts,
      status: 'verified',
    })
    .returning();

  pruneOldBackups();

  return {
    id: recorded.id,
    fileName,
    integritySha256,
    sizeBytes,
    recordCounts,
  };
}

export function verifyBackupFileIntegrity(fileName: string, expectedSha256: string): {
  exists: boolean;
  valid: boolean;
  actualSha256: string;
} {
  const safeName = path.basename(fileName);
  const targetPath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(targetPath)) {
    return { exists: false, valid: false, actualSha256: '' };
  }
  const content = fs.readFileSync(targetPath, 'utf8');
  const actualSha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return {
    exists: true,
    valid: actualSha256 === expectedSha256,
    actualSha256,
  };
}

export async function exportCompanyVerifiedBackup(companyId: number) {
  const [
    [company],
    units,
    members,
    [subscription],
    [reputationProfile],
    cats,
    prods,
    integs,
    metrics,
    comps,
    revs,
    evid,
    strat,
    sims,
    geoEnts,
    geoLogs,
    sales,
    costs,
    expenses,
    inventory,
    lgpd,
    audits,
  ] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db.select().from(companyUnits).where(eq(companyUnits.companyId, companyId)),
    db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId)),
    db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)),
    db.select().from(companyReputationProfiles).where(eq(companyReputationProfiles.companyId, companyId)),
    db.select().from(categories).where(eq(categories.companyId, companyId)),
    db.select().from(products).where(eq(products.companyId, companyId)),
    db.select().from(integrations).where(eq(integrations.companyId, companyId)),
    db.select().from(internalMetrics).where(eq(internalMetrics.companyId, companyId)),
    db.select().from(competitors).where(eq(competitors.companyId, companyId)),
    db.select().from(customerReviews).where(eq(customerReviews.companyId, companyId)),
    db.select().from(evidenceCards).where(eq(evidenceCards.companyId, companyId)),
    db.select().from(strategicItems).where(eq(strategicItems.companyId, companyId)),
    db.select().from(simulations).where(eq(simulations.companyId, companyId)),
    db.select().from(geoSavedEntities).where(eq(geoSavedEntities.companyId, companyId)),
    db.select().from(geoSearchLogs).where(eq(geoSearchLogs.companyId, companyId)).orderBy(desc(geoSearchLogs.createdAt)).limit(100),
    db.select().from(financialSalesRecords).where(eq(financialSalesRecords.companyId, companyId)),
    db.select().from(financialCostRecords).where(eq(financialCostRecords.companyId, companyId)),
    db.select().from(financialExpenseRecords).where(eq(financialExpenseRecords.companyId, companyId)),
    db.select().from(inventoryControlItems).where(eq(inventoryControlItems.companyId, companyId)),
    db.select().from(lgpdRecords).where(eq(lgpdRecords.companyId, companyId)),
    db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(desc(auditLogs.createdAt)).limit(200),
  ]);

  const bundle = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    companyId,
    data: {
      company,
      units,
      members,
      subscription,
      reputationProfile,
      categories: cats,
      products: prods,
      integrations: integs,
      internalMetrics: metrics,
      competitors: comps,
      customerReviews: revs,
      evidenceCards: evid,
      strategicItems: strat,
      simulations: sims,
      geoSavedEntities: geoEnts,
      geoSearchLogs: geoLogs,
      financialSalesRecords: sales,
      financialCostRecords: costs,
      financialExpenseRecords: expenses,
      inventoryControlItems: inventory,
      lgpdRecords: lgpd,
      auditLogs: audits,
    },
  };

  const json = JSON.stringify(bundle);
  const integritySha256 = crypto.createHash('sha256').update(json, 'utf8').digest('hex');

  await db.insert(backupSnapshots).values({
    fileName: `company-${companyId}-export-${Date.now()}.json`,
    triggerType: 'company_export',
    companyId,
    integritySha256,
    sizeBytes: Buffer.byteLength(json, 'utf8'),
    recordCountsJson: {
      products: prods.length,
      metrics: metrics.length,
      competitors: comps.length,
      reviews: revs.length,
      financialSales: sales.length,
    },
    status: 'verified',
  });

  return {
    integritySha256,
    bundle,
  };
}

let backupSchedulerStarted = false;

export function startPeriodicBackups(): void {
  if (backupSchedulerStarted) return;
  backupSchedulerStarted = true;

  // Run an initial snapshot shortly after boot, then every 6 hours
  const initialTimer = setTimeout(() => {
    void createDatabaseBackupSnapshot('scheduled').catch((err) => {
      console.warn('Initial scheduled backup skipped:', err instanceof Error ? err.message : err);
    });
  }, 45 * 1000);
  initialTimer.unref();

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const intervalTimer = setInterval(() => {
    void createDatabaseBackupSnapshot('scheduled').catch((err) => {
      console.warn('Periodic backup failed:', err instanceof Error ? err.message : err);
    });
  }, SIX_HOURS_MS);
  intervalTimer.unref();
}

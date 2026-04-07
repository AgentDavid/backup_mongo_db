#!/usr/bin/env node
'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { createBackup } = require('./src/backup');

// ---------------------------------------------------------------------------
// Configuration (from environment variables with sensible defaults)
// ---------------------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || '';
const MONGO_USER = process.env.MONGO_USER || '';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || '';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const BACKUP_RETENTION = parseInt(process.env.BACKUP_RETENTION || '3', 10);

// Default: every day at 02:00 AM
// node-cron format: second minute hour day-of-month month day-of-week
const BACKUP_CRON = process.env.BACKUP_CRON || '0 0 2 * * *';

// ---------------------------------------------------------------------------
// Helper: run one backup immediately (used for --now flag and scheduled runs)
// ---------------------------------------------------------------------------
async function runBackup() {
  try {
    const backupPath = await createBackup({
      uri: MONGO_URI,
      db: MONGO_DB || undefined,
      user: MONGO_USER || undefined,
      password: MONGO_PASSWORD || undefined,
      backupDir: BACKUP_DIR,
      retention: BACKUP_RETENTION,
    });
    console.log(`[scheduler] Backup finished: ${backupPath}`);
  } catch (err) {
    console.error('[scheduler] Backup failed:', err.message || err);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// CLI: --now flag runs a single backup immediately and exits
// ---------------------------------------------------------------------------
if (process.argv.includes('--now')) {
  console.log('[scheduler] Running immediate backup (--now flag detected)...');
  runBackup().then(() => {
    if (!process.exitCode) process.exit(0);
    else process.exit(1);
  });
} else {
  // ---------------------------------------------------------------------------
  // Scheduled mode: runs the backup on the configured cron schedule
  // ---------------------------------------------------------------------------
  if (!cron.validate(BACKUP_CRON)) {
    console.error(`[scheduler] Invalid cron expression: "${BACKUP_CRON}"`);
    process.exit(1);
  }

  console.log(`[scheduler] MongoDB backup scheduler started.`);
  console.log(`[scheduler] Schedule  : ${BACKUP_CRON}`);
  console.log(`[scheduler] Target DB : ${MONGO_URI}${MONGO_DB ? '/' + MONGO_DB : ''}`);
  console.log(`[scheduler] Backup dir: ${BACKUP_DIR}`);
  console.log(`[scheduler] Retention : last ${BACKUP_RETENTION} backups`);
  console.log('[scheduler] Waiting for next scheduled run... (press Ctrl+C to stop)');

  cron.schedule(BACKUP_CRON, () => {
    console.log(`[scheduler] Cron triggered at ${new Date().toISOString()}`);
    runBackup();
  });
}

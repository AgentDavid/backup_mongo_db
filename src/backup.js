'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execFileAsync = util.promisify(execFile);

/**
 * Build the array of arguments for mongodump based on the provided config.
 *
 * @param {object} config
 * @param {string} config.uri        - MongoDB connection URI
 * @param {string} [config.db]       - Database name (optional)
 * @param {string} [config.user]     - MongoDB username (optional)
 * @param {string} [config.password] - MongoDB password (optional)
 * @param {string} config.outDir     - Directory where this backup will be written
 * @returns {string[]}
 */
function buildMongodumpArgs(config) {
  const args = ['--uri', config.uri];

  if (config.db) {
    args.push('--db', config.db);
  }

  if (config.user) {
    args.push('--username', config.user);
  }

  if (config.password) {
    args.push('--password', config.password);
  }

  args.push('--out', config.outDir);

  return args;
}

/**
 * Run mongodump to create a backup.
 *
 * @param {object} config  - Same shape as buildMongodumpArgs
 * @returns {Promise<void>}
 */
async function runMongodump(config) {
  const args = buildMongodumpArgs(config);
  await execFileAsync('mongodump', args);
}

/**
 * Return the names of all backup sub-directories inside backupDir sorted from
 * oldest to newest (alphabetical order works because timestamps are used as
 * directory names).
 *
 * @param {string} backupDir
 * @returns {string[]} Sorted backup directory names (oldest first)
 */
function getSortedBackups(backupDir) {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((name) => {
      const full = path.join(backupDir, name);
      return fs.statSync(full).isDirectory();
    })
    .sort();
}

/**
 * Delete old backups so that at most `retention` backups remain.
 *
 * @param {string} backupDir  - Root backup directory
 * @param {number} retention  - Number of backups to keep
 */
function rotateBackups(backupDir, retention) {
  const backups = getSortedBackups(backupDir);

  const toDelete = backups.slice(0, Math.max(0, backups.length - retention));

  for (const name of toDelete) {
    const full = path.join(backupDir, name);
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`[backup] Deleted old backup: ${full}`);
  }
}

/**
 * Create a timestamped backup directory name.
 *
 * @returns {string} e.g. "2024-01-15T02-00-00"
 */
function makeBackupDirName() {
  return new Date().toISOString().replace(/:/g, '-').split('.')[0];
}

/**
 * Perform a full MongoDB backup and rotate old backups.
 *
 * @param {object} options
 * @param {string} options.uri        - MongoDB connection URI
 * @param {string} [options.db]       - Database name
 * @param {string} [options.user]     - MongoDB username
 * @param {string} [options.password] - MongoDB password
 * @param {string} options.backupDir  - Root directory for all backups
 * @param {number} options.retention  - Number of backups to keep
 * @returns {Promise<string>} Path of the newly created backup directory
 */
async function createBackup(options) {
  const { uri, db, user, password, backupDir, retention } = options;

  // Ensure the root backup directory exists
  fs.mkdirSync(backupDir, { recursive: true });

  const dirName = makeBackupDirName();
  const outDir = path.join(backupDir, dirName);

  console.log(`[backup] Starting backup → ${outDir}`);

  await runMongodump({ uri, db, user, password, outDir });

  console.log(`[backup] Backup completed: ${outDir}`);

  rotateBackups(backupDir, retention);

  return outDir;
}

module.exports = { createBackup, getSortedBackups, rotateBackups, makeBackupDirName, buildMongodumpArgs };

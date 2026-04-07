'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { getSortedBackups, rotateBackups, makeBackupDirName, buildMongodumpArgs } = require('./backup');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory and return its path. */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mongo-backup-test-'));
}

/** Create `count` fake backup sub-directories inside `dir`. */
function createFakeBackups(dir, names) {
  for (const name of names) {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('makeBackupDirName', () => {
  it('returns a string matching the ISO timestamp pattern (colons replaced by dashes)', () => {
    const name = makeBackupDirName();
    // Expected format: 2024-01-15T02-00-00
    assert.match(name, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  it('does not contain colons', () => {
    const name = makeBackupDirName();
    assert.ok(!name.includes(':'), 'name should not contain colons');
  });
});

describe('buildMongodumpArgs', () => {
  it('always includes --uri', () => {
    const args = buildMongodumpArgs({ uri: 'mongodb://localhost:27017', outDir: '/tmp/out' });
    assert.ok(args.includes('--uri'));
    assert.ok(args.includes('mongodb://localhost:27017'));
  });

  it('includes --db when provided', () => {
    const args = buildMongodumpArgs({ uri: 'mongodb://localhost:27017', db: 'mydb', outDir: '/tmp/out' });
    assert.ok(args.includes('--db'));
    assert.ok(args.includes('mydb'));
  });

  it('does not include --db when not provided', () => {
    const args = buildMongodumpArgs({ uri: 'mongodb://localhost:27017', outDir: '/tmp/out' });
    assert.ok(!args.includes('--db'));
  });

  it('includes --username and --password when provided', () => {
    const args = buildMongodumpArgs({
      uri: 'mongodb://localhost:27017',
      user: 'admin',
      password: 'secret',
      outDir: '/tmp/out',
    });
    assert.ok(args.includes('--username'));
    assert.ok(args.includes('admin'));
    assert.ok(args.includes('--password'));
    assert.ok(args.includes('secret'));
  });

  it('always includes --out', () => {
    const args = buildMongodumpArgs({ uri: 'mongodb://localhost:27017', outDir: '/tmp/out' });
    assert.ok(args.includes('--out'));
    assert.ok(args.includes('/tmp/out'));
  });
});

describe('getSortedBackups', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTempDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an empty array when the directory does not exist', () => {
    const result = getSortedBackups(path.join(tmpDir, 'nonexistent'));
    assert.deepEqual(result, []);
  });

  it('returns backup names sorted alphabetically (oldest first)', () => {
    const backupsDir = path.join(tmpDir, 'sorted');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, [
      '2024-01-15T02-00-00',
      '2024-01-13T02-00-00',
      '2024-01-14T02-00-00',
    ]);

    const result = getSortedBackups(backupsDir);
    assert.deepEqual(result, [
      '2024-01-13T02-00-00',
      '2024-01-14T02-00-00',
      '2024-01-15T02-00-00',
    ]);
  });

  it('ignores files (only returns directories)', () => {
    const backupsDir = path.join(tmpDir, 'files-ignored');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, ['2024-01-15T02-00-00']);
    fs.writeFileSync(path.join(backupsDir, 'somefile.txt'), 'data');

    const result = getSortedBackups(backupsDir);
    assert.deepEqual(result, ['2024-01-15T02-00-00']);
  });
});

describe('rotateBackups', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTempDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes oldest backups so only `retention` remain', () => {
    const backupsDir = path.join(tmpDir, 'rotate');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, [
      '2024-01-11T02-00-00',
      '2024-01-12T02-00-00',
      '2024-01-13T02-00-00',
      '2024-01-14T02-00-00',
      '2024-01-15T02-00-00',
    ]);

    rotateBackups(backupsDir, 3);

    const remaining = getSortedBackups(backupsDir);
    assert.equal(remaining.length, 3);
    assert.deepEqual(remaining, [
      '2024-01-13T02-00-00',
      '2024-01-14T02-00-00',
      '2024-01-15T02-00-00',
    ]);
  });

  it('does nothing when backup count is already within retention limit', () => {
    const backupsDir = path.join(tmpDir, 'no-rotate');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, ['2024-01-14T02-00-00', '2024-01-15T02-00-00']);

    rotateBackups(backupsDir, 3);

    const remaining = getSortedBackups(backupsDir);
    assert.equal(remaining.length, 2);
  });

  it('keeps exactly `retention` backups when count equals retention', () => {
    const backupsDir = path.join(tmpDir, 'exact');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, [
      '2024-01-13T02-00-00',
      '2024-01-14T02-00-00',
      '2024-01-15T02-00-00',
    ]);

    rotateBackups(backupsDir, 3);

    const remaining = getSortedBackups(backupsDir);
    assert.equal(remaining.length, 3);
  });

  it('deletes all backups when retention is 0', () => {
    const backupsDir = path.join(tmpDir, 'zero-retention');
    fs.mkdirSync(backupsDir);
    createFakeBackups(backupsDir, ['2024-01-14T02-00-00', '2024-01-15T02-00-00']);

    rotateBackups(backupsDir, 0);

    const remaining = getSortedBackups(backupsDir);
    assert.equal(remaining.length, 0);
  });
});

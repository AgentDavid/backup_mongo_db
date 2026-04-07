# backup_mongo_db

A Node.js CLI tool that creates a **full MongoDB backup every morning** and automatically keeps only the **last 3 backups**.

---

## Requirements

- Node.js 18+
- `mongodump` installed and available in your `PATH` ([MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/))

---

## Installation

```bash
# Clone the repository
git clone https://github.com/AgentDavid/backup_mongo_db.git
cd backup_mongo_db

# Install dependencies
npm install

# (Optional) install globally as a CLI command
npm install -g .
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable          | Default                      | Description                                               |
| ----------------- | ---------------------------- | --------------------------------------------------------- |
| `MONGO_URI`       | `mongodb://localhost:27017`  | MongoDB connection URI                                    |
| `MONGO_DB`        | _(empty – all databases)_    | Database name to back up (omit to back up all databases)  |
| `MONGO_USER`      | _(empty)_                    | MongoDB username (if authentication is required)          |
| `MONGO_PASSWORD`  | _(empty)_                    | MongoDB password (if authentication is required)          |
| `BACKUP_DIR`      | `./backups`                  | Directory where backups are stored                        |
| `BACKUP_RETENTION`| `3`                          | Number of most-recent backups to keep                     |
| `BACKUP_CRON`     | `0 0 2 * * *`                | Cron expression for the schedule (default: 02:00 AM daily)|

---

## Usage

### Start the scheduler (runs backup every day at 02:00 AM by default)

```bash
node index.js
# or, if installed globally:
mongo-backup
```

### Run a backup immediately (one-shot, then exit)

```bash
node index.js --now
# or
npm run backup:now
```

### Custom schedule via environment variable

```bash
# Run every day at 06:30 AM
BACKUP_CRON="0 30 6 * * *" node index.js
```

---

## How it works

1. **Backup** – Calls `mongodump` with the configured connection settings and writes the dump to `<BACKUP_DIR>/<timestamp>/`.
2. **Rotation** – After each successful backup, the tool deletes the oldest backups, keeping only the most-recent `BACKUP_RETENTION` copies (default: **3**).

Backup directory names use the ISO 8601 timestamp (colons replaced by dashes) so they sort correctly:

```
backups/
  2024-01-13T02-00-00/
  2024-01-14T02-00-00/
  2024-01-15T02-00-00/   ← newest
```

---

## Running tests

```bash
npm test
```

---

## Project structure

```
.
├── index.js          # CLI entry point / cron scheduler
├── src/
│   ├── backup.js     # Core backup + rotation logic
│   └── backup.test.js# Unit tests (Node built-in test runner)
├── .env.example      # Example environment configuration
├── package.json
└── README.md
```

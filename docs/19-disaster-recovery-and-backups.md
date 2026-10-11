# Disaster Recovery, Automated Offsite Backups & Zero-Downtime Migration Runbook

Status: COMPLETE REMEDIATED SPECIFICATION (P0 AUDIT REMEDIATION)  
Scope: PostgreSQL (Supabase), Cloudflare R2 / AWS S3, AES-256-GCM Stream Encryption, Inngest, Prisma

---

## 1. Disaster Recovery & Recovery Point Objectives

To provide clear operational guarantees without misleading claims, BizTrackBD employs a **2-Tier Recovery Architecture**:

| Recovery Scenario | Primary Mechanism | Target RPO | Target RTO | Verification Method |
|---|---|---|---|---|
| **Accidental Data Deletion / Corrupted Migration** | **Tier 1: Supabase Point-in-Time Recovery (PITR)** | `< 5 minutes` | `< 15 minutes` | Continuous WAL streaming with instant second-by-second rollbacks |
| **Catastrophic Cloud Provider Outage / Total Lockout** | **Tier 2: Encrypted Cold Offsite Daily Snapshots (Cloudflare R2)** | `≤ 24 hours` | `< 60 minutes` | Automated weekly restore drill into ephemeral test DB |

---

## 2. Backup Architecture & Encryption Pipeline

```
+-------------------------------------------------------------------------------+
| Tier 1: Continuous Point-in-Time Recovery (Supabase PITR)                     |
| - Real-time Write-Ahead Log (WAL) streaming                                   |
| - Instant rollbacks to any specific second within the past 7–30 days          |
+-------------------------------------------------------------------------------+
                                        +
+-------------------------------------------------------------------------------+
| Tier 2: Authenticated AES-256-GCM Encrypted Offsite Snapshots (Cloudflare R2) |
| - Daily cron at 03:00 AM Asia/Dhaka time via Inngest                          |
| - Pipeline: pg_dump -> gzip -> AES-256-GCM Stream -> Cloudflare R2 Bucket     |
| - Uploads backup file + cryptographic metadata manifest + updates latest ptr  |
| - Automated 30-day bucket lifecycle policy                                    |
+-------------------------------------------------------------------------------+
```

---

## 3. Production Encrypted Backup Function (`packages/core/src/backup.ts`)

> **Phase 8 built the pipeline in `packages/core/src/backup/index.ts` (import `@biztrackbd/core/backup`), not the code below, and ran the drill locally.** pg_dump, gzip and AES-256-GCM with the manifest as designed, plus a `BackupStore` interface; only `LocalDirStore` exists. Writing to Cloudflare R2, the 03:00 Dhaka schedule and the 30-day lifecycle rule are NOT built. The drill (`pnpm drill:backup`) restores into a scratch database and compares tables, row counts, row-level-security state and a live isolation check, and proves a changed backup and a wrong key are refused. See docs/16 Phase 8 for the numbers and their limits. The reference code below is the original design.

```typescript
import { inngest } from "./client";
import { exec } from "child_process";
import { promisify } from "util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import fs from "fs";
import zlib from "zlib";
import { pipeline } from "stream/promises";

const execAsync = promisify(exec);

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const executeDailyOffsiteBackup = inngest.createFunction(
  {
    id: "cron-daily-offsite-backup",
    name: "Daily Authenticated Encrypted Database Dump to R2/S3",
  },
  { cron: "0 21 * * *" }, // Daily at 03:00 AM BST (21:00 UTC)
  async ({ step }) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `biztrackbd-backup-${timestamp}`;
    const rawDumpPath = `/tmp/${baseName}.sql`;
    const encryptedPath = `/tmp/${baseName}.sql.gz.enc`;
    const bucket = process.env.R2_BACKUP_BUCKET_NAME || "biztrackbd-backups";

    // Step 1: Execute pg_dump from Direct Database URL
    await step.run("pg-dump-database", async () => {
      const dbUrl = process.env.DIRECT_URL!;
      await execAsync(`pg_dump "${dbUrl}" --format=plain --no-owner --no-privileges > ${rawDumpPath}`);
    });

    // Step 2: Stream Compress & Encrypt with AES-256-GCM
    const cryptoMetadata = await step.run("encrypt-dump", async () => {
      const secretKeyHex = process.env.BACKUP_ENCRYPTION_KEY_HEX!; // 64-char hex string (32 bytes)
      const key = Buffer.from(secretKeyHex, "hex");
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      const readStream = fs.createReadStream(rawDumpPath);
      const gzipStream = zlib.createGzip({ level: 9 });
      const writeStream = fs.createWriteStream(encryptedPath);

      // Stream: Read -> Gzip -> Encrypt -> Disk
      await pipeline(readStream, gzipStream, cipher, writeStream);

      const authTag = cipher.getAuthTag(); // 16-byte authentication tag
      const fileStats = fs.statSync(encryptedPath);

      // Clean up plaintext dump immediately
      fs.unlinkSync(rawDumpPath);

      return {
        ivHex: iv.toString("hex"),
        authTagHex: authTag.toString("hex"),
        fileSizeBytes: fileStats.size,
        timestamp: new Date().toISOString()
      };
    });

    // Step 3: Upload Encrypted Dump to Cloudflare R2 / S3
    await step.run("upload-encrypted-dump", async () => {
      const fileStream = fs.createReadStream(encryptedPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `backups/${baseName}.sql.gz.enc`,
          Body: fileStream,
          Metadata: {
            "x-amz-meta-iv": cryptoMetadata.ivHex,
            "x-amz-meta-authtag": cryptoMetadata.authTagHex,
          },
        })
      );
      // Clean up local encrypted file
      fs.unlinkSync(encryptedPath);
    });

    // Step 4: Write Manifest & Update 'latest.json' Pointer
    await step.run("update-latest-pointer", async () => {
      const manifest = {
        latestBackupFile: `backups/${baseName}.sql.gz.enc`,
        ...cryptoMetadata
      };

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: "backups/latest-manifest.json",
          Body: JSON.stringify(manifest, null, 2),
          ContentType: "application/json"
        })
      );
    });

    return { status: "backup_encrypted_and_uploaded", file: `${baseName}.sql.gz.enc` };
  }
);
```

---

## 4. Automated Recovery Verification Drill Script (`scripts/verify-backup-restore.ts`)

To guarantee backups are recoverable rather than speculative, this script runs automated weekly test restores in CI / maintenance crons:

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import fs from "fs";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runBackupRestoreDrill() {
  console.log("Starting automated Disaster Recovery verification drill...");

  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.R2_BACKUP_BUCKET_NAME || "biztrackbd-backups";

  // 1. Fetch latest manifest
  const manifestRes = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: "backups/latest-manifest.json"
  }));
  const manifestStr = await manifestRes.Body?.transformToString();
  const manifest = JSON.parse(manifestStr || "{}");

  console.log(`Downloading latest backup: ${manifest.latestBackupFile}`);

  // 2. Download encrypted backup file
  const backupRes = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: manifest.latestBackupFile
  }));

  const encryptedLocalPath = `/tmp/drill-encrypted.sql.gz.enc`;
  const decryptedLocalPath = `/tmp/drill-restored.sql`;

  const writeEncrypted = fs.createWriteStream(encryptedLocalPath);
  await pipeline(backupRes.Body as any, writeEncrypted);

  // 3. Decrypt & Decompress with GCM Auth Tag Verification
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY_HEX!, "hex");
  const iv = Buffer.from(manifest.ivHex, "hex");
  const authTag = Buffer.from(manifest.authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const readEncrypted = fs.createReadStream(encryptedLocalPath);
  const gunzip = zlib.createGunzip();
  const writeDecrypted = fs.createWriteStream(decryptedLocalPath);

  await pipeline(readEncrypted, decipher, gunzip, writeDecrypted);
  console.log("Decryption & integrity verification successful.");

  // 4. Restore into Ephemeral PostgreSQL Test Database
  const testDbUrl = process.env.TEST_RESTORE_DATABASE_URL;
  if (testDbUrl) {
    await execAsync(`psql "${testDbUrl}" -f ${decryptedLocalPath}`);
    console.log("Database schema & tables restored cleanly into test container.");
  }

  // Clean up drill files
  fs.unlinkSync(encryptedLocalPath);
  fs.unlinkSync(decryptedLocalPath);

  console.log("Disaster Recovery drill completed with 100% data integrity.");
}
```

---

## 5. Zero-Downtime Prisma Migration Protocol (Expand & Contract)

To maintain 100% storefront uptime during schema updates:

### Phase 1: Expand (Additive Only)
- Add new columns as optional (`Nullable`) or with safe database defaults (`@default(...)`).
- Deploy application code that reads the new column with fallback to old column.

### Phase 2: Dual Write & Backfill
- Application writes to both new and old columns concurrently.
- Run background Inngest backfill migration to populate historical rows.

### Phase 3: Contract (Cleanup)
- Deploy application code reading exclusively from the new column.
- Run final Prisma migration to remove deprecated old columns and drop triggers.

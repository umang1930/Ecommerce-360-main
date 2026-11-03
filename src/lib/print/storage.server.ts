import { getSql } from "../dashboard/synced-orders.server";
import { printJobEventBus } from "./event-bus.server";
import type { PrintJob, PrintJobStatus } from "./types";

// In-memory fallback and fast-path cache
const memoryJobs = new Map<string, PrintJob>();

let schemaInitialized: Promise<void> | undefined;

async function ensurePrintJobsSchema(): Promise<void> {
  schemaInitialized ??= (async () => {
    try {
      const sql = await getSql();
      if (sql.dialect === "mysql") {
        await sql.query(`CREATE TABLE IF NOT EXISTS print_jobs (
          job_id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(191) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_reference VARCHAR(255) NOT NULL,
          file_size_bytes INT NOT NULL,
          submission_timestamp VARCHAR(40) NOT NULL,
          status VARCHAR(30) NOT NULL,
          final_result TEXT,
          error_info TEXT,
          provider VARCHAR(60) NOT NULL,
          provider_job_id VARCHAR(191),
          acknowledged TINYINT(1) NOT NULL DEFAULT 0,
          created_at VARCHAR(40) NOT NULL,
          updated_at VARCHAR(40) NOT NULL,
          INDEX idx_print_user (user_id),
          INDEX idx_print_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      } else {
        await sql.query(`CREATE TABLE IF NOT EXISTS print_jobs (
          job_id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(191) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_reference VARCHAR(255) NOT NULL,
          file_size_bytes INT NOT NULL,
          submission_timestamp VARCHAR(40) NOT NULL,
          status VARCHAR(30) NOT NULL,
          final_result TEXT,
          error_info TEXT,
          provider VARCHAR(60) NOT NULL,
          provider_job_id VARCHAR(191),
          acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
          created_at VARCHAR(40) NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        )`);
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_print_user ON print_jobs (user_id)`);
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_print_status ON print_jobs (status)`);
      }
    } catch (error) {
      console.warn("[Print Storage] DB schema init skipped or deferred, using memory store:", error);
    }
  })();

  return schemaInitialized;
}

export async function createPrintJob(job: PrintJob): Promise<PrintJob> {
  memoryJobs.set(job.jobId, job);
  printJobEventBus.emitJobUpdate(job);

  try {
    await ensurePrintJobsSchema();
    const sql = await getSql();
    if (sql.dialect === "mysql") {
      await sql.query(
        `INSERT INTO print_jobs (
          job_id, user_id, file_name, file_reference, file_size_bytes,
          submission_timestamp, status, final_result, error_info, provider,
          provider_job_id, acknowledged, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.jobId, job.userId, job.fileName, job.fileReference, job.fileSizeBytes,
          job.submissionTimestamp, job.status, job.finalResult, job.errorInfo, job.provider,
          job.providerJobId, job.acknowledged ? 1 : 0, job.createdAt, job.updatedAt,
        ]
      );
    } else {
      await sql.query(
        `INSERT INTO print_jobs (
          job_id, user_id, file_name, file_reference, file_size_bytes,
          submission_timestamp, status, final_result, error_info, provider,
          provider_job_id, acknowledged, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (job_id) DO UPDATE SET
          status = EXCLUDED.status,
          final_result = EXCLUDED.final_result,
          error_info = EXCLUDED.error_info,
          updated_at = EXCLUDED.updated_at`,
        [
          job.jobId, job.userId, job.fileName, job.fileReference, job.fileSizeBytes,
          job.submissionTimestamp, job.status, job.finalResult, job.errorInfo, job.provider,
          job.providerJobId, job.acknowledged, job.createdAt, job.updatedAt,
        ]
      );
    }
  } catch (error) {
    console.warn("[Print Storage] DB save failed, memory updated:", error);
  }

  return job;
}

export async function getPrintJob(jobId: string): Promise<PrintJob | null> {
  if (memoryJobs.has(jobId)) {
    return memoryJobs.get(jobId)!;
  }

  try {
    await ensurePrintJobsSchema();
    const sql = await getSql();
    const result = await sql.query(
      sql.dialect === "mysql"
        ? `SELECT * FROM print_jobs WHERE job_id = ? LIMIT 1`
        : `SELECT * FROM print_jobs WHERE job_id = $1 LIMIT 1`,
      [jobId]
    );

    if (result.rows.length > 0 && result.rows[0]) {
      const row = result.rows[0];
      const job: PrintJob = {
        jobId: String(row["job_id"]),
        userId: String(row["user_id"]),
        fileName: String(row["file_name"]),
        fileReference: String(row["file_reference"]),
        fileSizeBytes: Number(row["file_size_bytes"]),
        submissionTimestamp: String(row["submission_timestamp"]),
        status: row["status"] as PrintJobStatus,
        finalResult: row["final_result"] ? String(row["final_result"]) : null,
        errorInfo: row["error_info"] ? String(row["error_info"]) : null,
        provider: String(row["provider"]),
        providerJobId: row["provider_job_id"] ? String(row["provider_job_id"]) : null,
        acknowledged: Boolean(row["acknowledged"]),
        createdAt: String(row["created_at"]),
        updatedAt: String(row["updated_at"]),
      };
      memoryJobs.set(job.jobId, job);
      return job;
    }
  } catch (error) {
    console.warn("[Print Storage] DB getPrintJob error:", error);
  }

  return null;
}

export async function updatePrintJobStatus(
  jobId: string,
  update: {
    status: PrintJobStatus;
    finalResult?: string | null;
    errorInfo?: string | null;
    providerJobId?: string | null;
    provider?: string;
  }
): Promise<PrintJob | null> {
  const existing = await getPrintJob(jobId);
  const now = new Date().toISOString();

  if (!existing) {
    return null;
  }

  const updated: PrintJob = {
    ...existing,
    status: update.status,
    finalResult: update.finalResult !== undefined ? update.finalResult : existing.finalResult,
    errorInfo: update.errorInfo !== undefined ? update.errorInfo : existing.errorInfo,
    providerJobId: update.providerJobId !== undefined ? update.providerJobId : existing.providerJobId,
    provider: update.provider !== undefined ? update.provider : existing.provider,
    updatedAt: now,
  };

  memoryJobs.set(jobId, updated);
  printJobEventBus.emitJobUpdate(updated);

  try {
    await ensurePrintJobsSchema();
    const sql = await getSql();
    if (sql.dialect === "mysql") {
      await sql.query(
        `UPDATE print_jobs SET
          status = ?, final_result = ?, error_info = ?, provider_job_id = ?, provider = ?, updated_at = ?
         WHERE job_id = ?`,
        [
          updated.status,
          updated.finalResult,
          updated.errorInfo,
          updated.providerJobId,
          updated.provider,
          updated.updatedAt,
          jobId,
        ]
      );
    } else {
      await sql.query(
        `UPDATE print_jobs SET
          status = $1, final_result = $2, error_info = $3, provider_job_id = $4, provider = $5, updated_at = $6
         WHERE job_id = $7`,
        [
          updated.status,
          updated.finalResult,
          updated.errorInfo,
          updated.providerJobId,
          updated.provider,
          updated.updatedAt,
          jobId,
        ]
      );
    }
  } catch (error) {
    console.warn("[Print Storage] DB update error:", error);
  }

  return updated;
}

export async function getPrintJobsForUser(
  userId: string,
  unacknowledgedOnly = false
): Promise<PrintJob[]> {
  const jobs: PrintJob[] = [];

  // Check memory first
  for (const job of memoryJobs.values()) {
    if (job.userId === userId) {
      if (!unacknowledgedOnly || (!job.acknowledged && (job.status === "COMPLETED" || job.status === "FAILED"))) {
        jobs.push(job);
      }
    }
  }

  try {
    await ensurePrintJobsSchema();
    const sql = await getSql();
    const queryStr = sql.dialect === "mysql"
      ? unacknowledgedOnly
        ? `SELECT * FROM print_jobs WHERE user_id = ? AND acknowledged = 0 AND status IN ('COMPLETED', 'FAILED') ORDER BY created_at DESC LIMIT 50`
        : `SELECT * FROM print_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
      : unacknowledgedOnly
        ? `SELECT * FROM print_jobs WHERE user_id = $1 AND acknowledged = false AND status IN ('COMPLETED', 'FAILED') ORDER BY created_at DESC LIMIT 50`
        : `SELECT * FROM print_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`;

    const result = await sql.query(queryStr, [userId]);
    for (const row of result.rows) {
      if (!row) continue;
      const jobId = String(row["job_id"]);
      if (!jobs.some((j) => j.jobId === jobId)) {
        jobs.push({
          jobId,
          userId: String(row["user_id"]),
          fileName: String(row["file_name"]),
          fileReference: String(row["file_reference"]),
          fileSizeBytes: Number(row["file_size_bytes"]),
          submissionTimestamp: String(row["submission_timestamp"]),
          status: row["status"] as PrintJobStatus,
          finalResult: row["final_result"] ? String(row["final_result"]) : null,
          errorInfo: row["error_info"] ? String(row["error_info"]) : null,
          provider: String(row["provider"]),
          providerJobId: row["provider_job_id"] ? String(row["provider_job_id"]) : null,
          acknowledged: Boolean(row["acknowledged"]),
          createdAt: String(row["created_at"]),
          updatedAt: String(row["updated_at"]),
        });
      }
    }
  } catch (error) {
    console.warn("[Print Storage] DB getPrintJobsForUser error:", error);
  }

  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function acknowledgePrintJob(jobId: string, userId: string): Promise<boolean> {
  const job = await getPrintJob(jobId);
  if (!job || job.userId !== userId) {
    return false;
  }

  job.acknowledged = true;
  job.updatedAt = new Date().toISOString();
  memoryJobs.set(jobId, job);

  try {
    await ensurePrintJobsSchema();
    const sql = await getSql();
    if (sql.dialect === "mysql") {
      await sql.query(`UPDATE print_jobs SET acknowledged = 1, updated_at = ? WHERE job_id = ? AND user_id = ?`, [
        job.updatedAt,
        jobId,
        userId,
      ]);
    } else {
      await sql.query(`UPDATE print_jobs SET acknowledged = true, updated_at = $1 WHERE job_id = $2 AND user_id = $3`, [
        job.updatedAt,
        jobId,
        userId,
      ]);
    }
  } catch (error) {
    console.warn("[Print Storage] DB acknowledge error:", error);
  }

  return true;
}

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import type { InvoiceExtraction } from "./invoice-ocr";

type Row = Record<string, unknown>;
type Result = { rows: Row[]; insertId?: number; affectedRows?: number };
type Executor = (text: string, params?: unknown[]) => Promise<Result>;
type Database = { dialect: "postgres" | "mysql"; query: Executor };
let databasePromise: Promise<Database> | undefined;

function getDatabase(): Promise<Database> {
  databasePromise ??= (async () => {
    const connectionString = process.env["DATABASE_URL"] ?? process.env["POSTGRES_URL"] ?? process.env["NEON_DATABASE_URL"];
    if (process.env["NODE_ENV"] !== "production" && process.env["DB_HOST"]) {
      const { createPool } = await import("mysql2/promise");
      const pool = createPool({
        host: process.env["DB_HOST"], port: Number(process.env["DB_PORT"] ?? 3306),
        user: process.env["DB_USER"] ?? "root", password: process.env["DB_PASSWORD"] ?? "",
        database: process.env["DB_NAME"] ?? "ecommerce360_orders", connectionLimit: 5,
      });
      const database: Database = { dialect: "mysql", query: async (text: string, params: unknown[] = []) => {
        const [result] = await pool.query(text.replace(/\$(\d+)/g, "?"), params);
        if (Array.isArray(result)) return { rows: result as Row[], affectedRows: result.length };
        const header = result as { insertId?: number; affectedRows?: number };
        return { rows: [], ...(header.insertId !== undefined ? { insertId: header.insertId } : {}),
          ...(header.affectedRows !== undefined ? { affectedRows: header.affectedRows } : {}) };
      } };
      return database;
    }
    if (connectionString) {
      const client = neon(connectionString);
      const database: Database = { dialect: "postgres", query: async (text: string, params: unknown[] = []) => ({ rows: await client.query(text, params) as Row[] }) };
      return database;
    }
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Invoice storage needs a persistent database. Set DATABASE_URL in the deployment environment.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = resolve(process.cwd(), ".local-data", "invoice-files");
    await mkdir(dataDir, { recursive: true });
    const client = await PGlite.create(dataDir);
    const database: Database = { dialect: "postgres", query: async (text: string, params: unknown[] = []) => {
      const result = await client.query(text, params);
      return { rows: result.rows as Row[], ...(result.affectedRows !== undefined ? { affectedRows: result.affectedRows } : {}) };
    } };
    return database;
  })().catch((error) => { databasePromise = undefined; throw error; });
  return databasePromise!;
}

let schemaPromise: Promise<void> | undefined;
async function ensureSchema(db: Database) {
  schemaPromise ??= (async () => {
    if (db.dialect === "mysql") {
      await db.query(`CREATE TABLE IF NOT EXISTS uploaded_invoice_files (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, mime_type VARCHAR(127) NOT NULL,
        size_bytes BIGINT NOT NULL, category VARCHAR(16) NOT NULL, invoice_data JSON NULL,
        file_data LONGBLOB NOT NULL, uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY uploaded_invoice_category_idx (category, uploaded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } else {
      await db.query(`CREATE TABLE IF NOT EXISTS uploaded_invoice_files (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes BIGINT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('pdf', 'invoice')), invoice_data JSONB,
        file_data BYTEA NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await db.query("CREATE INDEX IF NOT EXISTS uploaded_invoice_category_idx ON uploaded_invoice_files (category, uploaded_at DESC)");
    }
  })().catch((error) => { schemaPromise = undefined; throw error; });
  await schemaPromise;
}

function safeInvoiceData(value: unknown): InvoiceExtraction | undefined {
  if (typeof value === "string") {
    try { return JSON.parse(value) as InvoiceExtraction; } catch { return undefined; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as InvoiceExtraction;
}

export async function listStoredInvoices(category: "pdf" | "invoice") {
  const db = await getDatabase(); await ensureSchema(db);
  const result = await db.query(`SELECT id, name, mime_type, size_bytes,
    category, invoice_data, uploaded_at
    FROM uploaded_invoice_files WHERE category = $1 ORDER BY uploaded_at DESC`, [category]);
  return result.rows.map((row) => ({
    id: row["id"], name: row["name"], type: row["mime_type"], size: Number(row["size_bytes"]),
    category: row["category"],
    uploadedAt: row["uploaded_at"] instanceof Date ? row["uploaded_at"].toISOString() : String(row["uploaded_at"]),
    invoiceData: safeInvoiceData(row["invoice_data"]),
  }));
}

export async function saveStoredInvoice(input: {
  id: string; name: string; type: string; category: "pdf" | "invoice";
  invoiceData?: InvoiceExtraction; bytes: Uint8Array;
}) {
  const db = await getDatabase(); await ensureSchema(db);
  const insert = db.dialect === "mysql" ? "INSERT IGNORE" : "INSERT";
  const conflict = db.dialect === "mysql" ? "" : " ON CONFLICT (id) DO NOTHING";
  await db.query(`${insert} INTO uploaded_invoice_files (id, name, mime_type, size_bytes, category, invoice_data, file_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7)${conflict}`, [input.id, input.name, input.type, input.bytes.byteLength,
    input.category, input.invoiceData ? JSON.stringify(input.invoiceData) : null, input.bytes]);
}

export async function readStoredInvoice(id: string) {
  const db = await getDatabase(); await ensureSchema(db);
  const result = await db.query("SELECT name, mime_type AS type, file_data AS data FROM uploaded_invoice_files WHERE id = $1", [id]);
  return result.rows[0];
}

export async function updateStoredInvoice(id: string, invoiceData: InvoiceExtraction) {
  const db = await getDatabase(); await ensureSchema(db);
  await db.query("UPDATE uploaded_invoice_files SET invoice_data = $2 WHERE id = $1 AND category = 'invoice'", [id, JSON.stringify(invoiceData)]);
}

export async function deleteStoredInvoice(id: string) {
  const db = await getDatabase(); await ensureSchema(db);
  await db.query("DELETE FROM uploaded_invoice_files WHERE id = $1", [id]);
}

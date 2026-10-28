import { neon } from "@neondatabase/serverless";
import { resolve } from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import { fetchAmazonOrders } from "./amazon-sp-api.server";
import { fetchFlipkartDeliveredOrders, fetchFlipkartOrders } from "./flipkart-seller-api.server";

type Seller = "claspo" | "monkeyman";
type Marketplace = "Amazon" | "Flipkart";

export interface SyncedOrder {
  marketplace: Marketplace;
  seller: Seller;
  orderId: string;
  orderItemId: string;
  sku: string;
  title: string;
  status: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  orderDate: string;
  dispatchByDate: string | null;
}

interface SyncedOrderRow extends SyncedOrder {
  id: number;
  syncedAt: string;
}

interface SyncRunRow {
  marketplace: string;
  seller: string;
  status: string;
  finishedAt: string | null;
  recordsReceived: number;
  errorMessage: string | null;
}

function toMysqlDate(value: string): string {
  return new Date(value).toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
}

function fromMysqlDate(value: unknown): string | null {
  if (typeof value !== "string") return value instanceof Date ? value.toISOString() : null;
  return `${value.replace(" ", "T")}Z`;
}

type SqlRows = Record<string, unknown>[];
type QueryResult = {
  rows: SqlRows;
  affectedRows?: number | undefined;
  insertId?: number | undefined;
};
type SqlClient = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRows>) & {
  dialect: "postgres" | "mysql";
  provider: "MariaDB" | "PostgreSQL" | "Local embedded PostgreSQL";
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

let sqlClientPromise: Promise<SqlClient> | undefined;

function getSql(): Promise<SqlClient> {
  sqlClientPromise ??= (async () => {
  const connectionString = process.env["DATABASE_URL"] ?? process.env["POSTGRES_URL"] ?? process.env["NEON_DATABASE_URL"];
  let dialect: SqlClient["dialect"];
  let provider: SqlClient["provider"];
  let execute: (text: string, params?: unknown[]) => Promise<QueryResult>;
  if (process.env["NODE_ENV"] !== "production" && process.env["DB_HOST"]) {
    const { createPool } = await import("mysql2/promise");
    const pool = createPool({
      host: process.env["DB_HOST"],
      port: Number(process.env["DB_PORT"] ?? 3306),
      user: process.env["DB_USER"] ?? "root",
      password: process.env["DB_PASSWORD"] ?? "",
      database: process.env["DB_NAME"] ?? "ecommerce360_orders",
      connectionLimit: 5,
      timezone: "Z",
      dateStrings: true,
    });
    pool.on("connection", (connection) => {
      void connection.query("SET time_zone = '+00:00'");
    });
    dialect = "mysql";
    provider = "MariaDB";
    execute = async (text, params = []) => {
      const mysqlText = text.replace(/\$(\d+)/g, "?");
      const [result] = await pool.query(mysqlText, params);
      if (Array.isArray(result)) return { rows: result as SqlRows, affectedRows: result.length };
      const header = result as { affectedRows?: number; insertId?: number };
      return { rows: [], affectedRows: header.affectedRows, insertId: header.insertId };
    };
  } else if (connectionString) {
    const client = neon(connectionString);
    dialect = "postgres";
    provider = "PostgreSQL";
    execute = async (text, params = []) => {
      const rows = await client.query(text, params) as SqlRows;
      return { rows, affectedRows: rows.length };
    };
  } else if (process.env["NODE_ENV"] !== "production") {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = resolve(process.cwd(), ".local-data", "synced-orders");
    await mkdir(dataDir, { recursive: true });
    const client = await PGlite.create(dataDir);
    dialect = "postgres";
    provider = "Local embedded PostgreSQL";
    execute = async (text, params = []) => {
      const result = await client.query(text, params);
      return { rows: result.rows as SqlRows, affectedRows: result.affectedRows };
    };
  } else {
    throw new Error("Set DATABASE_URL to connect PostgreSQL. Local development uses a file-backed database automatically.");
  }
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    values.forEach((value, index) => {
      text += `$${index + 1}${strings[index + 1] ?? ""}`;
    });
    return execute(text, values).then((result) => result.rows);
  };
  return Object.assign(tag, { query: execute, dialect, provider });
  })().catch((error) => {
    sqlClientPromise = undefined;
    throw error;
  });
  return sqlClientPromise;
}

let schemaReady: Promise<void> | undefined;
async function ensureSchema() {
  schemaReady ??= (async () => {
    const sql = await getSql();
    if (sql.dialect === "mysql") {
      await sql.query(`CREATE TABLE IF NOT EXISTS synced_orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        marketplace VARCHAR(20) NOT NULL,
        seller VARCHAR(20) NOT NULL,
        order_id VARCHAR(191) NOT NULL,
        order_item_id VARCHAR(191) NOT NULL,
        sku VARCHAR(255) NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        status VARCHAR(100) NOT NULL DEFAULT 'Unknown',
        quantity INT NOT NULL DEFAULT 0,
        total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'INR',
        order_date DATETIME(3) NOT NULL,
        dispatch_by_date DATETIME(3) NULL,
        synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        expires_at DATETIME(3) NOT NULL,
        UNIQUE KEY synced_orders_source_item_key (marketplace, seller, order_id, order_item_id),
        KEY synced_orders_date_idx (order_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const mysqlColumns = await sql.query(`SELECT COLUMN_NAME AS columnName
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'synced_orders'
          AND COLUMN_NAME IN ('created_at', 'updated_at')`);
      const existingMysqlColumns = new Set(mysqlColumns.rows.map((row) => String(row["columnName"])));
      if (!existingMysqlColumns.has("created_at")) {
        // Leave legacy creation times unknown; new rows will receive the default timestamp.
        await sql.query("ALTER TABLE synced_orders ADD COLUMN created_at DATETIME(3) NULL");
        await sql.query("ALTER TABLE synced_orders MODIFY COLUMN created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)");
      }
      if (!existingMysqlColumns.has("updated_at")) {
        await sql.query("ALTER TABLE synced_orders ADD COLUMN updated_at DATETIME(3) NULL");
      }
      // synced_at is the best available last-update timestamp for existing rows.
      await sql.query("UPDATE synced_orders SET updated_at = synced_at WHERE updated_at IS NULL");
      await sql.query("ALTER TABLE synced_orders MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)");
      await sql.query(`CREATE TABLE IF NOT EXISTS order_sync_runs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        marketplace VARCHAR(20) NOT NULL,
        seller VARCHAR(20) NOT NULL,
        started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        finished_at DATETIME(3) NULL,
        status VARCHAR(20) NOT NULL,
        records_received INT NOT NULL DEFAULT 0,
        records_saved INT NOT NULL DEFAULT 0,
        error_message TEXT NULL,
        KEY order_sync_runs_latest_idx (marketplace, seller, started_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      return;
    }
    await sql`CREATE TABLE IF NOT EXISTS synced_orders (
      id BIGSERIAL PRIMARY KEY,
      marketplace TEXT NOT NULL CHECK (marketplace IN ('Amazon', 'Flipkart')),
      seller TEXT NOT NULL CHECK (seller IN ('claspo', 'monkeyman')),
      order_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Unknown',
      quantity INTEGER NOT NULL DEFAULT 0,
      total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      order_date TIMESTAMPTZ NOT NULL,
      dispatch_by_date TIMESTAMPTZ,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`;
    await sql`ALTER TABLE synced_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`;
    await sql`ALTER TABLE synced_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;
    // Leave legacy creation times unknown; new rows will receive the default timestamp.
    await sql`UPDATE synced_orders SET updated_at = synced_at WHERE updated_at IS NULL`;
    await sql`ALTER TABLE synced_orders ALTER COLUMN created_at SET DEFAULT NOW()`;
    await sql`ALTER TABLE synced_orders ALTER COLUMN updated_at SET DEFAULT NOW()`;
    await sql`ALTER TABLE synced_orders ALTER COLUMN updated_at SET NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS synced_orders_source_item_key ON synced_orders (marketplace, seller, order_id, order_item_id)`;
    await sql`CREATE INDEX IF NOT EXISTS synced_orders_date_idx ON synced_orders (order_date DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS order_sync_runs (
      id BIGSERIAL PRIMARY KEY,
      marketplace TEXT NOT NULL,
      seller TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL,
      records_received INTEGER NOT NULL DEFAULT 0,
      records_saved INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    )`;
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

async function ensureDashboardUsersTable(sql: SqlClient) {
  if (sql.dialect === "mysql") {
    await sql.query(`CREATE TABLE IF NOT EXISTS dashboard_users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      google_sub VARCHAR(191) NOT NULL UNIQUE,
      email VARCHAR(320) NOT NULL UNIQUE,
      display_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_login_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const columns = await sql.query(`SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dashboard_users' AND COLUMN_NAME = 'password_hash'`);
    if (columns.rows.length === 0) await sql.query("ALTER TABLE dashboard_users ADD COLUMN password_hash VARCHAR(255) NULL");
    return;
  }

  await sql`CREATE TABLE IF NOT EXISTS dashboard_users (
    id BIGSERIAL PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
}

/** Create the dashboard user table on first successful Google sign-in and upsert the company account. */
export async function recordDashboardGoogleUser(user: { sub: string; email: string; name: string }) {
  const sql = await getSql();
  await ensureDashboardUsersTable(sql);
  if (sql.dialect === "mysql") {
    await sql.query(`INSERT INTO dashboard_users (google_sub, email, display_name, last_login_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE email=VALUES(email), display_name=VALUES(display_name), last_login_at=CURRENT_TIMESTAMP(3)`,
    [user.sub, user.email, user.name]);
    return;
  }
  await sql`INSERT INTO dashboard_users (google_sub, email, display_name, last_login_at)
    VALUES (${user.sub}, ${user.email}, ${user.name}, NOW())
    ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name, last_login_at=NOW()`;
}

export async function getDashboardPasswordUser(email: string) {
  const sql = await getSql();
  await ensureDashboardUsersTable(sql);
  const result = await sql.query("SELECT google_sub, display_name, password_hash FROM dashboard_users WHERE email = $1 LIMIT 1", [email]);
  const row = result.rows[0];
  if (!row || typeof row["google_sub"] !== "string" || typeof row["display_name"] !== "string") return null;
  return {
    googleSub: row["google_sub"],
    displayName: row["display_name"],
    passwordHash: typeof row["password_hash"] === "string" ? row["password_hash"] : null,
  };
}

export async function setDashboardPasswordHash(email: string, passwordHash: string) {
  const sql = await getSql();
  await ensureDashboardUsersTable(sql);
  if (sql.dialect === "mysql") {
    const result = await sql.query("UPDATE dashboard_users SET password_hash = $1, last_login_at = CURRENT_TIMESTAMP(3) WHERE email = $2", [passwordHash, email]);
    return (result.affectedRows ?? 0) > 0;
  }
  const result = await sql.query("UPDATE dashboard_users SET password_hash = $1, last_login_at = NOW() WHERE email = $2 RETURNING google_sub", [passwordHash, email]);
  return result.rows.length > 0;
}

async function saveOrders(orders: SyncedOrder[]) {
  const sql = await getSql();
  const uniqueOrders = [...new Map(orders.map((order) => [
    `${order.marketplace}|${order.seller}|${order.orderId}|${order.orderItemId}`,
    order,
  ])).values()];
  let saved = 0;
  // Keep each parameterized batch below conservative serverless query-size limits.
  for (let offset = 0; offset < uniqueOrders.length; offset += 40) {
    const batch = uniqueOrders.slice(offset, offset + 40);
    const values: unknown[] = [];
    const rows = batch.map((order) => {
      const base = values.length;
      values.push(
        order.marketplace, order.seller, order.orderId, order.orderItemId, order.sku,
        order.title, order.status, order.quantity, order.totalPrice, order.currency,
        sql.dialect === "mysql" ? toMysqlDate(order.orderDate) : order.orderDate,
        order.dispatchByDate && sql.dialect === "mysql" ? toMysqlDate(order.dispatchByDate) : order.dispatchByDate,
        sql.dialect === "mysql"
          ? toMysqlDate(new Date(Date.parse(order.orderDate) + 30 * 86400_000).toISOString())
          : new Date(Date.parse(order.orderDate) + 30 * 86400_000).toISOString(),
      );
      return `(${Array.from({ length: 13 }, (_, index) => `$${base + index + 1}`).join(", ")})`;
    });
    const upsert = sql.dialect === "mysql"
      ? `INSERT INTO synced_orders (marketplace, seller, order_id, order_item_id, sku, title, status, quantity, total_price, currency, order_date, dispatch_by_date, expires_at) VALUES ${rows.join(", ")} ON DUPLICATE KEY UPDATE sku=VALUES(sku), title=VALUES(title), status=VALUES(status), quantity=VALUES(quantity), total_price=VALUES(total_price), currency=VALUES(currency), order_date=VALUES(order_date), dispatch_by_date=VALUES(dispatch_by_date), synced_at=NOW(3), updated_at=NOW(3), expires_at=VALUES(expires_at)`
      : `INSERT INTO synced_orders (marketplace, seller, order_id, order_item_id, sku, title, status, quantity, total_price, currency, order_date, dispatch_by_date, expires_at) VALUES ${rows.join(", ")} ON CONFLICT (marketplace, seller, order_id, order_item_id) DO UPDATE SET sku=EXCLUDED.sku, title=EXCLUDED.title, status=EXCLUDED.status, quantity=EXCLUDED.quantity, total_price=EXCLUDED.total_price, currency=EXCLUDED.currency, order_date=EXCLUDED.order_date, dispatch_by_date=EXCLUDED.dispatch_by_date, synced_at=NOW(), updated_at=NOW(), expires_at=EXCLUDED.expires_at RETURNING id`;
    await sql.query(upsert, values);
    saved += batch.length;
  }
  return saved;
}

async function syncSeller(marketplace: Marketplace, seller: Seller, start: string, end: string) {
  const sql = await getSql();
  const runInsert = await sql.query(
    sql.dialect === "mysql"
      ? "INSERT INTO order_sync_runs (marketplace, seller, status) VALUES ($1, $2, 'running')"
      : "INSERT INTO order_sync_runs (marketplace, seller, status) VALUES ($1, $2, 'running') RETURNING id",
    [marketplace, seller],
  );
  const runId = sql.dialect === "mysql" ? runInsert.insertId : runInsert.rows[0]?.["id"];
  if (typeof runId !== "number") throw new Error("Could not create the order sync run record.");
  try {
    let orders: SyncedOrder[];
    if (marketplace === "Amazon") {
      const result = await fetchAmazonOrders({ data: {
        seller,
        createdAfter: `${start}T00:00:00+05:30`,
        createdBefore: end,
      } });
      if (!result.configured) {
        await sql`UPDATE order_sync_runs SET finished_at=NOW(), status='skipped', error_message='Credentials are not configured.' WHERE id=${runId}`;
        return { marketplace, seller, received: 0, saved: 0, skipped: true };
      }
      if (result.message) throw new Error(result.message);
      orders = result.orders.map((order, index) => ({
        marketplace, seller, orderId: order.orderId,
        orderItemId: order.orderItemId || `${order.sku || "item"}-${index}`,
        sku: order.sku, title: order.title, status: order.status, quantity: order.quantity,
        totalPrice: order.itemPrice, currency: order.currency, orderDate: order.orderDate,
        dispatchByDate: null,
      }));
    } else {
      const result = await fetchFlipkartOrders({ data: {
        seller, fromDate: `${start}T00:00:00+05:30`, toDate: end,
      } });
      if (!result.configured) {
        await sql`UPDATE order_sync_runs SET finished_at=NOW(), status='skipped', error_message='Credentials are not configured.' WHERE id=${runId}`;
        return { marketplace, seller, received: 0, saved: 0, skipped: true };
      }
      if (result.message) throw new Error(result.message);
      if (result.warning) throw new Error(result.warning);
      const delivered = await fetchFlipkartDeliveredOrders({ data: {
        seller, fromDate: `${start}T00:00:00+05:30`, toDate: end,
      } });
      if (!delivered.configured) throw new Error("Flipkart delivered shipments API is not configured.");
      if (delivered.message) throw new Error(delivered.message);
      if (delivered.warning) throw new Error(delivered.warning);
      // Prefer the delivered feed for overlapping items so their status is current.
      // Keep distinct items in the same order, using the database's identity key.
      const mergedOrders = [...new Map(
        [...result.orders, ...delivered.orders].map((order) => [
          `${order.orderId}|${order.orderItemId || order.sku || order.orderId}`,
          order,
        ]),
      ).values()];
      orders = mergedOrders.map((order) => ({
        marketplace, seller, orderId: order.orderId,
        orderItemId: order.orderItemId || order.sku || order.orderId,
        sku: order.sku, title: order.title, status: order.status, quantity: order.quantity,
        totalPrice: order.customerPrice, currency: "INR", orderDate: order.orderDate,
        dispatchByDate: order.dispatchByDate,
      }));
    }
    const validOrders = orders.filter((order) => order.orderId && order.orderItemId && Number.isFinite(Date.parse(order.orderDate)));
    const saved = await saveOrders(validOrders);
    await sql`UPDATE order_sync_runs SET finished_at=NOW(), status='success', records_received=${orders.length}, records_saved=${saved} WHERE id=${runId}`;
    return { marketplace, seller, received: orders.length, saved };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketplace sync failed.";
    await sql`UPDATE order_sync_runs SET finished_at=NOW(), status='failed', error_message=${message.slice(0, 1000)} WHERE id=${runId}`;
    throw new Error(`${marketplace} (${seller}): ${message}`);
  }
}

async function writeOrderSyncLog(message: string) {
  const line = `${new Date().toISOString()} [order-sync] ${message.replace(/[\r\n]+/g, " ")}\n`;
  console.info(line.trimEnd());
  // Hosted production jobs use platform logs; local runs also keep the file log.
  if (process.env["NODE_ENV"] === "production") return;
  try {
    const directory = resolve(process.cwd(), ".local-data");
    await mkdir(directory, { recursive: true });
    await appendFile(resolve(directory, "local-order-sync.log"), line, "utf8");
  } catch (error) {
    console.error("Could not write order sync log", error);
  }
}

/** Daily background sync, kept separate from the live dashboard fetch flow. */
export async function runDailyOrderSync() {
  await writeOrderSyncLog("Job started.");
  try {
    const result = await executeDailyOrderSync();
    for (const feed of result.results) {
      await writeOrderSyncLog(`${feed.marketplace} (${feed.seller}): ${feed.skipped ? "skipped (credentials missing)" : "success"}; received=${feed.received}, saved=${feed.saved}.`);
    }
    for (const error of result.errors) await writeOrderSyncLog(`Feed failed: ${error}`);
    await writeOrderSyncLog(result.errors.length ? "Job completed with errors." : "Job completed successfully.");
    return result;
  } catch (error) {
    await writeOrderSyncLog(`Job failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function executeDailyOrderSync() {
  await ensureSchema();
  const endDate = new Date(Date.now() - 5 * 60_000);
  const startDate = new Date(Date.now() - 30 * 86400_000);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString();
  const sql = await getSql();
  const feeds: [Marketplace, Seller][] = [
    ["Amazon", "claspo"], ["Amazon", "monkeyman"],
    ["Flipkart", "claspo"], ["Flipkart", "monkeyman"],
  ];
  const results = await Promise.allSettled(feeds.map(([marketplace, seller]) => syncSeller(marketplace, seller, start, end)));
  await sql`DELETE FROM synced_orders WHERE expires_at <= NOW()`;
  const errors = results.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : []);
  return {
    results: results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    errors,
  };
}

/** Unpaginated database source for dashboard aggregations; never calls marketplace APIs. */
export async function loadDashboardOrders(input: {
  start: string; end: string; brand: string; marketplace: string;
}): Promise<SyncedOrder[]> {
  await ensureSchema();
  const sql = await getSql();
  const start = new Date(`${input.start}T00:00:00+05:30`).toISOString();
  const end = new Date(`${input.end}T23:59:59.999+05:30`).toISOString();
  const values: unknown[] = [
    sql.dialect === "mysql" ? toMysqlDate(start) : start,
    sql.dialect === "mysql" ? toMysqlDate(end) : end,
  ];
  const conditions = ["expires_at > NOW()", "order_date >= $1", "order_date <= $2"];
  if (input.marketplace !== "all") {
    values.push(input.marketplace);
    conditions.push(`marketplace = $${values.length}`);
  }
  if (input.brand !== "all") {
    const seller = input.brand === "CLASPO" ? "claspo" : input.brand === "MONKEYMAN" ? "monkeyman" : null;
    if (!seller) return [];
    values.push(seller);
    conditions.push(`seller = $${values.length}`);
  }
  const rows = (await sql.query(
    `SELECT marketplace, seller, order_id, order_item_id, sku, title, status,
      quantity, total_price, currency, order_date, dispatch_by_date
     FROM synced_orders WHERE ${conditions.join(" AND ")}`,
    values,
  )).rows;
  const timestamp = (value: unknown) => sql.dialect === "mysql"
    ? fromMysqlDate(value)
    : value instanceof Date ? value.toISOString() : String(value);
  return rows.map((row) => ({
    marketplace: row["marketplace"] as Marketplace,
    seller: row["seller"] as Seller,
    orderId: String(row["order_id"]), orderItemId: String(row["order_item_id"]),
    sku: String(row["sku"] ?? ""), title: String(row["title"] ?? ""),
    status: String(row["status"] ?? ""), quantity: Number(row["quantity"]),
    totalPrice: Number(row["total_price"]), currency: String(row["currency"]),
    orderDate: timestamp(row["order_date"]) ?? "",
    dispatchByDate: row["dispatch_by_date"] == null ? null : timestamp(row["dispatch_by_date"]),
  }));
}

export async function listSyncedOrders(input: {
  page: number; pageSize: number; marketplace: string; seller: string; search: string;
}) {
  await ensureSchema();
  const sql = await getSql();
  const offset = (input.page - 1) * input.pageSize;
  const marketplace = input.marketplace === "all" ? null : input.marketplace;
  const seller = input.seller === "all" ? null : input.seller;
  const search = input.search.trim() ? `%${input.search.trim().replace(/[\\%_]/g, "\\$&")}%` : null;
  const conditions = ["expires_at > NOW()"];
  const whereValues: unknown[] = [];
  const addCondition = (condition: (parameter: string) => string, value: unknown) => {
    whereValues.push(value);
    conditions.push(condition(`$${whereValues.length}`));
  };
  if (marketplace) addCondition((parameter) => `marketplace = ${parameter}`, marketplace);
  if (seller) addCondition((parameter) => `seller = ${parameter}`, seller);
  if (search) {
    const orderParam = whereValues.push(search);
    const skuParam = whereValues.push(search);
    const titleParam = whereValues.push(search);
    conditions.push(`(LOWER(order_id) LIKE LOWER($${orderParam}) OR LOWER(sku) LIKE LOWER($${skuParam}) OR LOWER(title) LIKE LOWER($${titleParam}))`);
  }
  const where = conditions.join(" AND ");
  const [count] = (await sql.query(`SELECT COUNT(*) AS total FROM synced_orders WHERE ${where}`, whereValues)).rows;
  const pageSizeParam = whereValues.length + 1;
  const offsetParam = whereValues.length + 2;
  const columnAliases = sql.dialect === "mysql"
    ? "order_id AS orderId, order_item_id AS orderItemId, total_price AS totalPrice, order_date AS orderDate, dispatch_by_date AS dispatchByDate, synced_at AS syncedAt"
    : 'order_id AS "orderId", order_item_id AS "orderItemId", total_price AS "totalPrice", order_date AS "orderDate", dispatch_by_date AS "dispatchByDate", synced_at AS "syncedAt"';
  const runAliases = sql.dialect === "mysql"
    ? "finished_at AS finishedAt, records_received AS recordsReceived, error_message AS errorMessage"
    : 'finished_at AS "finishedAt", records_received AS "recordsReceived", error_message AS "errorMessage"';
  const orderRows = (await sql.query(
    `SELECT id, marketplace, seller, sku, title, status, quantity, currency, ${columnAliases}
    FROM synced_orders WHERE ${where}
    ORDER BY order_date DESC LIMIT $${pageSizeParam} OFFSET $${offsetParam}`,
    [...whereValues, input.pageSize, offset],
  )).rows;
  const runRows = (await sql.query(`SELECT r.marketplace, r.seller, r.status,
    ${runAliases}
    FROM order_sync_runs r JOIN (
      SELECT marketplace, seller, MAX(started_at) AS latest FROM order_sync_runs GROUP BY marketplace, seller
    ) latest ON latest.marketplace = r.marketplace AND latest.seller = r.seller AND latest.latest = r.started_at`)).rows;
  const rows = sql.dialect === "mysql" ? orderRows.map((row) => ({
    ...row,
    orderDate: fromMysqlDate(row["orderDate"]),
    dispatchByDate: fromMysqlDate(row["dispatchByDate"]),
    syncedAt: fromMysqlDate(row["syncedAt"]),
  })) : orderRows;
  const lastRuns = sql.dialect === "mysql" ? runRows.map((row) => ({ ...row, finishedAt: fromMysqlDate(row["finishedAt"]) })) : runRows;
  return {
    orders: rows as unknown as SyncedOrderRow[],
    total: Number(count?.["total"] ?? 0),
    page: input.page,
    pageSize: input.pageSize,
    lastRuns: lastRuns as unknown as SyncRunRow[],
    databaseProvider: sql.provider,
  };
}


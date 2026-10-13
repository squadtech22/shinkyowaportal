import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import * as seed from "./seed-data.mjs";
import { migrateStockStatus } from "./migrate-stock-status.mjs";

const fresh = process.argv.includes("--fresh");
const demo = process.argv.includes("--demo");
const removeDemo = process.argv.includes("--remove-demo");

// Same format as hashPassword() in src/lib/admin/password.ts.
function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  charset: "utf8mb4",
});

try {
  if (fresh) {
    console.log("Dropping tables...");
    await db.query(`SET FOREIGN_KEY_CHECKS = 0;
      DROP VIEW IF EXISTS website_stocks;
      DROP TABLE IF EXISTS customer_updates, commissions, commission_payouts, japan_payments, stock_expenses, stock_purchases, expense_types, auctions, inquiries, stocks, makes, body_types, categories, countries, currencies,
        contact_messages, newsletter_subscribers, settings, info_rows, payments, customer_accounts,
        admin_sessions, role_permissions, users, roles, client_sessions, shipments, shipment_stock,
        documents, points;
      SET FOREIGN_KEY_CHECKS = 1;`);
  }

  console.log("Creating tables...");
  await db.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  await migrate(db);

  // INSERT IGNORE skips names that already exist, so rerunning is safe.
  const lookup = async (table, columns, rows) => {
    if (!rows.length) return;
    const marks = rows.map(() => `(${columns.map(() => "?").join(", ")}, NOW(), NOW())`).join(", ");
    await db.query(
      `INSERT IGNORE INTO ${table} (${columns.join(", ")}, created_at, updated_at) VALUES ${marks}`,
      rows.flat(),
    );
  };
  await lookup("makes", ["name", "image"], seed.makes);
  await lookup("body_types", ["name"], seed.bodyTypes.map((n) => [n]));
  await lookup("categories", ["name"], seed.categories.map((n) => [n]));
  await lookup("countries", ["name"], seed.countries.map((n) => [n]));
  await lookup("currencies", ["symbol", "code"], seed.currencies);
  await lookup("settings", ["`key`", "value"], seed.settings);
  // Finance lists are seeded once; after that they are edited in Catalog lists.
  for (const [table, names] of [["auctions", seed.auctions], ["expense_types", seed.expenseTypes]]) {
    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
    if (n === 0) await lookup(table, ["name"], names.map((name) => [name]));
  }
  // Only seed a section that has no rows yet, so deleted rows stay deleted.
  for (const [section, rows] of Object.entries(seed.infoRows)) {
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM info_rows WHERE section = ?", [section]);
    if (n === 0) {
      await lookup("info_rows", ["section", "label", "value", "sort_order"],
        rows.map(([label, value], i) => [section, label, value, i + 1]));
    }
  }

  await seedRolesAndAdmin(db);

  // Sample vehicles are demo data too, so they only load with --demo.
  const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM stocks");
  if (!demo || removeDemo) {
    // Nothing to load.
  } else if (count > 0) {
    console.log(`stocks already has ${count} vehicles - sample vehicles not loaded.`);
  } else {
    const ids = async (table, key) => {
      const [rows] = await db.query(`SELECT id, ${key} AS k FROM ${table}`);
      return Object.fromEntries(rows.map((r) => [r.k, r.id]));
    };
    const makeId = await ids("makes", "name");
    const bodyId = await ids("body_types", "name");
    const categoryId = await ids("categories", "name");
    const countryId = await ids("countries", "name");
    const currencyId = await ids("currencies", "code");

    for (const v of seed.vehicles) {
      await db.query(
        `INSERT INTO stocks (sid, thumbnail, images, chassis, make_id, model, year, fob, currency_id, mileage,
           doors, transmission, body_type_id, fuel, category_id, country_id, engine, color, features,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          v.sid, v.thumbnail, JSON.stringify(v.images), v.chassis, makeId[v.make], v.model, v.year, v.fob,
          currencyId[v.currency], v.mileage, v.doors, v.transmission, bodyId[v.bodyType], v.fuel,
          categoryId[v.category], countryId[v.country], v.engine, v.color, JSON.stringify(v.features),
        ],
      );
    }
    console.log(`Loaded ${seed.vehicles.length} sample vehicles.`);
  }

  if (removeDemo) await unloadDemo(db);
  else if (demo) {
    await loadDemo(db);
    await loadDemoActivity(db);
  }

  console.log("Done.");
} finally {
  await db.end();
}

// Changes to tables created by earlier versions of this script.
async function migrate(db) {
  const exists = async (sql, params) => (await db.query(sql, params))[0].length > 0;
  const hasColumn = (table, column) =>
    exists(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [table, column],
    );
  const hasConstraint = (table, name) =>
    exists(
      "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
      [table, name],
    );

  for (const table of ["inquiries", "contact_messages"]) {
    if (!(await hasColumn(table, "status"))) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN status ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new' AFTER ip`);
    }
  }
  if (!(await hasColumn("users", "approval_status"))) {
    await db.query(`ALTER TABLE users
      ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER is_active,
      ADD COLUMN phone VARCHAR(30) NULL AFTER approval_status`);
    // Approving registrations is new: managers get it, as in the default roles.
    await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission)
      SELECT id, 'users.approve' FROM roles WHERE name = 'Manager'`);
  }
  if (!(await hasColumn("users", "dashboard_prefs"))) {
    await db.query("ALTER TABLE users ADD COLUMN dashboard_prefs TEXT NULL AFTER phone");
  }
  if (!(await hasColumn("users", "manager_id"))) {
    await db.query(`ALTER TABLE users ADD COLUMN manager_id BIGINT UNSIGNED NULL AFTER role_id,
      ADD CONSTRAINT users_manager_id_foreign FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL`);
  }
  if (!(await hasColumn("customer_accounts", "password"))) {
    await db.query(`ALTER TABLE customer_accounts ADD COLUMN password VARCHAR(255) NULL AFTER agent_id,
      ADD COLUMN last_login_at TIMESTAMP NULL AFTER password`);
  }
  // Shipments, documents and team view are new: give the existing default
  // roles the access they get on a fresh install. Runs once, keyed on the
  // Manager role not having shipments.view yet.
  const [[manager]] = await db.query("SELECT id FROM roles WHERE name = 'Manager'");
  const granted = manager && (await exists(
    "SELECT 1 FROM role_permissions WHERE role_id = ? AND permission = 'shipments.view'", [manager.id],
  ));
  if (manager && !granted) {
    const added = ["shipments.view", "shipments.manage", "documents.view", "documents.manage", "customers.view_team"];
    for (const role of seed.roles.filter((r) => !r.isSuper)) {
      for (const permission of role.permissions.filter((p) => added.includes(p))) {
        await db.query("INSERT IGNORE INTO role_permissions (role_id, permission) SELECT id, ? FROM roles WHERE name = ?", [
          permission, role.name,
        ]);
      }
    }
  }
  if (!(await hasColumn("stocks", "is_listed"))) {
    await db.query("ALTER TABLE stocks ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 1 AFTER agent_id");
  }
  await migrateStockStatus(db);
  if (!(await hasColumn("shipments", "method"))) {
    await db.query(`ALTER TABLE shipments ADD COLUMN method ENUM('roro', 'container') NOT NULL DEFAULT 'roro' AFTER vessel_name,
      ADD COLUMN container_no VARCHAR(100) NULL AFTER method,
      ADD COLUMN bl_no VARCHAR(100) NULL AFTER container_no`);
  }
  if (!(await hasColumn("shipments", "status"))) {
    await db.query("ALTER TABLE shipments ADD COLUMN status ENUM('upcoming', 'at_sea', 'arrived') NULL DEFAULT NULL AFTER eta");
    // Changing a shipment's status by hand is new: the default roles that
    // have it on a fresh install get it.
    for (const role of seed.roles.filter((r) => r.permissions.includes("shipments.status"))) {
      await db.query("INSERT IGNORE INTO role_permissions (role_id, permission) SELECT id, 'shipments.status' FROM roles WHERE name = ?", [
        role.name,
      ]);
    }
  }
  if (!(await hasColumn("payments", "pending_amount"))) {
    await db.query(`ALTER TABLE payments ADD COLUMN pending_amount INT NULL AFTER in_yen,
      ADD COLUMN pending_due_at DATETIME NULL AFTER pending_amount`);
  }
  if (!(await hasColumn("stocks", "created_by"))) {
    await db.query("ALTER TABLE stocks ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER agent_id");
    // Adding vehicles (hidden from the website) is new: the default roles that
    // have it on a fresh install get it.
    for (const role of seed.roles.filter((r) => r.permissions.includes("stock.add"))) {
      await db.query("INSERT IGNORE INTO role_permissions (role_id, permission) SELECT id, 'stock.add' FROM roles WHERE name = ?", [
        role.name,
      ]);
    }
  }
  // The public website reads vehicles through this view, so vehicles bought
  // for a customer (is_listed = 0) never show there. Recreated on every run
  // because SELECT * is fixed when the view is created.
  await db.query("CREATE OR REPLACE VIEW website_stocks AS SELECT * FROM stocks WHERE is_listed = 1");
  if (!(await hasConstraint("stocks", "stocks_customer_account_id_foreign"))) {
    await db.query(`ALTER TABLE stocks ADD CONSTRAINT stocks_customer_account_id_foreign
      FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id) ON DELETE SET NULL`);
  }
  if (!(await hasColumn("users", "commission_type"))) {
    await db.query(`ALTER TABLE users ADD COLUMN commission_type ENUM('percent', 'fixed') NULL AFTER dashboard_prefs,
      ADD COLUMN commission_value DECIMAL(12, 2) NULL AFTER commission_type`);
    // Team management is new: managers get it, as in the default roles.
    await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission)
      SELECT id, 'users.manage_team' FROM roles WHERE name = 'Manager'`);
  }
  // Commission became monthly (period + payouts). The first version's table
  // was never used for real, so an empty one is simply recreated.
  if (!(await hasColumn("commissions", "period"))) {
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM commissions");
    if (n > 0) throw new Error("commissions has rows from the old format; migrate them by hand.");
    await db.query("DROP TABLE commissions");
    await db.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  }
  if (!(await hasColumn("commissions", "period"))) {
    const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM commissions");
    if (n > 0) throw new Error("commissions has rows from the old format; migrate them by hand.");
    await db.query("DROP TABLE commissions");
    await db.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  }
  if (!(await hasColumn("users", "display_currency"))) {
    await db.query(`ALTER TABLE users ADD COLUMN display_currency ENUM('USD', 'PKR') NOT NULL DEFAULT 'USD' AFTER commission_value,
      ADD COLUMN theme ENUM('light', 'dark') NOT NULL DEFAULT 'light' AFTER display_currency`);
  }
  // Agents now upload their own customers' documents. Granted once (the
  // settings row marks it), so removing it in Roles & permissions sticks.
  if (!(await exists("SELECT 1 FROM settings WHERE `key` = 'migrated_agent_documents'"))) {
    await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission)
      SELECT id, 'documents.manage' FROM roles WHERE name = 'Agent'`);
    await db.query("INSERT INTO settings (`key`, value, created_at, updated_at) VALUES ('migrated_agent_documents', '1', NOW(), NOW())");
  }
  // Agents now put their own customers' vehicles on vessels and set the
  // shipment status. Granted once, like the documents above.
  if (!(await exists("SELECT 1 FROM settings WHERE `key` = 'migrated_agent_shipments'"))) {
    await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission)
      SELECT id, 'shipments.manage' FROM roles WHERE name = 'Agent'`);
    await db.query("INSERT INTO settings (`key`, value, created_at, updated_at) VALUES ('migrated_agent_shipments', '1', NOW(), NOW())");
  }
  // Payments: rejected ("not received"), balance payments linked to their
  // advance, and who reviewed them.
  if (!(await hasColumn("payments", "kind"))) {
    await db.query(`ALTER TABLE payments
      MODIFY status ENUM('approved', 'not approved', 'rejected') NOT NULL DEFAULT 'not approved',
      ADD COLUMN kind ENUM('advance', 'balance') NOT NULL DEFAULT 'advance' AFTER status,
      ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER kind,
      ADD COLUMN reject_reason VARCHAR(255) NULL AFTER parent_id,
      ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER reject_reason,
      ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by,
      ADD CONSTRAINT payments_parent_id_foreign FOREIGN KEY (parent_id) REFERENCES payments (id) ON DELETE CASCADE,
      ADD CONSTRAINT payments_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL`);
  }
  // Only the admin (Super Admin) approves payments now: the default Manager
  // role loses it. Done once, so granting it again in Roles & permissions sticks.
  if (!(await exists("SELECT 1 FROM settings WHERE `key` = 'migrated_admin_only_approval'"))) {
    await db.query(`DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
      WHERE r.name = 'Manager' AND rp.permission = 'payments.approve'`);
    await db.query("INSERT INTO settings (`key`, value, created_at, updated_at) VALUES ('migrated_admin_only_approval', '1', NOW(), NOW())");
  }
  if (!(await hasConstraint("stocks", "stocks_created_by_foreign"))) {
    await db.query(`ALTER TABLE stocks ADD CONSTRAINT stocks_created_by_foreign
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL`);
  }
  if (!(await hasConstraint("stocks", "stocks_agent_id_foreign"))) {
    await db.query(`ALTER TABLE stocks ADD CONSTRAINT stocks_agent_id_foreign
      FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE SET NULL`);
  }
}

async function seedRolesAndAdmin(db) {
  // Default roles are added once; edits made in the admin panel are kept.
  for (const role of seed.roles) {
    const [existing] = await db.query("SELECT id FROM roles WHERE name = ?", [role.name]);
    if (existing.length) continue;
    const [res] = await db.query(
      "INSERT INTO roles (name, description, is_super, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
      [role.name, role.description, role.isSuper ? 1 : 0],
    );
    for (const permission of role.permissions) {
      await db.query("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)", [res.insertId, permission]);
    }
    console.log(`Created role "${role.name}".`);
  }

  const [[{ users }]] = await db.query("SELECT COUNT(*) AS users FROM users");
  if (users > 0) return;
  const email = process.env.ADMIN_EMAIL || "admin@shinkyowa.com";
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const [[superRole]] = await db.query("SELECT id FROM roles WHERE is_super = 1 ORDER BY id LIMIT 1");
  await db.query(
    "INSERT INTO users (name, email, password, role_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())",
    ["Super Admin", email, hashPassword(password), superRole.id],
  );
  console.log("\n  Super Admin login created:");
  console.log(`    email:    ${email}`);
  console.log(`    password: ${process.env.ADMIN_PASSWORD ? "(ADMIN_PASSWORD from .env.local)" : password}`);
  console.log("  Change the password after signing in (Admin > My Profile).\n");
}

// Demo customers (cid DEMO-*), reserved vehicles and payments spread over the
// last six months, so the dashboard has something to show.
async function loadDemo(db) {
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM customer_accounts WHERE cid LIKE 'DEMO-%'");
  if (n > 0) return console.log("Demo data already loaded.");
  const id = async (sql, params) => (await db.query(sql, params))[0][0]?.id ?? null;
  const usd = await id("SELECT id FROM currencies WHERE code = 'USD'");
  const gbp = await id("SELECT id FROM currencies WHERE code = 'GBP'");
  const yenRate = { [usd]: 150, [gbp]: 190 };
  const [[admin]] = await db.query("SELECT id FROM users ORDER BY id LIMIT 1");
  const customers = [
    ["DEMO-1001", "James Mwangi", "Mwangi Motors Ltd", "Kenya", usd, "Nairobi"],
    ["DEMO-1002", "Andre Campbell", "Island Auto Imports", "Jamaica", usd, "Kingston"],
    ["DEMO-1003", "Oliver Bennett", "Bennett Cars UK", "UK", gbp, "Leeds"],
    ["DEMO-1004", "Asha Juma", "Juma Traders", "Tanzania", usd, "Dar es Salaam"],
  ];

  for (const [index, [cid, name, company, country, currency, city]] of customers.entries()) {
    const countryId = await id("SELECT id FROM countries WHERE name = ?", [country]);
    const [res] = await db.query(
      `INSERT INTO customer_accounts (cid, name, company, phone, whatsapp, address, city, country_id, email,
         currency_id, agent_id, created_at, updated_at)
       VALUES (?, ?, ?, '+000 000 0000', '+000 000 0000', 'Demo address', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [cid, name, company, city, countryId, `${cid.toLowerCase()}@example.com`, currency, admin.id],
    );
    const customerId = res.insertId;

    // Reserve two available vehicles; CNF (sale price) = FOB + 15%.
    const [cars] = await db.query(
      "SELECT id, fob FROM stocks WHERE customer_account_id IS NULL AND fob > 0 ORDER BY id LIMIT 2",
    );
    let owed = 0;
    for (const car of cars) {
      const cnf = Math.round(car.fob * 1.15);
      owed += cnf;
      await db.query("UPDATE stocks SET customer_account_id = ?, cnf = ?, agent_id = ? WHERE id = ?", [
        customerId, cnf, admin.id, car.id,
      ]);
    }

    // Three approved installments in different months, plus one pending TT.
    for (const [i, share] of [0.3, 0.25, 0.15].entries()) {
      const amount = Math.round(owed * share);
      const monthsAgo = (index + i * 2) % 6;
      await db.query(
        `INSERT INTO payments (stock_id, description, payment_date, amount, in_yen, payment_recieved_date,
           customer_account_id, status, user_id, created_at, updated_at)
         VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL ? MONTH), ?, ?, DATE_SUB(CURDATE(), INTERVAL ? MONTH), ?,
           'approved', ?, NOW(), NOW())`,
        [cars[0]?.id ?? null, `[demo] Installment ${i + 1}`, monthsAgo, amount, amount * yenRate[currency], monthsAgo,
          customerId, admin.id],
      );
    }
    const pending = Math.round(owed * 0.1);
    await db.query(
      `INSERT INTO payments (stock_id, description, payment_date, amount, in_yen, customer_account_id, status,
         user_id, created_at, updated_at)
       VALUES (?, '[demo] TT copy received', CURDATE(), ?, ?, ?, 'not approved', ?, NOW(), NOW())`,
      [cars[0]?.id ?? null, pending, pending * yenRate[currency], customerId, admin.id],
    );
  }
  console.log("Loaded demo customers, reservations and payments.");
}

// Demo activity for the dashboard charts: closed "[demo]" enquiries over the
// last 30 days and demo customers spread over past months.
async function loadDemoActivity(db) {
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM inquiries WHERE name LIKE '[demo]%'");
  if (n > 0) return;
  const [cars] = await db.query("SELECT id FROM stocks ORDER BY id LIMIT 12");
  const [[country]] = await db.query("SELECT id FROM countries ORDER BY id LIMIT 1");
  for (let day = 29; day >= 0; day--) {
    // A gentle weekly rhythm with growth towards today.
    const count = Math.max(0, Math.round(1 + (29 - day) / 10 + 2 * Math.sin(day / 1.3)));
    for (let i = 0; i < count; i++) {
      await db.query(
        `INSERT INTO inquiries (country_id, stock_id, name, email, phone, country, message, ip, status, created_at, updated_at)
         VALUES (?, ?, ?, 'demo@example.com', '+000', 'Demo', 'Demo enquiry', '0.0.0.0', 'closed',
           DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [country.id, cars[(day + i) % cars.length].id, `[demo] Buyer ${day}-${i}`, day, day],
      );
    }
  }
  const [customers] = await db.query("SELECT id FROM customer_accounts WHERE cid LIKE 'DEMO-%' ORDER BY id");
  for (const [i, c] of customers.entries()) {
    await db.query("UPDATE customer_accounts SET created_at = DATE_SUB(NOW(), INTERVAL ? MONTH) WHERE id = ?", [[7, 5, 2, 0][i % 4], c.id]);
  }
  console.log("Loaded demo dashboard activity.");
}

async function unloadDemo(db) {
  await db.query("DELETE FROM inquiries WHERE name LIKE '[demo]%'");
  const [cars] = await db.query(
    "SELECT s.id FROM stocks s JOIN customer_accounts c ON c.id = s.customer_account_id WHERE c.cid LIKE 'DEMO-%'",
  );
  if (cars.length) {
    await db.query("UPDATE stocks SET customer_account_id = NULL, cnf = NULL, agent_id = NULL WHERE id IN (?)", [
      cars.map((c) => c.id),
    ]);
  }
  await db.query(
    "DELETE p FROM payments p JOIN customer_accounts c ON c.id = p.customer_account_id WHERE c.cid LIKE 'DEMO-%'",
  );
  const [res] = await db.query("DELETE FROM customer_accounts WHERE cid LIKE 'DEMO-%'");
  console.log(`Removed ${res.affectedRows} demo customers with their reservations and payments.`);
  // Sample vehicles all use placehold.co images. Ones a real customer or
  // payment has since been attached to are kept.
  const [sample] = await db.query(
    `DELETE s FROM stocks s WHERE s.thumbnail LIKE 'https://placehold.co/%' AND s.customer_account_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.stock_id = s.id)`,
  );
  console.log(`Removed ${sample.affectedRows} sample vehicles.`);
}

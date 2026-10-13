import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

// Real server modules, isolated adapters: no MySQL connection or live data.
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name === "react") return { cache: (fn) => fn };
    return require(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const navigation = {
  redirect(url) { throw Object.assign(new Error(url), { redirect: url }); },
  unstable_rethrow(error) { if (error.redirect) throw error; },
};
const auth = load("src/lib/admin/auth.ts", {
  "next/headers": {}, "next/navigation": navigation, "@/lib/db": { db: {} },
  "./permissions": load("src/lib/admin/permissions.ts"),
});
const actions = load("src/lib/admin/actions.ts", {
  "next/navigation": navigation, "./auth": auth, "@/lib/uploads": { UploadError: class extends Error {} },
});
const user = { id: 7, isSuper: false, permissions: new Set(["payments.manage", "customers.manage", "stock.manage"]) };
const common = {
  "next/cache": { revalidatePath() {} }, "next/navigation": navigation,
  "@/lib/admin/actions": actions, "@/lib/admin/flash": { async setFlash() {} },
  "@/lib/admin/auth": { ...auth, authorize: async () => user },
  "@/lib/documents": load("src/lib/documents.ts"),
};
function paymentForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ customer_account_id: "2", description: "Deposit", payment_date: "2026-10-13", amount: "500", in_yen: "75000" })) form.set(key, value);
  return form;
}
for (const status of ["approved", "not approved"]) {
  test(`staff without approval rights ${status === "approved" ? "cannot change approved" : "can change pending"} payments`, async () => {
    let writes = 0;
    const payments = load("src/actions/admin/payments.ts", {
      ...common, "@/lib/db": { db: { async query(sql) {
        if (sql.startsWith("SELECT id, customer")) return [[{ id: 1, customer_account_id: 2, status, file: null }]];
        if (sql.startsWith("SELECT c.id")) return [[{ id: 2 }]];
        writes++;
        return [{ affectedRows: 1 }];
      } } }, "@/lib/uploads": { filesFrom: () => [] },
    });
    if (status === "approved") {
      const result = await payments.savePayment(1, null, paymentForm());
      assert.match(result.error, /permission/);
      assert.equal(writes, 0);
    } else {
      await assert.rejects(payments.savePayment(1, null, paymentForm()), (error) => error.redirect === "/admin/payments");
      assert.equal(writes, 1);
    }
  });
}
test("a payment approved during editing rejects the stale update and removes the new upload", async () => {
  const removed = [];
  const payments = load("src/actions/admin/payments.ts", {
    ...common, "@/lib/db": { db: { async query(sql) {
      if (sql.startsWith("SELECT id, customer")) return [[{ customer_account_id: 2, status: "not approved" }]];
      if (sql.startsWith("SELECT c.id")) return [[{ id: 2 }]];
      assert.match(sql, /status <> 'approved'/);
      return [{ affectedRows: 0 }];
    } } }, "@/lib/uploads": { filesFrom: () => [{}], saveUpload: async () => "new.pdf", deleteUpload: async (name) => removed.push(name) },
  });
  const result = await payments.savePayment(1, null, paymentForm());
  assert.match(result.error, /permission/);
  assert.deepEqual(removed, ["new.pdf"]);
});

for (const dependency of ["payments", "shipments", "documents", "commissions", null]) {
  test(`reservation release ${dependency ? `protects existing ${dependency}` : "removes points once and rejects a repeated release"}`, async () => {
    let customerId = 2;
    let points = 20;
    let locked = false;
    const conn = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async query(sql, params) {
        if (sql.startsWith("SELECT customer_account_id")) { locked = sql.includes("FOR UPDATE"); return [[{ customer_account_id: customerId }]]; }
        if (sql.startsWith("SELECT c.id")) return [[{ id: 2 }]];
        if (sql.startsWith("SELECT (SELECT COUNT")) return [[{ payments: 0, shipments: 0, documents: 0, commissions: 0, ...(dependency ? { [dependency]: 1 } : {}) }]];
        assert.equal(locked, true);
        if (sql.startsWith("UPDATE stocks")) customerId = null;
        if (sql.startsWith("UPDATE points")) points = Math.max(points - params[0], 0);
        return [{ affectedRows: 1 }];
      },
    };
    const customers = load("src/actions/admin/customers.ts", {
      ...common, "@/lib/admin/customers": { POINTS_PER_RESERVATION: 10 }, "@/lib/admin/password": {},
      "@/lib/db": { db: { getConnection: async () => conn, query: async () => { throw new Error("Release must reuse its transaction connection"); } } },
    });
    const first = await customers.releaseVehicle(10);
    if (dependency) {
      assert.match(first.error, /highlighted/);
      assert.match(first.fieldErrors.stock_id, /before releasing/);
      assert.equal(customerId, 2);
      assert.equal(points, 20);
    } else {
      assert.equal(first.ok, true);
      assert.equal(customerId, null);
      assert.equal(points, 10);
      assert.match((await customers.releaseVehicle(10)).fieldErrors.stock_id, /not reserved/);
      assert.equal(points, 10);
    }
  });
}

test("reservation release succeeds after removing every file from an existing paperwork row", async () => {
  let released = false;
  let removedPoints = 0;
  const documentKeys = common["@/lib/documents"].DOCUMENT_KEYS;
  const conn = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params) {
      if (sql.startsWith("SELECT customer_account_id")) return [[{ customer_account_id: 2 }]];
      if (sql.startsWith("SELECT c.id")) return [[{ id: 2 }]];
      if (sql.startsWith("SELECT (SELECT COUNT")) {
        // The row remains after its files are removed; only populated file columns count.
        for (const key of documentKeys) assert.ok(sql.includes(`NULLIF(${key}, '') IS NOT NULL`));
        return [[{ payments: 0, shipments: 0, documents: 0, commissions: 0 }]];
      }
      if (sql.startsWith("UPDATE stocks")) released = true;
      if (sql.startsWith("UPDATE points")) removedPoints += params[0];
      return [{ affectedRows: 1 }];
    },
  };
  const customers = load("src/actions/admin/customers.ts", {
    ...common, "@/lib/admin/customers": { POINTS_PER_RESERVATION: 10 }, "@/lib/admin/password": {},
    "@/lib/db": { db: { getConnection: async () => conn, query: async () => { throw new Error("Release must reuse its transaction connection"); } } },
  });
  assert.equal((await customers.releaseVehicle(10)).ok, true);
  assert.equal(released, true);
  assert.equal(removedPoints, 10);
});

for (const activity of ["cars", "payments", null]) {
  test(`customer currency changes ${activity ? `are blocked by existing ${activity}` : "are allowed before account activity"}`, async () => {
    let changed = false;
    const customers = load("src/actions/admin/customers.ts", {
      ...common, "@/lib/admin/auth": { ...common["@/lib/admin/auth"], assignableAgents: async () => null },
      "@/lib/admin/customers": {}, "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8 },
      "@/lib/db": { db: { async query(sql) {
        if (sql.startsWith("SELECT c.id")) return [[{ id: 2 }]];
        if (sql.includes("SELECT currency_id")) return [[{ currency_id: 1, cars: 0, payments: 0, ...(activity ? { [activity]: 1 } : {}) }]];
        changed = true;
        return [{ affectedRows: 1 }];
      } } },
    });
    const form = new FormData();
    form.set("name", "Customer");
    form.set("currency_id", "2");
    if (activity) {
      const result = await customers.saveCustomer(2, null, form);
      assert.match(result.fieldErrors.currency_id, /preserve/);
      assert.equal(changed, false);
    } else {
      await assert.rejects(customers.saveCustomer(2, null, form), (error) => error.redirect === "/admin/customers/2");
      assert.equal(changed, true);
    }
  });
}

test("a zero-percent purchase deposit is reported as zero instead of missing", async () => {
  const finance = load("src/lib/admin/finance.ts", {
    "./format": { isoDate: String },
    "@/lib/db": { db: { async query(sql) {
      if (sql.startsWith("SELECT stock_id, expense")) return [[]];
      return [[{ id: 1, sid: "1001", year: "2026", model: "Hilux", chassis: "VIN", cnf: 1000, exchange_rate: 150,
        currency: "USD", deposit_percent: 0, bought: 50000, paid: 0, deal_date: "2026-10-13", purchase_date: null,
        customer_id: 2, agent_id: 7, shipment_id: null, japan_paid: 0, is_listed: 1 }]];
    } } },
  });
  const [row] = await finance.ledger({ year: null });
  assert.equal(row.depositDue, 0);
});

test("a restricted import skips another agent's reservation and keeps new customers assigned to the importer", async () => {
  const writes = [];
  let nextId = 20;
  const conn = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params) {
      if (sql.startsWith("SELECT")) {
        if (sql.includes("FROM users")) { assert.match(sql, /AND id = \?/); assert.deepEqual(params, [7]); return [[{ id: 7, name: "Own staff" }]]; }
        if (sql.includes("FROM makes")) return [[{ id: 1, name: "TOYOTA" }]];
        if (sql.includes("FROM currencies")) return [[{ id: 1, code: "USD" }]];
        if (sql.includes("FROM customer_accounts")) { assert.match(sql, /WHERE c.agent_id = \?/); return [[]]; }
        if (sql.includes("FROM stocks s")) return [[{ id: 4, sid: "1004", chassis: "PRIVATE-4", customer_account_id: 9, customer: "Hidden customer", visible: 0 }]];
        return [[]];
      }
      writes.push({ sql, params });
      return [{ insertId: nextId++, affectedRows: 1 }];
    },
  };
  const importer = load("src/lib/admin/stock-import.ts", {
    "@/lib/db": { db: { getConnection: async () => conn } }, "./auth": auth, "./customers": { POINTS_PER_RESERVATION: 10 },
  });
  const parsed = importer.parseSheet({ name: "Import", rows: [
    { n: 1, cells: ["CHASSIS", "MAKE/MODEL", "COMPANY", "CSR"] },
    { n: 2, cells: ["PRIVATE-4", "TOYOTA HILUX", "Someone else", "Other staff"] },
    { n: 3, cells: ["NEW-5", "TOYOTA HILUX", "New buyer", "Other staff"] },
  ] });
  const result = await importer.runImport(parsed, { user, actorId: user.id, costs: false, shipments: false, commit: true, sheetName: "Import" });
  assert.equal(result.rows[0].action, "skip");
  assert.equal(result.rows[0].customer, null);
  assert.doesNotMatch(JSON.stringify(result), /Hidden customer/);
  const customer = writes.find((w) => w.sql.includes("INSERT INTO customer_accounts"));
  assert.equal(customer.params[5], 7);
  assert.equal(writes.filter((w) => w.sql.includes("INSERT INTO points")).length, 1);
  assert.equal(writes.filter((w) => w.sql.includes("INSERT INTO stocks")).length, 1);
});

for (const date of ["2026-02-31", "2025-02-29", "31/04/2026", "0000-01-01", "10000-01-01", "2024-02-29", "13/10/2026"]) {
  test(`stock import validates calendar and SQL date range for ${date}`, async () => {
    let storedDate;
    const conn = {
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async query(sql, params) {
        if (sql.startsWith("SELECT")) return [sql.includes("FROM currencies") ? [{ id: 1, code: "USD" }] : []];
        if (sql.includes("INSERT INTO stock_purchases")) storedDate = params[3];
        return [{ insertId: 1, affectedRows: 1 }];
      },
    };
    const importer = load("src/lib/admin/stock-import.ts", {
      "@/lib/db": { db: { getConnection: async () => conn } }, "./auth": auth, "./customers": { POINTS_PER_RESERVATION: 10 },
    });
    const parsed = importer.parseSheet({ name: "Import", rows: [
      { n: 1, cells: ["CHASSIS", "MODEL", "DATE"] }, { n: 2, cells: ["QA-1", "HILUX", date] },
    ] });
    const result = await importer.runImport(parsed, { user, actorId: user.id, costs: true, shipments: false, commit: true, sheetName: "Import" });
    const expected = { "2024-02-29": "2024-02-29", "13/10/2026": "2026-10-13" }[date] ?? null;
    assert.equal(storedDate, expected);
    assert.equal(result.rows[0].messages.includes("Invalid purchase date — date was not imported"), expected === null);
  });
}

for (const action of ["completePayout", "unapprovePayout"]) {
  test(`${action} rolls both financial records back if the second update fails`, async () => {
    let value = { payout: "approved", commission: "approved" };
    let snapshot;
    let rolledBack = false;
    const conn = {
      async beginTransaction() { snapshot = { ...value }; }, async commit() {},
      async rollback() { value = snapshot; rolledBack = true; }, release() {},
      async query(sql) {
        if (sql.startsWith("SELECT user_id")) return [[{ user_id: 7 }]];
        if (sql.startsWith("SELECT id FROM users")) { assert.match(sql, /FOR UPDATE/); return [[{ id: 7 }]]; }
        if (sql.startsWith("SELECT p.*")) { assert.match(sql, /FOR UPDATE/); return [[{ status: "approved", amount: 1000, period: "2026-10", name: "Staff" }]]; }
        if (action === "completePayout") {
          if (sql.startsWith("UPDATE commission_payouts")) value.payout = "paid";
          else throw Object.assign(new Error("Foreign key failure"), { code: "ER_ROW_IS_REFERENCED_2" });
        } else {
          if (sql.startsWith("UPDATE commissions")) value.commission = "pending";
          else throw Object.assign(new Error("Foreign key failure"), { code: "ER_ROW_IS_REFERENCED_2" });
        }
        return [{ affectedRows: 1 }];
      },
    };
    const commissions = load("src/actions/admin/commissions.ts", {
      ...common, "@/lib/db": { db: { getConnection: async () => conn } },
      "@/lib/admin/commissions": {}, "@/lib/admin/display": { getFormat: async () => ({ yen: String }) },
    });
    const result = action === "completePayout"
      ? await commissions.completePayout(1, null, new FormData()) : await commissions.unapprovePayout(1);
    assert.ok(result.error);
    assert.equal(rolledBack, true);
    assert.deepEqual(value, { payout: "approved", commission: "approved" });
  });
}

test("commission period lookup reuses a supplied transaction connection", async () => {
  const commissions = load("src/lib/admin/commissions.ts", {
    "./finance": {}, "@/lib/db": { db: { query: async () => { throw new Error("A transaction must not acquire another pooled connection"); } } },
  });
  const current = commissions.periodOf();
  const conn = { query: async () => [[{ period: current }, { period: commissions.shiftPeriod(current, 1) }]] };
  assert.equal(await commissions.openPeriodFor(7, conn), commissions.shiftPeriod(current, 2));
});

test("month approval snapshots the exact commission rows included in its payout", async () => {
  const writes = [];
  const conn = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params) {
      if (sql.startsWith("SELECT id FROM users")) return [[{ id: 7 }]];
      if (sql.startsWith("SELECT id, amount FROM commissions")) return [[{ id: 10, amount: 250 }, { id: 12, amount: 750 }]];
      if (sql.startsWith("SELECT id, status FROM commission_payouts")) return [[]];
      writes.push({ sql, params });
      return [{ insertId: 20, affectedRows: 1 }];
    },
  };
  const commissions = load("src/actions/admin/commissions.ts", {
    ...common, "@/lib/db": { db: { getConnection: async () => conn } },
    "@/lib/admin/commissions": { isPeriod: () => true, periodLabel: (p) => p }, "@/lib/admin/display": {},
  });
  assert.equal((await commissions.approveMonth(7, "2026-10")).ok, true);
  assert.equal(writes[0].params[2], 1000);
  assert.match(writes[1].sql, /WHERE id IN \(\?\)/);
  assert.deepEqual(writes[1].params, [20, [10, 12]]);
});

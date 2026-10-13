// Isolated regression checks: no database connection, server, or uploads are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loadTs(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(source, {
    module: testModule,
    exports: testModule.exports,
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name} in ${relative}`);
    },
    console: { error() {} },
    FormData,
    File,
    Buffer,
    URLSearchParams,
  }, { filename });
  return testModule.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const features = loadTs("src/lib/features.ts");
const data = loadTs("src/lib/data.ts");
const documents = loadTs("src/lib/documents.ts");
const site = loadTs("src/lib/site.ts");
let checks = 0;
async function check(label, test) {
  await test();
  checks += 1;
  console.log(`PASS ${label}`);
}

const stockQueries = [];
const stock = loadTs("src/lib/stock.ts", {
  "server-only": {},
  react: { cache: (fn) => fn },
  "./features": features,
  "./data": data,
  "./db": { db: { async query(sql, params) {
    stockQueries.push({ sql, params });
    return [/COUNT\(\*\)/.test(sql) ? [{ total: 24 }] : []];
  } } },
});

await check("All stock aliases do not filter by a nonexistent category", () => {
  for (const category of ["all", "ALL", "stock", "Stock"]) {
    assert.deepEqual(plain(stock.stockFilter({ category })), { sql: [], params: [] });
  }
  assert.deepEqual(plain(stock.stockFilter({ category: "Discounted" }).params), ["Discounted"]);
});
await check("Stock search escapes literal SQL wildcard characters", () => {
  assert.equal(stock.stockSearch("A%_\\B").params[0], "%A\\%\\_\\\\B%");
  assert.deepEqual(plain(stock.stockSearch("   ")), { sql: [], params: [] });
});
await check("Malformed pagination never produces a fractional or invalid SQL offset", async () => {
  for (const [input, expected] of [[1.5, 1], [-1, 1], [NaN, 1], [Infinity, 1], [999, 3], [2, 2]]) {
    const result = await stock.listStock({ sql: [], params: [] }, undefined, input);
    assert.equal(result.currentPage, expected);
    assert.equal(stockQueries.at(-1).params.at(-1), (expected - 1) * 8);
  }
});
await check("Related stock excludes the viewed vehicle", async () => {
  await stock.relatedStock({ category: "New Arrival", id: 7 });
  assert.match(stockQueries.at(-1).sql, /s\.id <> \?/);
  assert.deepEqual(plain(stockQueries.at(-1).params), ["New Arrival", 7]);
});
await check("Stock and make routes apply the filters displayed in their forms", async () => {
  const mocks = {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "@/components/StockPage": { __esModule: true, default: "StockPage", readQuery: async (query) => query },
    "@/lib/stock": stock,
    "@/lib/site": site,
  };
  const stockPage = loadTs("src/app/(site)/stock/page.tsx", mocks);
  const result = await stockPage.default({ searchParams: Promise.resolve({ make: "Toyota", model: "Hilux" }) });
  assert.deepEqual(plain(result.props.where.params), ["Toyota", "Hilux"]);
  const makePage = loadTs("src/app/(site)/make/[make]/page.tsx", mocks);
  const filtered = await makePage.default({ params: Promise.resolve({ make: "Alfa Romeo" }), searchParams: Promise.resolve({ model: "Giulia", make: "Wrong" }) });
  assert.deepEqual(plain(filtered.props.where.params), ["Alfa Romeo", "Giulia"]);
  assert.equal(filtered.props.basePath, "/make/Alfa%20Romeo");
});
await check("Body-type route keeps its own type when extra filter aliases are present", async () => {
  const typePage = loadTs("src/app/(site)/type/[type]/page.tsx", {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "@/components/StockPage": { __esModule: true, default: "StockPage", readQuery: async (query) => query },
    "@/lib/stock": stock,
    "@/lib/site": site,
  });
  const result = await typePage.default({ params: Promise.resolve({ type: "Mini Buses" }), searchParams: Promise.resolve({ bodyType: "Truck", fueltype: "diesel" }) });
  assert.deepEqual(plain(result.props.where.params), ["Mini Buses", "diesel"]);
  assert.equal(result.props.basePath, "/type/Mini%20Buses");
});

await check("Contact and newsletter reject invalid fields without writing to the database", async () => {
  const queries = [];
  const actions = loadTs("src/actions/site.ts", {
    "@/lib/db": { db: { async query(sql, params) { queries.push({ sql, params }); } } },
    "@/lib/request": { clientIp: async () => "127.0.0.1", isEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
  });
  const invalid = new FormData();
  invalid.set("email", "invalid");
  assert.equal((await actions.sendContactMessage(invalid)).ok, false);
  assert.equal((await actions.subscribeNewsletter(invalid)).ok, false);
  assert.equal(queries.length, 0);
  const valid = new FormData();
  valid.set("name", " QA visitor ");
  valid.set("email", " QA@Example.test ");
  valid.set("message", " Hello ");
  assert.equal((await actions.sendContactMessage(valid)).ok, true);
  assert.deepEqual(plain(queries.at(-1).params), ["QA visitor", "QA@Example.test", "Hello", "127.0.0.1"]);
  assert.equal((await actions.subscribeNewsletter(valid)).ok, true);
  assert.match(queries.at(-1).sql, /INSERT IGNORE INTO newsletter_subscribers/);
  assert.deepEqual(plain(queries.at(-1).params), ["qa@example.test"]);
});

class NotAllowedError extends Error {}
class UploadError extends Error {}
class RedirectError extends Error {}
const actionHelpers = loadTs("src/lib/admin/actions.ts", {
  "next/navigation": { unstable_rethrow(error) { if (error instanceof RedirectError) throw error; } },
  "./auth": { NotAllowedError },
  "@/lib/uploads": { UploadError },
});

function inquiryHarness({ fail = false, inquired = false, vehicle = true } = {}) {
  const calls = [];
  const action = loadTs("src/actions/inquiry.ts", {
    "@/lib/db": { db: { async query(sql, params) {
      calls.push({ sql, params });
      if (fail) throw new Error("Database unavailable");
      return [/SELECT id/.test(sql) ? [{ id: 1 }] : { insertId: 1 }];
    } } },
    "@/lib/inquiries": { ALREADY_SUBMITTED: "Already submitted", hasInquired: async () => inquired },
    "@/lib/request": { clientIp: async () => "127.0.0.1", isEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
    "@/lib/stock": { getVehicle: async () => vehicle ? { id: 1 } : undefined },
  });
  return { ...action, calls };
}
function inquiryForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ country_id: "1", stock_id: "1", name: "QA visitor", email: "qa@example.test", phone: "+123456789", country: "Pakistan", message: "Test inquiry", ...overrides })) form.set(key, value);
  return form;
}
await check("Invalid inquiry IDs are rejected before any database request", async () => {
  const action = inquiryHarness();
  assert.equal((await action.sendInquiry(null, inquiryForm({ country_id: "NaN" }))).ok, false);
  assert.equal((await action.sendInquiry(null, inquiryForm({ stock_id: "1.5" }))).ok, false);
  assert.equal(action.calls.length, 0);
});
await check("Successful inquiry persists the validated vehicle and visitor details", async () => {
  const action = inquiryHarness();
  assert.equal((await action.sendInquiry(null, inquiryForm())).ok, true);
  assert.match(action.calls.at(-1).sql, /INSERT INTO inquiries/);
  assert.deepEqual(plain(action.calls.at(-1).params.slice(0, 4)), [1, 1, "QA visitor", "qa@example.test"]);
});
await check("Duplicate and hidden-vehicle inquiries do not insert a new row", async () => {
  const duplicate = inquiryHarness({ inquired: true });
  assert.equal((await duplicate.sendInquiry(null, inquiryForm())).message, "Already submitted");
  assert.equal(duplicate.calls.length, 1);
  const hidden = inquiryHarness({ vehicle: false });
  assert.equal((await hidden.sendInquiry(null, inquiryForm())).ok, false);
  assert.equal(hidden.calls.length, 1);
});
await check("Inquiry database failure produces a retry message instead of an unhandled action error", async () => {
  const action = inquiryHarness({ fail: true });
  const result = await action.sendInquiry(null, inquiryForm());
  assert.equal(result.ok, false);
  assert.match(result.message, /try again/);
});

function stockForm({ finance = false, files = false } = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ sid: "1", make_id: "1", model: "QA", year: "2024", chassis: "QA-1234", body_type_id: "1", fuel: "petrol", transmission: "automatic", mileage: "0", engine: "1000", doors: "4", category_id: "1", currency_id: "1", fob: "100", is_listed: "on" })) form.set(key, value);
  if (finance) {
    form.set("finance", "1");
    form.set("deposit_percent", "50");
  }
  if (files) form.set("thumbnail", new File(["photo"], "qa.jpg", { type: "image/jpeg" }));
  return form;
}
function stockHarness({ failPurchase = false, failUpload = false, failWrite = false, failDelete = false, paperwork = false, reserved = false, allowed = true } = {}) {
  const events = [];
  const deleted = [];
  const existing = { thumbnail: "/uploads/stock/old-main.jpg", images: JSON.stringify(["/uploads/stock/old-gallery.jpg"]), customer_account_id: reserved ? 4 : null };
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async query(sql, params) {
      events.push({ sql, params });
      if (/SELECT thumbnail/.test(sql)) return [[existing]];
      if (/FROM documents/.test(sql)) return [paperwork ? [{ final_invoice: "documents/invoice.pdf", bl_copy: "documents/bl.pdf", english_export: null }] : []];
      if (failWrite && /UPDATE stocks/.test(sql)) throw new Error("Write failed");
      if (failPurchase && /INSERT INTO stock_purchases/.test(sql)) throw new Error("Purchase failed");
      if (failDelete && /DELETE FROM stocks/.test(sql)) throw new Error("Delete failed");
      return [{ insertId: 2 }];
    },
  };
  const action = loadTs("src/actions/admin/stock.ts", {
    "next/cache": { revalidatePath(path) { events.push(`revalidate:${path}`); } },
    "next/navigation": { redirect() { throw new RedirectError("redirect"); } },
    "@/lib/db": { db: { getConnection: async () => connection, query: async () => [[{ id: 1 }]] } },
    "@/lib/admin/actions": actionHelpers,
    "@/lib/admin/auth": { async authorize() { if (!allowed) throw new NotAllowedError("Denied"); return {}; }, can: () => true },
    "@/lib/admin/flash": { async setFlash() { events.push("flash"); } },
    "@/lib/admin/lookups": { FUELS: ["petrol"], TRANSMISSIONS: ["automatic"] },
    "@/lib/documents": documents,
    "@/lib/uploads": {
      filesFrom: (form, field) => form.getAll(field).filter((entry) => entry instanceof File && entry.size > 0),
      async saveUpload() { if (failUpload) throw new UploadError("Rejected"); return "stock/new.jpg"; },
      stockUploadUrl: (stored) => `/uploads/${stored}`,
      async deleteUpload(stored) { deleted.push(stored); events.push(`delete-file:${stored}`); },
    },
  });
  return { ...action, events, deleted };
}
await check("Stock updates ignore forged photo removals belonging to another vehicle", async () => {
  const action = stockHarness();
  const form = stockForm();
  form.set("remove_image", "/uploads/stock/someone-else.jpg");
  await assert.rejects(action.saveStock(1, null, form), RedirectError);
  assert.equal(action.deleted.length, 0);
  assert.ok(action.events.includes("commit"));
});
await check("Replacing a stock photo deletes the old photo only after commit", async () => {
  const action = stockHarness();
  await assert.rejects(action.saveStock(1, null, stockForm({ files: true })), RedirectError);
  assert.deepEqual(action.deleted, ["stock/old-main.jpg"]);
  assert.ok(action.events.indexOf("commit") < action.events.indexOf("flash"));
});
await check("Deposit-only purchase data is saved inside the stock transaction", async () => {
  const action = stockHarness();
  await assert.rejects(action.saveStock(1, null, stockForm({ finance: true })), RedirectError);
  assert.ok(action.events.some((event) => typeof event === "object" && /INSERT INTO stock_purchases/.test(event.sql)));
  assert.ok(action.events.includes("commit"));
});
await check("A failed purchase rolls back stock changes and cleans new uploads while keeping existing files", async () => {
  const action = stockHarness({ failPurchase: true });
  const result = await action.saveStock(1, null, stockForm({ finance: true, files: true }));
  assert.ok(result.error);
  assert.ok(action.events.includes("rollback"));
  assert.ok(action.events.includes("release"));
  assert.ok(!action.events.includes("commit"));
  assert.deepEqual(action.deleted, ["stock/new.jpg"]);
});
await check("A failed stock write also cleans new uploads without deleting old photos", async () => {
  const action = stockHarness({ failWrite: true });
  assert.ok((await action.saveStock(1, null, stockForm({ files: true }))).error);
  assert.deepEqual(action.deleted, ["stock/new.jpg"]);
});
await check("Deleting reserved stock is blocked under a row lock", async () => {
  const action = stockHarness({ reserved: true });
  const result = await action.deleteStock(1);
  assert.match(result.error, /reserved/);
  assert.ok(action.events.some((event) => typeof event === "object" && /FOR UPDATE/.test(event.sql)));
  assert.ok(!action.events.some((event) => typeof event === "object" && /DELETE FROM stocks/.test(event.sql)));
  assert.equal(action.deleted.length, 0);
});
await check("Deleting unreserved stock removes its private paperwork only after the transaction commits", async () => {
  const action = stockHarness({ paperwork: true });
  await assert.rejects(action.deleteStock(1), RedirectError);
  assert.deepEqual(action.deleted, ["stock/old-main.jpg", "stock/old-gallery.jpg", "documents/invoice.pdf", "documents/bl.pdf"]);
  const lockedDocuments = action.events.findIndex((event) => typeof event === "object" && /FROM documents.*FOR UPDATE/.test(event.sql));
  const deletedStock = action.events.findIndex((event) => typeof event === "object" && /DELETE FROM stocks/.test(event.sql));
  assert.ok(lockedDocuments >= 0 && lockedDocuments < deletedStock);
  assert.ok(action.events.indexOf("commit") < action.events.indexOf("delete-file:documents/invoice.pdf"));
});
await check("A failed stock deletion rolls back and preserves both photos and paperwork files", async () => {
  const action = stockHarness({ paperwork: true, failDelete: true });
  assert.ok((await action.deleteStock(1)).error);
  assert.ok(action.events.includes("rollback"));
  assert.ok(action.events.includes("release"));
  assert.ok(!action.events.includes("commit"));
  assert.equal(action.deleted.length, 0);
});
await check("Stock management rejects unauthorized callers before any transaction or upload", async () => {
  const action = stockHarness({ allowed: false });
  assert.equal((await action.saveStock(1, null, stockForm({ files: true }))).error, "Denied");
  assert.equal(action.events.length, 0);
});

function documentsHarness({ fail = false } = {}) {
  const deleted = [];
  const queries = [];
  const revalidated = [];
  const current = Object.fromEntries(documents.DOCUMENT_KEYS.map((key) => [key, `documents/old-${key}.pdf`]));
  const action = loadTs("src/actions/admin/documents.ts", {
    "next/cache": { revalidatePath(path) { revalidated.push(path); } },
    "@/lib/admin/actions": actionHelpers,
    "@/lib/admin/auth": { authorize: async () => ({}), NotAllowedError },
    "@/lib/admin/documents": { getVehicleDocuments: async () => current },
    "@/lib/admin/flash": { setFlash: async () => {} },
    "@/lib/documents": documents,
    "@/lib/db": { db: { async query(sql, params) { queries.push({ sql, params }); if (fail) throw new Error("Write failed"); } } },
    "@/lib/uploads": {
      filesFrom: (form, field) => form.getAll(field).filter((entry) => entry instanceof File && entry.size > 0),
      saveUpload: async () => "documents/new.pdf",
      deleteUpload: async (stored) => { deleted.push(stored); },
    },
  });
  return { ...action, deleted, queries, revalidated };
}
await check("A failed document database write removes the new upload and preserves existing paperwork", async () => {
  const action = documentsHarness({ fail: true });
  const form = new FormData();
  form.set("final_invoice", new File(["pdf"], "qa.pdf", { type: "application/pdf" }));
  assert.ok((await action.saveDocuments(1, null, form)).error);
  assert.deepEqual(action.deleted, ["documents/new.pdf"]);
});
await check("Document updates touch only changed columns and refresh the customer portal", async () => {
  const action = documentsHarness();
  const form = new FormData();
  form.set("final_invoice", new File(["pdf"], "qa.pdf", { type: "application/pdf" }));
  assert.equal((await action.saveDocuments(1, null, form)).ok, true);
  const updateClause = action.queries[0].sql.split("ON DUPLICATE KEY UPDATE")[1];
  assert.match(updateClause, /final_invoice = VALUES/);
  assert.doesNotMatch(updateClause, /english_export = VALUES/);
  assert.deepEqual(action.deleted, ["documents/old-final_invoice.pdf"]);
  assert.ok(action.revalidated.includes("/client"));
});

console.log(`\n${checks} public and stock/document regression checks passed. No database or storage was modified.`);

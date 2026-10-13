import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

// Exercise the real server modules with isolated request/database adapters.
// These checks do not connect to MySQL or change the developer's records.
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = readFileSync(resolve(file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  const dependency = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name === "react") return { cache: (fn) => fn };
    return require(name);
  };
  new Function("require", "module", "exports", code)(dependency, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const permissions = load("src/lib/admin/permissions.ts");
const navigation = {
  redirect(url) { throw Object.assign(new Error(url), { redirect: url }); },
  unstable_rethrow(error) { if (error.redirect) throw error; },
};
const baseAuth = load("src/lib/admin/auth.ts", {
  "next/headers": { cookies: async () => ({ get: () => undefined }) },
  "next/navigation": navigation,
  "@/lib/db": { db: {} },
  "./permissions": permissions,
});
class UploadError extends Error {}
const actions = load("src/lib/admin/actions.ts", {
  "next/navigation": navigation,
  "./auth": baseAuth,
  "@/lib/uploads": { UploadError },
});

function transactionalDb(query) {
  const connection = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
  return { getConnection: async () => connection, query };
}

for (const kind of ["admin", "client"]) {
  for (const hasCookie of [true, false]) {
    test(`${kind} session revocation ${hasCookie ? "preserves the current browser" : "revokes all owner sessions without a cookie"}`, async () => {
      const token = "current-session-token";
      const current = createHash("sha256").update(token).digest("hex");
      let sessions = [{ owner: 7, id: current }, { owner: 7, id: "other-browser" }, { owner: 8, id: "unrelated-user" }];
      const db = {
        async query(sql, params) {
          assert.match(sql, kind === "admin" ? /DELETE FROM admin_sessions/ : /DELETE FROM client_sessions/);
          sessions = sessions.filter((s) => s.owner !== params[0] || (sql.includes("id <>") && s.id === params[1]));
          return [{ affectedRows: 1 }];
        },
      };
      const auth = load(`src/lib/${kind}/auth.ts`, {
        "next/headers": { cookies: async () => ({ get: () => hasCookie ? { value: token } : undefined }) },
        "next/navigation": navigation,
        "@/lib/db": { db },
        "./permissions": permissions,
      });
      await auth[kind === "admin" ? "revokeOtherSessions" : "revokeOtherClientSessions"](7);
      assert.deepEqual(sessions, hasCookie
        ? [{ owner: 7, id: current }, { owner: 8, id: "unrelated-user" }]
        : [{ owner: 8, id: "unrelated-user" }]);
    });
  }
}

for (const kind of ["admin", "client"]) {
  for (const correctPassword of [true, false]) {
    test(`${kind} password action ${correctPassword ? "invalidates other sessions after saving" : "rejects an incorrect password without changing sessions"}`, async () => {
      const calls = [];
      const auth = {
        ...baseAuth,
        getCurrentUser: async () => ({ id: 7 }),
        getCurrentCustomer: async () => ({ id: 7 }),
        revokeOtherSessions: async (id) => calls.push(["revoke", id]),
        revokeOtherClientSessions: async (id) => calls.push(["revoke", id]),
      };
      const db = {
        async query(sql, params) {
          if (sql.startsWith("SELECT password")) return [[{ password: "stored" }]];
          calls.push(["save", params[1]]);
          return [{ affectedRows: 1 }];
        },
      };
      const password = { MIN_PASSWORD_LENGTH: 8, verifyPassword: async () => correctPassword, hashPassword: async () => "new-hash" };
      const action = load(kind === "admin" ? "src/actions/admin/profile.ts" : "src/actions/client/auth.ts", {
        "next/cache": { revalidatePath() {} },
        "next/navigation": navigation,
        "@/lib/db": { db },
        "@/lib/admin/actions": actions,
        "@/lib/admin/auth": auth,
        "@/lib/client/auth": auth,
        "@/lib/admin/password": password,
        "@/lib/admin/display": {},
        "@/lib/admin/format": {},
        "@/lib/request": {},
      });
      const form = new FormData();
      form.set("current_password", "current-password");
      form.set("new_password", "next-password");
      form.set("confirm_password", "next-password");
      const result = await action[kind === "admin" ? "changePassword" : "changeClientPassword"](null, form);
      if (correctPassword) {
        assert.equal(result.ok, true);
        assert.deepEqual(calls, [["save", 7], ["revoke", 7]]);
      } else {
        assert.ok(result.fieldErrors.current_password);
        assert.deepEqual(calls, []);
      }
    });
  }
}

test("concurrent registration with an already-inserted email returns a form error", async () => {
  const register = load("src/actions/admin/auth.ts", {
    "next/navigation": navigation,
    "@/lib/admin/actions": actions,
    "@/lib/admin/auth": { loginBlocked: () => false, recordLoginFailure() {} },
    "@/lib/db": { db: { async query(sql) {
      if (sql.startsWith("SELECT")) return [[]];
      throw Object.assign(new Error("Duplicate email"), { code: "ER_DUP_ENTRY" });
    } } },
    "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8, hashPassword: async () => "hash" },
    "@/lib/request": { clientIp: async () => "127.0.0.1", isEmail: () => true },
  }).register;
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "QA user", email: "qa@example.test", password: "password123", confirm_password: "password123" })) form.set(key, value);
  const result = await register(null, form);
  assert.match(result.error, /already in use/);
});

test("pending duplicate registration still redirects through the action error handler", async () => {
  const register = load("src/actions/admin/auth.ts", {
    "next/navigation": navigation,
    "@/lib/admin/actions": actions,
    "@/lib/admin/auth": { loginBlocked: () => false },
    "@/lib/db": { db: { query: async () => [[{ approval_status: "pending" }]] } },
    "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8 },
    "@/lib/request": { clientIp: async () => "127.0.0.1", isEmail: () => true },
  }).register;
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "QA user", email: "qa@example.test", password: "password123", confirm_password: "password123" })) form.set(key, value);
  await assert.rejects(register(null, form), (error) => error.redirect === "/admin/register/pending");
});

test("team agent options exclude disabled, pending, and rejected registrations", async () => {
  const staff = [
    { id: 7, name: "Manager", active: true, status: "approved", manager: null },
    { id: 8, name: "Agent", active: true, status: "approved", manager: 7 },
    { id: 9, name: "Pending", active: true, status: "pending", manager: 7 },
    { id: 10, name: "Rejected", active: true, status: "rejected", manager: 7 },
    { id: 11, name: "Disabled", active: false, status: "approved", manager: 7 },
    { id: 12, name: "Other team", active: true, status: "approved", manager: 13 },
  ];
  const auth = load("src/lib/admin/auth.ts", {
    "next/headers": {}, "next/navigation": navigation, "./permissions": permissions,
    "@/lib/db": { db: { async query(sql, params) {
      return [staff.filter((s) => s.active && (!sql.includes("approval_status = 'approved'") || s.status === "approved") && (s.id === params[0] || s.manager === params[1]))];
    } } },
  });
  const result = await auth.assignableAgents({ id: 7, isSuper: false, permissions: new Set(["customers.view_team"]) });
  assert.deepEqual(result, [{ id: 7, name: "Manager" }, { id: 8, name: "Agent" }]);
});

test("a pending Super Admin account cannot bypass the last active Super Admin safeguard", async () => {
  let deleted = false;
  const users = load("src/actions/admin/users.ts", {
    "next/cache": {}, "next/navigation": navigation, "@/lib/admin/actions": actions,
    "@/lib/admin/auth": { ...baseAuth, authorizeAny: async () => ({ id: 1, isSuper: true }) },
    "@/lib/admin/flash": {}, "@/lib/admin/password": {}, "@/lib/admin/roles": {},
    "@/lib/db": { db: transactionalDb(async (sql) => {
      if (sql.startsWith("SELECT role_id FROM users WHERE id = ?")) return [[{ role_id: 1 }]];
      if (sql === "SELECT is_super FROM roles WHERE id = ?") return [[{ is_super: 1 }]];
      if (sql.includes("COUNT(*) AS n FROM users")) return [[{ n: sql.includes("approval_status = 'approved'") ? 0 : 1 }]];
      if (sql.startsWith("DELETE")) deleted = true;
      return [[{ n: 0 }]];
    }) },
  });
  const result = await users.deleteUser(2);
  assert.match(result.error, /last active Super Admin/);
  assert.equal(deleted, false);
});

test("an inactive manager posted directly cannot be assigned to a user", async () => {
  let inserted = false;
  const users = load("src/actions/admin/users.ts", {
    "next/cache": {}, "next/navigation": navigation, "@/lib/admin/actions": actions,
    "@/lib/admin/auth": { ...baseAuth, authorizeAny: async () => ({ id: 1, isSuper: true }) },
    "@/lib/admin/flash": {}, "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8 },
    "@/lib/admin/roles": { canAssignRole: async () => true },
    "@/lib/db": { db: transactionalDb(async (sql) => {
      if (sql.startsWith("SELECT id FROM users")) return [sql.includes("is_active = 1") ? [] : [{ id: 9 }]];
      if (sql.startsWith("INSERT")) inserted = true;
      return [[]];
    }) },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "QA user", email: "qa@example.test", role_id: "1", manager_id: "9", password: "password123", is_active: "on" })) form.set(key, value);
  const result = await users.saveUser(null, null, form);
  assert.ok(result.fieldErrors.manager_id);
  assert.equal(inserted, false);
});

test("resetting your own password through Users also revokes other browsers", async () => {
  const revoked = [];
  const users = load("src/actions/admin/users.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": navigation, "@/lib/admin/actions": actions,
    "@/lib/admin/auth": { ...baseAuth, authorizeAny: async () => ({ id: 1, isSuper: true }), revokeOtherSessions: async (id) => revoked.push(id) },
    "@/lib/admin/flash": { setFlash: async () => {} },
    "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8, hashPassword: async () => "new-hash" },
    "@/lib/admin/roles": { canAssignRole: async () => true },
    "@/lib/db": { db: transactionalDb(async (sql) => {
      if (sql.startsWith("SELECT role_id FROM users WHERE id = ?")) return [[{ role_id: 1 }]];
      if (sql === "SELECT is_super FROM roles WHERE id = ?") return [[{ is_super: 1 }]];
      return [{ affectedRows: 1 }];
    }) },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "QA user", email: "qa@example.test", role_id: "1", password: "password123", is_active: "on" })) form.set(key, value);
  await assert.rejects(users.saveUser(1, null, form), (error) => error.redirect === "/admin/users");
  assert.deepEqual(revoked, [1]);
});

for (const mutation of ["delete", "demote", "disable"]) {
  test(`concurrent Super Admin ${mutation} requests retain one active approved Super Admin`, async () => {
    let users = new Map([[1, { role: 1, active: true }], [2, { role: 1, active: true }]]);
    let queue = Promise.resolve();
    const events = [];
    const db = {
      query() { assert.fail("User checks and writes must use their transaction connection"); },
      async getConnection() {
        let started = false;
        let locked = false;
        let local;
        let unlock;
        return {
          async beginTransaction() { started = true; events.push("begin"); },
          async query(sql, params = []) {
            assert.equal(started, true, "The guard must run inside a transaction");
            if (sql === "SELECT id FROM roles WHERE is_super = 1 ORDER BY id FOR UPDATE") {
              const previous = queue;
              queue = new Promise((resolve) => { unlock = resolve; });
              await previous;
              locked = true;
              local = new Map([...users].map(([id, user]) => [id, { ...user }]));
              events.push("lock");
              return [[{ id: 1 }]];
            }
            assert.equal(locked, true, "The shared Super Admin role must be locked before any read or write");
            if (sql === "SELECT is_super FROM roles WHERE id = ?") return [[{ is_super: params[0] === 1 ? 1 : 0 }]];
            if (sql.startsWith("SELECT role_id FROM users")) {
              assert.match(sql, /FOR UPDATE$/);
              const user = local.get(params[0]);
              return [user ? [{ role_id: user.role }] : []];
            }
            if (sql.includes("COUNT(*) AS n FROM users")) {
              assert.match(sql, /approval_status = 'approved'/);
              return [[{ n: [...local].filter(([id, user]) => id !== params[0] && user.role === 1 && user.active).length }]];
            }
            if (sql.includes("COUNT(*) AS n FROM commissions")) return [[{ n: 0 }]];
            if (sql === "DELETE FROM users WHERE id = ?") local.delete(params[0]);
            if (sql.startsWith("UPDATE users SET name")) local.set(params[5], { role: params[2], active: params[4] === 1 });
            return [{ affectedRows: 1 }];
          },
          async commit() { users = local; events.push("commit"); locked = false; unlock(); },
          async rollback() { events.push("rollback"); locked = false; unlock?.(); },
          release() { assert.equal(locked, false, "The transaction must finish before releasing its connection"); events.push("release"); },
        };
      },
    };
    const roleLibrary = load("src/lib/admin/roles.ts", {
      "./auth": baseAuth, "./permissions": permissions, "@/lib/db": { db },
    });
    const request = (actorId) => load("src/actions/admin/users.ts", {
      "next/cache": { revalidatePath() {} }, "next/navigation": navigation, "@/lib/admin/actions": actions,
      "@/lib/admin/auth": { ...baseAuth, authorizeAny: async () => ({ id: actorId, isSuper: true }) },
      "@/lib/admin/flash": { setFlash: async () => {} },
      "@/lib/admin/password": { MIN_PASSWORD_LENGTH: 8 },
      "@/lib/admin/roles": roleLibrary, "@/lib/db": { db },
    });
    const run = (actorId) => {
      const action = request(actorId);
      if (mutation === "delete") return action.deleteUser(actorId === 1 ? 2 : 1);
      const target = mutation === "demote" ? actorId : actorId === 1 ? 2 : 1;
      const form = new FormData();
      for (const [key, value] of Object.entries({ name: "QA Admin", email: `qa${target}@example.test`, role_id: mutation === "demote" ? "2" : "1" })) form.set(key, value);
      if (mutation === "demote") form.set("is_active", "on");
      return action.saveUser(target, null, form);
    };
    const results = await Promise.allSettled([run(1), run(2)]);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason.redirect === "/admin/users").length, 1);
    assert.equal(results.filter((result) => result.status === "fulfilled" && /last active Super Admin/.test(result.value.error)).length, 1);
    assert.equal([...users.values()].filter((user) => user.role === 1 && user.active).length, 1);
    assert.equal(events.filter((event) => event === "commit").length, 1);
    assert.equal(events.filter((event) => event === "rollback").length, 1);
    assert.equal(events.filter((event) => event === "release").length, 2);
  });
}

for (const scenario of [
  { name: "Super Admin may assign Super Admin", actor: { isSuper: true, permissions: [] }, superRole: 1, perms: [], allowed: true },
  { name: "staff cannot assign Super Admin", actor: { isSuper: false, permissions: ["users.manage"] }, superRole: 1, perms: [], allowed: false },
  { name: "staff cannot grant finance access they lack", actor: { isSuper: false, permissions: ["users.manage"] }, superRole: 0, perms: ["finance.view"], allowed: false },
  { name: "team managers cannot create other team managers", actor: { isSuper: false, permissions: ["users.manage_team"] }, superRole: 0, perms: ["users.manage_team"], allowed: false },
  { name: "team managers may assign roles within their permissions", actor: { isSuper: false, permissions: ["users.manage_team", "customers.view"] }, superRole: 0, perms: ["customers.view"], allowed: true },
]) {
  test(scenario.name, async () => {
    const roles = load("src/lib/admin/roles.ts", {
      "./auth": baseAuth, "./permissions": permissions,
      "@/lib/db": { db: { async query(sql) { return sql.includes("SELECT is_super") ? [[{ is_super: scenario.superRole }]] : [scenario.perms.map((permission) => ({ permission }))]; } } },
    });
    assert.equal(await roles.canAssignRole({ ...scenario.actor, permissions: new Set(scenario.actor.permissions) }, 1), scenario.allowed);
  });
}

// Live QA against a LOCAL running app. Creates uniquely tagged fixtures and removes them in finally.
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.node');
const root = process.cwd();
const production = process.argv.includes('--production');
const base = process.env.QA_BASE_URL || process.argv.find(arg => /^https?:\/\//.test(arg)) || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('QA requires a local server');
const tag = `qa-${Date.now()}-${randomBytes(3).toString('hex')}`;
const name = `[${tag}]`;
const password = `Qa-${randomBytes(18).toString('hex')}`;
const salt = randomBytes(16);
const hash = ['scrypt', 16384, 8, 1, salt.toString('base64url'), scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64url')].join('$');
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(x => x.trim() && !x.startsWith('#')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
const db = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME });
const users = [], customerIds = [], stockIds = [], shipmentIds = [], roleIds = [], uploaded = new Set();
let settingsSnapshot = [];
const results = [];
function check(label, pass, detail = '') { results.push({ label, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${detail ? ': ' + detail : ''}`); }
const fd = values => { const form = new FormData(); for (const [k, v] of Object.entries(values)) for (const entry of Array.isArray(v) ? v : [v]) if (entry != null) form.append(k, entry instanceof Blob ? entry : String(entry)); return form; };
const session = () => ({ cookies: new Map() });
async function request(url, jar, opts = {}) {
  const headers = { ...opts.headers };
  if (jar?.cookies.size) headers.Cookie = [...jar.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  const response = await fetch(base + url, { ...opts, headers, redirect: 'manual', signal: AbortSignal.timeout(90000) });
  for (const cookie of response.headers.getSetCookie()) { const first = cookie.split(';')[0]; const i = first.indexOf('='); if (jar) jar.cookies.set(first.slice(0, i), first.slice(i + 1)); }
  const body = await response.text();
  return { status: response.status, location: response.headers.get('location'), redirect: response.headers.get('x-action-redirect'), type: response.headers.get('content-type'), body };
}
async function action(url, jar, file, exportedName, args) {
  await request(url, jar);
  const manifest = JSON.parse(await readFile(production ? '.next/server/server-reference-manifest.json' : '.next/dev/server/server-reference-manifest.json', 'utf8'));
  const id = Object.entries(manifest.node).find(([, v]) => v.filename?.replaceAll('\\', '/') === file && v.exportedName === exportedName)?.[0];
  if (!id) throw new Error(`Action not compiled: ${file} ${exportedName}`);
  return request(url, jar, { method: 'POST', headers: { 'Next-Action': id, Origin: base }, body: await encodeReply(args) });
}
const success = r => r.status < 400 && (!!r.redirect || r.body.includes('"ok":true'));
const denied = r => r.body.includes('You do not have permission');
async function login(user, jar = session(), pass = password) { const r = await action('/admin/login', jar, 'src/actions/admin/auth.ts', 'login', [null, fd({ email: user.email, password: pass })]); check(`Login ${user.name}`, r.redirect?.startsWith('/admin;') || r.redirect === '/admin', r.status === 500 ? r.body.slice(0, 200) : ''); return jar; }
const pdf = () => new File([Buffer.from('%PDF-1.4\n% local QA document\n%%EOF')], 'qa.pdf', { type: 'application/pdf' });
const png = () => new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1EAAAAASUVORK5CYII=', 'base64')], 'qa.png', { type: 'image/png' });
let fatal;
try {
  const [roles] = await db.query('SELECT id,name,is_super FROM roles ORDER BY id');
  for (const role of roles) {
    const email = `${tag}.role${role.id}@example.invalid`;
    const [res] = await db.query('INSERT INTO users(name,email,password,role_id,created_at,updated_at) VALUES(?,?,?,?,NOW(),NOW())', [`${name} ${role.name}`, email, hash, role.id]);
    const [perms] = await db.query('SELECT permission FROM role_permissions WHERE role_id=?', [role.id]);
    users.push({ ...role, userId: res.insertId, email, permissions: new Set(perms.map(p => p.permission)) });
  }
  const superUser = users.find(u => u.is_super), agent = users.find(u => u.name === 'Agent'), leader = users.find(u => u.name === 'Team Leader');
  await db.query('UPDATE users SET manager_id=? WHERE id=?', [leader.userId, agent.userId]);
  const jars = new Map();
  for (const user of users) jars.set(user.name, await login(user));
  const admin = jars.get('Super Admin');
  let invalid = await action('/admin/login', null, 'src/actions/admin/auth.ts', 'login', [null, fd({ email: agent.email, password: 'wrong-password' })]);
  check('Invalid staff password rejected', invalid.body.includes('Incorrect email or password'));
  const publicUrls = ['/', '/stock', '/filter', '/filter?category=stock', '/stock-search?query=test', '/make/Toyota', '/type/SUV', '/country/Kenya', '/category/New%20Arrival', '/services/shipping', '/about-us/company-profile', '/about-us/why-choose-us', '/sales-and-bank-details', '/admin/login', '/admin/register', '/client/login'];
  for (const url of publicUrls) { const r = await request(url); check(`Public GET ${url}`, r.status === 200, `HTTP ${r.status}`); }
  check('Unknown URL returns 404', (await request('/qa-nonexistent-route')).status === 404);
  const matrix = [
    ['/admin', 'dashboard.view'], ['/admin/stock', 'stock.view'], ['/admin/stock/new', 'stock.manage'], ['/admin/stock-import', 'stock.manage'],
    ['/admin/customers', 'customers.view'], ['/admin/customers/new', 'customers.manage'], ['/admin/payments', 'payments.view'], ['/admin/payments/new', 'payments.manage'],
    ['/admin/reserved', 'customers.view'], ['/admin/shipments', 'shipments.view'], ['/admin/shipments/new', 'shipments.manage'], ['/admin/documents', 'documents.view'],
    ['/admin/inquiries', 'inquiries.view'], ['/admin/website', 'website.manage'], ['/admin/catalog', 'catalog.manage'], ['/admin/approvals', 'users.approve'],
    ['/admin/users', ['users.manage', 'users.manage_team']], ['/admin/users/new', ['users.manage', 'users.manage_team']], ['/admin/roles', 'roles.manage'], ['/admin/roles/new', 'roles.manage'],
    ['/admin/finance', 'finance.view'], ['/admin/finance/ledger', 'finance.view'], ['/admin/finance/japan-payments', 'finance.view'], ['/admin/finance/japan-payments/new', 'finance.manage'],
    ['/admin/commissions', ['commission.manage', 'commission.approve', 'commission.pay']], ['/admin/profile', null], ['/admin/my-commission', null],
  ];
  for (const user of users) for (const [url, permission] of matrix) {
    const expected = !!user.is_super || permission == null || (Array.isArray(permission) ? permission.some(p => user.permissions.has(p)) : user.permissions.has(permission));
    const r = await request(url, jars.get(user.name));
    const ownCommissionRedirect = url === '/admin/my-commission' && (user.is_super || user.permissions.has('commission.manage') || user.permissions.has('commission.approve')) && r.location === '/admin/commissions';
    check(`${user.name} GET ${url}`, expected ? r.status === 200 || ownCommissionRedirect : r.location === '/admin/no-access', `expected ${expected ? 'access' : 'denied'}, HTTP ${r.status}${r.location ? ' ' + r.location : ''}`);
  }
  for (const [url] of matrix) { const r = await request(url); check(`Signed out ${url}`, r.location === '/admin/login', `HTTP ${r.status}`); }
  const lookup = {};
  for (const table of ['makes', 'body_types', 'categories', 'countries', 'currencies', 'auctions', 'expense_types']) { const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`); lookup[table] = rows[0]?.id; }
  const stockValues = { sid: 900000000 + Math.floor(Math.random() * 9999999), make_id: lookup.makes, model: `${name} QA car`, year: 2024, chassis: `${tag}-CHASSIS`, body_type_id: lookup.body_types, fuel: 'petrol', transmission: 'automatic', mileage: 12000, engine: 1500, doors: 4, color: 'white', category_id: lookup.categories, country_id: lookup.countries, currency_id: lookup.currencies, fob: 10000, is_listed: 'on', finance: '1', auction_id: lookup.auctions, purchase_date: '2026-09-10', bought_price: 600000, exchange_rate: 150, [`expense_${lookup.expense_types}`]: 100000, thumbnail: png() };
  let r = await action('/admin/stock/new', admin, 'src/actions/admin/stock.ts', 'saveStock', [null, null, fd(stockValues)]);
  check('Stock create with photo and purchase costs', success(r), r.body.includes('error') && !r.redirect ? r.body.slice(0, 300) : '');
  const [[stock]] = await db.query('SELECT * FROM stocks WHERE chassis=?', [stockValues.chassis]);
  if (!stock) throw new Error('Stock fixture creation failed'); stockIds.push(stock.id);
  if (stock.thumbnail?.startsWith('/uploads/')) uploaded.add(stock.thumbnail.slice('/uploads/'.length));
  const [[purchase]] = await db.query('SELECT * FROM stock_purchases WHERE stock_id=?', [stock.id]);
  check('Purchase costs persisted', Number(purchase?.bought_price) === 600000 && Number(purchase?.exchange_rate) === 150);
  check('Uploaded stock image served', (await request(stock.thumbnail)).status === 200);
  for (const url of ['/stock', '/filter?category=stock', '/stock?page=1.5', `/stock-search?search=${encodeURIComponent(stockValues.chassis)}`, `/vehicle-info/${stock.id}`]) { const page = await request(url); check(`Stock view ${url}`, page.status === 200 && page.body.includes(stockValues.model), `HTTP ${page.status}`); }
  const [[facets]] = await db.query('SELECT m.name make,bt.name type,co.name country,cat.name category FROM stocks s JOIN makes m ON m.id=s.make_id JOIN body_types bt ON bt.id=s.body_type_id JOIN countries co ON co.id=s.country_id JOIN categories cat ON cat.id=s.category_id WHERE s.id=?', [stock.id]);
  for (const facet of ['make', 'type', 'country', 'category']) { const url = `/${facet}/${encodeURIComponent(facets[facet])}`; const page = await request(url); check(`Matching ${facet} route includes vehicle`, page.status === 200 && page.body.includes(`href="/vehicle-info/${stock.id}"`)); }
  for (const url of ['/stock?fueltype=diesel', '/filter?yearfrom=2025', '/stock?model=nonexistent-qa-model']) { const page = await request(url); check(`Filter excludes nonmatching vehicle ${url}`, page.status === 200 && !page.body.includes(`href="/vehicle-info/${stock.id}"`)); }
  r = await action(`/admin/stock/${stock.id}`, admin, 'src/actions/admin/stock.ts', 'saveStock', [stock.id, null, fd({ ...stockValues, thumbnail: new File(['invalid'], 'qa.html', { type: 'text/html' }) })]); check('Invalid stock upload type rejected', r.body.includes('file type not allowed'));
  r = await action(`/admin/stock/${stock.id}`, jars.get('Agent'), 'src/actions/admin/stock.ts', 'saveStock', [stock.id, null, fd({ ...stockValues, thumbnail: [] })]); check('Agent cannot edit stock', denied(r));
  r = await action(`/admin/stock/${stock.id}`, admin, 'src/actions/admin/stock.ts', 'saveStock', [stock.id, null, fd({ ...stockValues, thumbnail: [], is_listed: [] })]); check('Hide stock from public site', success(r));
  const hiddenDetail = await request(`/vehicle-info/${stock.id}`);
  check('Hidden vehicle renders not-found without exposing its details', (hiddenDetail.status === 404 || /name="robots" content="noindex"/.test(hiddenDetail.body)) && !hiddenDetail.body.includes(stockValues.chassis), `HTTP ${hiddenDetail.status}`);
  r = await action(`/admin/stock/${stock.id}`, admin, 'src/actions/admin/stock.ts', 'saveStock', [stock.id, null, fd({ ...stockValues, thumbnail: [] })]); check('Relist stock', success(r));
  check('Relisted vehicle is public again', (await request(`/vehicle-info/${stock.id}`)).status === 200);
  const customerValues = { name: `${name} Buyer A`, email: `${tag}.buyerA@example.invalid`, portal_password: password, currency_id: lookup.currencies, country_id: lookup.countries, agent_id: agent.userId };
  r = await action('/admin/customers/new', admin, 'src/actions/admin/customers.ts', 'saveCustomer', [null, null, fd(customerValues)]); check('Customer create with portal login', success(r));
  const [[customer]] = await db.query('SELECT * FROM customer_accounts WHERE email=?', [customerValues.email]); if (!customer) throw new Error('Customer fixture creation failed'); customerIds.push(customer.id);
  const [otherRes] = await db.query('INSERT INTO customer_accounts(cid,name,email,password,currency_id,agent_id,created_at,updated_at) VALUES(?,?,?,?,?,?,NOW(),NOW())', [tag + '-B', `${name} Buyer B`, `${tag}.buyerB@example.invalid`, hash, lookup.currencies, superUser.userId]); const otherId = otherRes.insertId; customerIds.push(otherId);
  check('Agent sees own customer', (await request(`/admin/customers/${customer.id}`, jars.get('Agent'))).status === 200);
  check('Agent cannot open other customer', (await request(`/admin/customers/${otherId}`, jars.get('Agent'))).status === 404);
  check('Team Leader sees subordinate customer', (await request(`/admin/customers/${customer.id}`, jars.get('Team Leader'))).status === 200);
  check('Team Leader cannot open outside-team customer', (await request(`/admin/customers/${otherId}`, jars.get('Team Leader'))).status === 404);
  r = await action(`/admin/customers/${otherId}/edit`, jars.get('Agent'), 'src/actions/admin/customers.ts', 'saveCustomer', [otherId, null, fd({ name: 'forged', currency_id: lookup.currencies })]); check('Agent cannot mutate another customer', denied(r));
  r = await action(`/admin/customers/${customer.id}`, jars.get('Agent'), 'src/actions/admin/customers.ts', 'reserveVehicle', [customer.id, null, fd({ stock_id: stock.id, cnf: 12000 })]); check('Reserve vehicle', success(r));
  const [[points]] = await db.query('SELECT points FROM points WHERE customer_account_id=?', [customer.id]); check('Reservation awards exactly 10 points', Number(points?.points) === 10);
  r = await action(`/admin/customers/${customer.id}`, jars.get('Agent'), 'src/actions/admin/customers.ts', 'reserveVehicle', [customer.id, null, fd({ stock_id: stock.id, cnf: 12000 })]); check('Duplicate reservation rejected', r.body.includes('just reserved'));
  const paymentValues = { customer_account_id: customer.id, stock_id: stock.id, description: `${name} TT`, payment_date: '2026-10-13', amount: 12000, in_yen: 1800000, file: pdf() };
  r = await action('/admin/payments/new', jars.get('Agent'), 'src/actions/admin/payments.ts', 'savePayment', [null, null, fd(paymentValues)]); check('Agent records pending payment with TT upload', success(r));
  const [[payment]] = await db.query('SELECT * FROM payments WHERE customer_account_id=? ORDER BY id DESC', [customer.id]); if (!payment) throw new Error('Payment creation failed'); if (payment.file) uploaded.add(payment.file);
  check('Agent payment requires approval', payment.status === 'not approved');
  r = await action(`/admin/payments/${payment.id}`, jars.get('Agent'), 'src/actions/admin/payments.ts', 'approvePayment', [payment.id]); check('Agent cannot approve payment', denied(r));
  r = await action(`/admin/payments/${payment.id}`, jars.get('Manager'), 'src/actions/admin/payments.ts', 'approvePayment', [payment.id]); check('Manager approves payment', success(r));
  r = await action(`/admin/payments/${payment.id}`, jars.get('Agent'), 'src/actions/admin/payments.ts', 'savePayment', [payment.id, null, fd({ ...paymentValues, amount: 1, file: [] })]); check('Agent cannot change approved amount', denied(r));
  const [[approved]] = await db.query('SELECT amount,status FROM payments WHERE id=?', [payment.id]); check('Approved amount preserved', Number(approved.amount) === 12000 && approved.status === 'approved');
  r = await action(`/admin/customers/${customer.id}`, jars.get('Agent'), 'src/actions/admin/customers.ts', 'releaseVehicle', [stock.id]); check('Paid reservation cannot be released accidentally', r.body.includes('payment') || r.body.includes('Payment'));
  r = await action('/admin/shipments/new', admin, 'src/actions/admin/shipments.ts', 'saveShipment', [null, null, fd({ vessel_name: `${name} QA Vessel`, method: 'roro', etd: '2026-10-14', eta: '2026-11-14', stock_ids: stock.id })]); check('Shipment create and vehicle attachment', success(r));
  const [[shipment]] = await db.query('SELECT id FROM shipments WHERE vessel_name=?', [`${name} QA Vessel`]); if (shipment) shipmentIds.push(shipment.id);
  check('Fully paid shipped vehicle shows cleared in stock status', (await request(`/admin/stock?status=cleared`, admin)).body.includes(stockValues.chassis));
  r = await action(`/admin/documents/${stock.id}`, admin, 'src/actions/admin/documents.ts', 'saveDocuments', [stock.id, null, fd({ final_invoice: pdf() })]); check('Export document upload', success(r));
  const [[doc]] = await db.query('SELECT final_invoice FROM documents WHERE stock_id=?', [stock.id]); if (doc?.final_invoice) uploaded.add(doc.final_invoice);
  for (const [label, url, jar, expected] of [['Staff own TT', `/admin/files/${payment.file}`, jars.get('Agent'), 200], ['Staff invoice', `/admin/files/${doc.final_invoice}`, admin, 200], ['Anonymous TT', `/admin/files/${payment.file}`, null, 403], ['Anonymous invoice', `/admin/files/${doc.final_invoice}`, null, 403]]) { const file = await request(url, jar); check(label, file.status === expected, `HTTP ${file.status}`); }
  const client = session(); r = await action('/client/login', client, 'src/actions/client/auth.ts', 'clientLogin', [null, fd({ email: customer.email, password })]); check('Customer portal login', r.redirect?.startsWith('/client'));
  r = await request('/client', client); check('Portal displays own reserved car, payment and vessel', r.status === 200 && r.body.includes(stockValues.model) && r.body.includes('QA Vessel') && !r.body.includes('Buyer B'));
  check('Customer downloads own invoice', (await request(`/client/files/${doc.final_invoice}`, client)).status === 200);
  check('Customer downloads own TT', (await request(`/client/files/${payment.file}`, client)).status === 200);
  check('Customer session cannot enter admin', (await request('/admin', client)).location === '/admin/login');
  check('Staff session cannot enter client portal', (await request('/client', admin)).location === '/client/login');
  const buyerB = session(); await action('/client/login', buyerB, 'src/actions/client/auth.ts', 'clientLogin', [null, fd({ email: `${tag}.buyerB@example.invalid`, password })]);
  check('Other customer cannot download invoice', (await request(`/client/files/${doc.final_invoice}`, buyerB)).status === 404);
  check('Other customer cannot download TT', (await request(`/client/files/${payment.file}`, buyerB)).status === 404);
  check('Outside-team staff cannot download TT', (await request(`/admin/files/${payment.file}`, jars.get('Finance Manager'))).status === 404);
  check('Print customer statement', (await request(`/admin/statement/${customer.id}`, jars.get('Agent'))).status === 200);
  check('Other-customer statement blocked', (await request(`/admin/statement/${otherId}`, jars.get('Agent'))).status === 404);
  r = await action('/', null, 'src/actions/site.ts', 'sendContactMessage', [fd({ name, email: `${tag}@example.invalid`, message: 'Temporary local QA inquiry' })]); check('Contact form stores message', success(r));
  r = await action('/', null, 'src/actions/site.ts', 'subscribeNewsletter', [fd({ email: `${tag}@example.invalid` })]); check('Newsletter subscribe', success(r));
  await action('/', null, 'src/actions/site.ts', 'subscribeNewsletter', [fd({ email: `${tag}@example.invalid` })]); const [[count]] = await db.query('SELECT COUNT(*) n FROM newsletter_subscribers WHERE email=?', [`${tag}@example.invalid`]); check('Duplicate newsletter is idempotent', Number(count.n) === 1);
  r = await action(`/vehicle-info/${stock.id}`, null, 'src/actions/inquiry.ts', 'sendInquiry', [null, fd({ stock_id: stock.id, country_id: lookup.countries, name, email: `${tag}@example.invalid`, phone: '+123456789', country: 'Japan', message: 'Local QA vehicle inquiry' })]); check('Vehicle inquiry stores valid submission', success(r));
  r = await action(`/vehicle-info/${stock.id}`, null, 'src/actions/inquiry.ts', 'sendInquiry', [null, fd({ stock_id: stock.id, country_id: lookup.countries, name, email: `${tag}@example.invalid`, phone: '+123456789', country: 'Japan', message: 'Local QA duplicate' })]); const [[inq]] = await db.query('SELECT COUNT(*) n FROM inquiries WHERE stock_id=?', [stock.id]); check('Duplicate vehicle enquiry suppressed', Number(inq.n) === 1);
  for (const url of ['/admin/finance/ledger.csv', '/admin/inquiries/subscribers.csv', '/admin/stock-import/template.xlsx']) { r = await request(url, admin); check(`Export ${url}`, r.status === 200, `${r.status} ${r.type}`); }
  for (const url of ['/admin/finance/ledger.csv', '/admin/inquiries/subscribers.csv', '/admin/stock-import/template.xlsx']) { r = await request(url); check(`Anonymous export blocked ${url}`, r.status === 403 || r.location === '/admin/login', `HTTP ${r.status}`); }
  r = await action('/admin/commissions/new', admin, 'src/actions/admin/commissions.ts', 'saveCommission', [null, null, fd({ stock_id: stock.id, user_id: agent.userId, type: 'percent', rate: 10, note: name })]); check('Add salesperson commission', success(r));
  const [[commission]] = await db.query('SELECT * FROM commissions WHERE stock_id=? AND user_id=?', [stock.id, agent.userId]);
  check('Commission calculated from vehicle profit', Number(commission?.amount) === 110000);
  r = await action('/admin/commissions', jars.get('Agent'), 'src/actions/admin/commissions.ts', 'approveMonth', [agent.userId, commission.period]); check('Agent cannot approve own commission', denied(r));
  r = await action('/admin/commissions', admin, 'src/actions/admin/commissions.ts', 'approveMonth', [agent.userId, commission.period]); check('Commission month approved', success(r));
  let [[payout]] = await db.query('SELECT * FROM commission_payouts WHERE user_id=? AND period=?', [agent.userId, commission.period]);
  r = await action('/admin/commissions', admin, 'src/actions/admin/commissions.ts', 'unapprovePayout', [payout.id]); check('Unpaid commission approval can be withdrawn', success(r));
  r = await action('/admin/commissions', admin, 'src/actions/admin/commissions.ts', 'approveMonth', [agent.userId, commission.period]); check('Commission can be reapproved', success(r));
  [[payout]] = await db.query('SELECT * FROM commission_payouts WHERE user_id=? AND period=?', [agent.userId, commission.period]);
  r = await action('/admin/commissions?tab=finance', jars.get('Finance Manager'), 'src/actions/admin/commissions.ts', 'completePayout', [payout.id, null, fd({ payment_ref: name })]); check('Finance completes approved commission', success(r));
  const [[paidCommission]] = await db.query('SELECT status FROM commissions WHERE id=?', [commission.id]); check('Paid commission status persisted', paidCommission.status === 'paid');
  r = await action('/admin/commissions', admin, 'src/actions/admin/commissions.ts', 'unapprovePayout', [payout.id]); check('Paid commission cannot be withdrawn', r.body.includes('Already completed'));
  const csv = `CHASSIS,MAKE,MODEL,YEAR,TRANSMISSION,FUEL,ENGINE CC,DOORS\n${tag}-IMPORT,Toyota,QA Import,2020,manual,hybrid,1800,5\n`;
  const csvFile = () => new File([csv], 'qa.csv', { type: 'text/csv' });
  r = await action('/admin/stock-import', admin, 'src/actions/admin/stock-import.ts', 'importStock', [null, fd({ mode: 'preview', file: csvFile() })]); check('CSV import preview', r.body.includes('"committed":false') && r.body.includes('"create":1'));
  const [[beforeImport]] = await db.query('SELECT COUNT(*) n FROM stocks WHERE chassis=?', [tag + '-IMPORT']); check('Preview leaves database unchanged', Number(beforeImport.n) === 0);
  r = await action('/admin/stock-import', admin, 'src/actions/admin/stock-import.ts', 'importStock', [null, fd({ mode: 'import', file: csvFile() })]); check('CSV import commit', r.body.includes('"committed":true') && r.body.includes('"create":1'));
  const [[imported]] = await db.query('SELECT * FROM stocks WHERE chassis=?', [tag + '-IMPORT']); if (imported) stockIds.push(imported.id);
  check('Imported specifications persist', imported?.transmission === 'manual' && imported.fuel === 'hybrid' && imported.engine === 1800 && imported.doors === '5');
  r = await action('/admin/stock-import', admin, 'src/actions/admin/stock-import.ts', 'importStock', [null, fd({ mode: 'import', file: csvFile() })]); check('Repeated CSV import updates rather than duplicates', r.body.includes('"update":1'));
  const [[afterImport]] = await db.query('SELECT COUNT(*) n FROM stocks WHERE chassis=?', [tag + '-IMPORT']); check('Imported chassis remains unique', Number(afterImport.n) === 1);
  r = await action('/admin/finance/japan-payments/new', jars.get('Finance Manager'), 'src/actions/admin/finance.ts', 'saveJapanPayment', [null, null, fd({ payment_date: '2026-02-31', payee: name, amount: 1000 })]); check('Invalid calendar date rejected before SQL', r.body.includes('Enter a valid date'));
  r = await action('/admin/finance/japan-payments/new', jars.get('Finance Manager'), 'src/actions/admin/finance.ts', 'saveJapanPayment', [null, null, fd({ payment_date: '2026-10-13', payee: name, amount: 200000, stock_id: stock.id })]); check('Finance Manager records Japan payment', success(r));
  const [[japanPayment]] = await db.query('SELECT id FROM japan_payments WHERE payee=?', [name]);
  r = await action(`/admin/finance/japan-payments/${japanPayment.id}`, jars.get('Finance Manager'), 'src/actions/admin/finance.ts', 'saveJapanPayment', [japanPayment.id, null, fd({ payment_date: '2026-10-13', payee: name, amount: 210000, stock_id: stock.id, note: name })]); check('Japan payment edit', success(r));
  r = await action('/admin/finance/japan-payments', jars.get('Finance Manager'), 'src/actions/admin/finance.ts', 'deleteJapanPayment', [japanPayment.id]); check('Japan payment delete', success(r));
  r = await action('/admin/catalog', admin, 'src/actions/admin/catalog.ts', 'saveCatalogItem', ['body_types', null, null, fd({ name })]); check('Catalog item create', success(r));
  const [[catalog]] = await db.query('SELECT id FROM body_types WHERE name=?', [name]); if (catalog) { r = await action('/admin/catalog', admin, 'src/actions/admin/catalog.ts', 'deleteCatalogItem', ['body_types', catalog.id]); check('Catalog item delete', success(r)); }
  r = await action('/admin/roles/new', admin, 'src/actions/admin/roles.ts', 'saveRole', [null, null, fd({ name, description: 'Temporary QA role', permissions: ['stock.view', 'dashboard.view'] })]); check('Custom role create', success(r));
  const [[newRole]] = await db.query('SELECT id FROM roles WHERE name=?', [name]);
  if (newRole) {
    roleIds.push(newRole.id);
    r = await action(`/admin/roles/${newRole.id}`, admin, 'src/actions/admin/roles.ts', 'saveRole', [newRole.id, null, fd({ name, permissions: ['shipments.view'] })]); check('Custom role permissions edit', success(r));
    r = await action('/admin/users/new', admin, 'src/actions/admin/users.ts', 'saveUser', [null, null, fd({ name, email: `${tag}.custom@example.invalid`, role_id: newRole.id, password, is_active: 'on' })]); check('Create staff with custom role', success(r));
    const [[customUser]] = await db.query('SELECT id FROM users WHERE email=?', [`${tag}.custom@example.invalid`]); if (customUser) users.push({ userId: customUser.id });
    const customJar = await login({ name: 'Custom shipments role', email: `${tag}.custom@example.invalid` });
    check('Custom role without dashboard lands on allowed shipment page', (await request('/admin', customJar)).location === '/admin/shipments');
    check('Custom role can view shipments', (await request('/admin/shipments', customJar)).status === 200);
    check('Custom role cannot view stock', (await request('/admin/stock', customJar)).location === '/admin/no-access');
    r = await action(`/admin/roles/${newRole.id}`, admin, 'src/actions/admin/roles.ts', 'deleteRole', [newRole.id]); check('Role in use cannot be deleted', r.body.includes('still have this role'));
    r = await action('/admin/users', admin, 'src/actions/admin/users.ts', 'deleteUser', [customUser.id]); check('Delete custom-role staff account', success(r));
    check('Deleted staff session revoked', (await request('/admin/shipments', customJar)).location === '/admin/login');
    r = await action(`/admin/roles/${newRole.id}`, admin, 'src/actions/admin/roles.ts', 'deleteRole', [newRole.id]); check('Custom role delete', success(r));
  }
  r = await action('/admin/users/new', jars.get('Manager'), 'src/actions/admin/users.ts', 'saveUser', [null, null, fd({ name, email: `${tag}.managed@example.invalid`, role_id: agent.id, password, is_active: 'on' })]); check('Manager creates subordinate Agent', success(r));
  const [[managed]] = await db.query('SELECT id,manager_id FROM users WHERE email=?', [`${tag}.managed@example.invalid`]); if (managed) users.push({ userId: managed.id });
  check('Manager-created staff reports to Manager', Number(managed?.manager_id) === users.find(u => u.name === 'Manager').userId);
  r = await action(`/admin/users/${managed.id}`, jars.get('Manager'), 'src/actions/admin/users.ts', 'saveUser', [managed.id, null, fd({ name, email: `${tag}.managed@example.invalid`, role_id: superUser.id, is_active: 'on' })]); check('Manager cannot promote staff to Super Admin', denied(r) || r.body.includes('cannot give this role'));
  r = await action('/admin/website', jars.get('Agent'), 'src/actions/admin/website.ts', 'saveSettings', [0, null, fd({ email: 'fake@example.invalid' })]); check('Agent cannot change website content', denied(r));
  r = await action('/admin/website', admin, 'src/actions/admin/website.ts', 'saveSettings', [0, null, fd({ email: 'invalid' })]); check('Website content validates email', r.body.includes('Enter a valid email'));
  [settingsSnapshot] = await db.query('SELECT * FROM settings WHERE `key` IN (\'email\',\'phones\',\'whatsapp_number\',\'office_hours\')');
  const settingValues = Object.fromEntries(settingsSnapshot.map(row => [row.key, row.value]));
  r = await action('/admin/website', jars.get('Manager'), 'src/actions/admin/website.ts', 'saveSettings', [0, null, fd(settingValues)]); check('Manager saves website contact settings', success(r));
  check('Saved contact email shown publicly', (await request('/')).body.includes(settingValues.email));
  const [[vehicleInquiry]] = await db.query('SELECT id FROM inquiries WHERE stock_id=?', [stock.id]);
  r = await action('/admin/inquiries', jars.get('Manager'), 'src/actions/admin/inquiries.ts', 'setInquiryStatus', ['vehicle', vehicleInquiry.id, 'closed']); check('Manager closes vehicle enquiry', success(r));
  r = await action('/admin/inquiries', jars.get('Manager'), 'src/actions/admin/inquiries.ts', 'deleteInquiry', ['vehicle', vehicleInquiry.id]); check('Manager deletes vehicle enquiry', success(r));
  r = await action(`/admin/customers/${otherId}`, admin, 'src/actions/admin/customers.ts', 'reserveVehicle', [otherId, null, fd({ stock_id: imported.id, cnf: 5000 })]); check('Second customer reservation', success(r));
  r = await action(`/admin/stock/${imported.id}`, admin, 'src/actions/admin/stock.ts', 'deleteStock', [imported.id]); check('Reserved vehicle cannot be deleted', r.body.includes('reserved'));
  r = await action(`/admin/documents/${imported.id}`, admin, 'src/actions/admin/documents.ts', 'saveDocuments', [imported.id, null, fd({ final_invoice: pdf() })]); check('Second vehicle document upload', success(r));
  const [[secondDoc]] = await db.query('SELECT final_invoice FROM documents WHERE stock_id=?', [imported.id]); if (secondDoc?.final_invoice) uploaded.add(secondDoc.final_invoice);
  r = await action(`/admin/documents/${imported.id}`, admin, 'src/actions/admin/documents.ts', 'saveDocuments', [imported.id, null, fd({ remove_final_invoice: 'on' })]); check('Remove export document', success(r));
  check('Removed export document is no longer downloadable', (await request(`/admin/files/${secondDoc.final_invoice}`, admin)).status === 404);
  r = await action(`/admin/customers/${otherId}`, admin, 'src/actions/admin/customers.ts', 'releaseVehicle', [imported.id]); check('Release reservation after removing all paperwork', success(r));
  const [[releasedPoints]] = await db.query('SELECT points FROM points WHERE customer_account_id=?', [otherId]); check('Release subtracts reservation points exactly once', Number(releasedPoints?.points) === 0);
  r = await action(`/admin/customers/${otherId}`, admin, 'src/actions/admin/customers.ts', 'releaseVehicle', [imported.id]); check('Repeated release rejected', r.body.includes('not reserved'));
  r = await action(`/admin/stock/${imported.id}`, admin, 'src/actions/admin/stock.ts', 'deleteStock', [imported.id]); check('Available vehicle delete', success(r));
  const orphanCsv = csv.replace(tag + '-IMPORT', tag + '-PAPERWORK');
  await action('/admin/stock-import', admin, 'src/actions/admin/stock-import.ts', 'importStock', [null, fd({ mode: 'import', file: new File([orphanCsv], 'qa.csv', { type: 'text/csv' }) })]);
  const [[paperworkStock]] = await db.query('SELECT id FROM stocks WHERE chassis=?', [tag + '-PAPERWORK']); if (paperworkStock) stockIds.push(paperworkStock.id);
  r = await action(`/admin/documents/${paperworkStock.id}`, admin, 'src/actions/admin/documents.ts', 'saveDocuments', [paperworkStock.id, null, fd({ final_invoice: pdf() })]); check('Upload paperwork to unreserved vehicle', success(r));
  const [[paperwork]] = await db.query('SELECT final_invoice FROM documents WHERE stock_id=?', [paperworkStock.id]); uploaded.add(paperwork.final_invoice);
  r = await action(`/admin/stock/${paperworkStock.id}`, admin, 'src/actions/admin/stock.ts', 'deleteStock', [paperworkStock.id]); check('Delete unreserved vehicle with paperwork', success(r));
  let removedPaperwork = false; try { await readFile(path.join(root, 'storage/uploads', paperwork.final_invoice)); } catch (error) { removedPaperwork = error.code === 'ENOENT'; }
  check('Vehicle deletion removes its private document file', removedPaperwork);
  r = await action(`/admin/customers/${otherId}`, admin, 'src/actions/admin/customers.ts', 'deleteCustomer', [otherId]); check('Unused customer delete', success(r));
  check('Deleted customer portal session revoked', (await request('/client', buyerB)).location === '/client/login');
  r = await action(`/admin/payments/${payment.id}`, jars.get('Manager'), 'src/actions/admin/payments.ts', 'unapprovePayment', [payment.id]); check('Manager can return approved TT to pending', success(r));
  r = await action(`/admin/payments/${payment.id}`, jars.get('Agent'), 'src/actions/admin/payments.ts', 'deletePayment', [payment.id]); check('Agent deletes own pending payment', success(r));
  check('Deleted TT file is no longer downloadable', (await request(`/admin/files/${payment.file}`, admin)).status === 404);
  r = await action('/admin/shipments', admin, 'src/actions/admin/shipments.ts', 'deleteShipment', [shipment.id]); check('Shipment delete leaves reservation intact', success(r));
  const [[stillReserved]] = await db.query('SELECT customer_account_id FROM stocks WHERE id=?', [stock.id]); check('Deleting shipment preserves customer reservation', Number(stillReserved.customer_account_id) === customer.id);
  r = await action('/admin/register', null, 'src/actions/admin/auth.ts', 'register', [null, fd({ name, email: `${tag}.signup@example.invalid`, password, confirm_password: password })]); check('Staff registration awaits approval', r.redirect?.startsWith('/admin/register/pending'));
  const [[signup]] = await db.query('SELECT id,approval_status FROM users WHERE email=?', [`${tag}.signup@example.invalid`]); if (signup) users.push({ userId: signup.id, email: `${tag}.signup@example.invalid` });
  r = await action('/admin/login', null, 'src/actions/admin/auth.ts', 'login', [null, fd({ email: `${tag}.signup@example.invalid`, password })]); check('Pending staff cannot enter admin', r.redirect?.startsWith('/admin/register/pending'));
  r = await action('/admin/approvals', jars.get('Manager'), 'src/actions/admin/approvals.ts', 'approveRegistration', [signup.id, null, fd({ role_id: agent.id })]); check('Manager approves staff signup with Agent role', success(r));
  const staffOther = await login(agent); r = await action('/admin/profile', jars.get('Agent'), 'src/actions/admin/profile.ts', 'changePassword', [null, fd({ current_password: password, new_password: password + '-changed', confirm_password: password + '-changed' })]); check('Staff password change', success(r));
  check('Staff password change revokes other session', (await request('/admin', staffOther)).location === '/admin/login');
  check('Staff password change preserves current session', (await request('/admin', jars.get('Agent'))).status === 200);
  const clientOther = session(); await action('/client/login', clientOther, 'src/actions/client/auth.ts', 'clientLogin', [null, fd({ email: customer.email, password })]); r = await action('/client', client, 'src/actions/client/auth.ts', 'changeClientPassword', [null, fd({ current_password: password, new_password: password + '-changed', confirm_password: password + '-changed' })]); check('Customer password change', success(r));
  check('Customer password change revokes other session', (await request('/client', clientOther)).location === '/client/login');
  check('Customer password change preserves current session', (await request('/client', client)).status === 200);
  r = await action('/admin/profile', jars.get('Agent'), 'src/actions/admin/profile.ts', 'updatePreferences', [null, fd({ display_currency: 'PKR', theme: 'dark' })]); check('Currency and theme preferences', success(r));
  r = await action('/admin', jars.get('Agent'), 'src/actions/admin/auth.ts', 'logout', []); check('Staff logout redirects', r.redirect?.startsWith('/admin/login')); check('Logged-out session blocked', (await request('/admin', jars.get('Agent'))).location === '/admin/login');
  r = await action('/client', client, 'src/actions/client/auth.ts', 'clientLogout', []); check('Client logout redirects', r.redirect?.startsWith('/client/login')); check('Logged-out customer blocked', (await request('/client', client)).location === '/client/login');
} catch (error) { fatal = error.message; check('QA harness completed', false, fatal); }
finally {
  try {
    if (stockIds.length) {
      const [stocks] = await db.query('SELECT thumbnail,images FROM stocks WHERE id IN (?)', [stockIds]);
      for (const s of stocks) for (const url of [s.thumbnail, ...JSON.parse(s.images || '[]')]) if (url?.startsWith('/uploads/')) uploaded.add(url.slice('/uploads/'.length));
      const [docs] = await db.query('SELECT * FROM documents WHERE stock_id IN (?)', [stockIds]); for (const doc of docs) for (const value of Object.values(doc)) if (typeof value === 'string' && value.startsWith('documents/')) uploaded.add(value);
      await db.query('DELETE FROM inquiries WHERE stock_id IN (?)', [stockIds]);
    }
    if (customerIds.length) { const [payments] = await db.query('SELECT file FROM payments WHERE customer_account_id IN (?)', [customerIds]); for (const p of payments) if (p.file) uploaded.add(p.file); await db.query('DELETE FROM payments WHERE customer_account_id IN (?)', [customerIds]); }
    if (users.length) { await db.query('DELETE FROM commissions WHERE user_id IN (?)', [users.map(u => u.userId)]); await db.query('DELETE FROM commission_payouts WHERE user_id IN (?)', [users.map(u => u.userId)]); }
    for (const setting of settingsSnapshot) await db.query('UPDATE settings SET value=?,updated_at=? WHERE `key`=?', [setting.value, setting.updated_at, setting.key]);
    await db.query('DELETE FROM japan_payments WHERE payee=?', [name]);
    if (stockIds.length) await db.query('DELETE FROM stocks WHERE id IN (?)', [stockIds]);
    if (shipmentIds.length) await db.query('DELETE FROM shipments WHERE id IN (?)', [shipmentIds]);
    if (customerIds.length) await db.query('DELETE FROM customer_accounts WHERE id IN (?)', [customerIds]);
    await db.query('DELETE FROM contact_messages WHERE email=?', [`${tag}@example.invalid`]);
    await db.query('DELETE FROM newsletter_subscribers WHERE email=?', [`${tag}@example.invalid`]);
    await db.query('DELETE FROM body_types WHERE name=?', [name]);
    if (users.length) await db.query('DELETE FROM users WHERE id IN (?)', [users.map(u => u.userId)]);
    if (roleIds.length) await db.query('DELETE FROM roles WHERE id IN (?)', [roleIds]);
    for (const stored of uploaded) { const target = path.resolve(root, 'storage/uploads', stored); if (target.startsWith(path.resolve(root, 'storage/uploads') + path.sep)) await unlink(target).catch(() => {}); }
    check('Temporary fixtures cleaned up', true);
  } catch (e) { check('Temporary fixtures cleaned up', false, e.message); }
  await db.end();
  await mkdir('qa', { recursive: true });
  const report = { generatedAt: new Date().toISOString(), base, mode: production ? 'production' : 'development', fixtureTag: tag, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results, visualBrowserTested: false };
  await writeFile(production ? 'qa/production-results.json' : 'qa/runtime-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`TOTAL ${report.passed} passed, ${report.failed} failed`);
  if (report.failed || fatal) process.exitCode = 1;
}

-- Website tables. Column names and types follow the Laravel migrations in
-- shinkyowa-5s4d87e5/database/migrations so the same data (and later the
-- Laravel admin panel) can share this database.

CREATE TABLE IF NOT EXISTS makes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image VARCHAR(255) NULL,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS body_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS countries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS currencies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(1) NOT NULL UNIQUE,
  code VARCHAR(4) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- customer_account_id / agent_id belong to the admin side (customer_accounts,
-- users). They are kept as plain nullable columns so rows stay compatible.
CREATE TABLE IF NOT EXISTS stocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sid VARCHAR(100) NOT NULL UNIQUE,
  thumbnail VARCHAR(255) NULL,
  images TEXT NULL,
  chassis VARCHAR(255) NOT NULL,
  make_id BIGINT UNSIGNED NULL,
  model VARCHAR(100) NOT NULL,
  year VARCHAR(4) NOT NULL,
  fob INT NOT NULL,
  cnf INT NULL,
  currency_id BIGINT UNSIGNED NULL DEFAULT 1,
  mileage VARCHAR(255) NOT NULL,
  doors VARCHAR(4) NOT NULL,
  transmission ENUM('manual', 'automatic') NOT NULL,
  body_type_id BIGINT UNSIGNED NULL,
  fuel ENUM('diesel', 'petrol', 'electric', 'hybrid', 'gasoline') NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  country_id BIGINT UNSIGNED NULL,
  engine INT NOT NULL,
  color VARCHAR(255) NULL,
  features TEXT NOT NULL,
  customer_account_id BIGINT UNSIGNED NULL,
  agent_id BIGINT UNSIGNED NULL,
  -- Who added the vehicle; users with only stock.add may edit their own hidden ones.
  created_by BIGINT UNSIGNED NULL,
  is_listed TINYINT(1) NOT NULL DEFAULT 1,
  -- NULL follows the reservation/payment/shipment lifecycle; a value sets a manual sales label.
  status_override ENUM('available', 'reserved', 'shipped', 'cleared') NULL DEFAULT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT stocks_make_id_foreign FOREIGN KEY (make_id) REFERENCES makes (id) ON DELETE SET NULL,
  CONSTRAINT stocks_currency_id_foreign FOREIGN KEY (currency_id) REFERENCES currencies (id) ON DELETE SET NULL,
  CONSTRAINT stocks_body_type_id_foreign FOREIGN KEY (body_type_id) REFERENCES body_types (id) ON DELETE SET NULL,
  CONSTRAINT stocks_category_id_foreign FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT stocks_country_id_foreign FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  country_id BIGINT UNSIGNED NULL,
  stock_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  country VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  INDEX inquiries_stock_id_ip_index (stock_id, ip),
  CONSTRAINT inquiries_country_id_foreign FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE SET NULL,
  CONSTRAINT inquiries_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE SET NULL
);

-- New: the header "Contact Us" dialog and the footer newsletter boxes did
-- not save anything on the Laravel site.
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- Site-wide details shown in the header, footer, mobile menu and notice popup
-- (email, phones, addresses, social links...). One row per key; see
-- db/seed-data.mjs for the keys the site reads.
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  value TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- Label/value tables on the content pages, e.g. section 'bank_details'
-- (Sales & Bank Details page) and 'company_profile' (Company Profile page).
-- Rows are shown in sort_order.
CREATE TABLE IF NOT EXISTS info_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  value VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY info_rows_section_label_unique (section, label),
  INDEX info_rows_section_sort_index (section, sort_order)
);

-- ---------------------------------------------------------------------------
-- Admin panel
-- ---------------------------------------------------------------------------

-- A role is a named set of permissions. is_super roles (Super Admin) have
-- every permission and cannot be edited or deleted.
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_super TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- Permission keys are defined in src/lib/admin/permissions.ts.
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission VARCHAR(64) NOT NULL,
  PRIMARY KEY (role_id, permission),
  CONSTRAINT role_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id BIGINT UNSIGNED NULL,
  -- The user's team leader. Users with customers.view_team see the customers
  -- of everyone whose manager_id points at them.
  manager_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  -- Self-registered accounts start 'pending' and cannot sign in until someone
  -- with users.approve approves them (Admin > Approvals).
  approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
  phone VARCHAR(30) NULL,
  -- Per-user dashboard settings (chart types, hidden charts) as JSON.
  dashboard_prefs TEXT NULL,
  -- Default commission for vehicles this person sells: 'percent' of the
  -- vehicle's profit, or a 'fixed' JPY amount per vehicle. NULL: none set.
  commission_type ENUM('percent', 'fixed') NULL,
  commission_value DECIMAL(12, 2) NULL,
  -- My profile > Preferences: the currency amounts are shown in (converted
  -- with the exchange rates under Finance) and a light or dark admin panel.
  display_currency ENUM('USD', 'PKR') NOT NULL DEFAULT 'USD',
  theme ENUM('light', 'dark') NOT NULL DEFAULT 'light',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT users_role_id_foreign FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL,
  CONSTRAINT users_manager_id_foreign FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Login sessions. id is the SHA-256 of the cookie token, so a leaked table
-- does not reveal usable cookies.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL,
  INDEX admin_sessions_user_id_index (user_id),
  CONSTRAINT admin_sessions_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Buyers. agent_id is the staff member responsible for the customer.
CREATE TABLE IF NOT EXISTS customer_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cid VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  company VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL DEFAULT '',
  whatsapp VARCHAR(20) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  city VARCHAR(255) NOT NULL DEFAULT '',
  country_id BIGINT UNSIGNED NULL,
  description TEXT NULL,
  email VARCHAR(150) NULL UNIQUE,
  currency_id BIGINT UNSIGNED NULL,
  agent_id BIGINT UNSIGNED NULL,
  -- Customer portal (/client) password, same scrypt format as users.password.
  -- NULL: no portal access.
  password VARCHAR(255) NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT customer_accounts_country_id_foreign FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE SET NULL,
  CONSTRAINT customer_accounts_currency_id_foreign FOREIGN KEY (currency_id) REFERENCES currencies (id) ON DELETE SET NULL,
  CONSTRAINT customer_accounts_agent_id_foreign FOREIGN KEY (agent_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Telegraphic transfers (TT) received from customers. amount is in the
-- customer's currency, in_yen its JPY value. Status starts 'not approved'
-- (pending TT) until someone with payments.approve confirms it.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  payment_date DATE NOT NULL,
  -- USD. amount is the advance (paid); pending_amount is still owed, due at pending_due_at.
  amount INT NOT NULL,
  in_yen INT NOT NULL,
  pending_amount INT NULL,
  pending_due_at DATETIME NULL,
  payment_recieved_date DATE NULL,
  customer_account_id BIGINT UNSIGNED NULL,
  file VARCHAR(255) NULL,
  -- 'approved' = money received, 'rejected' = not received (reject_reason says why).
  status ENUM('approved', 'not approved', 'rejected') NOT NULL DEFAULT 'not approved',
  -- An advance (may have a pending balance), or a payment of the balance of parent_id.
  kind ENUM('advance', 'balance') NOT NULL DEFAULT 'advance',
  parent_id BIGINT UNSIGNED NULL,
  reject_reason VARCHAR(255) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  viewed TINYINT(1) NOT NULL DEFAULT 0,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  INDEX payments_status_index (status),
  CONSTRAINT payments_parent_id_foreign FOREIGN KEY (parent_id) REFERENCES payments (id) ON DELETE CASCADE,
  CONSTRAINT payments_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT payments_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE SET NULL,
  CONSTRAINT payments_customer_account_id_foreign FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id) ON DELETE SET NULL,
  CONSTRAINT payments_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- What happened on a customer's account, shown to them in the portal:
-- written automatically (reserved, payment received, on a vessel, documents...)
-- or by staff ("note"). user_id is who did it.
CREATE TABLE IF NOT EXISTS customer_updates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_account_id BIGINT UNSIGNED NOT NULL,
  stock_id BIGINT UNSIGNED NULL,
  kind VARCHAR(30) NOT NULL,
  message VARCHAR(500) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL,
  INDEX customer_updates_customer_index (customer_account_id, created_at),
  CONSTRAINT customer_updates_customer_account_id_foreign FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id) ON DELETE CASCADE,
  CONSTRAINT customer_updates_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE SET NULL,
  CONSTRAINT customer_updates_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Shipping, paperwork, loyalty and the customer portal
-- ---------------------------------------------------------------------------

-- Customer portal sign-in (/client). customer_accounts.password is set from
-- the admin customer form; NULL means the customer has no portal access.
CREATE TABLE IF NOT EXISTS client_sessions (
  id CHAR(64) NOT NULL PRIMARY KEY,
  customer_account_id BIGINT UNSIGNED NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL,
  INDEX client_sessions_customer_index (customer_account_id),
  CONSTRAINT client_sessions_customer_foreign FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id) ON DELETE CASCADE
);

-- A vessel sailing; shipment_stock lists the vehicles on board (one vessel
-- per vehicle).
CREATE TABLE IF NOT EXISTS shipments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vessel_name VARCHAR(255) NOT NULL,
  method ENUM('roro', 'container') NOT NULL DEFAULT 'roro',
  container_no VARCHAR(100) NULL,
  bl_no VARCHAR(100) NULL,
  etd DATE NOT NULL,
  eta DATE NOT NULL,
  -- Set by hand; NULL follows the ETD/ETA dates.
  status ENUM('upcoming', 'at_sea', 'arrived') NULL DEFAULT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS shipment_stock (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  stock_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY shipment_stock_stock_id_unique (stock_id),
  CONSTRAINT shipment_stock_shipment_id_foreign FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE,
  CONSTRAINT shipment_stock_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE CASCADE
);

-- Export paperwork per vehicle. Each column is a private file in
-- storage/uploads/documents/, NULL until uploaded.
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_id BIGINT UNSIGNED NOT NULL,
  japanese_export VARCHAR(255) NULL,
  english_export VARCHAR(255) NULL,
  final_invoice VARCHAR(255) NULL,
  inspection_certificate VARCHAR(255) NULL,
  bl_copy VARCHAR(255) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY documents_stock_id_unique (stock_id),
  CONSTRAINT documents_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE CASCADE
);

-- Loyalty points: +10 when a vehicle is reserved for the customer, -10 when
-- the reservation is released (src/actions/admin/customers.ts).
CREATE TABLE IF NOT EXISTS points (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_account_id BIGINT UNSIGNED NOT NULL,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY points_customer_account_id_unique (customer_account_id),
  CONSTRAINT points_customer_account_id_foreign FOREIGN KEY (customer_account_id) REFERENCES customer_accounts (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Finance (permission finance.view / finance.manage): what each vehicle cost
-- in Japan, so the admin panel can show profit per vehicle. All amounts in JPY.
-- ---------------------------------------------------------------------------

-- Auction houses, editable under Catalog lists.
CREATE TABLE IF NOT EXISTS auctions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- Cost lines added on top of the bought price (auction fees, freight,
-- transport...), editable under Catalog lists.
CREATE TABLE IF NOT EXISTS expense_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

-- Purchase of a vehicle. exchange_rate converts the sale price (stocks.cnf,
-- in the customer's currency) to JPY: profit = cnf * rate - bought - expenses.
CREATE TABLE IF NOT EXISTS stock_purchases (
  stock_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  auction_id BIGINT UNSIGNED NULL,
  lot_no VARCHAR(50) NULL,
  purchase_date DATE NULL,
  deposit_percent TINYINT UNSIGNED NULL,
  exchange_rate DECIMAL(10, 3) NULL,
  bought_price INT NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  INDEX stock_purchases_purchase_date_index (purchase_date),
  CONSTRAINT stock_purchases_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE CASCADE,
  CONSTRAINT stock_purchases_auction_id_foreign FOREIGN KEY (auction_id) REFERENCES auctions (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_id BIGINT UNSIGNED NOT NULL,
  expense_type_id BIGINT UNSIGNED NOT NULL,
  amount INT NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY stock_expenses_stock_type_unique (stock_id, expense_type_id),
  CONSTRAINT stock_expenses_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE CASCADE,
  CONSTRAINT stock_expenses_expense_type_id_foreign FOREIGN KEY (expense_type_id) REFERENCES expense_types (id)
);

-- Money paid out in Japan (auction houses, transport, freight forwarders),
-- optionally for one vehicle.
CREATE TABLE IF NOT EXISTS japan_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_date DATE NOT NULL,
  payee VARCHAR(150) NOT NULL,
  stock_id BIGINT UNSIGNED NULL,
  amount INT NOT NULL,
  reference VARCHAR(150) NULL,
  note VARCHAR(500) NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  INDEX japan_payments_payment_date_index (payment_date),
  CONSTRAINT japan_payments_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE SET NULL,
  CONSTRAINT japan_payments_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Staff commission (src/lib/admin/commissions.ts), paid monthly. Someone
-- with commission.manage adds commission per vehicle (% of profit or a fixed
-- amount); it belongs to a month (period). commission.approve approves a staff
-- member's month, which creates a payout for finance; commission.pay marks
-- the payout complete. Later commission goes into the next open month.
-- Amounts in JPY.
-- ---------------------------------------------------------------------------

-- One staff member's commission for one month.
CREATE TABLE IF NOT EXISTS commission_payouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  period CHAR(7) NOT NULL,
  amount INT NOT NULL,
  status ENUM('approved', 'paid') NOT NULL DEFAULT 'approved',
  approved_by BIGINT UNSIGNED NULL,
  approved_at TIMESTAMP NULL,
  paid_by BIGINT UNSIGNED NULL,
  paid_at TIMESTAMP NULL,
  payment_ref VARCHAR(150) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY commission_payouts_user_period_unique (user_id, period),
  INDEX commission_payouts_status_index (status),
  CONSTRAINT commission_payouts_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT commission_payouts_approved_by_foreign FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT commission_payouts_paid_by_foreign FOREIGN KEY (paid_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS commissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  -- Month it is paid with, 'YYYY-MM'.
  period CHAR(7) NOT NULL,
  type ENUM('percent', 'fixed') NOT NULL,
  -- The percentage, or the fixed amount, it was worked out from.
  rate DECIMAL(12, 2) NOT NULL,
  -- Vehicle profit when it was added (percent commissions).
  profit INT NULL,
  amount INT NOT NULL,
  note VARCHAR(255) NULL,
  -- pending until its month is approved; then follows the payout.
  status ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending',
  payout_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY commissions_stock_user_unique (stock_id, user_id),
  INDEX commissions_period_user_index (period, user_id),
  CONSTRAINT commissions_stock_id_foreign FOREIGN KEY (stock_id) REFERENCES stocks (id) ON DELETE SET NULL,
  -- Users with commission history cannot be deleted (disable them instead).
  CONSTRAINT commissions_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT commissions_payout_id_foreign FOREIGN KEY (payout_id) REFERENCES commission_payouts (id) ON DELETE SET NULL,
  CONSTRAINT commissions_created_by_foreign FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

**Shinkyowa QA report — 13 October 2026 (Asia/Karachi)**

The application passes the automated server and database checks performed after the fixes. The final production run passed **327 checks with zero failures**, and **77 focused regression checks passed**. Browser interaction and visual QA remain unverified because no browser connection was available in this session. This is not a claim that every possible input, browser, or deployment environment has been tested.

The development server is running at **http://localhost:3000**. The optimized production build was also started and tested locally on port 3002, then stopped after testing.

**Validation evidence**

| Check | Result | Evidence |
| --- | --- | --- |
| Final production build | PASS | `npm run build`; compilation, TypeScript, page generation and route checks completed |
| Repository lint | PASS | `npm run lint` |
| Standalone TypeScript check | PASS | `npx tsc --noEmit --incremental false` |
| Development workflows | 316 passed, 0 failed | [Development results](runtime-results.json); the final production run adds coverage and includes the last storage cleanup fix |
| Final production workflows | 327 passed, 0 failed | [Production results](production-results.json) |
| Authentication regressions | 22 passed | `scripts/qa/auth-regressions.test.mjs` |
| Business regressions | 25 passed | `scripts/qa/business-regressions.test.mjs` |
| Public site, stock and documents regressions | 22 passed | `scripts/qa-public.mjs` |
| Shared form validation regressions | 8 passed | `scripts/qa/form-validation.test.mjs` |

Live workflow checks submit actual requests to Next.js server actions and verify their database effects. The focused regression tests use isolated adapters to exercise rollback, permission failures and concurrency protections. Their counts are separate from live checks; repeated runs are not presented as unique coverage.

**Role coverage**

Each default role was signed in using a temporary account and checked against 27 staff pages. Signed-out access was checked separately. A custom role with only shipment-view permission was also created, edited, assigned, signed in and deleted.

| Role | Observed result |
| --- | --- |
| Super Admin | Full staff access; roles, users, costs, commission approval and administration work |
| Manager | Sales, stock, customers, payment approval, shipments, documents, content, catalog and subordinate staff work; restricted finance/roles pages are denied |
| Agent | Own customer management and pending payments work; other customers, stock writes and payment/commission approval are denied |
| Team Leader | Subordinate customers are visible; outside-team customers are blocked; shipment/document permissions behave as configured |
| Finance Manager | Finance and commission payment work; sales administration and customer records outside their scope are blocked |
| Custom shipment role | Login lands on the permitted shipment page; stock access is denied; deleting the account invalidates its session |
| Customer portal | Own vehicles, payments, loyalty points, vessel and documents are visible; another customer's downloads and staff access are denied |

Access expectations come from the role permissions currently stored in the local database. This checks that implementation matches those permissions, rather than independently approving the business policy behind every role.

**Workflow coverage**

| Area | Tested behavior |
| --- | --- |
| Public site | Home, stock, search, make/type/country/category routes, filters that include and exclude vehicles, fractional pagination, information pages, unknown URLs |
| Public forms | Contact, newsletter, duplicate newsletter, vehicle enquiry and duplicate enquiry suppression |
| Stock | Create with photo and purchase costs, reject unsupported upload type, hide/relist, prevent unauthorized edits, prevent reserved deletion, delete available stock and its paperwork files |
| Customers | Create with portal login, customer/team ownership checks, reserve, duplicate reserve rejection, +10 loyalty points, release, repeated release rejection, unused account deletion |
| Payments | Agent records pending TT with upload; manager approves/unapproves; agent cannot approve or alter approved amounts; pending payment deletion removes its private file |
| Shipping/documents | Create vessel and attach vehicle, cleared stock status, upload/download/remove documents, release after paperwork removal, deleting a vessel preserves the reservation |
| Finance/commissions | Purchase-cost persistence, profit-based commission, approval/withdrawal/reapproval/payment, prevention of withdrawing paid commission, Japan payment create/edit/delete, ledger export |
| Imports/exports | CSV preview without writes, commit, specification persistence, repeat import without duplicate chassis, XLSX template download, subscriber CSV download, anonymous export denial |
| Staff/content | Custom roles, staff creation/deletion, manager escalation denial, registration pending state and approval, website contact settings save, enquiry close/delete, catalog create/delete |
| Sessions/preferences | Staff and customer login/logout, incorrect staff password, separate portal/staff sessions, password changes revoke other sessions while preserving the current one, currency/theme preferences |

**Issues fixed**

| Priority | Problem and correction |
| --- | --- |
| High | Non-approvers could change approved payment amounts/customer details. Permission checks and conditional writes now reject approved or concurrently approved edits. |
| High | Reservation release could retain financial/shipping/document/commission dependencies or subtract points twice. Release now locks the vehicle, checks dependencies and updates points in one transaction. Empty paperwork rows no longer obstruct release. |
| High | Payments from an old customer could count toward a reassigned vehicle. Vehicle payment totals now match the current customer. |
| High | Changing customer currency reinterpreted historical balances. Currency changes are blocked once reservations or payments exist. |
| High | Commission approval/payment/withdrawal could partially update records or race. Transactions, staff/row locks and conditional writes protect the affected records and payout totals. |
| High | Stock imports could bypass customer/team scope and staff assignment limits. Import lookups and updates now respect ownership; imported reservations award loyalty points and update submitted specifications. |
| High | Simultaneous deletion/demotion/disable operations could remove the last active approved Super Admin. User mutations now serialize the guard and write inside a transaction. |
| High | A forged photo-removal value could target another vehicle's image. Only photos belonging to the edited vehicle are removed. |
| Medium | Stock and purchase saves could partially commit or leave newly uploaded files after errors. Saves now use one transaction, preserve old files on failure and clean up new uploads. |
| Medium | Document write failures could leave uploads; updates could replace unrelated columns. Failure cleanup and updates limited to changed columns fix this. Customer document changes also refresh the portal. |
| Medium | Deleting unreserved stock could leave private paperwork files after its document row cascaded away. Document filenames are read within the deletion transaction and files are removed after commit. |
| Medium | Password changes left other staff/customer sessions valid. Other sessions are now revoked, including staff self-resets through Users. |
| Medium | Pending/inactive staff could appear in assignment choices; duplicate registration races produced an unhandled failure. Approved/active checks and handled duplicate validation fix these cases. |
| Medium | “All stock” could filter on a nonexistent category; extra filters were ignored on listing/facet routes; fractional pagination could create invalid offsets. Query handling and pagination now apply the expected conditions. |
| Medium | Forms/imports accepted impossible dates; integer fields could lose precision. Calendar/range validation and safe-integer validation now reject those values. Imports also reject vessel arrival before departure. |
| Medium | Literal wildcard searches and shared-shipment searches behaved incorrectly. Search escaping and customer scope were corrected; zero-percent deposits remain visible. |
| Low | Custom roles without dashboard permission could land on profile despite having an allowed module. Login fallback destinations now include shipping, documents, finance, commission and team-user access. |
| Low | Banner/footer links, related-stock selection, filter/reset state, gallery state and newsletter feedback had defects. Links and state handling were corrected; related stock excludes the viewed vehicle. Client interaction still needs browser verification. |

**Data and environment**

The existing local database had 3 staff users, 5 roles, no stocks and no customer accounts. Creating a separate test database was denied by its database grants, so the suite created uniquely tagged temporary records in the existing local database. It removed its accounts, roles, vehicles, customers, payments, commissions, shipments, enquiries, subscribers and uploads in cleanup. Contact settings used in the save test were restored. Final database checks again show 3 users, 5 roles, zero stocks/customers and zero QA contact/subscriber records. Existing staff credentials were not changed.

The existing dev server stopped responding during testing and was restarted after Windows permission approval. Next.js reported a slow-filesystem warning in development; the final production suite completed successfully. Stale generated route types were regenerated and the final build passed.

Next.js can return HTTP 200 for a not-found result after streaming starts. The hidden-vehicle test verifies the not-found/noindex response and absence of vehicle details, rather than treating that documented status behavior as an application defect.

**Remaining verification**

No connected browser was available. Desktop/mobile layout, actual clicks, filter dropdown interactions, sorting/reset behavior, gallery/lightbox, header dialogs, intercepted drawers, client navigation/hydration and keyboard accessibility still need browser QA. Client-side fixes were inspected and built, but were not exercised through a browser.

External image/CDN availability, deployment hosting, large production datasets, sustained load, real database concurrency stress and every possible custom permission combination were not verified. CSV import was exercised live; XLSX template download was checked, but arbitrary real-world Excel workbooks were not exhaustively tested. No known failing automated check remains within the tested scope.

**Repeatable checks**

Run the focused checks from the project directory:

```powershell
npm run lint
npx tsc --noEmit --incremental false
node --test scripts/qa/*.test.mjs
node scripts/qa-public.mjs
```

With `npm run dev` already running at localhost:3000:

```powershell
node scripts/qa-runtime.mjs
```

For the production suite, build the project and run `npm start -- --port 3002`, then use another terminal:

```powershell
node scripts/qa-runtime.mjs --production http://localhost:3002
```

The live suite requires the local database configured in `.env.local`. It intentionally creates temporary test records and restores/removes them in `finally`; normal completion is confirmed by its “Temporary fixtures cleaned up” result.

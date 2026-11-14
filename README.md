# Takeoff Tokyo website and ticketing

React/Vite frontend using `@takeoff-tokyo/ui`, a Cloudflare Worker with static assets, ticketing APIs and automatic Brevo email delivery, Supabase Postgres/Auth, and Stripe Checkout. Startup and Investor are public ticket types; Crew is issued only through admin APIs. Sales default to **disabled**.

The shared footer links to the public Terms & Conditions (`/terms-conditions`), Privacy Policy (`/privacy-policy`), and Commercial Disclosure (`/scta`) pages. `/terms-and-conditions` and `/commercial-disclosure` also open the corresponding documents. These React pages use the Worker's existing SPA asset fallback for direct visits and refreshes and do not require sign-in. Their supplied content is maintained in `src/pages/LegalPage.tsx`.

Google Analytics uses measurement ID `G-Y1MHMNDZHN` through `src/analytics.ts`, enabled for production builds on `takeoff-tokyo.com` and `www.takeoff-tokyo.com`. In the GA4 web stream, enable Enhanced measurement → Page views → Page changes based on browser history events to measure React navigation. The app uses Google's automatic pageviews; it does not send additional manual pageviews. See [Google's SPA measurement guide](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).

## Code quality

Run `bun run lint` for ESLint checks and `bun run format:check` to check Prettier formatting. Use `bun run lint:fix` for automatic lint fixes and `bun run format` to format the code. The commands also work through `npm run`.

The Code quality GitHub Actions workflow runs lint, formatting, and the CSS policy check on every push and pull request. Checks report failures without modifying the pushed code. Generated files, local configuration, assets, and the separately maintained Supabase files are excluded from formatting.

## CSS styling

The app loads `@takeoff-tokyo/ui/css`, then `src/styles/tokens.css`, global typography/layout rules, and component styles. Reuse the library's `--takeoff-*` colors, fonts, borders, and radii. Site typography and layout conventions live in `tokens.css` as `--site-*` variables. Spacing uses a 4px scale in rem (for example, `--site-space-4` is 1rem).

All text uses **one shared size**, `--site-font-size-body: 1rem` (16px at the default root). This includes page and section headings, body copy, inputs, selects, buttons, labels, badges, helper text, tables, dialogs, and notifications. Use weight, font family, spacing, and color to distinguish roles; do not add size variants. The root remains `100%` so user font preferences and browser text resizing still apply.

`typography.css` applies the shared size to native headings and the UI library's components. Standard text uses a 1.5 line height; long-form copy uses 1.65. Keep TT Lakes Neue for display headings and Lato for body/UI text.

Public section headings use `className="section-title"` for the same font, weight, line height, alignment, capitalization, and bottom spacing. Keep these rules in `typography.css`; public component styles inherit the shared font size rather than repeating it.

Apply `.site-container` once at each outer page or section boundary. It centers content and applies the same responsive 16–32px gutter. Select a narrower or wider container by setting `--site-container-width: var(--site-width-...)` on that element. Nested grids, cards, and forms use the existing gutter rather than adding another container.

| `--site-width-*` | Maximum outer width | Use                                              |
| ---------------- | ------------------- | ------------------------------------------------ |
| `auth`           | 32rem / 512px       | Sign-in and compact forms                        |
| `form`           | 45rem / 720px       | Attendee forms, dialogs, newsletter section      |
| `reading`        | 52rem / 832px       | Legal documents, ticket offers, hero copy region |
| `page`           | 75rem / 1200px      | Public sections, footer, account pages           |
| `wide`           | 90rem / 1440px      | Admin pages and their header                     |

Use `--site-measure-copy` (65ch) for prose, `--site-section-spacing` (48–80px) for public section padding, `--site-heading-gap` for heading separation, `--site-grid-gap` for content grids, and `--site-card-padding` for cards. The hero media remains full width. Breakpoints are **480, 640, 768, 1024, and 1200px**; use range syntax such as `(width < 768px)` and `(width >= 768px)` so fractional viewport widths have no gaps. Small forms compact at 480px, ticket offers stack below 640px, general two-column content stacks below 768px, admin navigation becomes a sidebar at 1024px, and catalog grids expand at 1200px.

Use CSS classes for component styling, including hover states and responsive rules. Component-specific geometry (grid columns, aspect ratios, video sizing), structural values (`0`, `100%`, visually hidden dimensions), and media-query breakpoints stay in their stylesheets; native CSS variables cannot be used as media-query conditions. Keep responsive component variables such as `--hero-spacing` and `--dialog-pad` local and derive them from shared tokens.

Run `npm run check:styles` to check all source stylesheets for undefined variables, literal colors, typography/spacing values that bypass tokens, undocumented font roles, arbitrary maximum widths/breakpoints, and source components for inline styles, embedded style tags, and direct style assignments. The check also runs with `npm test`, `npm run build`, `npm run build:staging`, and `npm run build:cloudflare`.

Email HTML in `workers/email-template.js` and `supabase/templates/email-otp.html` retains inline literal styles for email-client compatibility; those templates do not load the app's CSS variables. Generated builds, dependency CSS, and SVG artwork are outside the site-style policy.

## Local setup

1. Use Bun **1.4.2**, pinned in `package.json`, and install dependencies with `bun install --frozen-lockfile`.
2. Use your existing hosted Supabase project for production; use the separate local stack and staging schemas described below for testing. Apply all SQL files from the canonical `../takeoff-tokyo-supabase/supabase/migrations/` repository in filename order once using the SQL editor or a database migration tool. This migration assumes Supabase's `auth.users`, `anon`, `authenticated`, and `service_role` already exist. It is not an upgrade migration for soh.
3. Copy `.env.example` to `.env.local` and set the public Supabase URL/key. Copy `.dev.vars.example` to `.dev.vars` and set backend credentials. Generate `QR_SIGNING_SECRET` with `openssl rand -hex 32`. Never expose service, Stripe, Brevo, or signing secrets as `VITE_*` variables.
4. Enable Supabase email passwordless sign-in with **six-digit email OTP codes**. In Authentication → Email Templates, set the Magic Link template to the content of `supabase/templates/email-otp.html` (use the same code template for Confirm Signup if that template is used for new accounts). Include `{{ .Token }}` instead of a confirmation link. Keep OTP length at six digits, set OTP expiration to 10 minutes, and retain the provider’s resend/rate limits. Supabase Auth sends these codes; configure its SMTP sender for production. Brevo ticket emails are separate from authentication email. No ticket-holder passwords are created or stored by this app.
5. For local development run `npm run local:start`, `npm run local:prepare`, then `npm run dev`. Open **http://127.0.0.1:8788**. The separate `dev:frontend` command is only for frontend diagnostics/mocked browser tests.
6. Sign in as an admin and open `/admin/ticket-types`. Set each public ticket’s JPY price, enable public purchase, then open sales. This creates the Stripe Product and Price automatically using the environment’s key. Additional public types can be created here; they start paused. Crew remains private and free.
7. Run `npm run local:stripe` in a separate terminal. It reads the local sandbox key, saves the CLI webhook signing secret to `.env.local-testing.local`, and forwards payment/refund events to the local API. Start or restart `npm run dev` after the listener has configured the secret. Keep both processes running during payment tests.

Price changes create immutable versions. Old prices remain usable by existing checkout sessions and order items retain their captured amounts. Purchased ticket types cannot be deleted, including after refunds or successful 100% discounts; pause public purchase instead. Unused types can be deleted and restored. A payment from a checkout opened before deletion still fulfills, permanently protecting that type. Codes are permanent identifiers and cannot be reused for another type.

Currency amounts in questionnaire APIs are integer minor units (USD 12.34 = 1234; JPY 1234 = 1234). Supported questionnaire currencies: JPY, USD, EUR, GBP.

## Staff access and Crew

For the first production admin, add this server-only setting in **website Worker → Settings → Variables and Secrets → Production**, then save and deploy:

```dotenv
ADMIN_BOOTSTRAP_EMAILS=ankhasgreens@gmail.com
```

Open `/admin` and request an email OTP for that address. A listed email can request its first code without an existing staff record or purchase. Only after Supabase verifies the signed-in user's email does the API upsert their admin role into `public.event_staff`. Requesting a code grants no permissions. Additional bootstrap addresses are comma-separated and matched exactly, ignoring case and whitespace. The production template includes the initial address; set the actual runtime binding in Cloudflare. Never use a `VITE_*` variable for this list.

Local and staging bootstrap lists are independent and empty by default. Existing database-assigned staff retain access without being listed. Bootstrap roles persist in the database: to revoke access, remove the email from the bootstrap list **and** remove its event staff row. While listed, a verified account will regain its admin role on its next account/admin request. No schema migration is needed.

Alternatively, create the staff member's Supabase Auth account and provision roles using privileged SQL, never client-editable user metadata:

```sql
insert into public.event_staff(event_id,user_id,role)
select id, 'REPLACE_WITH_AUTH_USER_UUID'::uuid, 'admin' -- or 'checkin'
from public.events where slug='takeoff-tokyo-2027';
```

Staff see **Staff check-in** after opening My tickets. The camera needs HTTPS (or localhost) and internet connectivity. A QR admits once per Tokyo calendar event day. A duplicate scan reports the earlier admission. Tickets cannot be transferred or have attendee details changed after their first check-in. Re-entry and offline scanning are not supported.

Crew recipients must also have signed in and verified their email once before issuance. An admin can issue Crew with `POST /api/admin/crew-tickets` and a body `{"name":"Crew member","email":"crew@example.com"}`. Admins can also issue Crew tickets from `/admin/crew`. There is no Crew purchase flow. Crew is free, nontransferable, and uses the same admission credential/check-in machinery.

## API

All responses are JSON with `Cache-Control: no-store`. Errors return `{"error":"..."}`. The catalog, checkout creation, discount preview, and guarded OTP request are public; the Stripe webhook verifies its signature. All account, ticket-management, and admin routes require `Authorization: Bearer <Supabase access token>`. Mutations with an Origin header must match `SITE_URL`. RLS is enabled and direct browser table/RPC access is revoked; API service-only transactions enforce ownership and staff roles.

| Endpoint                                        | Behavior                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/ticket-types`                         | Public prices, sales flag, sector and currency options; never Crew.                                                                                                                                                                         |
| `POST /api/auth/request-code`                   | `{email,purpose:"tickets"\|"orders"\|"transfer"\|"admin",transferToken?}`. Checks the database before asking Supabase Auth to email an OTP. Transfer sign-in requires the matching, valid invitation token.                                 |
| `GET /api/me`                                   | Verified email, event staff role, buyer's order summaries.                                                                                                                                                                                  |
| `POST /api/create-checkout`                     | Public `{name, email, qty:{<public-ticket-code>:quantity}, requestKey:<UUID>, discountCode?}`; returns `{orderId,url}`. Max 100 total tickets, price selected server-side. Reusing a request key requires identical input, including email. |
| `GET /api/orders/:id`                           | Buyer-only order/items and ticket status; transferred attendees' PII and QR codes are omitted.                                                                                                                                              |
| `GET /api/me/tickets`                           | Current holder's tickets, attendee/questionnaire data, pending transfer.                                                                                                                                                                    |
| `PATCH /api/tickets/:id/attendee`               | `{name,company?,role?,profile:{...}}`; email always comes from verified sign-in. Optional typed fields follow the SQL profile column names; investor `sectors` is an array of sector codes.                                                 |
| `GET /api/tickets/:id/qr`                       | Holder-only opaque signed `{credential}`; requires a completed basic attendee profile. Rendered locally as a QR image.                                                                                                                      |
| `POST /api/tickets/:id/transfers`               | `{email}`; queues an invitation, valid for 72 hours or until event start.                                                                                                                                                                   |
| `DELETE /api/transfers/:id`                     | Sender cancels a pending transfer.                                                                                                                                                                                                          |
| `POST /api/transfers/:token/accept`             | Recipient's verified email must match invitation. Atomically changes holder, revokes the old QR and clears old profile answers.                                                                                                             |
| `POST /api/checkins`                            | Staff-only `{credential}`; returns admission or duplicate result for today's Tokyo event day.                                                                                                                                               |
| `GET /api/admin/tickets?type=&status=&offset=0` | Admin-only listing, 100 records per page.                                                                                                                                                                                                   |
| `POST /api/admin/crew-tickets`                  | Admin-only `{name,email}`.                                                                                                                                                                                                                  |
| `POST /api/admin/tickets/:id/revoke`            | Admin-only permanent revocation, including pending transfers and credentials.                                                                                                                                                               |
| `POST /api/stripe-webhook`                      | Signed Stripe payment/refund events. Never accepts browser proof of payment.                                                                                                                                                                |

The buyer initially controls every purchased admission; each QR requires explicit attendee details. Bulk buyers can transfer unused admissions without completing those details. Recipients accept after email sign-in, then provide their own profile and questionnaire. Their ticket does not grant access to the original order. Forwarding an existing QR is not a transfer: accepting a transfer revokes the prior credential. The new holder may transfer onward before first admission. The buyer cannot reclaim an accepted transfer.

## Deployment and email delivery

- Deploy the website as a **Cloudflare Worker**. Root `wrangler.toml` defines `workers/site.js` as the entry point and `dist` as the static asset directory. Build first, then run `npx wrangler deploy` for production; Workers Builds settings are below. The Worker reuses the API in `functions/api/[[path]].js`. `/api` and `/api/*` always invoke it, including browser navigation; other paths use static assets with SPA fallback for account/admin deep links. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build variables. Use a restricted Stripe API key with Checkout Sessions write and Products/Prices read and write, and Charges read permissions where supported. Set `SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `QR_SIGNING_SECRET` as website Worker runtime secrets. Keep the QR signing secret stable; changing it invalidates issued QR codes.
- **Build settings are separate from runtime settings.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong under Settings → Builds → Variables and Secrets. Backend credentials and `ADMIN_BOOTSTRAP_EMAILS` belong under Settings → Variables and Secrets for the selected runtime environment. A key added only under Builds is unavailable to API requests. Both Worker configs use `keep_vars = true` so subsequent deployments preserve dashboard-managed runtime variables; secrets are also preserved. If `/api/ticket-types` reports "Ticketing service is not configured", check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist in the deployed runtime, not just in Builds.
- Set `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` as runtime secrets on the **website Worker**, alongside its existing site/Supabase settings. Successful payment fulfillment, transfer actions, and Crew issuance trigger outbox delivery through `ctx.waitUntil`; the API response does not wait for Brevo. The website Worker's committed cron runs every minute to recover already-pending messages and retry failures. Deploying the website includes this email processing; a separate production email Worker is optional. If one already exists, shared database leases prevent simultaneous workers from claiming the same job. Supabase Auth SMTP remains separate and uses a Brevo SMTP key; application ticket messages use the Brevo API key. Local messages continue to use the local inbox.
- Enable Stripe webhook events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded` at the production webhook URL. Payment methods are selected dynamically from your Stripe dashboard configuration, including delayed methods when enabled. Stripe webhook fulfillment verifies server-retrieved payment totals, is transactional, and is safe to retry concurrently. Configure live prices separately from test prices before enabling sales.
- Configure the Supabase production Site URL, six-digit OTP email template/expiration, production SMTP, and Brevo verified sender before launch. Test both a new account and an existing account: requesting a code alone must not authenticate, and incorrect, expired, or reused codes must fail. Successful verification must preserve the current ticket selection or pending transfer invitation.
- Outbox jobs have a five-minute lease, exponential retry delay, and eight attempts. Check `email_outbox where status='failed'` and Cloudflare Worker logs. After fixing configuration, requeue failed messages by resetting `status='pending', attempts=0, available_at=now()`. Delivery is at least once: a crash after Brevo accepts an email but before marking it sent can produce a duplicate email, never duplicate tickets. Transfer secrets are removed from successful jobs.
- Full Stripe refunds revoke all tickets in the order, including transferred tickets. Partial refunds set the order to `needs_review` and suspend all its tickets. Review the refund in Stripe and determine the affected admissions before manually revoking refunded tickets and reactivating unaffected ones in a privileged transaction. Credentials revoked during suspension must be regenerated via the holder's QR endpoint; do not restore old credentials. Never reset a refunded order to paid or delete its fulfillment history.
- Refunds, inventory limits, tiers, and resale payments have no self-service UI in v1. No automatic tax configuration is applied. Verify Stripe price tax behavior and actual event pricing before live launch.

## Verification

- `npm test`: input validation, signed QR verification, API authentication/origin checks, and email-link behavior. Database test is skipped without `TEST_DATABASE_URL`.
- `TEST_DATABASE_URL=<disposable-empty-postgres-url> npm test`: also applies the migration to a fresh test database with a minimal Supabase Auth stub, and verifies concurrent fulfillment, transfer acceptance, scan races, both event days, refunds, profile rollback, Crew authorization, RLS, and email leases. **Use an empty disposable database, never production**. Requires `psql`; the test's stub `auth.users` is not intended for deployment.
- `npm run build`: TypeScript and Vite. Include VITE Supabase values to also compile the enabled ticketing interface.
- After building, `npm run check:worker` dry-runs the website Worker, email processing, and assets without deploying; `npm run email:check` checks the optional standalone email Worker. `check:functions` is retained as an alias for `check:worker`.
- After building, `npm run test:worker` runs the real Worker/assets router locally with dummy credentials, checking SPA deep links, API navigation, authentication, and environment/origin guards. It does not use a hosted database.
- With local Supabase running and `.env.local-testing.local` prepared, `npm run test:admin-bootstrap` verifies a real local OTP and concurrent admin-role initialization, then removes its temporary account/role. It refuses hosted Supabase URLs.
- Before launch, use Stripe test mode and two distinct verified emails to purchase multiple ticket types, transfer one admission, confirm the old QR is rejected, and test the staff scanner against test-event days in an isolated Supabase project. Also verify canceled checkout, delayed webhook/confirmation, failed email delivery, refund revocation, and mobile camera permissions.

## Discount codes

Apply all migrations in `supabase/migrations/` in filename order, including `20261112052130_ticket_discounts.sql` for existing installations. Admins manage codes in **My tickets → Discount codes**. Choose specific ticket types, use the 10/20/30/50% presets or enter a custom percentage (0.01–100, up to two decimal places), and enable/disable the code. Codes are case-insensitive and normalized to uppercase. Crew is never eligible. Only one code can be applied per checkout.

Checkout previews and revalidates the discount on the server. Savings are computed on the combined eligible ticket subtotal and rounded once to the nearest whole yen (half up). Ineligible tickets remain at full price. Each ticket type must have a distinct Stripe Product: the API creates an order-specific, product-restricted Stripe coupon for the exact calculated saving. The restricted Stripe API key therefore also needs **Coupons write** and **Prices read** permissions. Keep any additional dashboard discounts disabled for these sessions; the application supplies its own coupon. A 100% discount is supported, with ticket fulfillment following Stripe's verified `no_payment_required` completion event.

Edits affect future orders; existing checkouts preserve their code, percentage, ticket eligibility, and saving snapshots. Invalid, inactive, deleted, or ineligible codes fail checkout rather than silently charging full price. A discount counts as used only after successful payment (including successfully completed free orders). Used codes cannot be deleted, even after refunds; disable them to stop future use. Deleting an unused code hides it and disables new uses, while retaining a tombstone so an already-open Stripe checkout can complete at its captured price. Deleted unused code names can be reused; historical orders remain linked to the original discount record. If a previously opened checkout pays later, that deleted code reappears in the admin usage history and is protected from further deletion.

**View usage emails** shows the original buyer's submitted purchasing email, name, order, payment date, captured percentage, saving, and current payment status. The email is verified when accessing the account after checkout. Ticket transfers do not change this attribution. Failed/pending checkouts do not appear, and webhook retries do not duplicate usage. Email history is admin-only and paginated in batches of 100.

Additional discount API endpoints (only the preview is public):

| Endpoint                                     | Purpose                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/discounts/quote`                  | `{discountCode, qty:{<public-ticket-code>:quantity}}`; returns validated subtotal, savings, and total. |
| `GET /api/admin/discounts`                   | Admin list with selected ticket types and successful usage counts.                                     |
| `POST /api/admin/discounts`                  | Admin create: `{code, percentage, tickets:["startup"], active:true}`.                                  |
| `PATCH /api/admin/discounts/:id`             | Admin edit with the same fields.                                                                       |
| `DELETE /api/admin/discounts/:id`            | Admin delete; returns conflict if already used.                                                        |
| `GET /api/admin/discounts/:id/uses?offset=0` | Admin-only successful purchasing-email history.                                                        |

`POST /api/create-checkout` additionally accepts optional `discountCode`. Include it when deciding whether to reuse an idempotency key. No additional environment credentials are required.

## Account and admin pages

The home page presents Startup and Investor ticket cards below About. Register scrolls to Tickets; each card opens the shared purchase modal. Prices and purchase availability come from the public catalog, including any additional public ticket types. Closed sales, paused types, and catalog failures disable card purchase actions. `/account/tickets` and `/account/orders` provide dedicated management pages, with refreshable detail routes and OTP sign-in. `/account/transfer` accepts incoming invitations; existing `?tickets=1`, `?order=...`, and transfer-fragment email links remain supported. The dashboard has no Buy tickets button; registration is available from the home page.

The purchase modal first collects ticket quantities with a live total, then the buyer's name, email and optional discount code before secure payment. Edit tickets returns to selection without losing buyer details. Purchasing requires no OTP or existing account. Successful Checkout returns to `/account/tickets?order=...`, where email OTP is required to access tickets. Verified account reads associate unclaimed purchases with the Auth email; they never trust a submitted email for account access. Webhooks still confirm payment and issue tickets, including before the buyer signs in. Delayed confirmation refreshes account capabilities as well as tickets after sign-in, including an existing holder or staff member’s first purchase. Order data remains restricted to its original buyer. Canceled payment returns to the purchase modal with the saved selection and buyer details, without OTP. Failed, expired, or aged unlinked attempts return HTTP 409 with `code: checkout_restart_required`, exposing **Restart payment**. Completed purchases return `checkout_already_completed`, exposing **View purchases** and an explicit **Buy again** action. Recovery uses a fresh request key only after the user chooses it and keeps the form values. Pending attempts and transient errors retain their original key across retries and reloads. Checkout responses save their order ID with the request; payment confirmation clears storage only when the confirmed request key or order identity matches, preserving unrelated pending purchases.

My tickets requests an OTP only when the database confirms a current, nonrevoked ticket for that email, including unclaimed admissions from completed purchases. Unknown emails and pending purchases receive no code. The server rechecks account access for existing sessions. Valid transfer invitations have a separate token-bound sign-in check, and staff use `/admin`. Original buyers retain access to Orders for completed purchases, including receipts after transfer/refund. Recipients cannot see the Orders tab or open another buyer's order; recipients who make separate purchases see only their own order history.

Before deploying these access checks, apply **`20261112081040_ticket_account_access.sql` in `../takeoff-tokyo-supabase`** after the existing migrations (use the staging renderer for staging). It adds the service-only eligibility RPC and account-access checks. The browser verifies codes through Supabase as before; the app requests new codes through the checked server endpoint. No hosted SQL is applied by this website change.

Before deploying guest checkout, apply **`20261112072554_guest_checkout.sql` in `../takeoff-tokyo-supabase`**, after the existing migrations. It allows orders and purchased admissions to await email verification, links them on verified account access, protects unclaimed admissions, and preserves their visibility in admin registrations. The migration and database ownership tests live in that schema repository. Use its staging renderer for the staging schema; this website change does not apply hosted SQL.

Administrators enter `/admin` and land on Registrations. Navigation includes Registrations, Crew, Tickets & prices, Discounts, and Check-in. Check-in staff are limited to the scanner. Tickets & prices supports public-type creation, renaming, purchase availability, Stripe-backed JPY price changes, global sales controls, deletion of unused types, restoration, and price history. Registration detail editing/deletion remains outside this panel.

Before deploying these pages, apply **`20261112062547_admin_read_views.sql` from the separate `takeoff-tokyo-2027/takeoff-tokyo-2027-supabase-schema` repository**, after the two original migrations. It supplies service-only `admin_read` queries for global registration search, refreshable details, and price history. Do not add independent copies of this migration to the website repository.

Read API additions: `GET /api/admin/tickets/:id`, `GET /api/admin/ticket-types`, and registration list filters `q`, `type`, `status`, `payment`, `day`, `checkin=yes|no`, and `offset`. The list retains `tickets` and adds `hasMore`; pages contain up to 100 records. All queries require event admin authorization.

Browser verification: install Chromium with `bunx playwright install chromium`. In one terminal start `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=example npm run dev:frontend -- --host 127.0.0.1 --port 4173`, then run `npm run test:browser`. Tests use mocked APIs and a synthetic local session, never live Supabase/Stripe credentials. They cover direct page refreshes, second-day QR access, admin search/detail navigation, ordinary-user denial, and the 320px layout/purchase modal. Database authorization and cross-page search are tested separately in the schema repository.

## Three environments: local, dev Preview, main Production

| Environment    | Website                                                | Database                                                | Auth / email                                                                            |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Local          | `http://127.0.0.1:8788`                                | Local Docker Supabase, `public`                         | Separate local Auth users; OTP and ticket messages captured at `http://127.0.0.1:54324` |
| Hosted staging | `dev` branch, Cloudflare Worker Preview                | Existing hosted project, `staging` / `staging_private`  | Shared hosted Auth; separate staging staff roles and allowlisted ticket emails          |
| Production     | `main` branch, Cloudflare Worker production deployment | Existing hosted project, `public` / `ticketing_private` | Production Auth and email settings                                                      |

The Free-plan workaround separates staging **tables, RPC implementations, orders, roles, discounts, QR signing and payment events**. Hosted Auth users, Auth email configuration, database extensions, service-role credentials, and project quotas are shared. Staging is logical isolation within one project, not a separate security boundary against someone holding that project's service key. Production data is not copied into staging. Only local testing is a completely independent Supabase stack.

### Local testing

The schema repo's committed `supabase/config.toml` defines a dedicated project/container name, six-digit OTP emails, ten-minute expiry, and a local email inbox. From this website repository:

To start everything in tmux:

```sh
npm run local:tmux
```

This starts local Supabase (including Studio and the inbox), applies local migrations, refreshes local configuration, and configures the Stripe webhook secret before the website starts. It then opens the `takeoff-tokyo` session with four titled panes: website/API, Stripe webhook forwarding, ticket email worker, and a shell showing the website, Studio, and inbox links. The website pane uses `local:web` and sends queued messages after successful mutations; the separate email pane periodically retries pending messages. Docker, tmux, Stripe CLI, and installed project dependencies are required; the workspace or local configuration must contain a sandbox Stripe key.

Running the same command again reattaches to the existing session without restarting services. From inside tmux it switches sessions. Use `npm run local:tmux -- --detach` to start without attaching, or `--session NAME` to choose a session name. Detach with `Ctrl+b`, then `d`; the services keep running. `tmux kill-session -t takeoff-tokyo` stops the pane processes; run `npm run local:stop` separately to stop the Supabase containers. Failed processes remain visible in their panes so their errors can be inspected.

To start the services manually:

```sh
npm run local:start
npm run local:prepare
npm run local:user -- admin@example.test admin
npm run dev:local
```

Use a current Docker daemon. The Supabase CLI is pinned in this website. The schema repository is expected at `../takeoff-tokyo-supabase`; set `SCHEMA_REPO_DIR` if you cloned it elsewhere. This is an optional development dependency, not needed for standalone production builds.

`local:prepare` gets keys from **local** CLI status and writes ignored `.env.local-testing.local`. `dev:local` builds into a separate `.local-testing` directory and runs the same website Worker entry point under `wrangler dev --local`, using a generated config and validated local `.dev.vars`. It disables Wrangler's automatic `.env` fallback. It polls the local email outbox every five seconds. Workspace sandbox `.env` is never overwritten. Studio is at `http://127.0.0.1:54323`; sign in using an OTP from the local inbox. `npm run local:user -- staff@example.test checkin` creates a local scanner account. No passwords or real emails are needed.

Sales remain closed until local prices are configured. For payment testing, `local:prepare` copies the workspace `.env` sandbox Stripe key into `.env.local-testing.local` (an explicit local test-key override is retained). Run `npm run local:stripe` to configure and forward local webhooks, restart `npm run dev`, then set sandbox prices and open sales through `/admin/ticket-types`. Live keys are rejected in local/staging; explicitly configured production requires a live key. Do not copy hosted price rows or live webhook secrets. Stop the website with Ctrl+C and the Supabase stack with `npm run local:stop`. Local volumes persist; this workflow never resets a hosted database.

`npm run dev` and `dev:functions` now use the same guarded local environment as `dev:local`. The explicit `dev:frontend` command retains raw Vite for mocked tests or frontend diagnostics; it is not the isolated end-to-end workflow.

### Hosted staging schema

In the schema repository run:

```sh
node scripts/render-staging.mjs /tmp/takeoff-staging.sql
```

Review and apply that bundle to the existing project using the Supabase SQL editor. It applies the canonical migrations to `staging` and `staging_private`, with a separate migration ledger; rerunning it applies only new versions. It does not update production tables or copy their data. **Do not apply the original public-schema migrations as your staging setup.**

Add **only `staging`** to the project's Data API exposed schemas (keep `public` for production); never expose `staging_private`. Service-role-only grants and RLS remain in force—do not copy generic example grants that give anonymous users table access. Assign staging admins in `staging.event_staff`, independently of production admins. Auth users are shared, so use dedicated staging emails; do not delete hosted Auth users as a staging cleanup operation.

### Cloudflare Git branch configuration

Connect the repository to the **website Worker** in Workers & Pages → Settings → Builds. Pages build settings and secrets do not migrate automatically. These settings use [Worker Previews](https://developers.cloudflare.com/workers/previews/get-started/), supported by the project's Wrangler version:

The repository pins `bun@1.4.2` through `package.json`'s `packageManager` field, which [Workers Builds uses to select the package manager version](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#package-manager-versions) before installing dependencies. Bun 1.2.15 cannot parse the committed version 2 `bun.lock`; keep the lockfile and frozen installs. If the build configuration explicitly sets `BUN_VERSION`, set it to **`1.4.2`** as well, then retry the build. This must be a **build** variable; a runtime binding in `wrangler.toml` cannot fix dependency installation.

1. Production branch: **`main`**.
2. Preview deployment branch controls: **include only `dev`**.
3. Build command: **`npm run build:cloudflare`**. Production deploy command: **`npx wrangler deploy`**. Preview command: **`npx wrangler preview --name dev`**. Use repository root `/`; assets come from `dist` in Wrangler config, with no Pages output-directory setting. Existing Workers may need the one-time Worker Previews setup in Builds settings; do not use `wrangler versions upload` for this staging configuration.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **build** variables. Workers Builds injects `WORKERS_CI_BRANCH`; the script derives `VITE_APP_ENV` (`main` → production, `dev` → staging) and rejects other branches. Build variables are separate from runtime secrets.
5. Set backend secrets separately under **Production** and **Previews Base** in Worker settings, including `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` for automatic ticket emails. Root `wrangler.toml` fixes Production to `APP_ENV=production` / `SUPABASE_DB_SCHEMA=public` and `previews.vars` to `APP_ENV=staging` / `SUPABASE_DB_SCHEMA=staging`. Previews do not inherit production secrets. Use `.env.production.example` and `.env.staging.example` as the credential lists.
6. Preview needs the shared Supabase URL/service key, a **sandbox Stripe key**, a webhook signing secret registered for the **Preview** endpoint, and an independent QR signing secret. Do not reuse the production QR secret or live Stripe keys. CLI equivalents are `npx wrangler secret put KEY` for production and `npx wrangler preview base-config secret put KEY` for new Previews. Changing Base secrets affects new Previews only; update the existing dev Preview using `npx wrangler preview secret put KEY --name dev` as well.
7. Root `wrangler.toml` sets the non-secret preview runtime `SITE_URL` to `https://dev-takeoff-tokyo-main-website.ankhasgreens.workers.dev`. Redeploy the **dev Preview** to apply it. If `SITE_URL` was previously stored as a secret, remove that obsolete secret from **dev Preview** and **Previews Base** before deploying the configured variable. The registered Stripe sandbox webhook is `https://dev-takeoff-tokyo-main-website.ankhasgreens.workers.dev/api/stripe-webhook`; copy that destination's signing secret to staging's `STRIPE_WEBHOOK_SECRET`. Its `STRIPE_SECRET_KEY` must belong to the same sandbox/account. Use the same site origin on the optional staging email Worker. Open this stable URL for payment testing; account emails and Checkout redirects use it. Set production's `SITE_URL` independently to the production site origin.

If browser POST requests (including `/api/auth/request-code`) fail while `GET /api/ticket-types` works, check the selected Preview's **runtime** `SITE_URL`. The origin check runs before sign-in or database access and requires an absolute HTTP(S) URL. Missing or malformed values used to produce the generic HTTP 500 message "Unable to complete request. Please try again."; they now return HTTP 503 and log the invalid configuration name. Setting a Builds variable or editing an ignored `.env.staging.local` file does not update the deployed runtime. To repair an existing Preview before redeploying, set its runtime `SITE_URL` to the stable URL above; updating Previews Base alone does not change an existing Preview.

`npm run staging:prepare` creates an ignored `.env.staging.local` from the shared Supabase settings without overwriting production configuration; it copies a Stripe key only if it is already a sandbox key. Fill its Preview webhook secret and email allowlist. `npm run build:staging` validates that file and writes `dist-staging` for a manual staging build. Cloudflare Git builds instead consume the appropriate dashboard variables and use `build:cloudflare`; ignored local env files are not uploaded.

Set a comma-separated `STAGING_EMAIL_ALLOWLIST` on the dev Preview, alongside its Supabase/Brevo runtime secrets. The website attempts email delivery after successful payment, transfer and Crew API calls. Worker Previews do not run Cron Triggers; for periodic retries while staging is idle, optionally deploy `wrangler deploy --config workers/wrangler.toml --env staging` and supply that Worker's matching staging secrets and allowlist. It reads only staging outbox jobs. Emails to other recipients fail without sending. Auth OTP messages use the shared Supabase Auth configuration and are not governed by that ticket-email allowlist. Production Worker secrets are not inherited by staging.

Payment sessions carry their environment in Stripe metadata. Each webhook ignores sessions from other environments, and non-production webhooks reject live-mode events. The frontend sends its environment on API calls; mismatched builds and runtime settings fail before database access. Separate browser session storage prevents automatic account-panel session reuse across environments.

These changes prepare Git-driven deployments; they do not change your Cloudflare dashboard branch settings, apply hosted SQL, or publish the website automatically.

### Stripe sandbox baseline

The filled-in workspace `.env` is the **sandbox baseline**, not production credentials. Local testing and hosted staging intentionally use the same Stripe sandbox account/key. Their Supabase tables remain separate, and payment metadata routes webhook events to the correct environment. `local:prepare` copies only the Stripe sandbox key from `.env`; it never copies the hosted Supabase connection into the local stack.

The generated `.env.staging.local` uses that same sandbox key. Configure it as the website Worker's **Previews Base** Stripe secret for `dev`. Use `.env.production.example` and independently supplied live keys for Cloudflare **Production** on `main`. Live keys are rejected by local/staging, and explicit production rejects sandbox keys.

A webhook signing secret belongs to its receiving endpoint or Stripe CLI listener. Keep the local listener's secret in `.env.local-testing.local` and the sandbox Preview endpoint's secret in `.env.staging.local`/Preview secrets. An existing workspace webhook secret should be assigned only after confirming which endpoint it belongs to. These scripts do not guess or duplicate it between endpoints.

### Admin ticket catalog API

All routes below require a verified event admin. Check-in staff and ordinary holders cannot mutate the catalog.

| Endpoint                                   | Body / behavior                                                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/ticket-types`              | Includes deleted types, paid-order counts and price history.                                                                           |
| `POST /api/admin/ticket-types`             | `{code,label,requestKey:<UUID>}`; creates a paused public type.                                                                        |
| `PATCH /api/admin/ticket-types/:id`        | `{label,publicPurchase:<boolean>}`; enabling requires a current price.                                                                 |
| `POST /api/admin/ticket-types/:id/prices`  | `{amount:<whole yen>,requestKey:<UUID>}`; creates a new Stripe price and makes it current. Retry identical requests with the same key. |
| `DELETE /api/admin/ticket-types/:id`       | Deletes only types with no successful purchase history.                                                                                |
| `POST /api/admin/ticket-types/:id/restore` | Restores a deleted type paused; set its price before enabling it.                                                                      |
| `PATCH /api/admin/ticket-sales`            | `{enabled:<boolean>}`; controls event-wide sales.                                                                                      |

New public types appear automatically in checkout, registration filters and discount associations. They collect the standard attendee information; Startup/Investor retain their specialized questionnaires. Concurrent price edits use a database comparison to prevent one admin silently overwriting another. A conflicting request must be restarted with a fresh UUID. Stripe products are separated by environment and ticket type, preserving discount eligibility even when local/staging share a sandbox. Products and historical prices remain active at Stripe so pending sessions keep working; the database controls public availability.

Apply migration `20261112074916_admin_ticket_pricing.sql` from the schema repository before deploying these routes. Local development applies it to the local stack; hosted staging uses the rendered staging bundle, and production uses the canonical public-schema migration. These deployments require **Products and Prices read/write** Stripe permissions alongside the existing Checkout/Coupons write and Charges read permissions.

### Verify local sandbox payments

Keep `npm run local:stripe` running alongside `npm run dev`. Complete a checkout created by the local website in Stripe sandbox mode. The verified webhook marks its local `orders` row paid, saves the Checkout Session/PaymentIntent IDs and payment timestamp, issues `tickets`, records a deduplicated `stripe_events` entry, and queues the purchase email. Discount usage and purchasing emails derive from successfully paid orders. Check-in usage is tracked separately in `ticket_checkins`. Card numbers and CVC are not stored.

Inspect local data at http://127.0.0.1:54323, or use the admin registration, price and discount pages. Redirecting back from checkout alone does not mark an order paid. If the listener was off during payment, its pending local order needs the genuine Stripe event delivered again; do not manually mark it paid. Local sessions carry environment metadata so the shared sandbox’s staging events are ignored.

### UI and HTML email templates

The account and admin pages use the UI package’s dark palette, typography and components. Advanced registration filters, discount entry, and optional questionnaires expand on demand; collapsed questionnaire inputs retain their values. Mobile navigation stays available, and checkout keeps the payment total and action visible while scrolling.

Ticket purchase, transfer, accepted-transfer and Crew messages include both HTML and plain-text bodies. `workers/email-template.js` contains the shared email layout and inline styles for email-client compatibility. Local Mailpit receives the same HTML as Brevo. The OTP template at `supabase/templates/email-otp.html` matches this design; the canonical copy is in the schema repository. Update both Supabase **Magic Link** and **Confirm Signup** email templates with that HTML before hosted release. Retain `{{ .Token }}` and the six-digit, ten-minute OTP settings. Hosted Auth configuration is shared between staging and production in the existing Supabase project.

HTML emails use the full Takeoff Tokyo wordmark from `/images/takeoff-tokyo-logo.png` in the header, displayed at 242×80 with responsive scaling. The existing PNG wordmark is used for email-client compatibility. Ticket messages load it from the email Worker's `SITE_URL`; the OTP template uses Supabase's `{{ .SiteURL }}`. Deploy the website's public assets at that origin so email clients can retrieve the image. The image has `Takeoff Tokyo` alt text for clients that block external images.

### Account links and email acknowledgements

Accepted-transfer emails link to `/account`. Signed-out visitors can choose **My tickets** or **Orders** before requesting a code; signed-in visitors go to a page their account can access. The same sign-in options are available on both account entry pages, so original buyers can access receipts after transferring their last ticket. Eligibility checks and original-buyer order authorization still apply.

The shared RPC helper accepts successful empty responses, including PostgREST’s `204 No Content` response for `finish_email`. Email transport tests use actual empty 204 `Response` objects for acknowledgement. Browser regression tests cover terminal checkout recovery, preserved pending request keys, delayed first-purchase capabilities, and both transfer-email account paths.

### Stored invitations and checkout selections

A newly opened transfer link routes to its invitation once. A stored invitation alone does not redirect visits to the home page. **Dismiss invitation** works before authentication and after eligibility errors, removes the stored token, and returns to registration.

Order details are cleared whenever the route changes and displayed only for the current order and signed-in user. Loading or failing to open another order never displays the previous receipt.

Restored paused/deleted ticket types appear under **Unavailable tickets** with removal controls. An unchanged pending selection can still use **Resume payment** with its original key and captured checkout prices. Removing unavailable types updates only the form until the user submits the fresh selection, which receives a new key. Hidden unavailable quantities cannot block the form without a way to remove them.

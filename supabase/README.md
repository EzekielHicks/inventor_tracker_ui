# Supabase workspace setup

This app uses one shared workspace per Supabase project. Apply
`supabase/migrations/20261103000000_shared_workspace.sql` in the Supabase SQL
Editor before signing in. The migration creates the account and workspace tables,
enables row-level security, and promotes only the first registered account to
Admin. Later self-registrations remain pending and cannot read workspace data.

Set these variables in `.env.local` and in the deployment's server environment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

The service-role key is server-only. Never prefix it with `NEXT_PUBLIC_` or
include it in browser code. It is used by protected server routes for workspace
data writes and Admin invitations.

In Supabase Authentication settings, enable email/password sign-in, set the site
URL to the app origin, and allow the callback URL `<APP_ORIGIN>/auth/callback`
(for local development, `http://localhost:3000/auth/callback`). Create the first
Admin account from the sign-in page's signup link. Later public signups remain
pending; use Settings to invite Managers and Team Members. Invitees set a
password from the email link before entering the workspace.

If the original migration has already been applied and any Auth users existed
before the membership trigger was installed, run
`supabase/migrations/20261103010000_backfill_workspace_members.sql` in the SQL
Editor. It adds missing users as pending and promotes the oldest Auth user to
Admin only when no workspace Admin exists. The script is safe to run again.

Email confirmation is controlled by Supabase Auth, not the app. If signup says
to check email but no message arrives, check Supabase Auth email-provider
settings, SMTP configuration and rate limits, the recipient's spam folder, and
the Auth email logs. A confirmation-required signup stays on the page until the
email link is opened; use the resend button there to request another email.

The first Admin's browser imports its saved supplier workspace, inventory
settings, and old demo profiles once. Inventory defaults and subsequent
products, orders, and usage records are persisted to Supabase. Other browsers
sign in to the shared workspace and do not overwrite existing data. The old
demo profiles are retained only as migration metadata; each person must use an
invited account, and the server-side workspace role determines access.

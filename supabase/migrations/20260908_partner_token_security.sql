-- Partner dashboard token security: hash, expiry, revocation support.
--
-- Background: dashboard links are bearer credentials. They were stored as
-- plaintext, never expired, and kept working after suspension — any database
-- or backup read impersonated every partner. After this migration only
-- SHA-256 hashes are stored (tokens are 192-bit CSPRNG output, so plain
-- SHA-256 has nothing to dictionary-attack), links expire, and issuance is
-- rotation (mintPartnerDashboardToken).
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the matching
-- application code. The new code hashes tokens before lookup, so plaintext
-- rows would stop matching until this migration converts them.
--
-- KEEP THIS FILE IN THE REPO. Deleted migrations cannot be verified by CI;
-- see scripts/security-contract-check.mjs.

create extension if not exists "pgcrypto" with schema "extensions";

alter table public.referral_partners
  add column if not exists dashboard_token_expires_at timestamptz;

-- One-way hash of any still-plaintext tokens (48 hex chars) into SHA-256 hex
-- (64 chars). The length guard makes this idempotent: already-hashed values
-- are untouched on re-run. After this, a usable bearer token exists only in
-- the partner's hands, never in the database or its backups.
update public.referral_partners
  set dashboard_token = encode(extensions.digest(dashboard_token, 'sha256'), 'hex')
  where dashboard_token is not null
    and length(dashboard_token) = 48;

-- Existing links get a one-year window from migration time; links minted
-- afterwards carry expiry from issuance.
update public.referral_partners
  set dashboard_token_expires_at = now() + interval '365 days'
  where dashboard_token is not null
    and dashboard_token_expires_at is null;

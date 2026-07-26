# Gmail Integration for Nodemailer — Primary-Source Research

> Compiled from official Google documentation, nodemailer.com, and npm registry. Last updated: 2026-07-26.

> **Purpose:** Inform how to connect the deplacementapp Next.js monolith to Gmail for sending travel-request approval/rejection notifications via the existing nodemailer-based `EmailService`.

---

## 1. Ways to Use Gmail for Outgoing Email

There are three supported authentication methods, plus an alternative SMTP relay for Google Workspace:

| Method | When to use | Status |
|---|---|---|
| **OAuth 2.0** | Recommended for all new integrations. Works with personal Gmail and Google Workspace. | Supported |
| **App Password** | Works only when 2-Step Verification is enabled. Simpler than OAuth 2.0 for small internal tools. | Supported |
| "Less Secure App" password | Deprecated — used plain username/password. | Disabled since May 30, 2022 |

*Source:* [nodemailer.com — Using Gmail](https://nodemailer.com/guides/using-gmail)

Gmail SMTP can be reached at:

- **Host:** `smtp.gmail.com`
- **Port 465** — SSL (TLS from the start)
- **Port 587** — TLS/STARTTLS
- **Authentication:** Required on both ports

*Source:* [Google Support — Read Gmail messages on other email clients](https://support.google.com/mail/answer/7104828)

**Important caveat:** Gmail rewrites the `From:` header to match the authenticated account. If you authenticate as `foo@gmail.com` but set `from: bar@example.com`, Gmail silently replaces it. Workarounds: set up a Gmail alias or use Google Workspace with the SMTP relay.

*Source:* [nodemailer.com — Using Gmail (Gmail rewrites the From header)](https://nodemailer.com/guides/using-gmail#gmail-rewrites-the-from-header)

### Additional option: Google Workspace SMTP relay

If using Google Workspace, the SMTP relay (`smtp-relay.gmail.com`) can be used. This authenticates by IP address (not user credentials) and is recommended for printers/scanners and apps. It supports sending as any address in the Workspace domain.

- **Host:** `smtp-relay.gmail.com`
- **Ports:** 25, 465, or 587
- **Limit:** 10,000 recipients per user per day

*Source:* [Google Support — Send email from a printer, scanner, or app](https://support.google.com/a/answer/176600)

---

## 2. Configuring Nodemailer with Gmail SMTP

### Using App Password (simpler)

```js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "me@gmail.com",
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});
```

The `service: "gmail"` shortcut auto-configures `smtp.gmail.com:465` with SSL. Equivalent manual config:

```js
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "me@gmail.com",
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});
```

### Using OAuth 2.0 (recommended)

```js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: "me@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});
```

Nodemailer auto-refreshes expired access tokens when a `refreshToken` is provided.

### Using Google Workspace SMTP relay

```js
const transporter = nodemailer.createTransport({
  service: "GmailWorkspace",  // smtp-relay.gmail.com:465
  auth: {
    user: "me@mydomain.com",
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});
```

*Source:* [nodemailer.com — Using Gmail (App Password)](https://nodemailer.com/guides/using-gmail#app-password-requires-2-step-verification), [nodemailer.com — OAuth2](https://nodemailer.com/smtp/oauth2), [nodemailer.com — Well-Known Services](https://nodemailer.com/smtp/well-known-services)

---

## 3. Gmail App Password

An **App Password** is a 16-digit passcode that gives an app or device permission to access a Google Account. It is **not** the account's regular password.

### Prerequisites

- **2-Step Verification must be turned on** for the Google Account. Without 2FA, the App Password option does not appear.
- App Passwords are **not available** for accounts with:
  - 2-Step Verification set up only for security keys
  - Advanced Protection enabled
  - Work/school accounts where the admin has disabled them

### How to generate

1. Go to [Google Account Security settings](https://myaccount.google.com/security)
2. Under "Signing in to Google," select **App Passwords** (you may need to sign in again)
3. Select "Mail" as the app and your device
4. Click **Generate**
5. Copy the 16-character password (it appears once)

### Usage notes

- Each app/device typically needs its own App Password
- App Passwords bypass most of Google's additional security checks, but Google may still block connections from unusual locations
- If an App Password stops working, generate a new one

*Source:* [Google Account Help — Sign in with app passwords](https://support.google.com/accounts/answer/185833), [Google Account Help — Turn on 2-Step Verification](https://support.google.com/accounts/answer/185839)

---

## 4. Gmail API OAuth2 for Nodemailer

### Architecture overview

Two approaches exist for authorizing a server-side app to send email via Gmail:

#### A. OAuth 2.0 client ID (OAuth consent screen)

For apps that act on behalf of a single Gmail user (or allow users to sign in with their own Gmail).

**Setup steps:**

1. **Create a Google Cloud project** — go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Enable the Gmail API** — in APIs & Services > Library
3. **Configure OAuth consent screen** — under APIs & Services > OAuth consent screen
   - Choose **Internal** (if only your org uses it) or **External**
   - Add the scope `https://www.googleapis.com/auth/gmail.send`
   - Add test users (if External and in Testing mode)
4. **Create OAuth 2.0 credentials** — under APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: **Web application**
   - Add authorized redirect URIs
   - Note the **Client ID** and **Client Secret**
5. **Obtain a refresh token** — run the OAuth2 flow (redirect user → authorize → exchange code for tokens). The refresh token is what Nodemailer stores and uses to get new access tokens.

**Nodemailer requires:**
- `clientId` — OAuth 2.0 Client ID
- `clientSecret` — OAuth 2.0 Client Secret
- `refreshToken` — obtained after user consent
- The access token scope must be `https://mail.google.com/` for SMTP or `https://www.googleapis.com/auth/gmail.send` for the API

*Source:* [Google Developers — Implement server-side authorization (Gmail API)](https://developers.google.com/workspace/gmail/api/auth/web-server), [Google Developers — Configure OAuth consent screen](https://developers.google.com/workspace/guides/configure-oauth-consent), [Google Developers — Create access credentials](https://developers.google.com/workspace/guides/create-credentials), [Google Developers — Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

#### B. Service account with domain-wide delegation

For apps that need to send mail on behalf of **any user in a Google Workspace domain** without individual consent.

**Setup steps:**

1. Create a service account in Google Cloud Console
2. Enable **domain-wide delegation** on the service account
3. In Google Admin Console, grant the service account's client ID the OAuth scope (`https://www.googleapis.com/auth/gmail.send`)
4. In code, the service account impersonates a specific user to send mail

**Nodemailer does not directly support service accounts.** Instead, use the `googleapis` library to obtain an access token for the impersonated user, then pass it to Nodemailer's OAuth2 config.

*Source:* [Google Developers — Create access credentials (service accounts)](https://developers.google.com/workspace/guides/create-credentials#service-account)

---

## 5. Rate Limits / Sending Limits

### Gmail SMTP limits (both App Password and OAuth2 SMTP)

| Account type | Messages per day (rolling 24h) | Recipients per message |
|---|---|---|
| **Personal Gmail** | 500 | 100 via SMTP / 500 via API |
| **Google Workspace** | 2,000 (1,500 for mail merge) | 2,000 total (500 external) |
| **Trial Workspace** | 500 | 2,000 total (500 external) |

When exceeded, Gmail rejects with an SMTP error: `550 5.4.5 Daily user sending limit exceeded`.

### Gmail API quotas (when using the API directly, not SMTP)

| Limit type | Value |
|---|---|
| Per minute per project | 1,200,000 quota units |
| Per minute per user per project | 6,000 quota units |
| Per day per project (threshold) | 80,000,000 quota units |
| **`messages.send` cost** | **100 quota units** per call |
| Recipients per message via API | 500 |

So per user you get ~60 `messages.send` calls per minute (6,000 / 100), and ~800,000 per day (80M / 100).

Exceeding these returns HTTP 403/429 errors (`dailyLimitExceeded`, `rateLimitExceeded`).

### Gmail API vs SMTP — which to use?

| Dimension | SMTP (via nodemailer) | Gmail API |
|---|---|---|
| **Sending limit (Workspace)** | 2,000 messages/day | ~800,000/day via API quota |
| **Recipients per message** | 100 | 500 |
| **Setup complexity** | Low (App Password) or Medium (OAuth2) | High (full OAuth2 consent screen + API client) |
| **Vendor lock-in** | Low — standard SMTP, switch providers by changing config | High — Google-specific API |
| **From: header rewriting** | Yes (Gmail always rewrites) | Same behavior |

**Verdict for deplacementapp:** For a business app sending ~hundreds of approval/rejection emails per day, SMTP via nodemailer with an App Password (or OAuth2) is simpler and sufficient. The Gmail API only becomes necessary if sending exceeds 2,000 messages/day or if per-recipient limits are a concern.

*Source:* [nodemailer.com — Using Gmail (Daily sending limits)](https://nodemailer.com/guides/using-gmail#daily-sending-limits), [Google Support — Limits for sending & getting mail](https://support.google.com/mail/answer/22839), [Google Workspace Admin Help — Gmail sending limits](https://support.google.com/a/answer/166852), [Google Developers — Gmail API Usage limits](https://developers.google.com/workspace/gmail/api/reference/quota), [Google Developers — Gmail API errors](https://developers.google.com/workspace/gmail/api/guides/handle-errors)

---

## 6. Environment Variables for a Next.js + Nodemailer App

The deplacementapp already uses these env vars (see `.env.example` and `lib/email-service.ts`):

| Current variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username (Gmail address) |
| `SMTP_PASS` | SMTP password (App Password) |
| `SMTP_FROM` | Default from-email address |
| `SMTP_FROM_NAME` | Display name for the sender |

For Gmail integration, recommended additions/changes:

| Variable | Purpose | Example value |
|---|---|---|
| `SMTP_HOST` | Gmail SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port for SSL | `465` |
| `SMTP_USER` | Full Gmail/Workspace email | `travel@example.com` |
| `SMTP_PASS` | App Password (not regular password) | `xxxx xxxx xxxx xxxx` (16 chars, no spaces) |
| `SMTP_FROM` | Default sender address | Same as `SMTP_USER` (Gmail rewrites From) |
| `SMTP_FROM_NAME` | Sender display name | `DeplacementApp` |

**Optional (OAuth2 route):**

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token from the OAuth2 consent flow |

**How it maps today:** The existing `EmailService` already reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`. To switch to Gmail, a deployer would set these to the Gmail SMTP values + an App Password. No code changes needed.

---

## 7. Security Best Practices

### .env file and secret storage

- **Never commit secrets** to version control. The `.env` file is in `.gitignore`. Only commit `.env.example` with placeholder values.
- The deplacementapp's current `.env.example` correctly omits real secrets — only `SMTP_HOST=localhost`, `SMTP_PORT=1025`, empty `SMTP_USER`/`SMTP_PASS`.

### App Password security

- An App Password **replaces** your regular password for the SMTP connection. Never use your actual Google account password.
- An App Password gives full access to send mail as that account. Treat it as sensitive as a database password.
- If an App Password is compromised, revoke it immediately from the [App Passwords page](https://myaccount.google.com/apppasswords).

### OAuth 2.0 security

- Store `clientSecret` and `refreshToken` in environment variables, never in code.
- Refresh tokens can be revoked from the Google Account security page.
- Use the minimal scope (`gmail.send` or `mail.google.com`) — do not request read or delete scopes unless needed.

### Production deployment

- In production (Coolify), set these env vars in the Coolify UI — the `compose.yaml` already marks them required with `${VAR:?}` syntax.
- Use different App Passwords (or OAuth2 tokens) for dev, staging, and production.
- Monitor the Google Account for security alerts — Google may block connections from unusual IP addresses.

*Source:* [Google Account Help — Sign in with app passwords](https://support.google.com/accounts/answer/185833), [nodemailer.com — Using Gmail (Troubleshooting)](https://nodemailer.com/guides/using-gmail#troubleshooting-checklist), nodemailer.com — [SMTP transport](https://nodemailer.com/smtp), nodemailer.com — [Error reference](https://nodemailer.com/errors)

---

## Sources

All sources are official/primary:

### Google official documentation

| Topic | URL |
|---|---|
| Gmail SMTP settings (POP/IMAP clients) | https://support.google.com/mail/answer/7104828 |
| Send email from a printer, scanner, or app (SMTP relay) | https://support.google.com/a/answer/176600 |
| Gmail sending limits in Google Workspace | https://support.google.com/a/answer/166852 |
| Limits for sending & getting mail (personal Gmail) | https://support.google.com/mail/answer/22839 |
| App Passwords — sign in with app passwords | https://support.google.com/accounts/answer/185833 |
| Turn on 2-Step Verification | https://support.google.com/accounts/answer/185839 |
| Route outgoing SMTP relay messages through Google | https://support.google.com/a/answer/2956491 |
| Gmail API — sending guide | https://developers.google.com/workspace/gmail/api/guides/sending |
| Gmail API — server-side authorization (OAuth2) | https://developers.google.com/workspace/gmail/api/auth/web-server |
| Gmail API — usage limits / quota | https://developers.google.com/workspace/gmail/api/reference/quota |
| Gmail API — handle errors | https://developers.google.com/workspace/gmail/api/guides/handle-errors |
| Gmail API — OAuth scopes | https://developers.google.com/workspace/gmail/api/auth/scopes |
| Gmail API — reference `messages.send` | https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send |
| Configure OAuth consent screen | https://developers.google.com/workspace/guides/configure-oauth-consent |
| Create access credentials (OAuth client IDs, service accounts) | https://developers.google.com/workspace/guides/create-credentials |
| Node.js quickstart (Gmail API) | https://developers.google.com/workspace/gmail/api/quickstart/nodejs |
| View & edit API quota limits | https://developers.google.com/workspace/guides/view-edit-quota-limits |

### Nodemailer documentation

| Topic | URL |
|---|---|
| Using Gmail (authentication methods, App Password, OAuth2, limits) | https://nodemailer.com/guides/using-gmail |
| OAuth2 authentication | https://nodemailer.com/smtp/oauth2 |
| SMTP transport (general config) | https://nodemailer.com/smtp |
| Well-Known Services (service: "gmail" shortcut) | https://nodemailer.com/smtp/well-known-services |
| Error reference | https://nodemailer.com/errors |

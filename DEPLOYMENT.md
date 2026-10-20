# Deployment and Operations

The chatbot runs on Railway as one service plus a PostgreSQL database. The backend serves both the API and the built frontend, so the widget and the API share one origin: https://keka-chatbot-production.up.railway.app. For adding the widget to the WordPress site, see `WORDPRESS_EMBED.md`.

## How a deploy works

Railway deploys every push to `main`. `railway.json` sets the build to `npm install && npm run build -w backend` (the backend build also builds the frontend into `backend/dist/public`) and the start command to `npm start -w backend`.

On startup the backend creates any missing tables from `backend/src/db/schema.sql` and `backend/src/db/analytics-schema.sql`. Railway sets `PORT` and `DATABASE_URL` itself.

Check a deploy with:

```bash
curl https://keka-chatbot-production.up.railway.app/api/health
# {"status":"ok","timestamp":"..."}
```

## Environment variables

Set these in Railway under the service's **Variables** tab. `.env.example` lists them all with example values.

| Variable | What it does |
|---|---|
| `NODE_ENV` | Must be `production`. If it is unset or `development`, emails are only printed to the logs and the frontend is not served. |
| `HASH_SALT` | Salt for hashing visitor IPs in logs. Generate with `openssl rand -hex 32`. Without it a fixed default salt is used. |
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error`. Use `warn` in production. |
| `FRONTEND_URL` | Allowed origin for API calls in the CSP. |
| `ALLOWED_EMBED_DOMAINS` | Comma-separated sites allowed to show the chat in an iframe. Defaults to kekarehabservices.com and www.kekarehabservices.com. |
| `TZ` | The server's time zone. The weekly report is scheduled in it, so set `America/New_York`. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS SES credentials for all email. |
| `SES_FROM_EMAIL` | Sender address for every email. |
| `ADMIN_EMAIL` | **To:** address for new-request notifications. No notification is sent without it. |
| `HANDOFF_EMAIL` | Optional comma-separated **Bcc:** list for new-request notifications. |
| `WEEKLY_REPORT_RECIPIENT` | Comma-separated **To:** list for the weekly report. The report is off without it. |
| `WEEKLY_REPORT_ENABLED` | Set to `false` to turn the weekly report off. |
| `WEEKLY_REPORT_DAY`, `WEEKLY_REPORT_HOUR` | When the report goes out. Defaults: `monday`, `9`. |
| `ANALYTICS_ENABLED` | Set to `false` to stop recording analytics events. |
| `ANALYTICS_API_KEY` | Key for the `/api/analytics/*` endpoints. Leave unset to keep them off (see below). |

`ANALYTICS_RETENTION_DAYS` appears in `.env.example`, but no code reads it, and analytics events are never deleted automatically. The schema defines `delete_old_analytics_events()` (90 days), but nothing calls it.

Variables are read at startup, so a change takes effect on the next deploy.

## Email

All email goes through AWS SES from `SES_FROM_EMAIL`, which must be verified in SES (verify the kekarehabservices.com domain or the single address). While the SES account is in sandbox mode, it can only send to verified addresses, so either verify every recipient or request production access.

- **New request notification** (sent when a visitor finishes an intake flow or asks to be contacted): To `ADMIN_EMAIL`, Bcc `HANDOFF_EMAIL`. Entries are trimmed and de-duplicated, and `ADMIN_EMAIL` is dropped from the Bcc list. It contains the visitor's contact details and non-medical answers. It never contains health information or the chat transcript.
- **Weekly report**: To every address in `WEEKLY_REPORT_RECIPIENT`; recipients can see each other. Times in both emails are shown in Eastern time.

## Analytics endpoints

`/api/analytics/*` returns usage metrics (`weekly`, `sessions`, `daily`, `faqs`, `intake`, `conversion`, `peak-hours`, `active-sessions`, `concurrent-peak`), an HTML preview of the weekly report (`report-preview`), and `POST send-report`, which emails the report now. Nothing in the app calls them, and the weekly report is sent by a scheduler inside the server, not through these endpoints.

They are off unless `ANALYTICS_API_KEY` is set (they return 404). With a key set:

```bash
curl -H "Authorization: Bearer $ANALYTICS_API_KEY" \
  https://keka-chatbot-production.up.railway.app/api/analytics/weekly
```

A missing or wrong key returns 401. For ad-hoc analysis, `backend/docs/ANALYTICS_QUERIES.md` has SQL to run against the database directly.

## Database

Open the PostgreSQL service in Railway to browse tables in the **Data** tab, or connect with `psql "$DATABASE_URL"` using the URL from its **Variables** tab.

- `handoffs`: one row per contact request (name, contact details, service type, non-medical answers in `form_data`).
- `analytics_events`: anonymous usage events (session id, event type, metadata, hashed IP).

Back up before any manual change:

```bash
pg_dump "$DATABASE_URL" > backup.sql
```

`scripts/purge-handoff-phi.sql` removes health fields that older versions of the intake stored in `handoffs.form_data`. Back up first, then run `psql "$DATABASE_URL" -f scripts/purge-handoff-phi.sql`. It is safe to run more than once.

## Logs

Logs are JSON lines in the service's **Logs** tab. Events worth watching:

- `phi_detected`: a visitor typed something that looks like health information (the message itself is not logged).
- `handoff_not_persisted`: a request could not be saved to the database and exists only in the notification email.
- `contact_me_email_failed`, `email_config_missing`: a notification email was not sent.
- `analytics_auth_failed`: someone called an analytics endpoint with a missing or wrong key.

Logs must never contain message text, names or contact details.

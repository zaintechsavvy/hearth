# Deploying Hearth to Vercel

Vercel runs Hearth as serverless functions: each request may start a fresh copy, and the disk is read-only. The embedded database can't live there, so a Vercel deployment needs three settings. Until they are set, every page shows a **Finish setting up Hearth** screen listing what is missing, and API routes answer `503`.

## 1. Add a database

In the Vercel project, open **Storage**, choose **Create Database**, then **Neon** (Serverless Postgres), and connect it to the project. That adds `DATABASE_URL` to every environment. Any Postgres works: for Supabase or your own server, add `DATABASE_URL` yourself under **Settings**, **Environment Variables**, using the pooled connection string.

Each production deploy creates or updates Hearth's tables before it builds (`npm run vercel-build` runs `scripts/migrate.mjs`), using Neon's direct connection, `DATABASE_URL_UNPOOLED`, when there is one. Preview deploys share the production database, so they skip this step. On another serverless host, run `npm run db:migrate` with `DATABASE_URL` set before each deploy.

## 2. Add the other settings

Under **Settings**, **Environment Variables**, add:

| Name | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | A long random value: `openssl rand -base64 32`. Keep it forever. Changing it signs everyone out and makes stored integration tokens unreadable. |
| `BETTER_AUTH_URL` | The address you open Hearth at, such as `https://hearth-you.vercel.app` or your own domain. |
| `TRUSTED_ORIGINS` | Optional. Other addresses that may sign in, comma separated, such as a second domain. |
| `CRON_SECRET` | A long random value: `openssl rand -hex 32`. The same value goes in the GitHub repository's **Settings**, **Secrets and variables**, **Actions**, as a secret called `CRON_SECRET`. A scheduled job then looks at every home every five minutes, so Activity and alerts keep up with no screen open. |
| `DISABLE_SIGNUP` | Optional. `true` once everyone in your household has an account. A public deployment lets anyone who finds it sign up until then. |

## 3. Redeploy

Settings only reach new deployments. Open **Deployments**, then the latest one's menu, and choose **Redeploy**.

## What works differently on Vercel

- **Your devices must be reachable from the internet.** Hearth calls Home Assistant and the Matter Server from Vercel's servers, not from your home, so `http://homeassistant.local:8123` or a `192.168.x.x` address won't connect. Use a public address such as Home Assistant Cloud (Nabu Casa) or a Tailscale Funnel. Add RTSP cameras through Home Assistant (Settings, Cameras, Add): Home Assistant streams them with its own go2rtc, so there is no relay to expose.
- **Background work runs every five minutes, not all the time.** With `CRON_SECRET` set, the **Sweep homes** GitHub Action looks at every home every five minutes: changes reach Activity and door, leak, and doorbell alerts go out even with every screen closed, a few minutes late at most. GitHub can delay scheduled runs at busy times. Automations, sensor history, timers, and doses still need the monitor of a Hearth on an always-on machine with Docker (see the README).
- **The phone certificate route does nothing.** Vercel serves real HTTPS, so phones can install Hearth and allow notifications directly.

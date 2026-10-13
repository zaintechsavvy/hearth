# Deploying Hearth to Vercel

Vercel runs Hearth as serverless functions: each request may start a fresh copy, and the disk is read-only. The embedded database can't live there, so a Vercel deployment needs three settings. Until they are set, every page shows a **Finish setting up Hearth** screen listing what is missing, and API routes answer `503`.

## 1. Add a database

In the Vercel project, open **Storage**, choose **Create Database**, then **Neon** (Serverless Postgres), and connect it to the project. That adds `DATABASE_URL` to every environment. Any Postgres works: for Supabase or your own server, add `DATABASE_URL` yourself under **Settings**, **Environment Variables**, using the pooled connection string.

Hearth creates its tables on the first request after each deploy.

## 2. Add the other settings

Under **Settings**, **Environment Variables**, add:

| Name | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | A long random value: `openssl rand -base64 32`. Keep it forever. Changing it signs everyone out and makes stored integration tokens unreadable. |
| `BETTER_AUTH_URL` | The address you open Hearth at, such as `https://hearth-you.vercel.app` or your own domain. |
| `TRUSTED_ORIGINS` | Optional. Other addresses that may sign in, comma separated, such as a second domain. |
| `DISABLE_SIGNUP` | Optional. `true` once everyone in your household has an account. A public deployment lets anyone who finds it sign up until then. |

## 3. Redeploy

Settings only reach new deployments. Open **Deployments**, then the latest one's menu, and choose **Redeploy**.

## What works differently on Vercel

- **Your devices must be reachable from the internet.** Hearth calls Home Assistant and the Matter Server from Vercel's servers, not from your home, so `http://homeassistant.local:8123` or a `192.168.x.x` address won't connect. Use a public address such as Home Assistant Cloud (Nabu Casa) or a Tailscale Funnel, and the same for the camera relay.
- **No background work.** Alerts, automations, sensor history, and the activity log come from a monitor that runs all the time, and serverless functions stop between requests. The dashboard, controls, and widgets all work. For the rest, run Hearth on an always-on machine with Docker (see the README).
- **The phone certificate route does nothing.** Vercel serves real HTTPS, so phones can install Hearth and allow notifications directly.

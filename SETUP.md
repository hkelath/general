# HCLTech Sales Intelligence — Setup Guide

Deploy your own private instance in under 20 minutes. No coding required.

---

## What You'll Build

A web app that takes a company name and produces a full GTM intelligence brief:
opportunity scoring, tech stack analysis, key contacts, market signals, and
exportable slide decks — powered by Claude Opus 4.7, Tavily, and Apollo.io.

---

## What You'll Need

| Account | Free Tier? | Sign-up Link |
|---|---|---|
| Anthropic API | No — pay per use | console.anthropic.com |
| Tavily | Yes — 1,000 searches/month | tavily.com |
| Apollo.io | Yes — 50 credits/month | apollo.io |
| Render | Yes — 1 free web service | render.com |
| GitHub | Yes | github.com |

**Estimated cost per org analysed:** $0.50–$2.00 (Anthropic API only; others free on free tier)

---

## Step 1 — Get Your API Keys

### Anthropic (Claude AI)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add a payment method (credit card required even for low usage)
3. Go to **API Keys** → **Create Key**
4. Copy the key — it starts with `sk-ant-api03-…`
5. Add $10–20 credit to start (Settings → Billing)

### Tavily (Web Research)
1. Go to [tavily.com](https://tavily.com) and sign up free
2. Go to your dashboard → **API Keys**
3. Copy the key — it starts with `tvly-…`

### Apollo.io (Company & Contact Data)
1. Go to [apollo.io](https://app.apollo.io) and sign up free
2. Go to **Settings → Integrations → API**
3. Copy your API key

---

## Step 2 — Fork the Repository

1. Log in to [github.com](https://github.com)
2. Go to: `https://github.com/hkelath/hcltech-sales-intelligence`
3. Click **Fork** (top right) → fork to your own account
4. Your copy will be at: `https://github.com/YOUR-USERNAME/hcltech-sales-intelligence`

---

## Step 3 — Deploy to Render

1. Go to [render.com](https://render.com) and sign up (GitHub or Google login works)
2. Click **New** → **Web Service**
3. Choose **Connect a Git repository**
4. Select **GitHub** and authorise Render to access your GitHub account
5. Select your forked `hcltech-sales-intelligence` repository
6. Render will detect the settings automatically. Confirm:
   - **Name:** anything you like (e.g. `my-sales-intelligence`)
   - **Root Directory:** `claude-app`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
7. Click **Create Web Service** — do NOT deploy yet

---

## Step 4 — Add Your API Keys

Before the first deploy, add your three keys as environment variables:

1. In Render, go to your new service → **Environment** tab
2. Add the following key/value pairs:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your `sk-ant-api03-…` key |
| `TAVILY_API_KEY` | Your `tvly-…` key |
| `APOLLO_API_KEY` | Your Apollo key |

3. Click **Save Changes**
4. Go to the **Deploys** tab and click **Deploy Latest Commit**

---

## Step 5 — Verify It Works

1. Wait ~2 minutes for the build to complete (watch the deploy log)
2. Click the URL Render gives you (e.g. `https://my-sales-intelligence.onrender.com`)
3. The three status dots in the top-right navbar should turn **green** — Claude, Tavily, Apollo
4. Type a company name (e.g. `Commonwealth Bank of Australia`) and click **Analyse**
5. Expect 3–8 minutes for the first result — the AI reasoning phase is thorough

> **Note:** On Render's free plan, the service "sleeps" after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds to wake up. Upgrade to the $7/month
> Starter plan to keep it always-on.

---

## Usage Tips

### Single Org
Type one company name → get a full brief with opportunities, tech stack, contacts,
market signals, and export options (PPTX, Excel, Text).

### Bulk Analysis (up to 20)
Switch to **Bulk** mode and paste one company per line. Results appear as cards
you can click through. Export all as an Excel workbook for pipeline reviews.

### Industry Sweep
Switch to **Industry Sweep**, type a sector (e.g. `Retail`, `Financial Services`)
and optionally a region (e.g. `Australia`). Claude discovers the top 20 companies
in that sector and analyses each one — useful for territory planning.

### Exports
| Format | Best for |
|---|---|
| **Export PPTX** | Client-ready deck — opens in PowerPoint or Google Slides |
| **HTML Slides** | Print to PDF or share as a self-contained file |
| **Text Brief** | Copy/paste into email or CRM notes |
| **Export Excel** | Bulk pipeline review, share with leadership |

---

## Cost Reference

| Usage | Approx. Anthropic Cost |
|---|---|
| 1 single org brief | $0.50–$2.00 |
| 10 org bulk run | $5–$20 |
| Industry sweep (20 orgs) | $10–$40 |

Tavily and Apollo.io are free within their monthly limits. If you exceed Apollo's
free limit, company profile and contact data will be missing but the rest still works.

---

## Customising for Your Team

The AI's GTM recommendations are tuned to HCLTech's APAC partner ecosystem
(Pega, Databricks, Snowflake, Workato, Camunda, etc.) and Power of Three
(HCLTech + AWS + Partner) motions. To adjust for a different region, partner
set, or service focus, edit the system prompt in `claude-app/server.js`
starting at line 26 — then commit and push; Render will redeploy automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status dots not green | Check API keys are set correctly in Render Environment tab |
| "Analysis error: Request timed out" | Render free plan has a 30s HTTP timeout on cold starts — try again, or upgrade to Starter ($7/month) |
| Apollo data missing | Apollo free tier has 50 credits/month — you may have hit the limit |
| Page loads but nothing happens | Check Render deploy logs for build errors |
| Very slow first analysis | Normal — Claude's adaptive thinking phase can take 3–8 minutes |

---

*HCLTech Digital Business Services — Internal Tool*

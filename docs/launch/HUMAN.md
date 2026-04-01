# Writer AI — Human Launch Checklist

**You are**: the human operator. Your job is to set up all external services, configure environments, and wire everything together once both agents have merged their code changes. No coding required — this is pure service setup and configuration.

**This checklist uses the free Vercel domain** (`your-app.vercel.app`) for the MVP. No custom domain or Cloudflare setup required. Add those later when you're ready to grow.

**Do this in order.** Steps within a section can be parallelized, but sections are sequentially dependent.

---

## Section 1 — Upstash Redis Setup

The backend uses Redis to track per-IP usage limits. Set this up before Railway.

1. Go to **upstash.com** → sign up (free, no card required)
2. Create Database → **Redis** → name it `writer-ai-usage` → region **US-East-1** (matches Railway's default US region)
3. Tier: **Free** (10,000 commands/day, 256MB — more than enough for MVP)
4. After creation, click the database → **REST API** tab
5. Copy the **UPSTASH_REDIS_URL** — it looks like:
   ```
   rediss://default:ABCD1234...@us1-example-12345.upstash.io:6380
   ```
   Save this — you'll paste it into Railway's env vars in Section 3.

---

## Section 2 — PostHog Setup

PostHog captures every Analyze, Rewrite, Copy, and Download action so you can see whether writers actually use the product.

1. Go to **posthog.com** → sign up → select **US Cloud** region
2. Create a new project → name it "Writer AI"
3. Skip the integration wizard (the frontend code is already wired up)
4. Go to Project Settings → copy your **Project API Key** (starts with `phc_`)
5. Copy the **Host** value — for US Cloud it's `https://us.i.posthog.com`

Save both values — you'll add them as Vercel env vars in Section 4.

---

## Section 3 — Railway Backend Deployment

### 3.1 Create the Railway Project

1. Go to **railway.app** → sign in with GitHub
2. New Project → Deploy from GitHub repo → select `writer-ai`
3. When prompted for the root directory, enter: `backend`
4. Railway detects Python + uv from `pyproject.toml` automatically (nixpacks)
5. **Do not deploy yet** — set env vars first

### 3.2 Set Environment Variables

In Railway → your service → Variables tab, add:

```
GEMINI_API_KEY           = [your Gemini API key from aistudio.google.com]
UPSTASH_REDIS_URL        = [the rediss:// URL from Section 1]
CORS_ORIGINS             = ["https://your-app.vercel.app"]
ALLOWED_HOSTS            = ["your-app.vercel.app"]
LIMIT_USAGE_PER_IP       = true
MAX_ATTEMPTS_PER_IP      = 5
ENV                      = production
DEBUG                    = false
LOG_LEVEL                = INFO
GEMINI_MODEL             = gemini-2.5-flash
GEMINI_MODEL_FAST        = gemini-2.5-flash-lite
GEMINI_STRUCTURED_OUTPUT = true
```

> You won't know the exact Vercel URL until Section 4. Use a placeholder now and update in Section 3.4 once you have it.

### 3.3 Deploy

Click Deploy. Railway runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (from `railway.toml`).

Watch the deploy logs — it should finish in ~60 seconds. The healthcheck at `/health` should return `{"status": "ok"}`.

### 3.4 Note Your Railway Domain

Railway assigns a URL like `backend-production-abc1.up.railway.app`. Copy it — you'll need it for Vercel's `BACKEND_URL` in Section 4.

---

## Section 4 — Vercel Frontend Deployment

### 4.1 Create the Vercel Project

1. Go to **vercel.com** → New Project → Import from GitHub → select `writer-ai`
2. Set root directory: `frontend`
3. Framework: Next.js (auto-detected)
4. **Do not deploy yet** — set env vars first

### 4.2 Set Environment Variables

In Vercel → your project → Settings → Environment Variables:

```
BACKEND_URL              = https://backend-production-abc1.up.railway.app
                           (your Railway domain from Section 3.4 — no trailing slash)

NEXT_PUBLIC_POSTHOG_KEY  = phc_...
                           (from Section 2)

NEXT_PUBLIC_POSTHOG_HOST = https://us.i.posthog.com
                           (from Section 2)
```

`BACKEND_URL` does **not** have the `NEXT_PUBLIC_` prefix — it's server-side only and never sent to the browser. This is intentional.

### 4.3 Deploy

Click Deploy. Vercel builds Next.js and deploys globally in ~2 minutes.

After deploy, Vercel shows your URL: `your-app.vercel.app`. Copy it.

### 4.4 Update Railway CORS

Now that you have the real Vercel URL, go back to Railway → Variables → update:

```
CORS_ORIGINS  = ["https://your-app.vercel.app"]
ALLOWED_HOSTS = ["your-app.vercel.app"]
```

Trigger a redeploy in Railway after saving (Railway → your service → Deploy → Redeploy).

---

## Section 5 — Enable Vercel Analytics

Vercel dashboard → your project → Analytics tab → **Enable**

This gives you page views, Web Vitals, and geographic data automatically. No code change needed — the `<Analytics />` component is already in the codebase.

---

## Section 6 — Smoke Testing

Run through this checklist after all services are live.

### 6.1 End-to-End Flow

1. Open `https://your-app.vercel.app` in an incognito window
2. Paste a paragraph of fiction into the textarea → click **Analyze Structure**
3. Confirm beats appear in the sidebar
4. Type an instruction in the edit box → click Apply
5. Click **Rewrite Chapter** → confirm new chapter appears with highlights
6. Click **Copy** → paste into a text editor, confirm content is there
7. Click **Download** → confirm `.txt` file downloads

### 6.2 Rate Limiting

1. Open `https://your-app.vercel.app` in an incognito window
2. Perform 5 successful Analyze or Rewrite actions
3. The 6th attempt should return a 429 with a "free attempts" message
4. Confirm the limit modal appears in the UI

### 6.3 PostHog Events

1. Open PostHog → your project → Live Events (updates in real-time)
2. Perform an Analyze → confirm `chapter_analyzed` event appears
3. Click Copy → confirm `content_copied` event appears
4. All 8 event types should appear as you exercise the flow

### 6.4 Backend URL Is Hidden

1. Open browser DevTools → Network tab on `https://your-app.vercel.app`
2. Trigger an Analyze
3. The request should go to `your-app.vercel.app/api/v1/chapter/outline` — NOT to a Railway domain
4. If you see a Railway URL, the Vercel rewrite proxy is not working — check `BACKEND_URL` in Vercel env vars

---

## Section 7 — Post-Launch Monitoring

### Watch These Immediately After Launch

- **Railway logs** (Observability tab): Look for errors, 5xx responses, Gemini timeouts
- **Upstash dashboard**: Commands/day counter — stay under 10,000/day for the free tier
- **PostHog Live Events**: Confirm events are flowing from real users
- **Vercel Analytics**: Page views and Web Vitals

### Set a Railway Spend Alert

Railway → Settings → Billing → Spend Alert → set to **$10**. You'll be emailed before anything significant auto-charges.

### Set a Gemini Quota Alert

Google AI Studio → your project → APIs → Gemini API → Quotas → set email alert at **80% of daily limit**.

---

## Quick Reference: All Credentials to Collect

| Item | Where | Used In |
|---|---|---|
| Gemini API key | aistudio.google.com → API keys | Railway env var |
| Upstash Redis URL | upstash.com → DB → REST API tab | Railway env var |
| PostHog Project Key | posthog.com → Project Settings | Vercel env var |
| PostHog Host | posthog.com → Project Settings | Vercel env var |
| Railway domain | Railway → your service → Settings | Vercel `BACKEND_URL` |
| Vercel `.vercel.app` URL | Vercel deploy page | Railway `CORS_ORIGINS` + `ALLOWED_HOSTS` |

---

## Adding a Custom Domain Later

When you're ready to move beyond the MVP:

1. Buy a domain at **cloudflare.com/products/registrar** (at-cost, no markup)
2. Add Cloudflare DNS records:
   - `CNAME @ → cname.vercel-dns.com` (proxy **ON** — routes frontend through Cloudflare WAF)
   - `CNAME api → your-railway-domain.railway.app` (proxy **OFF** — Railway handles its own TLS)
3. Add the custom domain in Vercel → Settings → Domains
4. Add the custom domain in Railway → Settings → Domains (`api.yourdomain.com`)
5. Update Railway env vars: `CORS_ORIGINS`, `ALLOWED_HOSTS` to include the new domain
6. Enable Cloudflare: SSL/TLS Full Strict, Bot Fight Mode, WAF rate limit rule on `/api/v1/`

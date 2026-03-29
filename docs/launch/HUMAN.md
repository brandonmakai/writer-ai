# Writer AI — Human Launch Checklist

**You are**: the human operator. Your job is to set up all external services, configure environments, and wire everything together once both agents have merged their code changes. No coding required — this is pure service setup and configuration.

**Do this in order.** Steps within a section can be parallelized, but sections are sequentially dependent.

---

## Section 1 — Domain

### 1.1 Buy the Domain at Cloudflare Registrar

Go to **cloudflare.com/products/registrar** and sign in or create an account.

1. Search for your domain. Recommended formats: a short `.com` (e.g. `writercraft.com`) or `.ai` (e.g. `narrateai.ai`). `.com` is ~$10/yr; `.ai` is ~$70/yr.
2. Purchase the domain. Cloudflare Registrar sells at cost with no markup — renewals stay the same price.
3. The domain is now automatically on Cloudflare's DNS. Skip the nameserver step below if you buy here.

**If you buy elsewhere (Namecheap, etc.):**
1. Go to Cloudflare dashboard → Add a Site → enter your domain → Free plan
2. Cloudflare gives you two nameservers (e.g. `kate.ns.cloudflare.com`)
3. Go to your registrar → domain settings → change nameservers to Cloudflare's two
4. Wait 5–30 minutes for propagation

---

## Section 2 — Cloudflare Configuration

Do this after DNS is on Cloudflare.

### 2.1 SSL/TLS Mode
Cloudflare dashboard → SSL/TLS → Overview → set mode to **Full (Strict)**

This ensures end-to-end encryption from browser → Cloudflare → your servers. Without "Strict", Cloudflare won't verify your server's certificate.

### 2.2 Enable Bot Fight Mode
Cloudflare dashboard → Security → Bots → **Bot Fight Mode: ON**

This is your primary defense against Meta's link preview crawlers (`facebookexternalhit`), which fire millions of requests when your URL is shared on Facebook/WhatsApp/Instagram. Bot Fight Mode identifies and JS-challenges them before they reach your servers. Free, zero configuration beyond the toggle.

### 2.3 Create a WAF Rate Limit Rule
Cloudflare dashboard → Security → WAF → Rate Limiting Rules → Create Rule

- **Rule name**: API Rate Limit
- **Field**: URI Path | **Operator**: starts with | **Value**: `/api/v1/`
- **Threshold**: 30 requests per 1 minute per IP
- **Action**: Block
- **Duration**: 1 hour

This is a CDN-level gate before requests even reach Railway. If a single IP hammers the API faster than any human could, Cloudflare blocks them — your rate limiter in FastAPI never sees the flood.

### 2.4 Create a WAF Custom Rule (Block Suspicious User-Agents)
Cloudflare dashboard → Security → WAF → Custom Rules → Create Rule

- **Rule name**: Block Bad Bots
- **Expression** (use the expression editor):
  ```
  (http.user_agent contains "python-requests") or
  (http.user_agent contains "curl/") or
  (http.user_agent contains "facebookexternalhit") or
  (http.user_agent contains "AhrefsBot") or
  (http.user_agent contains "SemrushBot") or
  (not http.user_agent matches ".")
  ```
- **Action**: Block

The last condition (`not http.user_agent matches "."`) blocks requests with empty User-Agent headers — a hallmark of unsophisticated bots.

### 2.5 Configure DNS Records (do after Sections 3 and 4 are complete)

You'll return here once Railway and Vercel are deployed. At that point, set:

| Type | Name | Value | Proxy |
|---|---|---|---|
| CNAME | `@` (or `www`) | `cname.vercel-dns.com` | **ON** (orange cloud) |
| CNAME | `api` | `[your-railway-domain].railway.app` | OFF (grey cloud) |

**Why the difference**: The frontend (`@`) goes through Cloudflare (proxy ON) so bot protection and WAF rules apply. The backend (`api`) bypasses Cloudflare proxy (proxy OFF) because Railway manages its own TLS termination — if you proxy-ON the backend domain, you need SSL certs configured on both sides which adds complexity.

> **Note**: You can enable Cloudflare proxy on the `api` subdomain later if you want WAF rules to apply to direct backend traffic too. That requires SSL Full (Strict) on Railway's side.

---

## Section 3 — Upstash Redis Setup

The backend uses Redis to track per-IP usage limits. This must be set up before Railway deployment.

1. Go to **upstash.com** → sign up (free, no card required)
2. Create Database → **Redis** → give it a name (e.g. `writer-ai-usage`) → select region **US-East-1** (matches Railway's default US region)
3. Tier: **Free** (10,000 commands/day, 256MB — more than enough for MVP)
4. After creation, click on the database → **REST API** tab
5. Copy the **UPSTASH_REDIS_URL** value — it looks like:
   ```
   rediss://default:ABCD1234...@us1-example-12345.upstash.io:6380
   ```
   Save this — you'll paste it into Railway's env vars in Section 5.

---

## Section 4 — PostHog Setup

PostHog is your event analytics — it captures every Analyze, Rewrite, Copy, and Download action to tell you whether writers actually use the product.

1. Go to **posthog.com** → sign up → select **US Cloud** region
2. Create a new project → name it "Writer AI"
3. Skip the integration wizard for now (your frontend agent handles the code)
4. Go to Project Settings → copy your **Project API Key** (starts with `phc_`)
5. Copy the **Host** value — for US Cloud it's `https://us.i.posthog.com`

Save both values — you'll add them as Vercel env vars in Section 6.

---

## Section 5 — Railway Backend Deployment

### 5.1 Create the Railway Project

1. Go to **railway.app** → sign in with GitHub
2. New Project → Deploy from GitHub repo → select `writer-ai`
3. When prompted for the root directory, enter: `backend`
4. Railway will detect Python + uv from `pyproject.toml` automatically (nixpacks)
5. **Do not deploy yet** — set env vars first

### 5.2 Set Environment Variables

In Railway → your service → Variables tab, add each of the following:

```
GEMINI_API_KEY          = [your Gemini API key from aistudio.google.com]
UPSTASH_REDIS_URL       = [the rediss:// URL from Section 3]
CORS_ORIGINS            = ["https://yourdomain.com","https://your-app.vercel.app"]
ALLOWED_HOSTS           = ["yourdomain.com","your-app.vercel.app","api.yourdomain.com"]
LIMIT_USAGE_PER_IP      = true
MAX_ATTEMPTS_PER_IP     = 5
ENV                     = production
DEBUG                   = false
LOG_LEVEL               = INFO
GEMINI_MODEL            = gemini-2.5-flash
GEMINI_MODEL_FAST       = gemini-2.5-flash-lite
GEMINI_STRUCTURED_OUTPUT = true
```

> Replace `yourdomain.com` and `your-app.vercel.app` with your actual values. You'll know the Vercel domain after Section 6.2.

### 5.3 Deploy

Click Deploy. Railway runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (configured in `railway.toml` by the backend agent).

Watch the deploy logs — it should finish in ~60 seconds. The healthcheck at `/health` should return `{"status": "ok"}`.

### 5.4 Note Your Railway Domain

Railway assigns a default domain like `backend-production-abc1.up.railway.app`. Copy it — you'll need it for Vercel's `BACKEND_URL` env var.

### 5.5 Set a Custom Domain (after Vercel is live)

Railway → your service → Settings → Domains → Add Custom Domain → enter `api.yourdomain.com`

Railway gives you a CNAME target. Add that as a DNS record in Cloudflare (see Section 2.5).

---

## Section 6 — Vercel Frontend Deployment

### 6.1 Create the Vercel Project

1. Go to **vercel.com** → New Project → Import from GitHub → select `writer-ai`
2. Set root directory: `frontend`
3. Framework: Next.js (auto-detected)
4. **Do not deploy yet** — set env vars first

### 6.2 Set Environment Variables

In Vercel → your project → Settings → Environment Variables:

```
BACKEND_URL                  = https://backend-production-abc1.up.railway.app
                               (your Railway domain from Section 5.4 — no trailing slash)

NEXT_PUBLIC_POSTHOG_KEY      = phc_...
                               (from Section 4)

NEXT_PUBLIC_POSTHOG_HOST     = https://us.i.posthog.com
                               (from Section 4)
```

`BACKEND_URL` does **not** have the `NEXT_PUBLIC_` prefix — it's server-side only and never sent to the browser. This is intentional.

### 6.3 Deploy

Click Deploy. Vercel will build Next.js and deploy globally. Takes ~2 minutes.

After deploy, Vercel shows you a `.vercel.app` URL (e.g. `writer-ai-abc.vercel.app`). Copy it.

### 6.4 Set Custom Domain

Vercel → your project → Settings → Domains → Add → enter `yourdomain.com`

Vercel gives you a CNAME value: `cname.vercel-dns.com`. Add this in Cloudflare DNS (see Section 2.5) with proxy **ON**.

### 6.5 Update Railway CORS

Now that you have real domain names, go back to Railway → Variables → update:
```
CORS_ORIGINS  = ["https://yourdomain.com","https://writer-ai-abc.vercel.app"]
ALLOWED_HOSTS = ["yourdomain.com","writer-ai-abc.vercel.app","api.yourdomain.com"]
```

Trigger a redeploy in Railway after updating.

---

## Section 7 — Enable Vercel Analytics

Vercel dashboard → your project → Analytics tab → Enable

This gives you page views, Web Vitals, and geographic data automatically. No code change needed — the `<Analytics />` component is already in the codebase.

---

## Section 8 — Smoke Testing

Run through this checklist after all services are live:

### 8.1 End-to-End Flow
1. Open `https://yourdomain.com` in an incognito window
2. Paste a paragraph of fiction into the textarea → click **Analyze Structure**
3. Confirm beats appear in the sidebar
4. Type an instruction in the edit box → click Apply
5. Click **Rewrite Chapter** → confirm new chapter appears with highlights
6. Click **Copy** → paste into a text editor, confirm content is there
7. Click **Download** → confirm `.txt` file downloads

### 8.2 Rate Limiting
1. Open `https://yourdomain.com` in an incognito window
2. Perform 5 successful Analyze or Rewrite actions
3. The 6th attempt should return a 429 error with a "free attempts" message
4. Confirm the limit modal appears in the UI

### 8.3 PostHog Events
1. Open PostHog → your project → Live Events (updates in real-time)
2. Perform an Analyze → confirm `chapter_analyzed` event appears
3. Click Copy → confirm `content_copied` event appears
4. All 8 event types should appear as you exercise the flow

### 8.4 Cloudflare Is Active
1. Cloudflare dashboard → Analytics → Traffic
2. After a few page loads, you should see requests flowing through Cloudflare
3. If analytics shows zero traffic, your DNS may not be proxying through Cloudflare — check that the `@` CNAME record has the orange cloud (proxy ON)

### 8.5 Backend URL Is Hidden
1. Open browser DevTools → Network tab on `https://yourdomain.com`
2. Trigger an Analyze
3. The request should go to `yourdomain.com/api/v1/chapter/outline` — NOT to a Railway domain
4. If you see a Railway URL, the Vercel rewrite is not working — check `BACKEND_URL` env var in Vercel

---

## Section 9 — Post-Launch Monitoring

### Watch These Immediately After Launch:
- **Railway logs** (Observability tab): Look for errors, 5xx responses, Gemini timeouts
- **Upstash dashboard**: Commands/day counter — stay under 10,000 for free tier
- **PostHog Live Events**: Confirm events are flowing from real users
- **Cloudflare Security Events**: Check if Bot Fight Mode is blocking anything unexpected

### Set a Railway Spend Alert:
Railway → Settings → Billing → Spend Alert → set to $10. If spend exceeds $10, you'll be emailed before anything auto-charges significantly.

### Set a Gemini Quota Alert:
Google AI Studio → your project → APIs → Gemini API → Quotas → set email alert at 80% of daily limit.

---

## Quick Reference: All Credentials to Collect

| Item | Where | Used In |
|---|---|---|
| Gemini API key | aistudio.google.com → API keys | Railway env var |
| Upstash Redis URL | upstash.com → DB → REST API | Railway env var |
| PostHog Project Key | posthog.com → Project Settings | Vercel env var |
| PostHog Host | posthog.com → Project Settings | Vercel env var |
| Railway domain | Railway → your service → Settings | Vercel `BACKEND_URL` |
| Vercel `.vercel.app` URL | Vercel deploy page | Railway `CORS_ORIGINS` |

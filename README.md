# ProspectPro

Personal commercial prospecting tracker. Log daily activities, monitor compliance vs targets, calculate your sales funnel, and visualize your progress over time.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui** — dark mode, Vercel/Linear style
- **Recharts** — 6 chart types
- **Supabase** (PostgreSQL) — no localStorage, no auth
- **Vercel** — deployment target

## Environment Variables

Create a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are in your Supabase project under **Settings → API**.

## Database Setup

Run migrations in order in the Supabase SQL editor:

1. `activities` table
2. `activity_logs` table
3. `goals` table
4. `recipe_scenarios` table
5. `recipe_actuals` table
6. `vw_daily_compliance` view

### vw_daily_compliance view (required)

```sql
CREATE OR REPLACE VIEW vw_daily_compliance AS
SELECT
  al.id,
  al.activity_id,
  a.name  AS activity_name,
  a.type,
  a.channel,
  al.log_date,
  al.day_goal,
  al.real_executed,
  ROUND((al.real_executed::NUMERIC / NULLIF(al.day_goal, 0)) * 100, 2) AS compliance_pct,
  CASE
    WHEN al.day_goal = 0                                   THEN 'no_goal'
    WHEN al.real_executed >= al.day_goal                   THEN 'green'
    WHEN (al.real_executed::NUMERIC / al.day_goal) >= 0.7  THEN 'yellow'
    ELSE 'red'
  END AS semaphore
FROM activity_logs al
JOIN activities a ON a.id = al.activity_id;
```

## Local Development

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy to Vercel

1. Push this directory to a GitHub repo.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to this folder if it's a monorepo.
4. Add environment variables under **Settings → Environment Variables**.
5. Click **Deploy** — Vercel auto-detects Next.js.

## Keyboard Shortcuts

| Key | Route |
|-----|-------|
| `C` | Check-in diario |
| `D` | Dashboard |
| `G` | Metas |

Shortcuts are disabled when the cursor is inside an input field.

## Modules

| Route | Description |
|-------|-------------|
| `/dashboard` | KPIs, period/type/channel filters, 6 chart types |
| `/checkin` | Daily activity log (upsert per day) |
| `/checkin/[date]` | Retroactive entry for any past date |
| `/activities` | CRUD for prospecting activities |
| `/recipe` | Sales funnel scenarios (Recetario) |
| `/goals` | Period-based goal planning and deviation alerts |

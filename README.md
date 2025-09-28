# Sarukulu

This repo contains the app code and a `supabase/` folder with:
- `schema.sql` — authoritative DB snapshot (tables, functions, triggers, RLS)
- `seed-data.sql` — optional sample data for local/dev
- `storage-schema.sql` — Supabase Storage schema
- `DB_README.md` — human-friendly database handbook

## Quick links
- Database handbook: [`supabase/DB_README.md`](supabase/DB_README.md)

## Apply the schema to a Supabase project (Option A — Studio)
1. Open **Supabase Studio → SQL Editor**
2. Paste the full contents of `supabase/schema.sql` and click **Run**
3. (Optional) Paste `supabase/seed-data.sql` and **Run** for demo data
4. (If using images) Create **bucket**: `product-images` and set to **public**

## Apply with psql (Option B — CLI)
```bash
# schema
psql "postgresql://postgres:DB_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require" -f supabase/schema.sql

# optional seed
psql "postgresql://postgres:DB_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require" -f supabase/seed-data.sql
```

> `schema.sql` is the source of truth. If docs ever disagree, trust the SQL.

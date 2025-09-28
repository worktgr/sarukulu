# Sarukulu DB README

## Overview
PostgreSQL (Supabase) schema for a grocery ecommerce app: users/profiles, catalog (brands, categories, products, variants, images), orders, and an admin audit log. Includes transactional COD checkout and Supabase Storage schema.

---

## ERD (high-level)
- auth.users 1–1 profiles  
- profiles 1–N addresses, 1–N orders  
- addresses 1–N orders (nullable, ON DELETE SET NULL)  
- orders 1–N order_items (CASCADE)  
- products 1–N product_variants (CASCADE), 1–N product_images (CASCADE)  
- categories 1–N products (SET NULL)  
- brands 1–N products (SET NULL)  
- admin_audit_log ↔ auth.users (optional FK)

---

## Enums
- product_status: draft | active | archived  
- order_status: placed | packed | out_for_delivery | delivered | cancelled  
- payment_method: cod | upi | card  
- payment_status: pending | success | failed | refunded  
- user_role: customer | manager | admin  

---

## Key Tables (essentials)
- **profiles** (PK id→auth.users): role default `customer`, phone unique (partial), timestamps.  
- **addresses**: `(user_id, is_default desc)` index; ON UPDATE trigger sets `updated_at`.  
- **categories**: `slug` required + unique, `sort_order` unique DEFERRABLE for safe reordering.  
- **products**: nullable FKs to category/brand (SET NULL), `status`, `gst_rate`, timestamps + update trigger.  
- **product_variants**: one—and only one—of (net_weight_g | net_volume_ml | pieces) must be set; `price<=mrp`; `stock_qty>=0`; uniques on `sku`, `barcode`, and `(product_id,name)`.  
- **orders**: monetary fields numeric(10,2), defaults, `(user_id, created_at desc)` index.  
- **order_items**: `qty>0`, `price>=0`, FKs to order/product/variant.  
- **admin_audit_log**: admin/manager read+insert only (via policies).  

---

## Functions & Triggers
- **create_order_cod(address_id, items, notes)**: transactional COD checkout (locks variants, stock checks, inserts order+items, decrements stock, returns totals). SECURITY DEFINER.  
- **handle_new_user()**: creates `profiles` row on sign-up. SECURITY DEFINER.  
- **set_updated_at()**: BEFORE UPDATE trigger for `updated_at`.  
- **set_category_position()/normalize_category_order_seq()**: safe category reordering using DEFERRABLE unique.  

---

## Row-Level Security (RLS)
Enabled with role-aware policies:

- **categories**: INSERT/UPDATE/DELETE for `admin`/`manager` (authenticated). Add a SELECT policy for public/app reads (e.g., `is_active=true`).  
- **admin_audit_log**: SELECT + INSERT for `admin`/`manager`.  
- **addresses**: owner-only delete/CRUD (owner pattern via `auth.uid()`).  

> Recommendation: Ensure SELECT/INSERT/UPDATE/DELETE policies exist for `products`, `product_variants`, `product_images`, `orders`, `order_items`, and `profiles` consistent with your app:  
> - Public (or anonymous) read for catalog tables limited to `is_active AND status='active'`.  
> - Orders readable by owner; all by admin/manager.  
> - Writes to catalog restricted to admin/manager only.

---

## Indexes (performance)
- Search & filters: `idx_products_name` (lower(name)), `idx_products_category_active`, `idx_variants_product_active`, `idx_variants_sku`, `idx_orders_user_created`, `idx_addresses_user_default`.

---

## Supabase Storage (schema)
Standard storage schema: `buckets`, `objects`, `prefixes`, multipart uploads, prefix hierarchy triggers, fast list/search helpers, bucket name length guard. Add bucket-level policies per your needs (e.g., public read for `product-images`, restricted write).

---

## Seed Data (dev convenience)
Sample admin profile, one address, categories with images + sort order, one product (Toned Milk) with 2 variants, demo orders and items. Sequences set.

---

## Common Workflows

### Create COD order (app side via RPC)
```sql
select * from create_order_cod(
  _address_id := 1,
  _items := '[{"variantId":1,"qty":1},{"variantId":2,"qty":2}]'::jsonb,
  _notes := 'Leave at the door'
);
```

### Promote category order
```sql
select set_category_position(_id := 23, _pos := 1);
```

---

## Safety Checklist (before prod)
- Add SELECT policies for catalog reads (public/anon as needed).  
- Lock writes on catalog tables to admin/manager.  
- Verify orders RLS: owner-only reads; admin/manager full access.  
- Review storage bucket policies (public read images vs private).  
- Keep all client writes behind RPC (e.g., `create_order_cod`) where possible.

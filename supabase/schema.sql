--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'placed',
    'packed',
    'out_for_delivery',
    'delivered',
    'cancelled'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cod',
    'upi',
    'card'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'success',
    'failed',
    'refunded'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'draft',
    'active',
    'archived'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'customer',
    'manager',
    'admin'
);


--
-- Name: create_order_cod(bigint, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_cod(_address_id bigint, _items jsonb, _notes text DEFAULT NULL::text) RETURNS TABLE(order_id bigint, subtotal numeric, delivery_fee numeric, total numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid;
  it jsonb;
  v_id bigint;
  v_qty int;
  p_id bigint;
  v_price numeric(10,2);
  v_stock int;
  _subtotal numeric(10,2) := 0;
  _delivery_fee numeric(10,2) := 0; -- MVP: always 0
  _oid bigint;
begin
  -- must be signed in
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- address must belong to caller
  if not exists (select 1 from public.addresses a where a.id = _address_id and a.user_id = uid) then
    raise exception 'Invalid address';
  end if;

  -- items must be an array of { variantId, qty }
  if jsonb_typeof(_items) <> 'array' then
    raise exception 'Items must be an array of {variantId, qty}';
  end if;

  -- Pre-validate and compute subtotal (lock stock rows to avoid races)
  for it in select * from jsonb_array_elements(_items) loop
    v_id  := (it->>'variantId')::bigint;
    v_qty := coalesce((it->>'qty')::int, 0);
    if v_id is null or v_qty <= 0 then
      raise exception 'Invalid item format';
    end if;

    -- lock variant row
    select pv.product_id, pv.price, pv.stock_qty
      into p_id, v_price, v_stock
    from public.product_variants pv
    where pv.id = v_id and pv.is_active = true and pv.status = 'active'
    for update;

    if not found then
      raise exception 'Variant % not found or inactive', v_id;
    end if;

    if v_stock < v_qty then
      raise exception 'Insufficient stock for variant % (have %, need %)', v_id, v_stock, v_qty;
    end if;

    _subtotal := _subtotal + (v_price * v_qty);
  end loop;

  -- Create order (only return id to avoid name clashes)
  insert into public.orders (
    user_id, address_id, status, payment_method, payment_status,
    subtotal, delivery_fee, total, notes
  )
  values (
    uid, _address_id, 'placed', 'cod', 'pending',
    _subtotal, _delivery_fee, _subtotal + _delivery_fee, _notes
  )
  returning id into _oid;

  -- Insert items & decrement stock
  for it in select * from jsonb_array_elements(_items) loop
    v_id  := (it->>'variantId')::bigint;
    v_qty := (it->>'qty')::int;

    select pv.product_id, pv.price into p_id, v_price
    from public.product_variants pv where pv.id = v_id;

    insert into public.order_items (order_id, product_id, variant_id, qty, price)
    values (_oid, p_id, v_id, v_qty, v_price);

    update public.product_variants
      set stock_qty = stock_qty - v_qty
      where id = v_id;
  end loop;

  return query
    select _oid, _subtotal, _delivery_fee, (_subtotal + _delivery_fee);
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, phone, name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end;
$$;


--
-- Name: normalize_category_order_seq(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_category_order_seq() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with ranked as (
    select id,
           row_number() over (
             order by coalesce(sort_order, 2147483647), name, id
           ) as pos
    from public.categories
  )
  update public.categories c
     set sort_order = r.pos
  from ranked r
  where c.id = r.id
    and c.sort_order is distinct from r.pos;
$$;


--
-- Name: set_category_position(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_category_position(_id integer, _pos integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  total int;
  target_pos int;
begin
  -- Allow temporary duplicates while we reshuffle (requires DEFERRABLE constraint)
  set constraints uq_categories_sort_order deferred;

  -- First compact
  perform public.normalize_category_order_seq();

  select count(*) into total from public.categories;
  if total = 0 then
    return;
  end if;

  if _pos is null or _pos < 1 then
    target_pos := 1;
  elsif _pos > total then
    target_pos := total;
  else
    target_pos := _pos;
  end if;

  with ordered as (
    select id, row_number() over (order by sort_order, name, id) as rn
    from public.categories
    where id <> _id
  ),
  shifted as (
    select id,
           case when rn >= target_pos then rn + 1 else rn end as new_pos
    from ordered
  ),
  combined as (
    select id, new_pos from shifted
    union all
    select _id as id, target_pos as new_pos
  )
  update public.categories c
     set sort_order = s.new_pos
  from combined s
  where c.id = s.id
    and c.sort_order is distinct from s.new_pos;

  -- Final compact (keeps 1..N if anything drifted)
  perform public.normalize_category_order_seq();
end
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    line1 text NOT NULL,
    line2 text,
    landmark text,
    city text NOT NULL,
    pincode text NOT NULL,
    lat double precision,
    lon double precision,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id bigint NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name text NOT NULL,
    image_url text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    slug text,
    image_path text,
    CONSTRAINT categories_slug_not_null CHECK (((slug IS NOT NULL) AND (length(slug) > 0)))
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    product_id bigint NOT NULL,
    variant_id bigint NOT NULL,
    qty integer NOT NULL,
    price numeric(10,2) NOT NULL,
    CONSTRAINT order_items_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT order_items_qty_check CHECK ((qty > 0))
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    address_id bigint,
    status public.order_status DEFAULT 'placed'::public.order_status NOT NULL,
    payment_method public.payment_method DEFAULT 'cod'::public.payment_method NOT NULL,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    variant_id bigint,
    url text NOT NULL,
    alt text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    name text NOT NULL,
    sku text,
    barcode text,
    pack_size_label text,
    net_weight_g integer,
    net_volume_ml integer,
    pieces integer,
    mrp numeric(10,2),
    price numeric(10,2) NOT NULL,
    compare_at_price numeric(10,2),
    stock_qty integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    status public.product_status DEFAULT 'active'::public.product_status NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_variant_mrp_nonneg CHECK (((mrp IS NULL) OR (mrp >= (0)::numeric))),
    CONSTRAINT chk_variant_pack_metric_one CHECK ((((
CASE
    WHEN ((net_weight_g IS NOT NULL) AND (net_weight_g > 0)) THEN 1
    ELSE 0
END +
CASE
    WHEN ((net_volume_ml IS NOT NULL) AND (net_volume_ml > 0)) THEN 1
    ELSE 0
END) +
CASE
    WHEN ((pieces IS NOT NULL) AND (pieces > 0)) THEN 1
    ELSE 0
END) = 1)),
    CONSTRAINT chk_variant_price_le_mrp CHECK (((mrp IS NULL) OR (price <= mrp))),
    CONSTRAINT chk_variant_price_nonneg CHECK ((price >= (0)::numeric)),
    CONSTRAINT chk_variant_stock_nonneg CHECK ((stock_qty >= 0))
);


--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_variants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text,
    category_id bigint,
    brand_id bigint,
    description text,
    hsn_code text,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    is_veg boolean,
    shelf_life_days integer,
    is_active boolean DEFAULT true NOT NULL,
    status public.product_status DEFAULT 'active'::public.product_status NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    phone text,
    name text,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: admin_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: brands brands_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_slug_key UNIQUE (slug);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_barcode_key UNIQUE (barcode);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_product_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_name_key UNIQUE (product_id, name);


--
-- Name: product_variants product_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_sku_key UNIQUE (sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: categories uq_categories_sort_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT uq_categories_sort_order UNIQUE (sort_order) DEFERRABLE;


--
-- Name: idx_addresses_user_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_addresses_user_default ON public.addresses USING btree (user_id, is_default DESC);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: idx_products_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_active ON public.products USING btree (category_id, is_active);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name ON public.products USING btree (lower(name));


--
-- Name: idx_profiles_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_profiles_phone_unique ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: idx_variants_product_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variants_product_active ON public.product_variants USING btree (product_id, is_active);


--
-- Name: idx_variants_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variants_sku ON public.product_variants USING btree (sku);


--
-- Name: uq_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_categories_slug ON public.categories USING btree (slug);


--
-- Name: addresses trg_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_variants trg_product_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_audit_log admin_audit_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: orders orders_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: categories Admin delete categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin delete categories" ON public.categories FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: categories Admin insert categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: categories Admin update categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin update categories" ON public.categories FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: admin_audit_log Admins insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert audit logs" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: admin_audit_log Admins read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read audit logs" ON public.admin_audit_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: addresses Owner delete addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner delete addresses" ON public.addresses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: addresses Owner insert addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner insert addresses" ON public.addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: addresses Owner read addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner read addresses" ON public.addresses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: order_items Owner read order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner read order_items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));


--
-- Name: orders Owner read orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner read orders" ON public.orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: addresses Owner update addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner update addresses" ON public.addresses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: products Public read active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (((is_active = true) AND (status = 'active'::public.product_status)));


--
-- Name: product_variants Public read active variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active variants" ON public.product_variants FOR SELECT USING (((is_active = true) AND (status = 'active'::public.product_status)));


--
-- Name: categories Public read categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);


--
-- Name: product_images Public read images of active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read images of active products" ON public.product_images FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_images.product_id) AND (p.is_active = true) AND (p.status = 'active'::public.product_status)))));


--
-- Name: profiles Read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


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
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.addresses (id, user_id, name, phone, line1, line2, landmark, city, pincode, lat, lon, is_default, created_at, updated_at) VALUES (1, 'ffd1f97b-0fa7-424b-8439-a0856c648b70', 'Dev one', '1234567890', 'Address house 1', 'Address road', 'Near address hall', 'Address city', '123456', NULL, NULL, true, '2025-08-18 13:18:57.631808+00', '2025-08-18 13:18:57.631808+00');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.categories (id, name, image_url, sort_order, is_active, slug, image_path) VALUES (25, 'Gat', 'https://dtruqubqifvmroxeykwz.supabase.co/storage/v1/object/public/product-images/categories/25_1757592633475.webp?v=1757592634186', 1, true, 'gat', 'categories/25_1757592633475.webp');
INSERT INTO public.categories (id, name, image_url, sort_order, is_active, slug, image_path) VALUES (23, 'Lat 4', 'https://dtruqubqifvmroxeykwz.supabase.co/storage/v1/object/public/product-images/categories/23_1757513053609.webp?v=1757513054056', 2, true, 'lat-4', 'categories/23_1757513053609.webp');
INSERT INTO public.categories (id, name, image_url, sort_order, is_active, slug, image_path) VALUES (18, 'Cat 4', 'https://dtruqubqifvmroxeykwz.supabase.co/storage/v1/object/public/product-images/categories/18_1756446368826.png?v=1756446377498', 3, true, 'cat-4', 'categories/18_1756446368826.png');
INSERT INTO public.categories (id, name, image_url, sort_order, is_active, slug, image_path) VALUES (21, 'Gat 6', 'https://dtruqubqifvmroxeykwz.supabase.co/storage/v1/object/public/product-images/categories/21_1757485249352.webp?v=1757485250296', 4, true, 'gat-6', 'categories/21_1757485249352.webp');
INSERT INTO public.categories (id, name, image_url, sort_order, is_active, slug, image_path) VALUES (26, 'Mat', 'https://dtruqubqifvmroxeykwz.supabase.co/storage/v1/object/public/product-images/categories/26_1757592669221.webp?v=1757592669687', 5, false, 'mat', 'categories/26_1757592669221.webp');


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.orders (id, user_id, address_id, status, payment_method, payment_status, subtotal, delivery_fee, total, notes, created_at) VALUES (1, 'ffd1f97b-0fa7-424b-8439-a0856c648b70', 1, 'placed', 'cod', 'pending', 58.00, 0.00, 58.00, NULL, '2025-08-18 14:14:43.341781+00');
INSERT INTO public.orders (id, user_id, address_id, status, payment_method, payment_status, subtotal, delivery_fee, total, notes, created_at) VALUES (2, 'ffd1f97b-0fa7-424b-8439-a0856c648b70', 1, 'placed', 'cod', 'pending', 118.00, 0.00, 118.00, NULL, '2025-08-18 14:15:24.551615+00');
INSERT INTO public.orders (id, user_id, address_id, status, payment_method, payment_status, subtotal, delivery_fee, total, notes, created_at) VALUES (3, 'ffd1f97b-0fa7-424b-8439-a0856c648b70', 1, 'placed', 'cod', 'pending', 88.00, 0.00, 88.00, NULL, '2025-08-18 14:53:27.565204+00');
INSERT INTO public.orders (id, user_id, address_id, status, payment_method, payment_status, subtotal, delivery_fee, total, notes, created_at) VALUES (4, 'ffd1f97b-0fa7-424b-8439-a0856c648b70', 1, 'placed', 'cod', 'pending', 88.00, 0.00, 88.00, NULL, '2025-08-25 07:08:56.888167+00');


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.products (id, name, slug, category_id, brand_id, description, hsn_code, gst_rate, is_veg, shelf_life_days, is_active, status, created_at, updated_at) VALUES (1, 'Toned Milk', NULL, NULL, 1, 'Fresh toned milk', NULL, 0.00, NULL, NULL, true, 'active', '2025-08-18 05:25:09.358451+00', '2025-08-28 11:07:19.745981+00');


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.product_variants (id, product_id, name, sku, barcode, pack_size_label, net_weight_g, net_volume_ml, pieces, mrp, price, compare_at_price, stock_qty, is_active, status, sort_order, created_at, updated_at) VALUES (2, 1, '500 ml', 'MILK-500', NULL, '500 ml', NULL, 500, NULL, 32.00, 30.00, NULL, 36, true, 'active', 2, '2025-08-18 05:25:09.358451+00', '2025-08-25 07:08:56.888167+00');
INSERT INTO public.product_variants (id, product_id, name, sku, barcode, pack_size_label, net_weight_g, net_volume_ml, pieces, mrp, price, compare_at_price, stock_qty, is_active, status, sort_order, created_at, updated_at) VALUES (1, 1, '1 L', 'MILK-1L', NULL, '1 L', NULL, 1000, NULL, 60.00, 58.00, NULL, 21, true, 'active', 1, '2025-08-18 05:25:09.358451+00', '2025-08-25 07:08:56.888167+00');


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (1, 1, 1, 1, 1, 58.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (2, 2, 1, 1, 1, 58.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (3, 2, 1, 2, 2, 30.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (4, 3, 1, 2, 1, 30.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (5, 3, 1, 1, 1, 58.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (6, 4, 1, 2, 1, 30.00);
INSERT INTO public.order_items (id, order_id, product_id, variant_id, qty, price) VALUES (7, 4, 1, 1, 1, 58.00);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('ffd1f97b-0fa7-424b-8439-a0856c648b70', NULL, 'Dev one', 'admin', '2025-08-18 12:33:11.332746+00', '2025-08-28 06:14:47.118655+00');
INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('9cbecfda-2d9e-4b32-9cda-3a6f6d4d40a9', NULL, '', 'customer', '2025-08-28 06:51:24.976396+00', '2025-08-28 06:51:24.976396+00');
INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('51886895-6bb8-462a-b9bc-53d7a116bf8f', NULL, '', 'customer', '2025-08-28 11:06:10.594352+00', '2025-08-28 11:06:10.594352+00');


--
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.addresses_id_seq', 1, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 28, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 7, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 4, true);


--
-- Name: product_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_variants_id_seq', 2, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 1, true);


--
-- PostgreSQL database dump complete
--


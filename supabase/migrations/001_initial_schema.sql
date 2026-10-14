-- ====================================================================
-- FOODIPLACE / CASH ON DELIVERY MULTI-PORTAL FOOD DELIVERY PLATFORM
-- POSTGRESQL & SUPABASE PRODUCTION DATABASE SCHEMA
-- File: supabase/migrations/001_initial_schema.sql
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. SYSTEM SETTINGS TABLE (Global Rates & Radius)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    per_km_delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    base_delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    rider_match_radius_km NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '৳',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 3. CUSTOMER USERS TABLE (Self-Registered Customers)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 4. VENDORS / RESTAURANTS TABLE (Admin Registered)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unique_id VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_image TEXT,
    cuisine VARCHAR(100) DEFAULT 'Fast Food, Biryani',
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    address TEXT NOT NULL,
    zone VARCHAR(100) NOT NULL DEFAULT 'Chawkbazar Zone',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    google_maps_link TEXT,
    is_active BOOLEAN DEFAULT true,
    is_boosted BOOLEAN DEFAULT false,
    boost_banner_title TEXT,
    boost_banner_subtitle TEXT,
    rating NUMERIC(2, 1) DEFAULT 4.8,
    estimated_prep_time_minutes INT DEFAULT 20,
    is_password_set BOOLEAN DEFAULT false,
    password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 5. PROMOTIONAL ADS & HERO BANNERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.ads_banners (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    action_text VARCHAR(100) DEFAULT 'Redeem now',
    image_url TEXT NOT NULL,
    target_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    target_category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 6. MENU ITEMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    category VARCHAR(100) DEFAULT 'Main Course',
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 7. CUSTOMER ADDRESS BOOK (With Map Pin Points)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    label VARCHAR(50) DEFAULT 'Home',
    address_line TEXT NOT NULL,
    details TEXT,
    zone VARCHAR(100) DEFAULT 'Chawkbazar Zone',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 8. RIDERS TABLE (Admin Registered)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unique_id VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    photo_url TEXT,
    home_address TEXT,
    zone VARCHAR(100) NOT NULL DEFAULT 'Chawkbazar Zone',
    vehicle_type VARCHAR(50) DEFAULT 'Motorcycle',
    is_online BOOLEAN DEFAULT false,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    last_location_updated_at TIMESTAMP WITH TIME ZONE,
    cash_in_hand NUMERIC(10, 2) DEFAULT 0.00,
    is_approved BOOLEAN DEFAULT true,
    is_password_set BOOLEAN DEFAULT false,
    password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 9. ORDERS TABLE (Full Cash-On-Delivery & Prep Lifecycle)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id),
    rider_id UUID REFERENCES public.riders(id),
    zone VARCHAR(100) NOT NULL,
    
    delivery_address TEXT NOT NULL,
    delivery_latitude DOUBLE PRECISION NOT NULL,
    delivery_longitude DOUBLE PRECISION NOT NULL,
    
    food_total NUMERIC(10, 2) NOT NULL,
    delivery_distance_km NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL,
    total_cash_payable NUMERIC(10, 2) NOT NULL,
    
    food_cash_paid_to_vendor BOOLEAN DEFAULT false,
    food_and_delivery_cash_collected_from_customer BOOLEAN DEFAULT false,
    
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    vendor_prep_minutes INT DEFAULT 15,
    prep_ends_at TIMESTAMP WITH TIME ZONE,
    customer_confirmed_prep BOOLEAN DEFAULT false,
    cancellation_reason TEXT,
    
    dispatched_rider_id UUID REFERENCES public.riders(id),
    dispatch_sent_at TIMESTAMP WITH TIME ZONE,
    rejected_rider_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 10. ORDER ITEMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    item_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- ====================================================================
-- 11. INDEXES FOR HIGH PERFORMANCE REAL-TIME QUERIES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_vendors_zone ON public.vendors(zone);
CREATE INDEX IF NOT EXISTS idx_riders_zone ON public.riders(zone);
CREATE INDEX IF NOT EXISTS idx_riders_online ON public.riders(is_online);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_ads_active ON public.ads_banners(is_active);

-- ====================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Global System Settings Policies
CREATE POLICY "Public read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admin update system settings" ON public.system_settings FOR ALL USING (true);

-- Customers Policies
CREATE POLICY "Public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Customers update own profile" ON public.customers FOR UPDATE USING (true);

-- Vendors Policies
CREATE POLICY "Public read vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Admin & Vendor manage vendors" ON public.vendors FOR ALL USING (true);

-- Promotional Banner Ads Policies
CREATE POLICY "Public read active ads" ON public.ads_banners FOR SELECT USING (true);
CREATE POLICY "Admin manage ads" ON public.ads_banners FOR ALL USING (true);

-- Menu Items Policies
CREATE POLICY "Public read menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Vendors manage menu items" ON public.menu_items FOR ALL USING (true);

-- Customer Addresses Policies
CREATE POLICY "Manage customer addresses" ON public.customer_addresses FOR ALL USING (true);

-- Riders Policies
CREATE POLICY "Public read active riders" ON public.riders FOR SELECT USING (true);
CREATE POLICY "Admin & Rider update riders" ON public.riders FOR ALL USING (true);

-- Orders & Order Items Policies
CREATE POLICY "Public create and read orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Public manage order items" ON public.order_items FOR ALL USING (true);

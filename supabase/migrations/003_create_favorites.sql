-- Migration 003: Create Favorites table for customer favorite vendors with RLS
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_phone VARCHAR(50),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_customer_vendor_favorite UNIQUE (customer_phone, vendor_id)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_favorites_customer_phone ON public.favorites(customer_phone);
CREATE INDEX IF NOT EXISTS idx_favorites_customer_id ON public.favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_vendor_id ON public.favorites(vendor_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public favorites access" ON public.favorites;
CREATE POLICY "Public favorites access" 
ON public.favorites FOR ALL 
USING (true)
WITH CHECK (true);

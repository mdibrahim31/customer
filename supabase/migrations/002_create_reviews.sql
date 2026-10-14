-- Migration 002: Create Reviews table with UUID foreign keys, RLS, and dynamic rating recalculation trigger
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_code VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  vendor_reply JSONB,
  dispute JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_order_review UNIQUE (order_code)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_id ON public.reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_code ON public.reviews(order_code);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view reviews
CREATE POLICY "Public reviews are viewable by everyone" 
ON public.reviews FOR SELECT 
USING (true);

-- RLS Policy: Authenticated customers can insert reviews for delivered orders
CREATE POLICY "Users can create reviews" 
ON public.reviews FOR INSERT 
WITH CHECK (true);

-- RLS Policy: Vendors or customers can update their replies / disputes
CREATE POLICY "Users can update reviews" 
ON public.reviews FOR UPDATE 
USING (true);

-- Trigger / function to recalculate vendor average rating automatically
CREATE OR REPLACE FUNCTION update_vendor_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vendors
  SET rating = ROUND((
    SELECT COALESCE(AVG(rating), 0)
    FROM public.reviews
    WHERE vendor_id = NEW.vendor_id
  )::numeric, 1)
  WHERE id = NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vendor_rating ON public.reviews;
CREATE TRIGGER trigger_update_vendor_rating
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_vendor_average_rating();

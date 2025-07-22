-- Performance optimization: Add index on created_at for faster time-based filtering
-- This enables efficient queries for hazard reports within the last 24 hours
CREATE INDEX IF NOT EXISTS idx_hazard_reports_created_at 
ON public.hazard_reports(created_at DESC);
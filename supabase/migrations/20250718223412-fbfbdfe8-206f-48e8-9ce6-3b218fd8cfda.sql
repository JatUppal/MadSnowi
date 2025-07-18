-- Create table for storing hazard reports
CREATE TABLE public.hazard_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hazard_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  location_address TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_confidence TEXT CHECK (location_confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for hazard reports
-- Anyone can view hazard reports (for public safety)
CREATE POLICY "Hazard reports are viewable by everyone" 
ON public.hazard_reports 
FOR SELECT 
USING (true);

-- Users can create hazard reports (both authenticated and anonymous)
CREATE POLICY "Anyone can create hazard reports" 
ON public.hazard_reports 
FOR INSERT 
WITH CHECK (true);

-- Only the creator can update their own reports (if authenticated)
CREATE POLICY "Users can update their own reports" 
ON public.hazard_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Only the creator can delete their own reports (if authenticated)
CREATE POLICY "Users can delete their own reports" 
ON public.hazard_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hazard_reports_updated_at
BEFORE UPDATE ON public.hazard_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries by location and created date
CREATE INDEX idx_hazard_reports_created_at ON public.hazard_reports(created_at DESC);
CREATE INDEX idx_hazard_reports_location ON public.hazard_reports(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
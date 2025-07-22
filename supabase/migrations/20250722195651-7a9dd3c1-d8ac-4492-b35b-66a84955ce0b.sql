-- Create table to store Google Places search results for debugging
CREATE TABLE public.places_search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_query TEXT NOT NULL,
  user_lat NUMERIC NOT NULL,
  user_lng NUMERIC NOT NULL,
  radius_meters INTEGER NOT NULL,
  radius_miles NUMERIC GENERATED ALWAYS AS (radius_meters * 0.000621371) STORED,
  place_name TEXT NOT NULL,
  place_address TEXT NOT NULL,
  place_lat NUMERIC NOT NULL,
  place_lng NUMERIC NOT NULL,
  place_types TEXT[] NOT NULL DEFAULT '{}',
  distance_miles NUMERIC NOT NULL,
  similarity_score NUMERIC NOT NULL,
  was_selected BOOLEAN NOT NULL DEFAULT false,
  confidence_level TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_places_search_logs_created_at ON public.places_search_logs(created_at DESC);
CREATE INDEX idx_places_search_logs_query ON public.places_search_logs(search_query);
CREATE INDEX idx_places_search_logs_radius ON public.places_search_logs(radius_meters);

-- Enable RLS
ALTER TABLE public.places_search_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view and insert search logs (for debugging)
CREATE POLICY "Places search logs are viewable by everyone" 
ON public.places_search_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert places search logs" 
ON public.places_search_logs 
FOR INSERT 
WITH CHECK (true);
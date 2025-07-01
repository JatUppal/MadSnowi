import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startLocation, endLocation, travelMode = 'driving' } = await req.json();
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Get route from Google Maps Directions API
    const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
    directionsUrl.searchParams.set('origin', startLocation);
    directionsUrl.searchParams.set('destination', endLocation);
    directionsUrl.searchParams.set('mode', travelMode);
    directionsUrl.searchParams.set('key', googleMapsApiKey);

    const response = await fetch(directionsUrl.toString());
    const directionsData = await response.json();

    if (directionsData.status !== 'OK') {
      throw new Error(`Google Maps API error: ${directionsData.status}`);
    }

    const route = directionsData.routes[0];
    const leg = route.legs[0];

    // Extract coordinates for weather analysis
    const coordinates = [];
    for (const step of leg.steps) {
      coordinates.push({
        lat: step.start_location.lat,
        lng: step.start_location.lng
      });
    }
    // Add final destination
    coordinates.push({
      lat: leg.end_location.lat,
      lng: leg.end_location.lng
    });

    return new Response(JSON.stringify({
      route: {
        distance: leg.distance.text,
        duration: leg.duration.text,
        coordinates,
        polyline: route.overview_polyline.points
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-route function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
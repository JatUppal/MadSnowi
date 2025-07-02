import "https://deno.land/x/xhr@0.1.0/mod.ts";
// Updated to force redeployment with new secrets
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
    const { city, lat, lng } = await req.json();
    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY');

    if (!openWeatherApiKey) {
      throw new Error('OpenWeather API key not configured');
    }

    let weatherUrl = new URL('https://api.openweathermap.org/data/2.5/weather');
    
    if (lat && lng) {
      weatherUrl.searchParams.set('lat', lat.toString());
      weatherUrl.searchParams.set('lon', lng.toString());
    } else if (city) {
      weatherUrl.searchParams.set('q', city);
    } else {
      throw new Error('Either city name or coordinates required');
    }

    weatherUrl.searchParams.set('appid', openWeatherApiKey);
    weatherUrl.searchParams.set('units', 'imperial');

    const response = await fetch(weatherUrl.toString());
    const weatherData = await response.json();

    if (response.status !== 200) {
      throw new Error(`OpenWeather API error: ${weatherData.message}`);
    }

    // Simulate snow depth based on weather conditions and temperature
    let snowDepth = 0;
    if (weatherData.weather[0].main.toLowerCase().includes('snow') || 
        weatherData.weather[0].description.toLowerCase().includes('snow')) {
      // More realistic snow depth calculation
      if (weatherData.main.temp <= 32) {
        snowDepth = Math.random() * 8 + 1; // 1-9 inches for snow conditions
      } else {
        snowDepth = Math.random() * 2; // Light snow/slush
      }
    } else if (weatherData.main.temp <= 32) {
      snowDepth = Math.random() * 3; // Possible residual snow
    }

    return new Response(JSON.stringify({
      name: weatherData.name,
      main: {
        temp: weatherData.main.temp,
        pressure: weatherData.main.pressure,
        feels_like: weatherData.main.feels_like
      },
      weather: weatherData.weather,
      wind: weatherData.wind,
      snow_depth: snowDepth
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-weather function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
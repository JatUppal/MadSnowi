import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coordinates, vehicleInfo, travelMode } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get weather data for each coordinate
    const routeSegments = [];
    let totalSnowDepth = 0;

    for (const coord of coordinates) {
      // Call our weather function
      const weatherResponse = await supabase.functions.invoke('get-weather', {
        body: { lat: coord.lat, lng: coord.lng }
      });

      if (weatherResponse.error) {
        console.error('Weather API error:', weatherResponse.error);
        continue;
      }

      const weatherData = weatherResponse.data;
      const snowDepth = weatherData.snow_depth || 0;
      totalSnowDepth += snowDepth;

      let safetyScore: 'safe' | 'caution' | 'danger' = 'safe';
      
      // Safety scoring based on travel mode and conditions
      if (travelMode === 'driving') {
        if (snowDepth > 6) {
          safetyScore = 'danger';
        } else if (snowDepth > 3) {
          safetyScore = 'caution';
        }
      } else if (travelMode === 'walking') {
        if (snowDepth > 4 || (weatherData.main.feels_like && weatherData.main.feels_like < 10)) {
          safetyScore = 'caution';
        }
        if (snowDepth > 8 || (weatherData.main.feels_like && weatherData.main.feels_like < -10)) {
          safetyScore = 'danger';
        }
      } else if (travelMode === 'biking') {
        if (snowDepth > 2) {
          safetyScore = 'danger'; // Biking in snow is generally unsafe
        } else if (snowDepth > 0.5) {
          safetyScore = 'caution';
        }
      }

      routeSegments.push({
        lat: coord.lat,
        lng: coord.lng,
        snowDepth,
        safetyScore,
        temperature: weatherData.main.temp,
        conditions: weatherData.weather[0].description
      });
    }

    const avgSnowDepth = totalSnowDepth / coordinates.length;
    
    // Vehicle-specific safety assessment
    let vehicleSafety = { score: 'safe' as const, message: 'Good conditions for travel' };
    
    if (travelMode === 'driving' && vehicleInfo) {
      vehicleSafety = calculateVehicleSafety(
        avgSnowDepth,
        vehicleInfo.type,
        vehicleInfo.tires || 'regular',
        vehicleInfo.drive || 'fwd'
      );
    }

    // Generate recommendation
    const recommendation = generateRecommendation(
      vehicleSafety.score,
      avgSnowDepth,
      routeSegments[0]?.temperature || 32,
      travelMode
    );

    return new Response(JSON.stringify({
      routeSegments,
      avgSnowDepth,
      overallSafety: vehicleSafety.score,
      vehicleSafetyMessage: vehicleSafety.message,
      recommendation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-route-safety function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateVehicleSafety(
  snowDepth: number,
  vehicleType: 'sedan' | 'suv' | 'truck',
  tireType: 'regular' | 'snow',
  driveType: 'fwd' | 'awd' | '4wd'
): { score: 'safe' | 'caution' | 'danger'; message: string } {
  let baseScore = 0;

  // Vehicle type scoring
  switch (vehicleType) {
    case 'truck': baseScore += 3; break;
    case 'suv': baseScore += 2; break;
    case 'sedan': baseScore += 1; break;
  }

  // Tire type scoring
  if (tireType === 'snow') baseScore += 2;

  // Drive type scoring
  switch (driveType) {
    case '4wd': baseScore += 3; break;
    case 'awd': baseScore += 2; break;
    case 'fwd': baseScore += 1; break;
  }

  // Snow depth penalty
  const snowPenalty = snowDepth / 2;
  const finalScore = baseScore - snowPenalty;

  let score: 'safe' | 'caution' | 'danger';
  let message: string;

  if (finalScore >= 4) {
    score = 'safe';
    message = `✅ Your ${vehicleType} with ${tireType} tires and ${driveType.toUpperCase()} is well-suited for these conditions.`;
  } else if (finalScore >= 2) {
    score = 'caution';
    message = `⚠️ Use caution with your ${vehicleType}. Consider snow tires or alternate route.`;
  } else {
    score = 'danger';
    message = `❌ Unsafe conditions for your ${vehicleType} with current setup. Avoid travel or use snow tires with AWD/4WD.`;
  }

  return { score, message };
}

function generateRecommendation(
  safetyScore: 'safe' | 'caution' | 'danger',
  snowDepth: number,
  temperature: number,
  travelMode: string
): string {
  if (safetyScore === 'danger') {
    if (travelMode === 'biking') {
      return `Dangerous conditions for biking with ${snowDepth.toFixed(1)}" of snow. Consider walking or driving instead.`;
    }
    return `Dangerous conditions with ${snowDepth.toFixed(1)}" of snow. Consider delaying travel, using public transit, or taking a major highway with snow removal.`;
  } else if (safetyScore === 'caution') {
    return `Use caution with ${snowDepth.toFixed(1)}" of snow. Allow extra time, ${travelMode === 'driving' ? 'drive slowly' : 'move carefully'}, and consider an alternate route.`;
  } else {
    return `Safe travel conditions. Normal winter ${travelMode} precautions recommended.`;
  }
}
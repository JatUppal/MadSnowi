import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HazardAnalysis {
  hazardType: string;
  description: string;
  location: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    confidence: 'high' | 'medium' | 'low';
  } | null;
  severity: 'low' | 'medium' | 'high';
  needsLocationConfirmation: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userInput, locationContext } = await req.json();
    console.log('Analyzing hazard input:', userInput);
    console.log('Location context:', locationContext);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build enhanced prompt with location context
    let systemPrompt = `You are an AI assistant that analyzes road hazard reports. Your job is to:
1. Identify the type of hazard from user descriptions
2. Extract location information if mentioned
3. Use available location context to improve location accuracy
4. Assess severity level
5. Determine if more location details are needed

Available Location Context:`;

    if (locationContext?.lastKnownLocation) {
      systemPrompt += `\n- User's last known location: ${locationContext.lastKnownLocation.address || `${locationContext.lastKnownLocation.lat}, ${locationContext.lastKnownLocation.lng}`}`;
    }
    if (locationContext?.routeStartLocation) {
      systemPrompt += `\n- User's route start: ${locationContext.routeStartLocation.address || `${locationContext.routeStartLocation.lat}, ${locationContext.routeStartLocation.lng}`}`;
    }
    if (locationContext?.routeDestinationLocation) {
      systemPrompt += `\n- User's route destination: ${locationContext.routeDestinationLocation.address || `${locationContext.routeDestinationLocation.lat}, ${locationContext.routeDestinationLocation.lng}`}`;
    }

    if (!locationContext?.lastKnownLocation && !locationContext?.routeStartLocation && !locationContext?.routeDestinationLocation) {
      systemPrompt += `\n- No location context available`;
    }

    systemPrompt += `

IMPORTANT: If the user's hazard description doesn't include a specific location BUT you have location context available, try to intelligently match the hazard to the most likely location:
- If user is on a planned route, hazard is likely somewhere along that route
- If user mentions "here" or "where I am", use their last known location
- If user mentions direction indicators like "ahead", "behind", "near", try to relate to their context

Respond ONLY with valid JSON in this exact format:
{
  "hazardType": "Brief description of hazard type",
  "description": "Original user input",
  "location": {
    "address": "extracted or inferred address",
    "coordinates": {"lat": number, "lng": number},
    "confidence": "high|medium|low",
    "source": "extracted|inferred_from_context|unknown"
  } or null,
  "severity": "low|medium|high",
  "needsLocationConfirmation": boolean
}

Hazard types to look for: ice patches, snow drifts, fallen trees, accidents, potholes, construction, flooding, debris, visibility issues.
Severity guidelines:
- high: ice, fallen trees, accidents, severe flooding
- medium: snow drifts, construction, moderate debris  
- low: potholes, minor debris

Location confidence and needsLocationConfirmation logic:
- high confidence + no confirmation needed: specific address mentioned or high confidence inference from context
- medium confidence + no confirmation needed: general area mentioned with good context
- low confidence + confirmation needed: vague description with some context
- null location + confirmation needed: no location info and no useful context

Set needsLocationConfirmation to true ONLY if you cannot determine a likely location with at least medium confidence using the available context.`;

    // Use OpenAI to analyze the hazard report
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('OpenAI response:', aiResponse);

    // Parse the JSON response from OpenAI
    let analysis: HazardAnalysis;
    try {
      analysis = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      // Fallback to basic analysis if AI response is malformed
      analysis = {
        hazardType: 'Road hazard reported',
        description: userInput,
        location: null,
        severity: 'medium',
        needsLocationConfirmation: true
      };
    }

    // If we have a location address, try to geocode it
    if (analysis.location?.address) {
      const geocodeResult = await geocodeAddress(analysis.location.address);
      if (geocodeResult) {
        analysis.location.coordinates = geocodeResult;
        analysis.location.confidence = 'high';
        analysis.needsLocationConfirmation = false;
      }
    }

    console.log('Final analysis:', analysis);
    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-hazard function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze hazard report',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
  try {
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      console.log('Google Maps API key not available for geocoding');
      return null;
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log('Geocoded address:', address, 'to coordinates:', location);
      return {
        lat: location.lat,
        lng: location.lng
      };
    } else {
      console.log('No geocoding results for address:', address);
      return null;
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
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
    const { userInput } = await req.json();
    console.log('Analyzing hazard input:', userInput);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

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
            content: `You are an AI assistant that analyzes road hazard reports. Your job is to:
1. Identify the type of hazard from user descriptions
2. Extract location information if mentioned
3. Assess severity level
4. Determine if more location details are needed

Respond ONLY with valid JSON in this exact format:
{
  "hazardType": "Brief description of hazard type",
  "description": "Original user input",
  "location": {
    "address": "extracted address or null",
    "confidence": "high|medium|low"
  } or null,
  "severity": "low|medium|high",
  "needsLocationConfirmation": boolean
}

Hazard types to look for: ice patches, snow drifts, fallen trees, accidents, potholes, construction, flooding, debris, visibility issues.
Severity guidelines:
- high: ice, fallen trees, accidents, severe flooding
- medium: snow drifts, construction, moderate debris  
- low: potholes, minor debris

Location confidence:
- high: specific address or landmark mentioned
- medium: road name or highway number mentioned
- low: vague location description

Set needsLocationConfirmation to true if location is null or confidence is low.`
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
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
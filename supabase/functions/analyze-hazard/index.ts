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

    // Build comprehensive context for AI analysis
    let systemPrompt = `You are an expert AI assistant analyzing road hazard reports. You will receive ALL available user information and must use this context to make the best possible guess about hazard location.

=== USER INFORMATION ANALYSIS ===

LOCATION CONTEXT:`;

    let hasLocationData = false;

    if (locationContext?.lastKnownLocation) {
      hasLocationData = true;
      const location = locationContext.lastKnownLocation;
      const timeAgo = location.timestamp ? Math.floor((Date.now() - location.timestamp) / (1000 * 60)) : 'unknown';
      systemPrompt += `
📍 LAST KNOWN LOCATION: ${location.address || `${location.lat}, ${location.lng}`}
   - Coordinates: ${location.lat}, ${location.lng}
   - Captured: ${timeAgo} minutes ago
   - Confidence: This is where the user was recently located`;
    }

    if (locationContext?.routeStartLocation) {
      hasLocationData = true;
      const start = locationContext.routeStartLocation;
      systemPrompt += `
🚗 ROUTE START: ${start.address || `${start.lat}, ${start.lng}`}
   - Coordinates: ${start.lat}, ${start.lng}
   - Context: User planned a trip starting from here`;
    }

    if (locationContext?.routeDestinationLocation) {
      hasLocationData = true;
      const dest = locationContext.routeDestinationLocation;
      systemPrompt += `
🎯 ROUTE DESTINATION: ${dest.address || `${dest.lat}, ${dest.lng}`}
   - Coordinates: ${dest.lat}, ${dest.lng}
   - Context: User is traveling to this location`;
    }

    if (!hasLocationData) {
      systemPrompt += `
❌ NO LOCATION DATA: User has not shared any location information previously`;
    }

    systemPrompt += `

=== AI ANALYSIS INSTRUCTIONS ===

Your task is to:
1. Analyze the user's hazard description
2. Use ALL available context to make an educated guess about location
3. Only ask for user location if you genuinely cannot make a reasonable guess

LOCATION INFERENCE RULES:
• If user says "here", "where I am", "at my location" → Use last known location
• If user says "ahead", "behind", "up the road" → Infer direction from route context
• If user mentions road names → Cross-reference with their known locations
• If user is on a planned route → Hazard is likely somewhere along that path
• If no specific location mentioned but context exists → Make best educated guess
• If user says general area (like "downtown", "near the mall") → Combine with their context

CONFIDENCE LEVELS:
• HIGH: Specific location mentioned OR strong contextual inference
• MEDIUM: General area mentioned OR moderate contextual inference  
• LOW: Weak contextual clues OR ambiguous description
• UNKNOWN: No useful information to make any location guess

WHEN TO ASK FOR LOCATION:
Only set needsLocationConfirmation=true if:
- No location mentioned in description AND
- No useful context available to make even a rough guess AND
- Cannot infer location from any available data

RESPONSE FORMAT (JSON only):
{
  "hazardType": "Brief description of hazard type",
  "description": "Original user input",
  "location": {
    "address": "best guess address or area description",
    "coordinates": {"lat": number, "lng": number} or null,
    "confidence": "high|medium|low",
    "source": "extracted_from_text|inferred_from_last_known|inferred_from_route|inferred_from_context|educated_guess",
    "reasoning": "explanation of how you determined this location"
  } or null,
  "severity": "low|medium|high",
  "needsLocationConfirmation": boolean,
  "aiReasoning": "Brief explanation of your decision process"
}

HAZARD TYPES: ice patches, snow drifts, fallen trees, accidents, potholes, construction, flooding, debris, visibility issues
SEVERITY: high=dangerous (ice,trees,accidents), medium=moderate (snow,construction), low=minor (potholes,small debris)`;

    console.log('System prompt with context:', systemPrompt);

    // Use OpenAI to analyze the hazard report with full context
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
            content: `USER HAZARD REPORT: "${userInput}"

Please analyze this hazard report using all the context provided above and make your best guess about the location.`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
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
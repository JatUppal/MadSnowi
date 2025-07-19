import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HazardAnalysis {
  title: string;
  hazardType: string;
  description: string;
  location: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    confidence: 'high' | 'medium' | 'low';
    source: 'gpt_guess' | 'user_location' | 'places_api' | 'exact_match';
    reasoning?: string;
  } | null;
  severity: 'low' | 'medium' | 'high';
  needsLocationConfirmation: boolean;
  aiReasoning?: string;
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

    // Get nearby places if user location is available
    let nearbyPlaces = '';
    if (locationContext?.lastKnownLocation) {
      nearbyPlaces = await getNearbyPlaces(locationContext.lastKnownLocation.lat, locationContext.lastKnownLocation.lng);
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

    if (nearbyPlaces) {
      systemPrompt += `
🏪 NEARBY PLACES (within 1 mile of user):
${nearbyPlaces}`;
    }

    systemPrompt += `

=== AI ANALYSIS INSTRUCTIONS ===

Your task is to:
1. Correct any grammatical errors and spelling mistakes in the user's description
2. Create a concise 2-4 word title for the hazard type (MUST be 2-4 words only)
3. Use ALL available context including nearby places to make precise location guesses
4. Format the address as a readable street address (not just coordinates)
5. Provide confidence assessment and reasoning for location choices
6. Only ask for user location if you genuinely cannot make a reasonable guess

TEXT PROCESSING:
- Fix spelling errors (e.g., "teh" → "the", "thier" → "their")
- Correct grammar and capitalize appropriately
- Make the description clear and professional
- Keep the original meaning intact

TITLE GENERATION (CRITICAL - MUST BE 2-4 WORDS ONLY):
Create a precise 2-4 word title with correct spelling:
- Ice/frost → "Ice Hazard"
- Fallen tree → "Fallen Tree"
- Pothole → "Pothole Alert" 
- Debris/trash → "Road Debris"
- Water/flood → "Water Hazard"
- Construction → "Construction Zone"
- Accident → "Accident Alert"
- Animal → "Animal Hazard"
- Oil spill → "Spill Alert"
- Vehicle breakdown → "Vehicle Breakdown"
- Road closure → "Road Closure"
- Default → "Road Hazard"

LOCATION INFERENCE PRIORITY (CRITICAL):
1. **FIRST PRIORITY**: Extract specific location from user text and match with nearby places
   • "7/11" → Check nearby places list for exact 7-Eleven match
   • "Safeway" → Find Safeway in nearby places list
   • "tree down near 7/11 in Dublin" → Find Dublin 7-Eleven from context
   • "Highway 101" → Find Highway 101 in user's area  
   • "downtown" → Find downtown relative to user's known locations

2. **USE NEARBY PLACES DATA**: Prioritize matches from nearby places list
   • If user mentions "Safeway" and there's a Safeway in nearby places → Use that exact location
   • Match business names, landmarks, and addresses from nearby places first
   • Use nearby places to disambiguate common names (multiple Starbucks, etc.)

3. **USE CONTEXT TO NARROW DOWN**: Use user's location context to resolve ambiguity
   • Multiple matches exist → Pick closest to user's coordinates
   • User context helps disambiguate common place names

3. **DIRECTION/RELATIVE TERMS**: 
   • "here" / "where I am" / "at my location" → Use exact user location
   • "ahead" / "up the road" → Estimate along route direction from user location
   • "near downtown" → Find downtown area relative to user's context

4. **ADDRESS FORMATTING**:
   • Always provide readable street address when possible
   • Format as: "123 Main St, City, State ZIP" 
   • Use 📍 symbol before address
   • Avoid showing raw coordinates to user

5. **FALLBACK HIERARCHY**:
   • Cannot find mentioned location → Use user's coordinates as fallback (MEDIUM confidence)
   • No location mentioned but have context → Use user location (MEDIUM confidence)  
   • No location mentioned and no context → Ask for location (LOW confidence)

WHEN TO ASK FOR LOCATION:
Only set needsLocationConfirmation=true if:
- No location mentioned in description AND
- No user context available (no last known, no route data) AND  
- Cannot make any reasonable location guess
- If user has NO data at all, MUST prompt for location

RESPONSE FORMAT (JSON only):
{
  "title": "2-4 word hazard title with correct spelling",
  "hazardType": "Brief description of hazard type",
  "description": "Corrected and cleaned user input with proper grammar and spelling",
  "location": {
    "address": "📍 readable street address", 
    "coordinates": {"lat": number, "lng": number} or null,
    "confidence": "high|medium|low",
    "source": "gpt_guess|user_location|places_api|exact_match",
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
        title: 'Road Hazard',
        hazardType: 'Road hazard reported',
        description: userInput,
        location: null,
        severity: 'medium',
        needsLocationConfirmation: true
      };
    }

    // Enhanced location processing with Google Places API
    if (analysis.location) {
      // If AI provided a rough location, try to enhance it with Google Places
      if (analysis.location.confidence === 'low' || analysis.location.confidence === 'medium') {
        const enhancedLocation = await enhanceLocationWithPlaces(analysis.location.address, locationContext);
        if (enhancedLocation) {
          analysis.location = enhancedLocation;
          analysis.needsLocationConfirmation = false;
        }
      }
      
      // If we still need geocoding, try standard geocoding
      if (!analysis.location.coordinates && analysis.location.address) {
        const geocodeResult = await geocodeAddress(analysis.location.address);
        if (geocodeResult) {
          analysis.location.coordinates = geocodeResult;
          if (analysis.location.confidence === 'low') {
            analysis.location.confidence = 'medium';
          }
          analysis.needsLocationConfirmation = false;
        }
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

async function getNearbyPlaces(lat: number, lng: number): Promise<string> {
  try {
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      console.log('Google Maps API key not available for nearby places');
      return '';
    }

    const radius = 1609; // 1 mile in meters
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${googleMapsApiKey}`;
    
    const response = await fetch(placesUrl);
    if (!response.ok) {
      console.error('Places API error:', response.status);
      return '';
    }

    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      // Format places for AI context
      const places = data.results.slice(0, 20).map((place: any) => {
        return `• ${place.name} (${place.types[0]?.replace(/_/g, ' ')}) - ${place.vicinity}`;
      }).join('\n');
      
      console.log('Found nearby places:', places);
      return places;
    }
    
    return '';
  } catch (error) {
    console.error('Error getting nearby places:', error);
    return '';
  }
}

async function enhanceLocationWithPlaces(locationText: string | undefined, locationContext: any): Promise<any | null> {
  try {
    if (!locationText || !locationContext?.lastKnownLocation) return null;
    
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) return null;

    // Use Google Places Text Search to find specific places mentioned by user
    const query = locationText.replace('📍', '').trim();
    const userLat = locationContext.lastKnownLocation.lat;
    const userLng = locationContext.lastKnownLocation.lng;
    
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${userLat},${userLng}&radius=8000&key=${googleMapsApiKey}`;
    
    const response = await fetch(textSearchUrl);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const place = data.results[0]; // Take the closest/most relevant result
      
      return {
        address: `📍 ${place.formatted_address}`,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        confidence: 'high' as const,
        source: 'places_api' as const,
        reasoning: `Found exact match using Google Places: ${place.name}`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error enhancing location with Places API:', error);
    return null;
  }
}

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
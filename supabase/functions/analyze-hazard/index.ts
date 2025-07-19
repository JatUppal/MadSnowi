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
    console.log('🔑 API KEY CHECK:');
    console.log('  - Has API Key:', !!openAIApiKey);
    console.log('  - API Key length:', openAIApiKey?.length || 0);
    console.log('  - API Key prefix:', openAIApiKey?.substring(0, 10) || 'none');
    
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found in environment variables');
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
- NEVER end the title with ":" or suffixes like "There"
- The title should not include vague terms like "Here", "There", "Nearby", "Location", or "by the user"
- Always generate a clean, specific, informative title (2-4 words)

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

4. **DIRECTION/RELATIVE TERMS**: 
   • "here" / "where I am" / "at my location" → Use exact user location
   • "ahead" / "up the road" → Estimate along route direction from user location
   • "near downtown" → Find downtown area relative to user's context

5. **ADDRESS FORMATTING**:
   • Always provide readable street address when possible
   • Format as: "123 Main St, City, State ZIP" 
   • Use 📍 symbol before address
   • Avoid showing raw coordinates to user

6. **FALLBACK HIERARCHY**:
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

Do NOT include vague location descriptors like "There", "Here", or "Nearby" in the title or address.
Always generate a clean, specific, informative title (2-4 words).

HAZARD TYPES: ice patches, snow drifts, fallen trees, accidents, potholes, construction, flooding, debris, visibility issues
SEVERITY: high=dangerous (ice,trees,accidents), medium=moderate (snow,construction), low=minor (potholes,small debris)`;

    console.log('System prompt with context:', systemPrompt);

    // Try OpenAI analysis first, but handle quota/API failures gracefully
    let analysis: HazardAnalysis;
    
    console.log('🤖 ATTEMPTING OPENAI API CALL...');
    
    try {
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

      console.log('📡 OPENAI API RESPONSE:');
      console.log('  - Status:', response.status);
      console.log('  - Status Text:', response.statusText);
      console.log('  - Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error details:', errorText);
        console.error('❌ Full response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Handle specific error types
        if (response.status === 429) {
          console.log('OpenAI quota exceeded, using smart fallback analysis');
          throw new Error('QUOTA_EXCEEDED');
        } else if (response.status === 401) {
          console.log('OpenAI API key invalid, using fallback analysis');
          throw new Error('INVALID_API_KEY');
        } else {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      console.log('OpenAI response:', aiResponse);

      // Parse the JSON response from OpenAI
      try {
        const rawAnalysis = JSON.parse(aiResponse);
        
        // Clean up the title to remove colons and extra text
        const cleanTitle = (rawAnalysis.title || 'Road Hazard')
          .replace(/:\s*.*$/, '') // Remove colon and everything after it
          .trim();
        
        analysis = {
          ...rawAnalysis,
          title: cleanTitle,
          hazardType: cleanTitle
        };
        
        console.log('✅ OPENAI ANALYSIS SUCCESS:', analysis);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('PARSE_ERROR');
      }
      
    } catch (aiError) {
      console.log('OpenAI analysis failed, using enhanced fallback logic:', aiError.message);
      
      // Simple but effective fallback analysis
      analysis = createSimpleFallback(userInput, locationContext);
    }

    // Enhanced location processing with Google Places API if AI succeeded
    if (analysis.location && analysis.location.confidence !== 'high') {
      // Try to enhance location with Google Places Text Search
      const enhancedLocation = await tryEnhanceWithPlaces(userInput, locationContext);
      if (enhancedLocation) {
        analysis.location = enhancedLocation;
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

function createSimpleFallback(userInput: string, locationContext: any): HazardAnalysis {
  console.log('Creating simple fallback analysis for:', userInput);
  
  // Clean up the input text
  let cleanedText = userInput.trim();
  cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  if (!cleanedText.match(/[.!?]$/)) {
    cleanedText += '.';
  }
  
  // Generate title (2-4 words)
  const lowerInput = userInput.toLowerCase();
  let title = 'Road Hazard';
  let severity: 'low' | 'medium' | 'high' = 'medium';
  
  if (lowerInput.includes('tree') && (lowerInput.includes('down') || lowerInput.includes('fell'))) {
    title = 'Fallen Tree';
    severity = 'high';
  } else if (lowerInput.includes('ice') || lowerInput.includes('frost')) {
    title = 'Ice Hazard';
    severity = 'high';
  } else if (lowerInput.includes('accident') || lowerInput.includes('crash')) {
    title = 'Accident Alert';
    severity = 'high';
  } else if (lowerInput.includes('construction')) {
    title = 'Construction Zone';
    severity = 'medium';
  } else if (lowerInput.includes('pothole')) {
    title = 'Pothole Alert';
    severity = 'low';
  } else if (lowerInput.includes('debris') || lowerInput.includes('trash')) {
    title = 'Road Debris';
    severity = 'medium';
  }
  
  // Basic location handling
  let location = null;
  let needsConfirmation = true;
  
  if (locationContext?.lastKnownLocation) {
    location = {
      address: locationContext.lastKnownLocation.address || `📍 Location: ${locationContext.lastKnownLocation.lat.toFixed(4)}, ${locationContext.lastKnownLocation.lng.toFixed(4)}`,
      coordinates: {
        lat: locationContext.lastKnownLocation.lat,
        lng: locationContext.lastKnownLocation.lng
      },
      confidence: "medium" as const,
      source: "user_location" as const,
      reasoning: "Used user location as no specific place could be identified"
    };
    needsConfirmation = false;
  }
  
  return {
    title,
    hazardType: 'Road hazard',
    description: cleanedText,
    location,
    severity,
    needsLocationConfirmation: needsConfirmation,
    aiReasoning: 'Analysis created using fallback logic due to AI service unavailability'
  };
}

async function tryEnhanceWithPlaces(userInput: string, locationContext: any) {
  try {
    if (!locationContext?.lastKnownLocation) return null;
    
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) return null;

    // Extract business/place names and street names from input
    const businessMatch = userInput.match(/\b(walgreens?|cvs|safeway|target|walmart|starbucks|mcdonalds?|7-eleven|shell|chevron)\b/gi);
    const streetGuess = userInput.match(/\b(\w+\s+(road|rd|avenue|ave|parkway|blvd|boulevard|street|st|lane|ln))\b/gi)?.[0] || '';
    
    if (!businessMatch) return null;

    const business = businessMatch[0];
    const userLat = locationContext.lastKnownLocation.lat;
    const userLng = locationContext.lastKnownLocation.lng;
    
    // Build a more specific query including street information if available
    let query = business;
    if (streetGuess) {
      // Include street context in the search for better matching
      query = `${business} ${streetGuess}`;
    }
    
    // Use a larger radius to find places further away but still prioritize by distance
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${userLat},${userLng}&radius=16000&key=${googleMapsApiKey}`;
    
    console.log('🔍 Enhanced location search query:', query);
    console.log('🔍 Search URL:', textSearchUrl.replace(googleMapsApiKey, '[REDACTED]'));
    
    const response = await fetch(textSearchUrl);
    if (!response.ok) return null;

    const data = await response.json();
    console.log('🔍 Places API response status:', data.status);
    console.log('🔍 Number of results:', data.results?.length || 0);
    
    if (data.status === 'OK' && data.results.length > 0) {
      // Find the closest result to user's location
      let bestPlace = data.results[0];
      let shortestDistance = Number.MAX_VALUE;
      
      for (const place of data.results.slice(0, 5)) { // Check top 5 results
        const distance = calculateDistance(
          userLat, userLng,
          place.geometry.location.lat, place.geometry.location.lng
        );
        
        // Calculate scoring factors for better matching
        const nameScore = place.name?.toLowerCase().includes(business.toLowerCase()) ? 1 : 0;
        const addressScore = streetGuess && place.formatted_address?.toLowerCase().includes(streetGuess.toLowerCase()) ? 0.5 : 0;
        const distanceScore = Math.max(0, 1 - (distance / 10)); // Normalize distance to 0-1 scale
        const totalScore = nameScore + addressScore + distanceScore;
        
        console.log(`🔍 Evaluating place: ${place.name} at ${place.formatted_address}`);
        console.log(`  - Name score: ${nameScore}`);
        console.log(`  - Address score: ${addressScore}`);
        console.log(`  - Distance score: ${distanceScore.toFixed(2)}`);
        console.log(`  - Total score: ${totalScore.toFixed(2)}`);
        console.log(`  - Distance: ${distance.toFixed(2)} km`);
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          bestPlace = place;
        }
      }
      
      console.log(`🎯 Selected closest place: ${bestPlace.name} (${shortestDistance.toFixed(2)} km away)`);
      
      return {
        address: `📍 ${bestPlace.formatted_address}`,
        coordinates: {
          lat: bestPlace.geometry.location.lat,
          lng: bestPlace.geometry.location.lng
        },
        confidence: 'high' as const,
        source: 'places_api' as const,
        reasoning: `Found closest match using Google Places: ${bestPlace.name} (${shortestDistance.toFixed(1)} km away)`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error enhancing location with Places API:', error);
    return null;
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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
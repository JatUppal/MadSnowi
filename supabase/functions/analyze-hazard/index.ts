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
    const { userInput, locationContext, geocodeOnly, placesSearchOnly } = await req.json();
    console.log('Analyzing hazard input:', userInput);
    console.log('Location context:', locationContext);

    // Handle special requests
    if (placesSearchOnly) {
      const placeQuery = userInput.replace('Search place: ', '');
      const placeResult = await searchPlaceWithContext(placeQuery, locationContext.lastKnownLocation);
      return new Response(JSON.stringify({ place: placeResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (geocodeOnly) {
      const locationQuery = userInput.replace('Find location: ', '');
      const coords = await geocodeAddress(locationQuery);
      return new Response(JSON.stringify({ 
        location: coords ? { coordinates: coords } : null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        analysis = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('PARSE_ERROR');
      }
      
    } catch (aiError) {
      console.log('OpenAI analysis failed, using enhanced fallback logic:', aiError.message);
      
      // Simple fallback analysis without complex dependencies
      analysis = {
        title: "Road Hazard",
        hazardType: "Road hazard",
        description: userInput.trim(),
        location: null,
        severity: "medium",
        needsLocationConfirmation: true,
        aiReasoning: "Analysis created using fallback logic due to AI service unavailability"
      };
      
      // Try to add user location if available
      if (locationContext?.lastKnownLocation) {
        analysis.location = {
          address: locationContext.lastKnownLocation.address || `📍 Location: ${locationContext.lastKnownLocation.lat.toFixed(4)}, ${locationContext.lastKnownLocation.lng.toFixed(4)}`,
          coordinates: {
            lat: locationContext.lastKnownLocation.lat,
            lng: locationContext.lastKnownLocation.lng
          },
          confidence: "medium" as const,
          source: "user_location" as const,
          reasoning: "Used user location as no specific place could be identified"
        };
        analysis.needsLocationConfirmation = false;
      }
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

async function createFallbackAnalysis(userInput: string, locationContext: any): Promise<HazardAnalysis> {
  console.log('Creating enhanced fallback analysis for:', userInput);
  
  // Clean and process the text
  const processedText = processHazardText(userInput);
  
  // Enhanced location extraction using Google Places Text Search
  let location = null;
  let needsConfirmation = true;
  
  // Extract potential place names from user input
  const placeKeywords = extractPlaceKeywords(userInput);
  console.log('Extracted place keywords:', placeKeywords);
  
  if (placeKeywords.length > 0 && locationContext?.lastKnownLocation) {
    // Try Google Places Text Search for each keyword
    for (const keyword of placeKeywords) {
      console.log('Searching for place:', keyword);
      const placeResult = await searchPlaceWithContext(keyword, locationContext.lastKnownLocation);
      
      if (placeResult) {
        location = {
          address: `📍 ${placeResult.formatted_address}`,
          coordinates: placeResult.coordinates,
          confidence: 'high' as const,
          source: 'places_api' as const,
          reasoning: `Found using Google Places search: ${placeResult.name}`
        };
        needsConfirmation = false;
        console.log('Successfully found place using Google Places:', placeResult);
        break;
      }
    }
  }
  
  // Fallback to user location if no specific place found
  if (!location && locationContext?.lastKnownLocation) {
    const userLoc = locationContext.lastKnownLocation;
    location = {
      address: userLoc.address || `📍 Location: ${userLoc.lat.toFixed(4)}, ${userLoc.lng.toFixed(4)}`,
      coordinates: { lat: userLoc.lat, lng: userLoc.lng },
      confidence: 'medium' as const,
      source: 'user_location' as const,
      reasoning: 'Used user location as no specific place could be identified'
    };
    needsConfirmation = false;
  }
  
  return {
    title: processedText.title,
    hazardType: processedText.hazardType,
    description: processedText.description,
    location,
    severity: processedText.severity,
    needsLocationConfirmation: needsConfirmation,
    aiReasoning: 'Analysis created using fallback logic due to AI service unavailability'
  };
}

function processHazardText(userInput: string): { title: string; hazardType: string; description: string; severity: 'low' | 'medium' | 'high' } {
  // Clean up text
  let cleanedText = userInput.trim()
    .replace(/\bi\b/g, 'I')
    .replace(/\btheres\b/gi, 'there is')
    .replace(/\bthier\b/gi, 'their')
    .replace(/\bteh\b/gi, 'the')
    .replace(/\bwalgrens\b/gi, 'Walgreens')
    .replace(/\bbollingr\b/gi, 'Bollinger')
    .replace(/\s+/g, ' ');
  
  // Capitalize first letter and add period
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
  
  return {
    title,
    hazardType: 'Road hazard',
    description: cleanedText,
    severity
  };
}

function extractPlaceKeywords(userInput: string): string[] {
  const keywords: string[] = [];
  const input = userInput.toLowerCase();
  
  // Common business/place patterns
  const businessPatterns = [
    /\b(walgreens?|cvs|safeway|target|walmart|starbucks|mcdonalds?|burger king|taco bell)\b/g,
    /\b(shell|chevron|exxon|bp|gas station)\b/g,
    /\b(home depot|lowes?|costco|best buy)\b/g
  ];
  
  // Street/road patterns
  const streetPatterns = [
    /\b([a-zA-Z\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|highway|hwy|drive|dr|lane|ln|way))\b/gi
  ];
  
  // Extract business names
  businessPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(input)) !== null) {
      keywords.push(match[0].trim());
    }
  });
  
  // Extract street names
  streetPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(userInput)) !== null) {
      keywords.push(match[0].trim());
    }
  });
  
  return [...new Set(keywords)]; // Remove duplicates
}

async function searchPlaceWithContext(query: string, userLocation: {lat: number, lng: number}): Promise<any | null> {
  try {
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) return null;
    
    // Use Google Places Text Search with user location bias
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${userLocation.lat},${userLocation.lng}&radius=8000&key=${googleMapsApiKey}`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const place = data.results[0];
      
      return {
        name: place.name,
        formatted_address: place.formatted_address,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error searching place with context:', error);
    return null;
  }
}
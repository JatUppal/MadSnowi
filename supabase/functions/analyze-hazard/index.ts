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
    
    // Handle special reverse geocoding request
    if (userInput === 'reverse-geocode-only' && locationContext?.lastKnownLocation) {
      const location = locationContext.lastKnownLocation;
      const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
      
      if (googleMapsApiKey) {
        try {
          console.log('🔍 REVERSE GEOCODING FOR USER LOCATION STORAGE...');
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${googleMapsApiKey}`;
          const geocodeResponse = await fetch(geocodeUrl);
          
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
              const reverseGeocodeResult = geocodeData.results[0].formatted_address;
              console.log('✅ Reverse geocoding successful:', reverseGeocodeResult);
              return new Response(
                JSON.stringify({ reverseGeocodeResult }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (error) {
          console.log('⚠️ Reverse geocoding failed:', error);
        }
      }
      
      // Return original address if geocoding fails
      return new Response(
        JSON.stringify({ reverseGeocodeResult: location.address }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      
      // Get Google Maps API key for reverse geocoding
      const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
      
      // Use existing address or coordinates as fallback
      let userLocationAddress = location.address || `${location.lat}, ${location.lng}`;
      
      console.log(`🔍 REVERSE GEOCODING START:`);
      console.log(`  - Original coordinates: ${location.lat}, ${location.lng}`);
      console.log(`  - Original address: ${userLocationAddress}`);
      console.log(`  - Google Maps API Key available: ${!!googleMapsApiKey}`);
      
      // Try to reverse geocode coordinates to get readable address (optional)
      if (googleMapsApiKey && userLocationAddress.includes('Location:')) {
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${googleMapsApiKey}`;
          console.log(`  - Making geocoding request to: ${geocodeUrl.replace(googleMapsApiKey, 'API_KEY_HIDDEN')}`);
          
          const geocodeResponse = await fetch(geocodeUrl);
          
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            
            console.log(`📍 GEOCODING API RESPONSE:`);
            console.log(`  - Status: ${geocodeData.status}`);
            console.log(`  - Results count: ${geocodeData.results?.length || 0}`);
            console.log(`  - Full response:`, JSON.stringify(geocodeData, null, 2));
            
            if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
              userLocationAddress = geocodeData.results[0].formatted_address;
              console.log(`✅ REVERSE GEOCODING SUCCESS:`);
              console.log(`  - New address: ${userLocationAddress}`);
              console.log(`  - Coordinates: ${location.lat}, ${location.lng}`);
              console.log(`  - Address components:`, JSON.stringify(geocodeData.results[0].address_components, null, 2));
            } else {
              console.log(`⚠️ Geocoding failed with status: ${geocodeData.status}`);
              if (geocodeData.error_message) {
                console.log(`  - Error message: ${geocodeData.error_message}`);
              }
            }
          } else {
            console.log(`⚠️ Geocoding API request failed: ${geocodeResponse.status}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to reverse geocode user location: ${error.message}`);
          // Continue with original address - don't let geocoding failure break the function
        }
      } else {
        console.log(`  - Skipping reverse geocoding (no API key or address already readable)`);
      }
      
      console.log(`📍 FINAL USER LOCATION FOR AI: ${userLocationAddress}`);
      
      systemPrompt += `
📍 LAST KNOWN LOCATION: ${userLocationAddress}
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
1. **FIRST PRIORITY - USER LOCATION PROXIMITY**: Always prioritize finding the CLOSEST business to user's location
   • "fallen tree by safeway" → Find the NEAREST Safeway to user's coordinates FIRST
   • "accident at 7/11" → Find the CLOSEST 7-Eleven to user's current location
   • "ice patch near walmart" → Find the NEAREST Walmart to user's position
   • NEVER use a random or far-away location - ALWAYS find closest match to user

2. **SEARCH EXPANSION STRATEGY**: Start near user location and expand outward
   • Search within 1 mile radius of user location FIRST
   • If no match found, expand to 5 mile radius
   • If still no match, expand to 10 mile radius
   • Always prefer closer businesses over farther ones

3. **USE NEARBY PLACES DATA**: Prioritize businesses from nearby places list
   • If user mentions "Safeway" and there's a Safeway in nearby places → Use that exact location
   • Match business names from nearby places list FIRST before expanding search
   • Use nearby places to disambiguate common names (multiple Starbucks, etc.)

4. **BUSINESS NAME MATCHING**: Extract business name and find NEAREST match
   • Extract: "walgreens", "cvs", "safeway", "target", "walmart", "starbucks", etc.
   • Search Google Places for exact business name near user location
   • Return address of CLOSEST matching business only

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
      
      // Try to enhance location with Google Places even in fallback mode
      const enhancedLocation = await tryEnhanceWithPlaces(userInput, locationContext);
      if (enhancedLocation) {
        analysis.location = enhancedLocation;
        analysis.needsLocationConfirmation = false;
      }
    }

    // Enhanced location processing with Google Places API if AI succeeded
    if (analysis.location && analysis.location.confidence !== 'high') {
      // Try to enhance location with Google Places Text Search if not already done
      if (analysis.location.source !== 'places_api') {
        const enhancedLocation = await tryEnhanceWithPlaces(userInput, locationContext);
        if (enhancedLocation) {
          analysis.location = enhancedLocation;
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

    // Extract business/place names from input
    const businessMatch = userInput.match(/\b(walgreens?|cvs|safeway|target|walmart|starbucks|mcdonalds?|7-eleven|shell|chevron|gas\s*station|grocery\s*store|pharmacy|bank|atm|home\s*depot|lowes?|best\s*buy|costco|sams?\s*club|whole\s*foods|trader\s*joes?|chipotle|subway|taco\s*bell|burger\s*king|kfc|pizza\s*hut|dominos?|papa\s*johns?|dennys?|ihop|applebees?|olive\s*garden|red\s*lobster|chilis?|outback|panda\s*express|in-n-out|five\s*guys|jack\s*in\s*the\s*box|wendys?|arbys?|sonic|dairy\s*queen|baskin\s*robbins|dunkin\s*donuts?|krispy\s*kreme|tim\s*hortons?|panera\s*bread?|einstein\s*bros?|jamba\s*juice|smoothie\s*king|orange\s*julius|auntie\s*annes?|cinnabon|pretzelmaker|hot\s*dog\s*on\s*a\s*stick|nathans?\s*famous|wienerschnitzel|del\s*taco|el\s*pollo\s*loco|yoshinoya|pei\s*wei|pick\s*up\s*stix|pf\s*changs?|benihana|cheesecake\s*factory|california\s*pizza\s*kitchen|bjs?\s*restaurant|cracker\s*barrel|golden\s*corral|hometown\s*buffet|ryans?\s*steakhouse|sizzler|black\s*angus|claim\s*jumper|marie\s*callenders?|mimi\s*cafe|coco\s*s|nordstrom|macys?|jc\s*penney|kohls?|sears|bloomingdales?|neiman\s*marcus|saks\s*fifth\s*avenue|barneys?\s*new\s*york|century\s*21|tj\s*maxx|marshalls?|ross\s*dress\s*for\s*less|burlington\s*coat\s*factory|old\s*navy|gap|banana\s*republic|american\s*eagle|abercrombie|hollister|aeropostale|forever\s*21|h&m|zara|uniqlo|urban\s*outfitters|anthropologie|free\s*people|victoria\s*secret|bath\s*and\s*body\s*works|bed\s*bath\s*and\s*beyond|williams\s*sonoma|pottery\s*barn|crate\s*and\s*barrel|pier\s*1|ikea|ashley\s*furniture|rooms\s*to\s*go|la-z-boy|ethan\s*allen|restoration\s*hardware|west\s*elm|cb2|design\s*within\s*reach|room\s*and\s*board|mitchell\s*gold|bob\s*williams|dwr|world\s*market|cost\s*plus|pier\s*1\s*imports|tuesday\s*morning|big\s*lots|dollar\s*tree|family\s*dollar|dollar\s*general)\b/gi);
    
    if (!businessMatch) return null;

    const business = businessMatch[0];
    const userLat = locationContext.lastKnownLocation.lat;
    const userLng = locationContext.lastKnownLocation.lng;
    
    console.log('🔍 FINDING CLOSEST BUSINESS TO USER');
    console.log(`🔍 User location: ${userLat}, ${userLng}`);
    console.log(`🔍 Business to find: "${business}"`);
    
    // Strategy 1: Use Nearby Search API first (more accurate for finding closest businesses)
    const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLat},${userLng}&radius=8000&keyword=${encodeURIComponent(business)}&key=${googleMapsApiKey}`;
    
    console.log('🔍 STRATEGY 1: Nearby Search API');
    console.log(`🔍 Nearby search URL: ${nearbySearchUrl.replace(googleMapsApiKey, '[REDACTED]')}`);
    
    let response = await fetch(nearbySearchUrl);
    let data = await response.json();
    
    console.log(`🔍 Nearby search status: ${data.status}`);
    console.log(`🔍 Nearby search results: ${data.results?.length || 0}`);
    
    // Strategy 2: If nearby search fails or returns no results, try text search
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log('🔍 STRATEGY 2: Text Search API (fallback)');
      const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(business)}&location=${userLat},${userLng}&radius=8000&key=${googleMapsApiKey}`;
      
      console.log(`🔍 Text search URL: ${textSearchUrl.replace(googleMapsApiKey, '[REDACTED]')}`);
      
      response = await fetch(textSearchUrl);
      data = await response.json();
      
      console.log(`🔍 Text search status: ${data.status}`);
      console.log(`🔍 Text search results: ${data.results?.length || 0}`);
    }
    
    if (!response.ok || data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log('🔍 No results found from either search method');
      return null;
    }

    // Find the closest business by calculating actual distances
    let closestBusiness = null;
    let shortestDistance = Number.MAX_VALUE;
    
    console.log(`🔍 ANALYZING ${data.results.length} POTENTIAL MATCHES:`);
    
    for (let i = 0; i < data.results.length; i++) {
      const place = data.results[i];
      const distance = calculateDistance(
        userLat, userLng,
        place.geometry.location.lat, place.geometry.location.lng
      );
      
      // Check if the business name matches what we're looking for
      const nameMatch = place.name?.toLowerCase().includes(business.toLowerCase()) ||
                       place.types?.some(type => type.includes(business.toLowerCase()));
      
      console.log(`📍 [${i + 1}] ${place.name}`);
      console.log(`    📍 Address: ${place.formatted_address || place.vicinity}`);
      console.log(`    📍 Distance: ${distance.toFixed(2)} km`);
      console.log(`    📍 Name match: ${nameMatch}`);
      console.log(`    📍 Types: ${place.types?.join(', ')}`);
      
      // Prioritize exact name matches that are closest
      if (nameMatch && distance < shortestDistance) {
        shortestDistance = distance;
        closestBusiness = place;
        console.log(`    ✅ NEW CLOSEST MATCH!`);
      }
    }
    
    if (!closestBusiness) {
      console.log('🔍 No matching businesses found');
      return null;
    }
    
    // Get detailed address using Place Details API for more accurate address
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${closestBusiness.place_id}&fields=formatted_address,geometry&key=${googleMapsApiKey}`;
    
    console.log('🔍 GETTING DETAILED ADDRESS INFO');
    const detailsResponse = await fetch(placeDetailsUrl);
    const detailsData = await detailsResponse.json();
    
    let finalAddress = closestBusiness.formatted_address || closestBusiness.vicinity;
    let finalCoordinates = closestBusiness.geometry.location;
    
    if (detailsData.status === 'OK' && detailsData.result) {
      finalAddress = detailsData.result.formatted_address || finalAddress;
      finalCoordinates = detailsData.result.geometry.location || finalCoordinates;
      console.log('✅ Enhanced address from Place Details API');
    }
    
    console.log(`🎯 FINAL RESULT:`);
    console.log(`🎯 Business: ${closestBusiness.name}`);
    console.log(`🎯 Address: ${finalAddress}`);
    console.log(`🎯 Distance: ${shortestDistance.toFixed(2)} km`);
    console.log(`🎯 Coordinates: ${finalCoordinates.lat}, ${finalCoordinates.lng}`);
    
    return {
      address: `📍 ${finalAddress}`,
      coordinates: {
        lat: finalCoordinates.lat,
        lng: finalCoordinates.lng
      },
      confidence: 'high' as const,
      source: 'places_api' as const,
      reasoning: `Found closest ${business} using Google Places API: ${closestBusiness.name} located ${shortestDistance.toFixed(1)} km from user`
    };
    
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
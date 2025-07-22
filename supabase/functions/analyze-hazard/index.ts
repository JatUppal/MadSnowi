import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HazardAnalysis {
  title: string;
  hazardType: string;
  description: string;
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
    confidence: string;
    source?: string;
    reasoning?: string;
  };
  severity: string;
  needsLocationConfirmation: boolean;
  aiReasoning?: string;
}

interface PlaceResult {
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types: string[];
  rating?: number;
}

interface PlacesResponse {
  results: PlaceResult[];
  next_page_token?: string;
  status: string;
}

// Calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1, where 1 is perfect match)
function calculateSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return (maxLength - distance) / maxLength;
}

// Search for places using Google Places Text Search API with radius expansion
async function searchPlacesWithExpansion(
  userLat: number, 
  userLng: number, 
  query: string, 
  googleMapsApiKey: string,
  supabase: any
): Promise<{ place: PlaceResult; distance: number; similarity: number; confidence: string } | null> {
  
  const radiusLayers = [1600, 4800, 8000, 16000]; // 1mi, 3mi, 5mi, 10mi in meters
  const confidenceThresholds = {
    1600: 'high',    // < 1 mile = high confidence
    4800: 'medium',  // < 3 miles = medium confidence  
    8000: 'medium',  // < 5 miles = medium confidence
    16000: 'low'     // < 10 miles = low confidence
  };

  console.log(`🔍 Starting place search with query: "${query}"`);
  console.log(`📍 User location: ${userLat}, ${userLng}`);

  for (const radius of radiusLayers) {
    console.log(`🌐 Searching radius: ${radius}m (${(radius * 0.000621371).toFixed(1)} miles)`);
    
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${userLat},${userLng}&radius=${radius}&key=${googleMapsApiKey}`;
      
      let allResults: PlaceResult[] = [];
      let pageToken: string | undefined;
      let pageCount = 0;
      const maxPages = 3;

      // Fetch all pages of results for this radius
      do {
        const searchUrl = pageToken 
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${googleMapsApiKey}`
          : url;
        
        console.log(`  📄 Fetching page ${pageCount + 1}: ${searchUrl.replace(googleMapsApiKey, 'API_KEY_HIDDEN')}`);
        
        if (pageToken) {
          // Google requires a delay before using page tokens
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const response = await fetch(searchUrl);
        const data: PlacesResponse = await response.json();

        console.log(`  📡 API Response status: ${data.status}`);
        if (data.results) {
          console.log(`  📝 Raw results: ${JSON.stringify(data.results.slice(0, 3), null, 2)}`);
        }

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.log(`  ⚠️ API Error: ${data.status}`);
          if (data.status === 'REQUEST_DENIED') {
            console.log(`  ❌ REQUEST_DENIED - Check API key and billing`);
          }
          break;
        }

        if (data.results) {
          allResults.push(...data.results);
          console.log(`  ✅ Found ${data.results.length} places on page ${pageCount + 1}`);
        }

        pageToken = data.next_page_token;
        pageCount++;
        
      } while (pageToken && pageCount < maxPages);

      console.log(`  📊 Total results for ${radius}m radius: ${allResults.length}`);

      // Store all results in database for debugging
      const confidence = confidenceThresholds[radius as keyof typeof confidenceThresholds];
      
      for (const place of allResults) {
        const distance = calculateDistance(
          userLat, userLng,
          place.geometry.location.lat, place.geometry.location.lng
        );

        // Skip places outside the current radius
        if (distance > radius * 0.000621371) continue;

        // Calculate similarity score
        const queryWords = query.toLowerCase().split(/\s+/);
        const businessNames = queryWords.filter(word => 
          word.length > 2 && 
          !['near', 'by', 'at', 'on', 'the', 'and', 'or'].includes(word)
        );

        let maxSimilarity = 0;
        for (const businessName of businessNames) {
          const similarity = calculateSimilarity(businessName, place.name);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // Also check against place types for generic terms
        if (maxSimilarity < 0.6) {
          for (const type of place.types) {
            for (const businessName of businessNames) {
              const typeSimilarity = calculateSimilarity(businessName, type.replace(/_/g, ' '));
              maxSimilarity = Math.max(maxSimilarity, typeSimilarity);
            }
          }
        }

        // Store in database
        try {
          const { error } = await supabase
            .from('places_search_logs')
            .insert({
              search_query: query,
              user_lat: userLat,
              user_lng: userLng,
              radius_meters: radius,
              place_name: place.name,
              place_address: place.formatted_address,
              place_lat: place.geometry.location.lat,
              place_lng: place.geometry.location.lng,
              place_types: place.types,
              distance_miles: distance,
              similarity_score: maxSimilarity,
              confidence_level: confidence,
              was_selected: false // Will update this later if selected
            });

          if (error) {
            console.log(`⚠️ Failed to store place data: ${error.message}`);
          }
        } catch (dbError) {
          console.log(`⚠️ Database error: ${dbError.message}`);
        }
      }

      // Analyze results for this radius to find best match
      let bestMatch: { place: PlaceResult; distance: number; similarity: number } | null = null;
      
      for (const place of allResults) {
        const distance = calculateDistance(
          userLat, userLng,
          place.geometry.location.lat, place.geometry.location.lng
        );

        // Skip places outside the current radius
        if (distance > radius * 0.000621371) continue;

        // Extract business names from the query to match against
        const queryWords = query.toLowerCase().split(/\s+/);
        const businessNames = queryWords.filter(word => 
          word.length > 2 && 
          !['near', 'by', 'at', 'on', 'the', 'and', 'or'].includes(word)
        );

        let maxSimilarity = 0;
        for (const businessName of businessNames) {
          const similarity = calculateSimilarity(businessName, place.name);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // Also check against place types for generic terms
        if (maxSimilarity < 0.6) {
          for (const type of place.types) {
            for (const businessName of businessNames) {
              const typeSimilarity = calculateSimilarity(businessName, type.replace(/_/g, ' '));
              maxSimilarity = Math.max(maxSimilarity, typeSimilarity);
            }
          }
        }

        console.log(`    🏪 ${place.name}: distance=${distance.toFixed(2)}mi, similarity=${maxSimilarity.toFixed(3)}`);

        if (maxSimilarity > 0.7 && (!bestMatch || 
            (maxSimilarity > bestMatch.similarity) || 
            (maxSimilarity >= bestMatch.similarity && distance < bestMatch.distance))) {
          bestMatch = { place, distance, similarity: maxSimilarity };
        }
      }

      // If we found a confident match in this radius, mark it as selected and return it
      if (bestMatch && bestMatch.similarity >= 0.85) {
        const confidence = confidenceThresholds[radius as keyof typeof confidenceThresholds];
        
        // Update the selected place in database
        try {
          const { error } = await supabase
            .from('places_search_logs')
            .update({ was_selected: true })
            .eq('place_name', bestMatch.place.name)
            .eq('search_query', query)
            .eq('radius_meters', radius);

          if (error) {
            console.log(`⚠️ Failed to update selected place: ${error.message}`);
          }
        } catch (dbError) {
          console.log(`⚠️ Database error updating selection: ${dbError.message}`);
        }

        console.log(`✅ Found confident match in ${radius}m radius: ${bestMatch.place.name} (similarity: ${bestMatch.similarity.toFixed(3)}, distance: ${bestMatch.distance.toFixed(2)}mi)`);
        return { ...bestMatch, confidence };
      }

    } catch (error) {
      console.log(`❌ Error searching radius ${radius}m:`, error.message);
    }
  }

  console.log('❌ No confident match found in any radius');
  return null;
}

// Extract hazard type and severity from description
function classifyHazard(description: string): { hazardType: string; severity: string; title: string } {
  const text = description.toLowerCase();
  
  // High severity hazards
  if (text.includes('accident') || text.includes('crash') || text.includes('collision')) {
    return { hazardType: 'accident', severity: 'high', title: 'Accident Alert' };
  }
  if (text.includes('ice') || text.includes('frost') || text.includes('frozen')) {
    return { hazardType: 'ice', severity: 'high', title: 'Ice Hazard' };
  }
  if (text.includes('tree') && (text.includes('fell') || text.includes('down') || text.includes('fallen') || text.includes('blocking'))) {
    return { hazardType: 'obstruction', severity: 'high', title: 'Fallen Tree' };
  }
  if (text.includes('blocked') || text.includes('blocking') || text.includes('closure')) {
    return { hazardType: 'obstruction', severity: 'high', title: 'Road Closure' };
  }

  // Medium severity hazards
  if (text.includes('flood') || text.includes('water') || text.includes('flooding')) {
    return { hazardType: 'flooding', severity: 'medium', title: 'Water Hazard' };
  }
  if (text.includes('construction') || text.includes('work') || text.includes('crew')) {
    return { hazardType: 'construction', severity: 'medium', title: 'Construction Zone' };
  }
  if (text.includes('debris') || text.includes('trash') || text.includes('garbage')) {
    return { hazardType: 'debris', severity: 'medium', title: 'Road Debris' };
  }

  // Low severity hazards
  if (text.includes('pothole') || text.includes('hole')) {
    return { hazardType: 'pothole', severity: 'low', title: 'Pothole Alert' };
  }
  if (text.includes('sign') && text.includes('down')) {
    return { hazardType: 'debris', severity: 'low', title: 'Sign Down' };
  }

  // Default
  return { hazardType: 'unknown', severity: 'medium', title: 'Road Hazard' };
}

// Clean and improve description text
function cleanDescription(input: string): string {
  return input
    .replace(/\bteh\b/gi, 'the')
    .replace(/\bthier\b/gi, 'their')
    .replace(/\byou're\b/gi, 'you are')
    .replace(/\btheres\b/gi, 'there is')
    .replace(/\bdont\b/gi, 'do not')
    .replace(/\bcant\b/gi, 'cannot')
    .replace(/\bwont\b/gi, 'will not')
    .trim()
    .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
    .replace(/([.!?])\s*$/, '$1'); // Ensure proper ending punctuation
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userInput, locationContext } = await req.json();
    console.log('🚀 Starting hazard analysis for:', userInput);
    console.log('📍 Location context:', JSON.stringify(locationContext, null, 2));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    console.log('🔑 Google Maps API Key check:', {
      hasKey: !!googleMapsApiKey,
      keyLength: googleMapsApiKey?.length || 0,
      keyPrefix: googleMapsApiKey?.substring(0, 10) || 'none'
    });
    
    if (!googleMapsApiKey) {
      console.error('❌ Google Maps API key not found');
      throw new Error('Google Maps API key not configured');
    }

    // Handle special reverse geocoding request
    if (userInput === 'reverse-geocode-only' && locationContext?.lastKnownLocation) {
      const location = locationContext.lastKnownLocation;
      
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
      
      // Return original address if geocoding fails
      return new Response(
        JSON.stringify({ reverseGeocodeResult: location.address }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has location data
    if (!locationContext?.lastKnownLocation) {
      console.log('❌ No user location available - requesting location confirmation');
      
      const { hazardType, severity, title } = classifyHazard(userInput);
      const cleanedDescription = cleanDescription(userInput);
      
      const analysis: HazardAnalysis = {
        title,
        hazardType,
        description: cleanedDescription,
        location: {
          address: '📍 Location needed for accurate reporting',
          coordinates: { lat: 0, lng: 0 },
          confidence: 'low',
          source: 'user_input_only',
          reasoning: 'No user location available - need location to find precise address'
        },
        severity,
        needsLocationConfirmation: true,
        aiReasoning: 'Cannot determine precise location without user coordinates. Please share your location for accurate hazard reporting.'
      };

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user coordinates
    const userLat = locationContext.lastKnownLocation.lat;
    const userLng = locationContext.lastKnownLocation.lng;

    console.log(`📍 User location: ${userLat}, ${userLng}`);

    // Classify the hazard
    const { hazardType, severity, title } = classifyHazard(userInput);
    const cleanedDescription = cleanDescription(userInput);

    console.log(`🏷️ Classified as: ${title} (${hazardType}, ${severity} severity)`);

    // Search for the most likely location using Google Places API
    const searchResult = await searchPlacesWithExpansion(userLat, userLng, userInput, googleMapsApiKey, supabase);

    let analysis: HazardAnalysis;

    if (searchResult && searchResult.similarity >= 0.85) {
      // Found a confident match
      const { place, distance, similarity, confidence } = searchResult;
      
      analysis = {
        title,
        hazardType,
        description: `${cleanedDescription} near ${place.name}.`,
        location: {
          address: `📍 ${place.formatted_address}`,
          coordinates: place.geometry.location,
          confidence,
          source: 'places_api',
          reasoning: `Matched '${place.name}' within ${distance.toFixed(2)} mi radius with ${(similarity * 100).toFixed(1)}% name similarity`
        },
        severity,
        needsLocationConfirmation: false,
        aiReasoning: `Found confident location match using Google Places API. ${place.name} located ${distance.toFixed(2)} miles from user with high name similarity (${(similarity * 100).toFixed(1)}%).`
      };

    } else {
      // No confident match found - use user's location as fallback
      console.log('🔄 No confident match found, using user location as fallback');
      
      // Try to get a readable address for user's location
      let userAddress = locationContext.lastKnownLocation.address || `${userLat}, ${userLng}`;
      
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${userLat},${userLng}&key=${googleMapsApiKey}`;
        const geocodeResponse = await fetch(geocodeUrl);
        
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
            userAddress = geocodeData.results[0].formatted_address;
          }
        }
      } catch (error) {
        console.log('⚠️ Failed to reverse geocode user location:', error.message);
      }

      analysis = {
        title,
        hazardType,
        description: cleanedDescription,
        location: {
          address: `📍 ${userAddress}`,
          coordinates: { lat: userLat, lng: userLng },
          confidence: 'medium',
          source: 'user_location',
          reasoning: 'Used user\'s current location as no confident business match was found nearby'
        },
        severity,
        needsLocationConfirmation: false,
        aiReasoning: 'Could not find specific business location mentioned in description. Using user\'s current location as the most likely hazard location.'
      };
    }

    console.log('✅ Analysis complete:', JSON.stringify(analysis, null, 2));

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in analyze-hazard function:', error);
    
    // Return a basic error response
    const errorResponse: HazardAnalysis = {
      title: 'Road Hazard',
      hazardType: 'unknown',
      description: 'Unable to process hazard report due to system error.',
      location: {
        address: '📍 Location unavailable',
        coordinates: { lat: 0, lng: 0 },
        confidence: 'low',
        source: 'error',
        reasoning: 'System error prevented location analysis'
      },
      severity: 'medium',
      needsLocationConfirmation: true,
      aiReasoning: 'System error occurred during analysis. Please try again or manually specify location.'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
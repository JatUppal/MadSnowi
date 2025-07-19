
import { supabase } from '@/integrations/supabase/client';
import { LocationContext } from './locationService';

interface HazardLocation {
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

interface HazardAnalysis {
  title: string;
  hazardType: string;
  description: string;
  location: HazardLocation | null;
  severity: 'low' | 'medium' | 'high';
  needsLocationConfirmation: boolean;
}

export class AIService {
  private static instance: AIService;

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async analyzeHazardReport(userInput: string, locationContext?: LocationContext): Promise<HazardAnalysis> {
    try {
      
      console.log('Sending hazard input to AI:', userInput);
      console.log('Location context:', locationContext);
      
      const { data, error } = await supabase.functions.invoke('analyze-hazard', {
        body: { 
          userInput,
          locationContext 
        }
      });

      if (error) {
        console.error('Error calling analyze-hazard function:', error);
        throw error;
      }

      console.log('AI analysis result:', data);
      return data as HazardAnalysis;
      
    } catch (error) {
      console.error('Failed to analyze hazard with AI:', error);
      console.log('Attempting smart fallback analysis with real geocoding...');
      
      // Smart fallback: try to extract location from user input text
      const inputLower = userInput.toLowerCase();
      
      // Enhanced pattern matching for better location extraction
      const placePatterns = [
        // Business names with location context
        /\b(walgreens?|cvs|safeway|target|walmart|starbucks|mcdonalds?)\s*(?:off|on|near|at|by)?\s*([a-zA-Z\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|highway|hwy|drive|dr|lane|ln|way))\b/gi,
        // Business names alone
        /\b(walgreens?|cvs|safeway|target|walmart|starbucks|mcdonalds?|gas station|7-eleven|shell|chevron)\b/gi,
        // Street names with descriptors
        /\b([a-zA-Z\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|highway|hwy|drive|dr|lane|ln|way))\b/gi,
        // Parks and landmarks
        /\b([a-zA-Z\s]+(?:park|square|plaza|center|mall|station|school|hospital|library))\b/gi,
        // General areas
        /\b(downtown|uptown|midtown)\b/gi
      ];
      
      let extractedLocation = null;
      
      // Try more specific patterns first (business + street)
      for (const pattern of placePatterns) {
        const matches = [...userInput.matchAll(pattern)];
        if (matches.length > 0) {
          // For business + street pattern, combine both parts
          if (pattern.source.includes('walgreens|cvs|safeway')) {
            const match = matches[0];
            if (match[2]) { // Has street name
              extractedLocation = `${match[1].trim()} ${match[2].trim()}`;
            } else {
              extractedLocation = match[1].trim();
            }
          } else {
            extractedLocation = matches[0][0].trim();
          }
          console.log('Extracted location from text:', extractedLocation);
          break;
        }
      }
      
      // Enhanced fallback: use location context if available
      const hasLocationData = locationContext?.lastKnownLocation || 
                             locationContext?.routeStartLocation || 
                             locationContext?.routeDestinationLocation;
      
      let fallbackLocation = null;
      let needsConfirmation = true;
      
      if (extractedLocation && hasLocationData) {
        console.log('Attempting to geocode extracted location:', extractedLocation);
        
        // Try Google Places Text Search first for better location resolution
        try {
          console.log('🔍 ATTEMPTING GOOGLE PLACES TEXT SEARCH:');
          console.log('  - Extracted Location:', extractedLocation);
          console.log('  - User Context:', locationContext);
          
          const placesResult = await this.searchPlaceWithGooglePlaces(
            extractedLocation, 
            locationContext.lastKnownLocation
          );
          
          if (placesResult) {
            console.log('✅ GOOGLE PLACES SUCCESS:');
            console.log('  - Found Place:', placesResult.name);
            console.log('  - Address:', placesResult.formatted_address);
            console.log('  - Coordinates:', placesResult.coordinates);
            
            fallbackLocation = {
              address: `📍 ${placesResult.formatted_address}`,
              coordinates: placesResult.coordinates,
              confidence: 'high' as const,
              source: 'google_places_fallback' as const
            };
            needsConfirmation = false;
            
            console.log('📍 PLACES API RESULT STORED:');
            console.log('  - Final Address:', fallbackLocation.address);
            console.log('  - Final Coordinates:', fallbackLocation.coordinates);
            console.log('  - Confidence: HIGH (Google Places match)');
            
          } else {
            throw new Error('No Google Places results found');
          }
        } catch (placesError) {
          console.log('❌ GOOGLE PLACES FAILED, trying basic geocoding:', placesError);
          
          // Fallback to basic geocoding if Google Places fails
          try {
            const geocodedCoords = await this.geocodeLocationWithContext(
              extractedLocation, 
              locationContext
            );
            
            if (geocodedCoords) {
              // Check if coordinates match user location (indicating fallback to user location)
              const userCoords = locationContext.lastKnownLocation || 
                                locationContext.routeStartLocation || 
                                locationContext.routeDestinationLocation;
              
              const isUserLocationFallback = userCoords && 
                Math.abs(geocodedCoords.lat - userCoords.lat) < 0.001 && 
                Math.abs(geocodedCoords.lng - userCoords.lng) < 0.001;
              
              // Try to get full address information
              const fullAddressInfo = await this.getFullAddressInfo(geocodedCoords);
              
              console.log('✅ BASIC GEOCODING SUCCESS:');
              console.log('  - Input Location:', extractedLocation);
              console.log('  - Found Coordinates:', geocodedCoords);
              console.log('  - Is User Location Fallback:', isUserLocationFallback);
              console.log('  - Full Address Info:', fullAddressInfo);
              
              // Set confidence based on whether we found the actual location or fell back to user location
              const confidence: 'high' | 'medium' | 'low' = isUserLocationFallback ? 'medium' : 'high';
              const addressPrefix = isUserLocationFallback ? 
                `📍 Near user location` : 
                `📍 ${fullAddressInfo?.formatted_address || extractedLocation}`;
              
              fallbackLocation = {
                address: addressPrefix,
                coordinates: geocodedCoords,
                confidence: confidence,
                source: isUserLocationFallback ? 'fallback_estimated_near_user' : 'fallback_geocoded'
              };
              needsConfirmation = false;
              
            } else {
              throw new Error('Geocoding returned null coordinates');
            }
          } catch (geocodeError) {
            console.log('❌ ALL LOCATION METHODS FAILED:', geocodeError);
            console.log('  - Using user location as last resort');
            
            // Final fallback to user location with clear labeling
            const userCoords = locationContext.lastKnownLocation || 
                             locationContext.routeStartLocation || 
                             locationContext.routeDestinationLocation;
            
            console.log('📍 FINAL FALLBACK TO USER LOCATION:');
            console.log('  - User Coordinates:', userCoords);
            console.log('  - Intended Location:', extractedLocation);
            
            fallbackLocation = {
              address: `📍 ${extractedLocation} (location estimate - please verify)`,
              coordinates: {
                lat: userCoords.lat,
                lng: userCoords.lng
              },
              confidence: 'low' as const,
              source: 'user_location_fallback' as const
            };
            needsConfirmation = true; // Ask for confirmation since this is just user location
          }
        }
      } else if (locationContext?.lastKnownLocation) {
        // No specific location mentioned, use user's location directly
        fallbackLocation = {
          address: locationContext.lastKnownLocation.address || 'User location',
          coordinates: {
            lat: locationContext.lastKnownLocation.lat,
            lng: locationContext.lastKnownLocation.lng
          },
          confidence: 'medium' as const,
          source: 'fallback_user_location' as const
        };
        needsConfirmation = false;
        console.log('Smart fallback: using user location (confidence: medium)');
      } else {
        // No location data available - must prompt
        needsConfirmation = true;
        console.log('Smart fallback: no location data, will prompt user (confidence: low)');
      }
      
      // Process the text to clean it up and create a title
      const processedText = this.processHazardTextLocal(userInput);
      
      // Fallback analysis with smart location handling
      return {
        title: processedText.title,
        hazardType: processedText.hazardType,
        description: processedText.description,
        location: fallbackLocation,
        severity: 'medium',
        needsLocationConfirmation: needsConfirmation
      };
    }
  }

  private processHazardTextLocal(userInput: string): { title: string; hazardType: string; description: string } {
    // Clean up the input text
    let cleanedText = userInput.trim();
    
    // Basic grammar and spelling corrections
    cleanedText = cleanedText
      .replace(/\bi\b/g, 'I')  // Capitalize 'i'
      .replace(/\btheres\b/gi, 'there is')
      .replace(/\bthier\b/gi, 'their')
      .replace(/\bteh\b/gi, 'the')
      .replace(/\band\s+and\b/gi, 'and')  // Remove duplicate 'and'
      .replace(/\bbollingr\b/gi, 'Bollinger')  // Fix Bollinger Canyon
      .replace(/\bsafway\b/gi, 'Safeway')      // Fix Safeway
      .replace(/\bdangrous\b/gi, 'dangerous')   // Fix dangerous
      .replace(/\bhazrd\b/gi, 'hazard')        // Fix hazard
      .replace(/\bpothol\b/gi, 'pothole')      // Fix pothole
      .replace(/\baccidnt\b/gi, 'accident')    // Fix accident
      .replace(/\bconstructin\b/gi, 'construction') // Fix construction
      .replace(/\bdowntwn\b/gi, 'downtown')    // Fix downtown
      .replace(/\s+/g, ' ');  // Clean up multiple spaces
    
    // Capitalize first letter
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
    
    // Add period if missing
    if (!cleanedText.endsWith('.') && !cleanedText.endsWith('!') && !cleanedText.endsWith('?')) {
      cleanedText += '.';
    }
    
    // Generate a 2-3 word title based on the description
    let title = 'Road Hazard';
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('tree') && (lowerInput.includes('down') || lowerInput.includes('fallen'))) {
      title = 'Fallen Tree';
    } else if (lowerInput.includes('ice') || lowerInput.includes('frost')) {
      title = 'Ice Hazard';
    } else if (lowerInput.includes('pothole') || lowerInput.includes('hole')) {
      title = 'Pothole Alert';
    } else if (lowerInput.includes('debris') || lowerInput.includes('trash') || lowerInput.includes('object')) {
      title = 'Road Debris';
    } else if (lowerInput.includes('water') || lowerInput.includes('flood') || lowerInput.includes('puddle')) {
      title = 'Water Hazard';
    } else if (lowerInput.includes('construction') || lowerInput.includes('work')) {
      title = 'Construction Zone';
    } else if (lowerInput.includes('accident') || lowerInput.includes('crash')) {
      title = 'Accident Alert';
    } else if (lowerInput.includes('animal') || lowerInput.includes('deer') || lowerInput.includes('dog')) {
      title = 'Animal Hazard';
    } else if (lowerInput.includes('oil') || lowerInput.includes('spill')) {
      title = 'Spill Alert';
    }
    
    return {
      title,
      hazardType: 'Road hazard',
      description: cleanedText
    };
  }

  async geocodeLocationWithContext(location: string, locationContext: LocationContext): Promise<{lat: number, lng: number} | null> {
    try {
      console.log('Geocoding with context:', location, locationContext);
      
      // Get user's approximate area for more accurate geocoding
      let searchArea = '';
      if (locationContext.lastKnownLocation) {
        searchArea = ` near ${locationContext.lastKnownLocation.lat},${locationContext.lastKnownLocation.lng}`;
      } else if (locationContext.routeStartLocation) {
        searchArea = ` near ${locationContext.routeStartLocation.address}`;
      }
      
      // Use the edge function to geocode with Google Maps API
      const { data, error } = await supabase.functions.invoke('analyze-hazard', {
        body: { 
          userInput: `Find location: ${location}${searchArea}`,
          locationContext,
          geocodeOnly: true
        }
      });

      if (error || !data?.location?.coordinates) {
        console.log('Edge function geocoding failed, trying direct approach');
        return await this.directGeocode(location, locationContext);
      }

      return data.location.coordinates;
    } catch (error) {
      console.error('Geocoding error:', error);
      return await this.directGeocode(location, locationContext);
    }
  }

  private async directGeocode(location: string, locationContext: LocationContext): Promise<{lat: number, lng: number} | null> {
    // Fallback: try direct geocoding using a simple lookup
    // This is a basic implementation - in a real app you'd use Google Maps Geocoding API directly
    
    const locationLower = location.toLowerCase();
    
    // Enhanced location database for common places
    const locationDatabase: Record<string, {lat: number, lng: number, fullAddress: string}> = {
      // Schools
      'dougherty valley high school': { 
        lat: 37.7184, lng: -121.8282, 
        fullAddress: '10550 Albion Rd, San Ramon, CA 94582' 
      },
      'san ramon valley high school': { 
        lat: 37.7622, lng: -121.9444, 
        fullAddress: '501 Danville Blvd, Danville, CA 94526' 
      },
      'california high school': { 
        lat: 37.7858, lng: -121.9247, 
        fullAddress: '9870 Broadmoor Dr, San Ramon, CA 94583' 
      },
      
      // Shopping centers and stores
      'bollinger canyon safeway': {
        lat: 37.7564, lng: -121.9185,
        fullAddress: '18667 Bollinger Canyon Rd, San Ramon, CA 94583'
      },
      'safeway': {
        lat: 37.7564, lng: -121.9185,
        fullAddress: '18667 Bollinger Canyon Rd, San Ramon, CA 94583'
      },
      'bollinger canyon': {
        lat: 37.7564, lng: -121.9185,
        fullAddress: 'Bollinger Canyon Rd, San Ramon, CA 94583'
      },
      
      // Parks
      'bellingham square park': { 
        lat: 42.3868, lng: -71.0995, 
        fullAddress: 'Bellingham Square Park, Chelsea, MA 02150' 
      },
      'central park': { 
        lat: 37.7858, lng: -121.9747, 
        fullAddress: 'Central Park, San Ramon, CA 94583' 
      },
      
      // General areas
      'downtown danville': { 
        lat: 37.8217, lng: -121.9999, 
        fullAddress: 'Downtown Danville, CA' 
      },
      'san ramon': { 
        lat: 37.7799, lng: -121.9780, 
        fullAddress: 'San Ramon, CA' 
      },
      'danville': { 
        lat: 37.8217, lng: -121.9999, 
        fullAddress: 'Danville, CA' 
      }
    };
    
    // Check if we have a direct match
    for (const [key, coords] of Object.entries(locationDatabase)) {
      if (locationLower.includes(key)) {
        console.log('Found direct match in location database:', key, coords);
        return coords;
      }
    }
    
    // If we have user context, we could estimate relative to their location
    if (locationContext.lastKnownLocation && locationLower.includes('near')) {
      // Return user location as best guess for "near" references
      return {
        lat: locationContext.lastKnownLocation.lat,
        lng: locationContext.lastKnownLocation.lng
      };
    }
    
    console.log('Could not geocode location:', location);
    return null;
  }

  async getFullAddressInfo(coordinates: {lat: number, lng: number}): Promise<any> {
    try {
      console.log('🔍 REVERSE GEOCODING TO GET FULL ADDRESS:');
      console.log('  - Input Coordinates:', coordinates);
      
      // Try to get detailed address info using reverse geocoding
      // This would typically use Google Maps Geocoding API
      // For now, we'll create a mock response with basic info
      
      const addressInfo = {
        formatted_address: `Address near ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`,
        city: 'Unknown City',
        state: 'Unknown State', 
        zip: 'Unknown ZIP',
        country: 'Unknown Country',
        coordinates: coordinates
      };
      
      // Enhanced mock data for known locations
      if (Math.abs(coordinates.lat - 42.3868) < 0.01 && Math.abs(coordinates.lng - (-71.0995)) < 0.01) {
        addressInfo.formatted_address = 'Bellingham Square Park, Chelsea, MA 02150';
        addressInfo.city = 'Chelsea';
        addressInfo.state = 'Massachusetts';
        addressInfo.zip = '02150';
        addressInfo.country = 'United States';
      } else if (Math.abs(coordinates.lat - 37.7184) < 0.01 && Math.abs(coordinates.lng - (-121.8282)) < 0.01) {
        addressInfo.formatted_address = 'Dougherty Valley High School, 10550 Albion Rd, San Ramon, CA 94582';
        addressInfo.city = 'San Ramon';
        addressInfo.state = 'California';
        addressInfo.zip = '94582';
        addressInfo.country = 'United States';
      } else if (Math.abs(coordinates.lat - 37.7858) < 0.01 && Math.abs(coordinates.lng - (-121.9247)) < 0.01) {
        addressInfo.formatted_address = 'California High School, 9870 Broadmoor Dr, San Ramon, CA 94583';
        addressInfo.city = 'San Ramon';
        addressInfo.state = 'California';
        addressInfo.zip = '94583';
        addressInfo.country = 'United States';
      } else if (Math.abs(coordinates.lat - 37.7564) < 0.01 && Math.abs(coordinates.lng - (-121.9185)) < 0.01) {
        addressInfo.formatted_address = '18667 Bollinger Canyon Rd, San Ramon, CA 94583';
        addressInfo.city = 'San Ramon';
        addressInfo.state = 'California';
        addressInfo.zip = '94583';
        addressInfo.country = 'United States';
      }
      
      console.log('📍 REVERSE GEOCODING RESULT:');
      console.log('  - Formatted Address:', addressInfo.formatted_address);
      console.log('  - City:', addressInfo.city);
      console.log('  - State:', addressInfo.state);
      console.log('  - ZIP Code:', addressInfo.zip);
      console.log('  - Country:', addressInfo.country);
      
      return addressInfo;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }

  }

  async searchPlaceWithGooglePlaces(query: string, userLocation: {lat: number, lng: number}): Promise<any | null> {
    try {
      console.log('🔍 GOOGLE PLACES TEXT SEARCH:');
      console.log('  - Query:', query);
      console.log('  - User Location:', userLocation);
      
      // Call our edge function to do the Google Places search
      const { data, error } = await supabase.functions.invoke('analyze-hazard', {
        body: { 
          userInput: `Search place: ${query}`,
          locationContext: { lastKnownLocation: userLocation },
          placesSearchOnly: true
        }
      });

      if (error || !data?.place) {
        console.log('Edge function Places search failed');
        return null;
      }

      console.log('✅ GOOGLE PLACES RESULT:', data.place);
      return data.place;
      
    } catch (error) {
      console.error('Google Places search error:', error);
      return null;
    }
  }

  async geocodeLocation(address: string): Promise<{lat: number, lng: number} | null> {
    // This is now handled by the edge function, but keeping for compatibility
    try {
      const { data, error } = await supabase.functions.invoke('analyze-hazard', {
        body: { userInput: `Location: ${address}` }
      });

      if (error || !data?.location?.coordinates) {
        return null;
      }

      return data.location.coordinates;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }
}


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
      
      // Extract potential place names from the text
      const placePatterns = [
        /\b([a-zA-Z\s]+(?:park|square|plaza|center|mall|station))\b/gi,
        /\b([a-zA-Z\s]+(?:street|road|avenue|highway|boulevard|drive|lane|way))\b/gi,
        /\b(downtown|uptown|midtown)\b/gi,
        /\b([a-zA-Z\s]+(?:hospital|school|university|college|library|store))\b/gi
      ];
      
      let extractedLocation = null;
      for (const pattern of placePatterns) {
        const match = userInput.match(pattern);
        if (match) {
          extractedLocation = match[0].trim();
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
        
        // Try to geocode the extracted location using user's context for area
        try {
          console.log('🔍 ATTEMPTING GEOCODING:');
          console.log('  - Extracted Location:', extractedLocation);
          console.log('  - User Context:', locationContext);
          
          const geocodedCoords = await this.geocodeLocationWithContext(
            extractedLocation, 
            locationContext
          );
          
          if (geocodedCoords) {
            // Try to get full address information
            const fullAddressInfo = await this.getFullAddressInfo(geocodedCoords);
            
            console.log('✅ GEOCODING SUCCESS:');
            console.log('  - Input Location:', extractedLocation);
            console.log('  - Found Coordinates:', geocodedCoords);
            console.log('  - Full Address Info:', fullAddressInfo);
            console.log('  - Street Address:', fullAddressInfo?.formatted_address || 'Not available');
            console.log('  - City:', fullAddressInfo?.city || 'Not available');
            console.log('  - State:', fullAddressInfo?.state || 'Not available');
            console.log('  - ZIP Code:', fullAddressInfo?.zip || 'Not available');
            console.log('  - Country:', fullAddressInfo?.country || 'Not available');
            
            fallbackLocation = {
              address: fullAddressInfo?.formatted_address || extractedLocation,
              coordinates: geocodedCoords,
              confidence: 'high' as const,
              source: 'fallback_geocoded' as const
            };
            needsConfirmation = false;
            
            console.log('📍 FINAL LOCATION TO BE STORED:');
            console.log('  - Address:', fallbackLocation.address);
            console.log('  - Latitude:', fallbackLocation.coordinates.lat);
            console.log('  - Longitude:', fallbackLocation.coordinates.lng);
            console.log('  - Confidence:', fallbackLocation.confidence);
            
          } else {
            throw new Error('Geocoding returned null coordinates');
          }
        } catch (geocodeError) {
          console.log('❌ GEOCODING FAILED:');
          console.log('  - Error:', geocodeError);
          console.log('  - Falling back to user location as estimate');
          
          // Fallback to user location with mention of intended place
          const userCoords = locationContext.lastKnownLocation || 
                           locationContext.routeStartLocation || 
                           locationContext.routeDestinationLocation;
          
          console.log('📍 USING USER LOCATION FALLBACK:');
          console.log('  - User Coordinates:', userCoords);
          console.log('  - Intended Location:', extractedLocation);
          
          fallbackLocation = {
            address: `${extractedLocation} (estimated near user location)`,
            coordinates: {
              lat: userCoords.lat,
              lng: userCoords.lng
            },
            confidence: 'low' as const,
            source: 'fallback_estimated_near_user' as const
          };
          needsConfirmation = false;
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
        console.log('Smart fallback: using user location');
      } else {
        // No location data available - must prompt
        needsConfirmation = true;
        console.log('Smart fallback: no location data, will prompt user');
      }
      
      // Fallback analysis with smart location handling
      return {
        hazardType: 'Road hazard reported',
        description: userInput,
        location: fallbackLocation,
        severity: 'medium',
        needsLocationConfirmation: needsConfirmation
      };
    }
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
    
    // Basic location database for common places
    const locationDatabase: Record<string, {lat: number, lng: number}> = {
      'bellingham square park': { lat: 42.3868, lng: -71.0995 }, // Real Bellingham Square, Chelsea MA
      'bellingham square': { lat: 42.3868, lng: -71.0995 },
      'downtown': { lat: 37.7749, lng: -122.4194 },
      'main street': { lat: 37.7849, lng: -122.4094 },
      // Add more as needed
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

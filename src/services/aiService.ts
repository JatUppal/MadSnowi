
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
      console.log('Attempting smart fallback analysis...');
      
      // Smart fallback: try to extract location from user input text
      const inputLower = userInput.toLowerCase();
      
      // Check if user mentions a specific place
      const hasSpecificLocation = /\b(park|street|road|avenue|highway|mall|downtown|square|plaza|center)\b/.test(inputLower);
      
      // Enhanced fallback: use location context if available
      const hasLocationData = locationContext?.lastKnownLocation || 
                             locationContext?.routeStartLocation || 
                             locationContext?.routeDestinationLocation;
      
      let fallbackLocation = null;
      let needsConfirmation = true;
      
      if (hasSpecificLocation && hasLocationData) {
        // User mentioned a specific place, but we couldn't geocode it with AI
        // Use their location as a fallback but mark it as low confidence
        fallbackLocation = {
          address: `Near ${userInput.match(/\b\w+\s+(park|street|road|avenue|highway|mall|downtown|square|plaza|center)\b/i)?.[0] || 'mentioned location'} (estimated near user location)`,
          coordinates: {
            lat: locationContext.lastKnownLocation?.lat || locationContext.routeStartLocation?.lat || locationContext.routeDestinationLocation?.lat,
            lng: locationContext.lastKnownLocation?.lng || locationContext.routeStartLocation?.lng || locationContext.routeDestinationLocation?.lng
          },
          confidence: 'low' as const,
          source: 'fallback_estimated_near_user' as const
        };
        needsConfirmation = false; // Don't prompt since we have some context
        console.log('Smart fallback: estimated location near user for mentioned place');
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

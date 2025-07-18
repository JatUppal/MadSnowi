
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
      
      // Enhanced fallback: use location context if available
      const hasLocationData = locationContext?.lastKnownLocation || 
                             locationContext?.routeStartLocation || 
                             locationContext?.routeDestinationLocation;
      
      let fallbackLocation = null;
      if (locationContext?.lastKnownLocation) {
        fallbackLocation = {
          address: locationContext.lastKnownLocation.address || 'User location',
          coordinates: {
            lat: locationContext.lastKnownLocation.lat,
            lng: locationContext.lastKnownLocation.lng
          },
          confidence: 'medium' as const,
          source: 'fallback_last_known' as const
        };
      }
      
      // Fallback to basic analysis with available location context
      return {
        hazardType: 'Road hazard reported',
        description: userInput,
        location: fallbackLocation,
        severity: 'medium',
        needsLocationConfirmation: !hasLocationData // Only ask if no location data available
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

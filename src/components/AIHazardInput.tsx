
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AIService } from '@/services/aiService';
import { LocationService, UserLocation } from '@/services/locationService';

interface AIHazardInputProps {
  onHazardSubmit: (hazard: {
    text: string;
    location?: { 
      address?: string;
      coordinates?: { lat: number; lng: number };
    };
  }) => void;
}

export const AIHazardInput: React.FC<AIHazardInputProps> = ({ onHazardSubmit }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [pendingHazard, setPendingHazard] = useState<any>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const aiService = AIService.getInstance();
      
      // Get location context before analysis
      const locationContext = LocationService.getLocationContext();
      
      console.log('=== AI PROCESSING INFORMATION ===');
      console.log('User Input:', input.trim());
      console.log('Last Known Location:', locationContext.lastKnownLocation);
      console.log('Route Start:', locationContext.routeStartLocation);
      console.log('Route Destination:', locationContext.routeDestinationLocation);
      console.log('Has Any Location Data:', LocationService.hasAnyLocationData());
      
      const analysis = await aiService.analyzeHazardReport(input.trim(), locationContext);

      console.log('AI Analysis:', analysis);

      if (analysis.needsLocationConfirmation) {
        // AI couldn't determine location precisely even with available context
        setPendingHazard(analysis);
        setShowLocationPrompt(true);
        setNeedsLocation(true);
      } else {
        // AI found a good location match
        const hazardReport = {
          text: `${analysis.hazardType}: ${analysis.description}`,
          location: analysis.location ? {
            address: analysis.location.address,
            coordinates: analysis.location.coordinates
          } : undefined
        };

        onHazardSubmit(hazardReport);
        setInput('');
      }
    } catch (error) {
      console.error('Error processing hazard report:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLocationShare = async () => {
    setIsProcessing(true);
    try {
      const userLocation = await LocationService.requestUserLocation();
      
      if (userLocation && pendingHazard) {
        const hazardReport = {
          text: `${pendingHazard.hazardType}: ${pendingHazard.description}`,
          location: {
            address: userLocation.address || 'User location',
            coordinates: {
              lat: userLocation.lat,
              lng: userLocation.lng
            }
          }
        };

        onHazardSubmit(hazardReport);
        setInput('');
        resetLocationPrompt();
      } else {
        // User denied location or error occurred
        console.log('Could not get user location');
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLocationDeny = () => {
    console.log('User denied location sharing - hazard not reported');
    resetLocationPrompt();
  };

  const resetLocationPrompt = () => {
    setShowLocationPrompt(false);
    setNeedsLocation(false);
    setPendingHazard(null);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the hazard you've spotted (e.g., 'Ice patch on Highway 151 near Verona' or 'Tree down blocking the road')"
          rows={3}
          className="resize-none bg-background/50 border-accent/30"
        />
        <Button 
          type="submit" 
          size="sm" 
          disabled={!input.trim() || isProcessing}
          className="bg-primary hover:bg-primary/90"
        >
          {isProcessing ? 'Processing...' : '🤖 Report with AI'}
        </Button>
      </form>

      {showLocationPrompt && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription>
            <div className="space-y-3">
              <p className="text-sm">
                🤖 I detected: <strong>{pendingHazard?.hazardType}</strong>
                <br />
                I checked your route and previous locations, but I still need your current location to report this hazard accurately. Would you like to share your location?
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleLocationShare}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  📍 Share Location
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleLocationDeny}
                  disabled={isProcessing}
                >
                  ❌ Don't Share
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

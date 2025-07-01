import React from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Snowflake, MapPin, Route } from 'lucide-react';

interface RouteMapProps {
  startLocation?: string;
  endLocation?: string;
  travelMode?: string;
  routeData?: any;
}

const RouteMap: React.FC<RouteMapProps> = ({ 
  startLocation, 
  endLocation, 
  travelMode,
  routeData 
}) => {
  
  // Demo map view with winter-themed styling
  const showRoute = startLocation && endLocation;

  if (showRoute) {
    return (
      <Card className="w-full h-96 overflow-hidden shadow-ice bg-gradient-winter">
        <div className="relative w-full h-full">
          {/* Demo route visualization */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="flex justify-center space-x-8">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm">
                    🧀
                  </div>
                  <span className="text-xs mt-1 font-medium">{startLocation}</span>
                </div>
                
                <div className="flex items-center">
                  <Route className="h-6 w-6 text-winter-safe animate-pulse" />
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-winter-safe rounded-full flex items-center justify-center text-white text-sm">
                    🎯
                  </div>
                  <span className="text-xs mt-1 font-medium">{endLocation}</span>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Winter route analysis: {travelMode} mode
              </div>
              
              {/* Mock route indicators */}
              <div className="flex justify-center space-x-2 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-winter-safe rounded-full"></div>
                  Safe
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-winter-caution rounded-full"></div>
                  Caution
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-winter-danger rounded-full"></div>
                  Danger
                </span>
              </div>
            </div>
          </div>
          
          {/* Overlay info */}
          <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-2">
            <div className="text-xs font-medium">🦡 Madison, WI Area</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-96 flex items-center justify-center bg-gradient-winter shadow-snow">
      <div className="text-center space-y-4">
        <Snowflake className="h-12 w-12 text-primary mx-auto animate-frost-pulse" />
        <div>
          <h3 className="text-lg font-semibold">Interactive Winter Map</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Enter start and end locations to display winter-safe routes with real-time snow conditions
          </p>
        </div>
        <Alert className="max-w-md mx-auto border-accent/50 bg-accent/20">
          <MapPin className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Google Maps API integration ready for live route display
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
};

export default RouteMap;
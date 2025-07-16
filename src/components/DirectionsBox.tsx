import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, Clock, MapPin } from 'lucide-react';

interface DirectionsBoxProps {
  routeData?: any;
  startLocation?: string;
  endLocation?: string;
  loading?: boolean;
}

const DirectionsBox: React.FC<DirectionsBoxProps> = ({
  routeData,
  startLocation,
  endLocation,
  loading
}) => {
  // Mock directions data for demonstration
  const mockDirections = [
    { instruction: "Head north on University Ave", distance: "0.3 mi", icon: "↑" },
    { instruction: "Turn right onto State St", distance: "0.7 mi", icon: "→" },
    { instruction: "Continue onto E Washington Ave", distance: "1.2 mi", icon: "↑" },
    { instruction: "Turn left onto Blair St", distance: "0.5 mi", icon: "←" },
    { instruction: "Destination will be on your right", distance: "", icon: "📍" }
  ];

  if (loading) {
    return (
      <Card className="bg-gradient-winter shadow-snow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 animate-spin" />
            Getting Directions...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!startLocation || !endLocation) {
    return (
      <Card className="bg-gradient-winter shadow-snow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-muted-foreground" />
            Turn-by-Turn Directions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Enter start and end locations to see directions
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-winter shadow-snow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Directions
        </CardTitle>
        {routeData && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{routeData.duration}</span>
            <Badge variant="outline" className="text-xs">
              {routeData.distance}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {mockDirections.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded bg-background/30 border border-accent/20"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-semibold">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {step.instruction}
                </p>
                {step.distance && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.distance}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-3 border-t border-accent/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>📍 From: {startLocation}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>🎯 To: {endLocation}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DirectionsBox;
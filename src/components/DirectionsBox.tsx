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
  // Get maneuver icon based on instruction content
  const getManeuverIcon = (instruction: string, maneuver?: string) => {
    if (instruction.toLowerCase().includes('destination')) return '📍';
    if (maneuver === 'turn-right' || instruction.toLowerCase().includes('turn right')) return '→';
    if (maneuver === 'turn-left' || instruction.toLowerCase().includes('turn left')) return '←';
    if (maneuver === 'straight' || instruction.toLowerCase().includes('continue')) return '↑';
    if (instruction.toLowerCase().includes('merge')) return '↗';
    if (instruction.toLowerCase().includes('exit')) return '↘';
    return '↑'; // default
  };

  const directions = routeData?.steps || [];

  if (loading) {
    return (
      <Card className="bg-gradient-winter shadow-snow rounded-xl">
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
      <Card className="bg-gradient-winter shadow-snow h-[280px] rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-muted-foreground" />
            Turn-by-Turn Directions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-full">
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
    <Card className="bg-gradient-winter shadow-snow h-[320px] rounded-xl">
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
      <CardContent className="h-full overflow-hidden">
        <div className="space-y-3 max-h-52 overflow-y-auto">
          {directions.length > 0 ? directions.map((step: any, index: number) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-xl bg-background/30 border border-accent/20"
            >
              <div className="flex-shrink-0 w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-semibold">
                {getManeuverIcon(step.instruction, step.maneuver)}
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
          )) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No directions available
              </p>
            </div>
          )}
        </div>
        
      </CardContent>
    </Card>
  );
};

export default DirectionsBox;
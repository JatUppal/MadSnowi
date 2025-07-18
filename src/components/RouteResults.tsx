import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Snowflake, Target, AlertTriangle } from 'lucide-react';
interface RouteResultsProps {
  routeData?: {
    distance: string;
    duration: string;
    snowDepth: number;
    safetyScore: 'safe' | 'caution' | 'danger';
    vehicleSafety: string;
    recommendation: string;
    weatherConditions: {
      temperature: number;
      windChill?: number;
      conditions: string;
    };
  };
  loading?: boolean;
  travelMode?: 'driving' | 'walking' | 'biking' | '';
}
const RouteResults: React.FC<RouteResultsProps> = ({
  routeData,
  loading,
  travelMode
}) => {
  if (loading) {
    return <Card className="w-full bg-gradient-snow shadow-snow animate-pulse rounded-xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Snowflake className="h-5 w-5 text-primary animate-spin" />
            <span className="text-lg font-semibold">Analyzing winter conditions...</span>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </Card>;
  }
  if (!routeData) {
    return <Card className="w-full bg-gradient-winter shadow-snow h-[320px] flex items-center justify-center rounded-xl">
        <div className="p-6 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            Enter locations to see winter route analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Get snow depth, safety scores, and vehicle-specific recommendations
          </p>
        </div>
      </Card>;
  }
  const getSafetyBadgeVariant = (score: string) => {
    switch (score) {
      case 'safe':
        return 'default';
      case 'caution':
        return 'secondary';
      case 'danger':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  const getSafetyIcon = (score: string) => {
    switch (score) {
      case 'safe':
        return '✅';
      case 'caution':
        return '⚠️';
      case 'danger':
        return '❌';
      default:
        return '❓';
    }
  };
  return <div className="space-y-4">
      {/* Main Route Summary */}
      <Card className="bg-gradient-winter shadow-snow rounded-xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Route Analysis</h2>
            <Badge variant={getSafetyBadgeVariant(routeData.safetyScore)} className="text-sm">
              {getSafetyIcon(routeData.safetyScore)} {routeData.safetyScore.toUpperCase()}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-semibold">{routeData.distance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-semibold">{routeData.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Snow Depth:</span>
                <span className="font-semibold flex items-center gap-1">
                  <Snowflake className="h-4 w-4 text-blue-500" />
                  {routeData.snowDepth}" avg
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temperature:</span>
                <span className="font-semibold">{routeData.weatherConditions.temperature}°F</span>
              </div>
              {routeData.weatherConditions.windChill && <div className="flex justify-between">
                  <span className="text-muted-foreground">Wind Chill:</span>
                  <span className="font-semibold">{routeData.weatherConditions.windChill}°F</span>
                </div>}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conditions:</span>
                <span className="font-semibold">{routeData.weatherConditions.conditions}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Vehicle Safety Assessment - Only show for non-walking modes */}
      {travelMode !== 'walking' && (
        <Card className="bg-card/50 backdrop-blur-sm shadow-snow rounded-xl">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🚗 Vehicle Safety Assessment
            </h3>
            <p className="text-foreground">{routeData.vehicleSafety}</p>
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {routeData.safetyScore !== 'safe' && <Alert variant={routeData.safetyScore === 'danger' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Recommendation:</strong> {routeData.recommendation}
          </AlertDescription>
        </Alert>}

      {/* Winter Travel Tips */}
      <Card className="bg-accent/20 border-none shadow-none rounded-none">
        <div className="p-4 text-center bg-sky-100">
          <h4 className="font-semibold mb-2 text-sm">🦡 Wisconsin Winter Tips</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Keep emergency kit: blanket, water, snacks, phone charger</li>
            <li>• Check 511WI.gov for real-time road conditions</li>
            <li>• Allow extra travel time in winter weather</li>
            <li>• Consider public transit during severe weather</li>
          </ul>
        </div>
      </Card>
    </div>;
};
export default RouteResults;
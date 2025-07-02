import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Snowflake, MapPin, Route, Loader2 } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

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
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [directionsService, setDirectionsService] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: "AIzaSyB4QJhSxEL-9qJz6Qaqvu_BVDBErBOiTY4",
          version: "weekly",
          libraries: ["places"]
        });

        const { Map } = await loader.importLibrary("maps");
        const { DirectionsService, DirectionsRenderer } = await loader.importLibrary("routes");

        if (!mapRef.current) return;

        // Center on Madison, WI
        const mapInstance = new Map(mapRef.current, {
          center: { lat: 43.0731, lng: -89.4012 },
          zoom: 12,
          mapTypeId: 'roadmap',
          styles: [
            {
              featureType: "all",
              elementType: "geometry.fill",
              stylers: [{ color: "#f8faff" }]
            },
            {
              featureType: "water",
              elementType: "geometry.fill",
              stylers: [{ color: "#a8d0ff" }]
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#d4e6ff" }]
            }
          ]
        });

        const dirService = new DirectionsService();
        const dirRenderer = new DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });

        dirRenderer.setMap(mapInstance);

        setMap(mapInstance);
        setDirectionsService(dirService);
        setDirectionsRenderer(dirRenderer);
      } catch (err) {
        console.error('Error loading Google Maps:', err);
        setError('Failed to load Google Maps');
      }
    };

    initMap();
  }, []);

  // Update route when locations change
  useEffect(() => {
    if (!startLocation || !endLocation || !directionsService || !directionsRenderer) {
      return;
    }

    setLoading(true);
    setError(null);

    const request: any = {
      origin: startLocation,
      destination: endLocation,
      travelMode: travelMode === 'driving' ? 'DRIVING' :
                 travelMode === 'walking' ? 'WALKING' :
                 travelMode === 'biking' ? 'BICYCLING' :
                 'DRIVING'
    };

    directionsService.route(request, (result: any, status: string) => {
      setLoading(false);
      
      if (status === 'OK' && result) {
        directionsRenderer.setDirections(result);
      } else {
        setError(`Failed to get directions: ${status}`);
        console.error('Directions request failed:', status);
      }
    });
  }, [startLocation, endLocation, travelMode, directionsService, directionsRenderer, map]);

  const showRoute = startLocation && endLocation;

  if (error) {
    return (
      <Card className="w-full h-96 flex items-center justify-center bg-gradient-winter shadow-snow">
        <div className="text-center space-y-4">
          <AlertDescription className="text-red-600">{error}</AlertDescription>
          <p className="text-sm text-muted-foreground">
            Please check your internet connection and try again
          </p>
        </div>
      </Card>
    );
  }

  if (!showRoute) {
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
  }

  return (
    <Card className="w-full h-96 overflow-hidden shadow-ice bg-gradient-winter">
      <div className="relative w-full h-full">
        {/* Google Maps Container */}
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading route...</span>
            </div>
          </div>
        )}
        
        {/* Winter overlay info */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-2">
          <div className="text-xs font-medium">🦡 Madison Winter Routes</div>
        </div>
        
        {/* Route info overlay */}
        {showRoute && !loading && (
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-2">
            <div className="text-xs space-y-1">
              <div>🧀 {startLocation}</div>
              <div>🎯 {endLocation}</div>
              <div className="text-muted-foreground">{travelMode} mode</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default RouteMap;
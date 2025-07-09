import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Snowflake, MapPin, Loader2 } from 'lucide-react';
import { GoogleMap, DirectionsService, DirectionsRenderer, LoadScript, Marker } from '@react-google-maps/api';

interface RouteMapProps {
  startLocation?: string;
  endLocation?: string;
  travelMode?: string;
  routeData?: any;
}

const DEFAULT_CENTER = { lat: 43.0731, lng: -89.4012 }; // UW-Madison

const RouteMap: React.FC<RouteMapProps> = ({ 
  startLocation, 
  endLocation, 
  travelMode,
  routeData 
}) => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Static libraries array to prevent performance warnings
  const libraries: ("places")[] = ['places'];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(coords);
          setUserLocation(coords);
        },
        () => {
          setCenter(DEFAULT_CENTER);
          setUserLocation(null);
        },
        { timeout: 5000 }
      );
    } else {
      setCenter(DEFAULT_CENTER);
      setUserLocation(null);
    }
  }, []);

  useEffect(() => {
    console.log("✅ Google Maps API Key:", import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
    console.log("🔍 API Key length:", apiKey?.length);
    console.log("🔍 API Key starts with AIzaSy:", apiKey?.startsWith('AIzaSy'));
  }, [apiKey]);

  // Memoize directions to prevent flicker
  const memoizedDirections = useMemo(() => directions, [directions]);

  if (!apiKey || apiKey === 'your_actual_google_maps_api_key_here') {
    console.warn('Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.');
    console.log("❌ API Key validation failed:", { apiKey, hasApiKey: !!apiKey, isPlaceholder: apiKey === 'your_actual_google_maps_api_key_here' });
    return (
      <Card className="w-full h-96 flex items-center justify-center bg-gradient-winter shadow-snow">
        <div className="text-center space-y-4">
          <AlertDescription className="text-red-600">
            Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.
          </AlertDescription>
        </div>
      </Card>
    );
  }

  const directionsCallback = (response: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
    setLoading(false);
    if (response !== null && status === 'OK') {
      setDirections(response);
      setError(null);
    } else {
      setError(`Failed to get directions: ${status || 'Unknown error'}`);
      console.error('Directions request failed:', status);
    }
  };

  const getTravelMode = (mode: string): google.maps.TravelMode => {
    switch (mode) {
      case 'walking':
        return google.maps.TravelMode.WALKING;
      case 'biking':
        return google.maps.TravelMode.BICYCLING;
      case 'transit':
        return google.maps.TravelMode.TRANSIT;
      default:
        return google.maps.TravelMode.DRIVING;
    }
  };

  const showRoute = startLocation && endLocation;

  // Get origin and destination LatLng from directions if available
  let originLatLng = null;
  let destLatLng = null;
  if (memoizedDirections && memoizedDirections.routes.length > 0) {
    const leg = memoizedDirections.routes[0].legs[0];
    originLatLng = leg.start_location;
    destLatLng = leg.end_location;
  }

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

  return (
    <Card className="w-full h-96 overflow-hidden shadow-ice bg-gradient-winter">
      <div className="relative w-full h-full" style={{ height: '100%' }}>
        <LoadScript
          googleMapsApiKey={apiKey || ''}
          libraries={libraries}
        >
          <GoogleMap
            mapContainerClassName="w-full h-full"
            mapContainerStyle={{ height: '100%' }}
            center={center}
            zoom={15}
            options={{
              mapTypeId: 'roadmap',
            }}
          >
            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  url: "/badger.png",
                  scaledSize: { width: 40, height: 40 } as google.maps.Size
                }}
                title="Your Location"
              />
            )}
            {/* Custom origin and destination markers */}
            {originLatLng && (
              <Marker
                position={originLatLng}
                icon={{
                  url: "/badger.png",
                  scaledSize: { width: 40, height: 40 } as google.maps.Size
                }}
                title="Origin"
                zIndex={2}
              />
            )}
            {destLatLng && (
              <Marker
                position={destLatLng}
                icon={{
                  url: "/cheese.png",
                  scaledSize: { width: 40, height: 40 } as google.maps.Size
                }}
                title="Destination"
                zIndex={2}
              />
            )}
            {showRoute && (
              <DirectionsService
                options={{
                  origin: startLocation,
                  destination: endLocation,
                  travelMode: getTravelMode(travelMode || 'driving')
                }}
                callback={directionsCallback}
              />
            )}
            {memoizedDirections && (
              <DirectionsRenderer
                options={{
                  directions: memoizedDirections,
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: "#2563eb",
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                  }
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>
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
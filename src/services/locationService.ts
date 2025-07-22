export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
  timestamp?: number;
}

export interface LocationContext {
  lastKnownLocation?: UserLocation;
  routeStartLocation?: UserLocation;
  routeDestinationLocation?: UserLocation;
}

export class LocationService {
  private static readonly LOCATION_STORAGE_KEY = 'user_last_location';
  private static readonly ROUTE_START_KEY = 'route_start_location';
  private static readonly ROUTE_DEST_KEY = 'route_destination_location';

  static async requestUserLocation(): Promise<UserLocation | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: UserLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now()
          };

          // Try to get address from coordinates (reverse geocoding)
          try {
            const address = await LocationService.reverseGeocode(location.lat, location.lng);
            location.address = address;
          } catch (error) {
            console.log('Could not get address for location:', error);
          }

          // Store as last known location
          this.storeLastKnownLocation(location);

          resolve(location);
        },
        (error) => {
          console.error('Error getting user location:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  static storeLastKnownLocation(location: UserLocation): void {
    try {
      console.log('=== STORING LOCATION ===');
      console.log('Location to store:', location);
      localStorage.setItem(this.LOCATION_STORAGE_KEY, JSON.stringify(location));
      console.log('Stored successfully. Checking retrieval...');
      const retrieved = localStorage.getItem(this.LOCATION_STORAGE_KEY);
      console.log('Retrieved from storage:', retrieved);
    } catch (error) {
      console.error('Error storing location:', error);
    }
  }

  static getLastKnownLocation(): UserLocation | null {
    try {
      const stored = localStorage.getItem(this.LOCATION_STORAGE_KEY);
      if (!stored) return null;
      
      const location = JSON.parse(stored) as UserLocation;
      
      // Check if location is less than 24 hours old
      if (location.timestamp && Date.now() - location.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.LOCATION_STORAGE_KEY);
        return null;
      }
      
      return location;
    } catch (error) {
      console.error('Error retrieving stored location:', error);
      return null;
    }
  }

  static storeRouteStartLocation(location: UserLocation): void {
    try {
      localStorage.setItem(this.ROUTE_START_KEY, JSON.stringify(location));
    } catch (error) {
      console.error('Error storing route start location:', error);
    }
  }

  static getRouteStartLocation(): UserLocation | null {
    try {
      const stored = localStorage.getItem(this.ROUTE_START_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error retrieving route start location:', error);
      return null;
    }
  }

  static storeRouteDestinationLocation(location: UserLocation): void {
    try {
      localStorage.setItem(this.ROUTE_DEST_KEY, JSON.stringify(location));
    } catch (error) {
      console.error('Error storing route destination location:', error);
    }
  }

  static getRouteDestinationLocation(): UserLocation | null {
    try {
      const stored = localStorage.getItem(this.ROUTE_DEST_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error retrieving route destination location:', error);
      return null;
    }
  }

  static getLocationContext(): LocationContext {
    return {
      lastKnownLocation: this.getLastKnownLocation(),
      routeStartLocation: this.getRouteStartLocation(),
      routeDestinationLocation: this.getRouteDestinationLocation()
    };
  }

  static hasAnyLocationData(): boolean {
    const context = this.getLocationContext();
    return !!(
      context.lastKnownLocation ||
      context.routeStartLocation ||
      context.routeDestinationLocation
    );
  }

  private static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      console.log('🔍 REVERSE GEOCODING USER LOCATION...');
      
      // Call the edge function directly for reverse geocoding
      const supabase = (await import('../integrations/supabase/client')).supabase;
      const { data, error } = await supabase.functions.invoke('analyze-hazard', {
        body: {
          userInput: 'reverse-geocode-only',
          locationContext: {
            lastKnownLocation: {
              lat,
              lng,
              address: `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              timestamp: Date.now()
            }
          }
        }
      });

      if (error) {
        console.error('⚠️ Edge function error:', error);
        return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      if (data && data.reverseGeocodeResult && !data.reverseGeocodeResult.includes('Location:')) {
        console.log('✅ Got reverse geocoded address:', data.reverseGeocodeResult);
        return data.reverseGeocodeResult;
      }
      
      console.log('⚠️ Reverse geocoding failed, using coordinates');
      return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }
}
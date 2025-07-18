
export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
}

export class LocationService {
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
            lng: position.coords.longitude
          };

          // Try to get address from coordinates (reverse geocoding)
          try {
            const address = await LocationService.reverseGeocode(location.lat, location.lng);
            location.address = address;
          } catch (error) {
            console.log('Could not get address for location:', error);
          }

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

  private static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    // Mock reverse geocoding - in a real implementation, use Google Maps API
    return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

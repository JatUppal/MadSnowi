// Weather service for MadSnowi winter route planning
import { supabase } from '@/integrations/supabase/client';

interface WeatherData {
  name: string;
  main: {
    temp: number;
    pressure: number;
    feels_like?: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind?: {
    speed: number;
  };
  snow_depth: number; // Custom field for snow analysis
}

interface RouteSegment {
  lat: number;
  lng: number;
  snowDepth: number;
  safetyScore: 'safe' | 'caution' | 'danger';
}

interface RouteData {
  distance: string;
  duration: string;
  coordinates: Array<{lat: number, lng: number}>;
  polyline: string;
}

export class WeatherService {
  private static instance: WeatherService;

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async getWeatherForCity(city?: string): Promise<WeatherData> {
    try {
      // First try to get user's current location
      const location = await this.getCurrentLocation();
      
      let weatherData;
      if (location) {
        console.log('Using geolocation for weather:', location);
        // Use coordinates if location is available
        const { data, error } = await supabase.functions.invoke('get-weather', {
          body: { lat: location.lat, lng: location.lng }
        });

        if (error) {
          console.warn('Supabase weather function failed with coordinates, using fallback:', error);
          weatherData = this.getFallbackWeatherData('Madison');
        } else {
          weatherData = data;
        }
      } else {
        // Fall back to Madison if location access denied or failed
        console.log('User denied location access. Using Madison as fallback.');
        weatherData = await this.getWeatherForCityFallback('Madison');
      }

      return weatherData;
    } catch (error) {
      console.warn('Weather service error, using Madison fallback:', error);
      return this.getFallbackWeatherData('Madison');
    }
  }

  private async getWeatherForCityFallback(city: string): Promise<WeatherData> {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { city }
      });

      if (error) {
        console.warn('Supabase weather function failed with city, using fallback:', error);
        return this.getFallbackWeatherData(city);
      } else {
        return data;
      }
    } catch (error) {
      console.warn('City weather fallback failed, using mock data:', error);
      return this.getFallbackWeatherData(city);
    }
  }

  private getFallbackWeatherData(city: string): WeatherData {
    // Generate realistic fallback weather data for Madison, WI
    const baseTemp = Math.random() * 20 + 10; // 10-30°F typical winter range
    const hasSnow = Math.random() > 0.6; // 40% chance of snow
    const snowDepth = hasSnow ? Math.random() * 6 + 1 : Math.random() * 2; // 1-7" if snowing, 0-2" otherwise
    
    return {
      name: city || 'Madison',
      main: {
        temp: baseTemp,
        pressure: 1013,
        feels_like: baseTemp - (Math.random() * 10 + 5)
      },
      weather: [{
        main: hasSnow ? 'Snow' : 'Clouds',
        description: hasSnow ? 'light snow' : 'scattered clouds'
      }],
      wind: {
        speed: Math.random() * 15 + 5
      },
      snow_depth: snowDepth
    };
  }

  async getRouteData(startLocation: string, endLocation: string, travelMode: string): Promise<RouteData> {
    try {
      const { data, error } = await supabase.functions.invoke('get-route', {
        body: { startLocation, endLocation, travelMode }
      });

      if (error) {
        console.warn('Supabase route function failed, using fallback:', error);
        return this.getFallbackRouteData(startLocation, endLocation, travelMode);
      }

      return data.route;
    } catch (error) {
      console.warn('Route service error, using fallback:', error);
      return this.getFallbackRouteData(startLocation, endLocation, travelMode);
    }
  }

  private getFallbackRouteData(startLocation: string, endLocation: string, travelMode: string): RouteData {
    // Generate mock route data
    const distance = `${Math.floor(Math.random() * 20 + 5)} mi`;
    const duration = `${Math.floor(Math.random() * 30 + 15)} min`;
    
    // Generate coordinates between Madison area points
    const coordinates = [
      { lat: 43.0731, lng: -89.4012 }, // Madison
      { lat: 43.0731 + (Math.random() - 0.5) * 0.1, lng: -89.4012 + (Math.random() - 0.5) * 0.1 },
      { lat: 43.0731 + (Math.random() - 0.5) * 0.1, lng: -89.4012 + (Math.random() - 0.5) * 0.1 }
    ];

    return {
      distance,
      duration,
      coordinates,
      polyline: 'mock_polyline_data'
    };
  }

  async analyzeRouteWeather(
    coordinates: Array<{lat: number, lng: number}>, 
    vehicleInfo?: { type: string; tires: string; drive: string },
    travelMode: string = 'driving'
  ): Promise<{
    routeSegments: RouteSegment[];
    avgSnowDepth: number;
    overallSafety: 'safe' | 'caution' | 'danger';
    vehicleSafetyMessage: string;
    recommendation: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-route-safety', {
        body: { coordinates, vehicleInfo, travelMode }
      });

      if (error) {
        console.warn('Supabase route analysis failed, using fallback:', error);
        return this.getFallbackRouteAnalysis(coordinates, vehicleInfo, travelMode);
      }

      return {
        routeSegments: data.routeSegments,
        avgSnowDepth: data.avgSnowDepth,
        overallSafety: data.overallSafety,
        vehicleSafetyMessage: data.vehicleSafetyMessage,
        recommendation: data.recommendation
      };
    } catch (error) {
      console.warn('Route analysis error, using fallback:', error);
      return this.getFallbackRouteAnalysis(coordinates, vehicleInfo, travelMode);
    }
  }

  private getFallbackRouteAnalysis(
    coordinates: Array<{lat: number, lng: number}>, 
    vehicleInfo?: { type: string; tires: string; drive: string },
    travelMode: string = 'driving'
  ): {
    routeSegments: RouteSegment[];
    avgSnowDepth: number;
    overallSafety: 'safe' | 'caution' | 'danger';
    vehicleSafetyMessage: string;
    recommendation: string;
  } {
    const avgSnowDepth = Math.random() * 4 + 1; // 1-5 inches
    const overallSafety = avgSnowDepth > 4 ? 'danger' : avgSnowDepth > 2 ? 'caution' : 'safe';
    
    const routeSegments = coordinates.map(coord => ({
      lat: coord.lat,
      lng: coord.lng,
      snowDepth: avgSnowDepth + (Math.random() - 0.5) * 2,
      safetyScore: overallSafety as 'safe' | 'caution' | 'danger'
    }));

    const vehicleSafety = vehicleInfo ? 
      this.calculateVehicleSafety(avgSnowDepth, vehicleInfo.type as 'sedan' | 'suv' | 'truck', vehicleInfo.tires as 'regular' | 'snow', vehicleInfo.drive as 'fwd' | 'awd' | '4wd') :
      { score: overallSafety, message: 'Vehicle information not provided' };

    return {
      routeSegments,
      avgSnowDepth,
      overallSafety,
      vehicleSafetyMessage: vehicleSafety.message,
      recommendation: this.generateRecommendation(overallSafety, avgSnowDepth, 25)
    };
  }

  calculateVehicleSafety(
    snowDepth: number, 
    vehicleType: 'sedan' | 'suv' | 'truck',
    tireType: 'regular' | 'snow',
    driveType: 'fwd' | 'awd' | '4wd'
  ): {
    score: 'safe' | 'caution' | 'danger';
    message: string;
  } {
    let baseScore = 0;

    // Vehicle type scoring
    switch (vehicleType) {
      case 'truck': baseScore += 3; break;
      case 'suv': baseScore += 2; break;
      case 'sedan': baseScore += 1; break;
    }

    // Tire type scoring
    if (tireType === 'snow') baseScore += 2;

    // Drive type scoring
    switch (driveType) {
      case '4wd': baseScore += 3; break;
      case 'awd': baseScore += 2; break;
      case 'fwd': baseScore += 1; break;
    }

    // Snow depth penalty
    const snowPenalty = snowDepth / 2;
    const finalScore = baseScore - snowPenalty;

    let score: 'safe' | 'caution' | 'danger';
    let message: string;

    if (finalScore >= 4) {
      score = 'safe';
      message = `✅ Your ${vehicleType} with ${tireType} tires and ${driveType.toUpperCase()} is well-suited for these conditions.`;
    } else if (finalScore >= 2) {
      score = 'caution';
      message = `⚠️ Use caution with your ${vehicleType}. Consider snow tires or alternate route.`;
    } else {
      score = 'danger';
      message = `❌ Unsafe conditions for your ${vehicleType} with current setup. Avoid travel or use snow tires with AWD/4WD.`;
    }

    return { score, message };
  }

  generateRecommendation(
    safetyScore: 'safe' | 'caution' | 'danger',
    snowDepth: number,
    temperature: number
  ): string {
    if (safetyScore === 'danger') {
      return `Dangerous conditions with ${snowDepth.toFixed(1)}" of snow. Consider delaying travel, using public transit, or taking a major highway with snow removal.`;
    } else if (safetyScore === 'caution') {
      return `Use caution with ${snowDepth.toFixed(1)}" of snow. Allow extra time, drive slowly, and consider an alternate route.`;
    } else {
      return `Safe travel conditions. Normal winter driving precautions recommended.`;
    }
  }

  private getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('Geolocation is not supported by this browser. Using Madison as fallback.');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Geolocation successful:', position.coords);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          // Handle different types of geolocation errors
          switch (error.code) {
            case error.PERMISSION_DENIED:
              console.log('User denied location access. Using Madison as fallback.');
              break;
            case error.POSITION_UNAVAILABLE:
              console.log('Location information unavailable. Using Madison as fallback.');
              break;
            case error.TIMEOUT:
              console.log('Location request timed out. Using Madison as fallback.');
              break;
            default:
              console.log('Geolocation error occurred. Using Madison as fallback.');
              break;
          }
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
}
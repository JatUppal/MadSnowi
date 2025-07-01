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

  async getWeatherForCity(city: string): Promise<WeatherData> {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { city }
      });

      if (error) {
        console.error('Weather API error:', error);
        throw new Error('Failed to fetch weather data');
      }

      return data;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  }

  async getRouteData(startLocation: string, endLocation: string, travelMode: string): Promise<RouteData> {
    try {
      const { data, error } = await supabase.functions.invoke('get-route', {
        body: { startLocation, endLocation, travelMode }
      });

      if (error) {
        console.error('Route API error:', error);
        throw new Error('Failed to fetch route data');
      }

      return data.route;
    } catch (error) {
      console.error('Error fetching route:', error);
      throw error;
    }
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
        console.error('Route analysis error:', error);
        throw new Error('Failed to analyze route safety');
      }

      return {
        routeSegments: data.routeSegments,
        avgSnowDepth: data.avgSnowDepth,
        overallSafety: data.overallSafety,
        vehicleSafetyMessage: data.vehicleSafetyMessage,
        recommendation: data.recommendation
      };
    } catch (error) {
      console.error('Error analyzing route:', error);
      throw error;
    }
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
}
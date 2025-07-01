// Weather service for MadSnowi winter route planning
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

export class WeatherService {
  private static instance: WeatherService;
  private readonly apiKey = 'your-openweather-api-key'; // Would be from Supabase secrets in production

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async getWeatherForCity(city: string): Promise<WeatherData> {
    // Mock data for demo - in production would fetch from OpenWeatherMap API
    const mockData: WeatherData = {
      name: city,
      main: {
        temp: 26.8,
        pressure: 1013,
        feels_like: 18.5
      },
      weather: [{
        main: "Snow",
        description: "light snow"
      }],
      wind: {
        speed: 8.2
      },
      snow_depth: Math.random() * 8 + 1 // Random snow depth between 1-9 inches
    };

    return new Promise(resolve => {
      setTimeout(() => resolve(mockData), 500);
    });
  }

  async analyzeRouteWeather(coordinates: Array<{lat: number, lng: number}>): Promise<RouteSegment[]> {
    // Analyze weather conditions for each segment of the route
    const segments: RouteSegment[] = [];

    for (const coord of coordinates) {
      const snowDepth = Math.random() * 10; // Mock snow depth
      let safetyScore: 'safe' | 'caution' | 'danger' = 'safe';

      if (snowDepth > 6) {
        safetyScore = 'danger';
      } else if (snowDepth > 3) {
        safetyScore = 'caution';
      }

      segments.push({
        lat: coord.lat,
        lng: coord.lng,
        snowDepth,
        safetyScore
      });
    }

    return new Promise(resolve => {
      setTimeout(() => resolve(segments), 300);
    });
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
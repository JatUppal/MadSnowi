import React, { useState } from 'react';
import RouteSearchForm from '@/components/RouteSearchForm';
import RouteMap from '@/components/RouteMap';
import RouteResults from '@/components/RouteResults';
import WeatherDashboard from '@/components/WeatherDashboard';
import { WeatherService } from '@/services/weatherService';

interface RouteSearchData {
  startLocation: string;
  endLocation: string;
  travelMode: 'driving' | 'walking' | 'biking' | '';
  vehicleInfo?: {
    type: 'sedan' | 'suv' | 'truck' | '';
    tires: 'regular' | 'snow' | '';
    drive: 'fwd' | 'awd' | '4wd' | '';
  };
}

const Index = () => {
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchData, setSearchData] = useState<RouteSearchData | null>(null);

  const handleRouteSearch = async (data: RouteSearchData) => {
    setLoading(true);
    setSearchData(data);
    
    try {
      const weatherService = WeatherService.getInstance();
      
      // Simulate route analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock coordinates for route analysis
      const mockCoordinates = [
        { lat: 43.0742, lng: -89.3837 }, // Madison
        { lat: 43.0850, lng: -89.3900 }, // Route point 1
        { lat: 43.0950, lng: -89.4000 }, // Route point 2
      ];
      
      const routeSegments = await weatherService.analyzeRouteWeather(mockCoordinates);
      const avgSnowDepth = routeSegments.reduce((sum, seg) => sum + seg.snowDepth, 0) / routeSegments.length;
      
      let vehicleSafety: { score: 'safe' | 'caution' | 'danger'; message: string } = { 
        score: 'safe', 
        message: 'Good conditions for travel' 
      };
      
      if (data.travelMode === 'driving' && data.vehicleInfo?.type) {
        vehicleSafety = weatherService.calculateVehicleSafety(
          avgSnowDepth,
          data.vehicleInfo.type,
          data.vehicleInfo.tires || 'regular',
          data.vehicleInfo.drive || 'fwd'
        );
      }
      
      const weatherData = await weatherService.getWeatherForCity('Madison');
      
      const mockRouteData = {
        distance: '12.4 miles',
        duration: '25 minutes',
        snowDepth: avgSnowDepth,
        safetyScore: vehicleSafety.score,
        vehicleSafety: vehicleSafety.message,
        recommendation: weatherService.generateRecommendation(
          vehicleSafety.score,
          avgSnowDepth,
          weatherData.main.temp
        ),
        weatherConditions: {
          temperature: Math.round(weatherData.main.temp),
          windChill: weatherData.main.feels_like ? Math.round(weatherData.main.feels_like) : undefined,
          conditions: weatherData.weather[0].description
        }
      };
      
      setRouteData(mockRouteData);
    } catch (error) {
      console.error('Error analyzing route:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-snow">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header with weather */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RouteSearchForm onSearch={handleRouteSearch} loading={loading} />
          </div>
          <div>
            <WeatherDashboard city="Madison" />
          </div>
        </div>

        {/* Map and Results */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <RouteMap 
              startLocation={searchData?.startLocation}
              endLocation={searchData?.endLocation}
              travelMode={searchData?.travelMode}
              routeData={routeData}
            />
          </div>
          <div>
            <RouteResults routeData={routeData} loading={loading} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground bg-card/30 rounded-lg p-4">
          <p>🧀 MadSnowi - Winter-Safe Route Planning for Wisconsin 🦡</p>
          <p className="mt-1">Stay safe, Go Badgers! Data from OpenWeatherMap & 511WI</p>
        </div>
      </div>
    </div>
  );
};

export default Index;

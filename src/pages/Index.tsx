import React, { useState } from 'react';
import RouteSearchForm from '@/components/RouteSearchForm';
import RouteMap from '@/components/RouteMap';
import RouteResults from '@/components/RouteResults';
import WeatherDashboard from '@/components/WeatherDashboard';
import HazardReporterCard from '@/components/HazardReporterCard';
import DirectionsBox from '@/components/DirectionsBox';
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

      // Get real route data from Google Maps
      const routeData = await weatherService.getRouteData(data.startLocation, data.endLocation, data.travelMode);

      // Analyze route safety with real weather data
      const safetyAnalysis = await weatherService.analyzeRouteWeather(routeData.coordinates, data.vehicleInfo, data.travelMode);

      // Get weather for the general area
      const weatherData = await weatherService.getWeatherForCity('Madison');
      const routeResults = {
        distance: routeData.distance,
        duration: routeData.duration,
        snowDepth: safetyAnalysis.avgSnowDepth,
        safetyScore: safetyAnalysis.overallSafety,
        vehicleSafety: safetyAnalysis.vehicleSafetyMessage,
        recommendation: safetyAnalysis.recommendation,
        weatherConditions: {
          temperature: Math.round(weatherData.main.temp),
          windChill: weatherData.main.feels_like ? Math.round(weatherData.main.feels_like) : undefined,
          conditions: weatherData.weather[0].description
        }
      };
      setRouteData(routeResults);
    } catch (error) {
      console.error('Error analyzing route:', error);
      // Set error state or show user-friendly message
      setRouteData({
        distance: 'Unable to calculate',
        duration: 'Unable to calculate',
        snowDepth: 0,
        safetyScore: 'caution' as const,
        vehicleSafety: 'Unable to analyze route safety. Please try again.',
        recommendation: 'Please check your internet connection and try again.',
        weatherConditions: {
          temperature: 32,
          conditions: 'Unknown'
        }
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-snow">
      <div className="container mx-auto px-4 py-8 bg-sky-100">
        {/* 2-Column Responsive Layout */}
        <div className="grid lg:grid-cols-[7fr_4fr] gap-6">
          {/* Left Column (60% width) */}
          <div className="space-y-6">
            {/* Route Input Form */}
            <RouteSearchForm onSearch={handleRouteSearch} loading={loading} />
            
            {/* Google Map Display */}
            <RouteMap startLocation={searchData?.startLocation} endLocation={searchData?.endLocation} travelMode={searchData?.travelMode} routeData={routeData} />
            
            {/* Instructional Text */}
            <div className="text-center py-4">
              <p className="text-lg text-muted-foreground">
                {!searchData ? "Enter locations to see winter route analysis" : "Analyzing route safety with real-time weather data"}
              </p>
            </div>
          </div>

          {/* Right Column (40% width) */}
          <div className="space-y-6">
            {/* Weather Info Card */}
            <WeatherDashboard city="Madison" />
            
            {/* Turn-by-Turn Directions Card */}
            <DirectionsBox routeData={routeData} startLocation={searchData?.startLocation} endLocation={searchData?.endLocation} loading={loading} />
            
            {/* Live Hazard Reports */}
            <HazardReporterCard />
          </div>
        </div>

        {/* Route Results (moved below map for better flow) */}
        {routeData && (
          <div className="mt-6">
            <RouteResults routeData={routeData} loading={loading} />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground rounded-lg p-4 bg-sky-100 mt-8">
          <p>🧀 MadSnowi - Winter-Safe Route Planning for Wisconsin 🦡</p>
          <p className="mt-1">Stay safe, Go Badgers! Data from OpenWeatherMap & 511WI</p>
        </div>
      </div>
    </div>;
};
export default Index;
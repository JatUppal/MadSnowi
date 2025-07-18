import React, { useState } from 'react';
import RouteSearchForm from '@/components/RouteSearchForm';
import RouteMap from '@/components/RouteMap';
import RouteResults from '@/components/RouteResults';
import WeatherDashboard from '@/components/WeatherDashboard';
import HazardReporterCard from '@/components/HazardReporterCard';
import DirectionsBox from '@/components/DirectionsBox';
import { WeatherService } from '@/services/weatherService';
import { LocationService } from '@/services/locationService';
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

      // 🎯 STORE ROUTE LOCATIONS FOR AI USE
      // We'll geocode the start and end locations to get coordinates
      try {
        // Use the first coordinate as start and last as end from the route
        if (routeData.coordinates && routeData.coordinates.length > 0) {
          const startCoord = routeData.coordinates[0];
          const endCoord = routeData.coordinates[routeData.coordinates.length - 1];
          
          LocationService.storeRouteStartLocation({
            lat: startCoord.lat,
            lng: startCoord.lng,
            address: data.startLocation,
            timestamp: Date.now()
          });
          console.log('🎯 Route start location stored for AI:', data.startLocation);
          
          LocationService.storeRouteDestinationLocation({
            lat: endCoord.lat,
            lng: endCoord.lng,
            address: data.endLocation,
            timestamp: Date.now()
          });
          console.log('🎯 Route destination stored for AI:', data.endLocation);
        }
      } catch (error) {
        console.log('Could not store route locations:', error);
      }

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
        steps: routeData.steps, // Include the steps for turn-by-turn directions
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
  return <div className="min-h-screen bg-sky-100">
      <div className="container mx-auto px-4 py-8 bg-sky-100">
        {/* Upside-down T Layout: Two columns at top, full-width section below */}
        
        {/* Top Section: Left + Right Columns */}
        <div className="grid lg:grid-cols-[65fr_35fr] gap-6 mb-6">
          {/* Left Column (65% width) */}
          <div className="flex flex-col space-y-6 h-full bg-sky-100 p-4 rounded-xl">
            {/* MadSnowi Header + Route Input Form */}
            <div className="rounded-xl">
              <RouteSearchForm onSearch={handleRouteSearch} loading={loading} />
            </div>
            
            {/* Google Map Display */}
            <div className="rounded-xl overflow-hidden flex-1">
              <RouteMap startLocation={searchData?.startLocation} endLocation={searchData?.endLocation} travelMode={searchData?.travelMode} routeData={routeData} />
            </div>
          </div>

          {/* Right Column (35% width) */}
          <div className="space-y-6 bg-sky-100 p-4 rounded-xl">
            {/* Weather Box (Blackhawk Weather) */}
            <div className="rounded-xl">
              <WeatherDashboard city="Madison" />
            </div>
            
            {/* Turn-by-Turn Directions Card */}
            <div className="rounded-xl">
              <DirectionsBox routeData={routeData} startLocation={searchData?.startLocation} endLocation={searchData?.endLocation} loading={loading} />
            </div>
            
            {/* Live Hazard Reports */}
            <div className="rounded-xl">
              <HazardReporterCard />
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Horizontal Section */}
        {routeData && (
          <div className="rounded-xl">
            <RouteResults routeData={routeData} loading={loading} travelMode={searchData?.travelMode} />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground rounded-xl p-4 bg-sky-100 mt-8">
          <p>🧀 MadSnowi - Winter-Safe Route Planning for Wisconsin 🦡</p>
          <p className="mt-1">Stay safe, Go Badgers! Data from OpenWeatherMap & 511WI</p>
        </div>
      </div>
    </div>;
};
export default Index;
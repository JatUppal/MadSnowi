import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Snowflake, Target } from 'lucide-react';
import { useLoadScript } from '@react-google-maps/api';
import PlacesAutocompleteInput from './PlacesAutocompleteInput';

// Static libraries array to prevent performance warnings
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];
interface VehicleInfo {
  type: 'sedan' | 'suv' | 'truck' | '';
  tires: 'regular' | 'snow' | '';
  drive: 'fwd' | 'awd' | '4wd' | '';
}
interface PlaceDetails {
  address: string;
  placeId: string;
  lat?: number;
  lng?: number;
}
interface RouteSearchData {
  startLocation: string;
  endLocation: string;
  travelMode: 'driving' | 'walking' | 'biking' | '';
  vehicleInfo?: VehicleInfo;
  startPlaceDetails?: PlaceDetails;
  endPlaceDetails?: PlaceDetails;
}
interface Props {
  onSearch: (data: RouteSearchData) => void;
  loading?: boolean;
}
const RouteSearchForm: React.FC<Props> = ({
  onSearch,
  loading = false
}) => {
  const {
    isLoaded
  } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBMtL5TzN6Mh6G2rfn5_fbTXDoluWW5rEI',
    libraries: GOOGLE_MAPS_LIBRARIES
  });
  const [formData, setFormData] = useState<RouteSearchData>({
    startLocation: '',
    endLocation: '',
    travelMode: '',
    vehicleInfo: {
      type: '',
      tires: '',
      drive: ''
    }
  });
  const handleStartLocationChange = (address: string, placeDetails?: PlaceDetails) => {
    setFormData(prev => ({
      ...prev,
      startLocation: address,
      startPlaceDetails: placeDetails
    }));
  };
  const handleEndLocationChange = (address: string, placeDetails?: PlaceDetails) => {
    setFormData(prev => ({
      ...prev,
      endLocation: address,
      endPlaceDetails: placeDetails
    }));
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.startLocation && formData.endLocation && formData.travelMode) {
      onSearch(formData);
    }
  };
  const isDriving = formData.travelMode === 'driving';
  if (!isLoaded) {
    return <Card className="w-full max-w-4xl mx-auto bg-gradient-winter shadow-snow border-0 rounded-xl">
        <div className="p-6 flex items-center justify-center">
          <Snowflake className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-foreground">Loading Google Maps...</span>
        </div>
      </Card>;
  }
  return <Card className="w-full max-w-4xl mx-auto bg-gradient-winter shadow-snow border-0 rounded-xl">
      <div className="space-y-6 h-full flex flex-col justify-between bg-sky-200 px-[24px] pb-[24px] pt-[12px] mx-0 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-50">
            <Snowflake className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-red-500">MadSnowi</h1>
            <p className="text-sm text-muted-foreground">AI Winter-Safe Route Planner for Wisconsin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location Inputs */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">🧀 Start Location</Label>
              <PlacesAutocompleteInput defaultValue={formData.startLocation} onSelect={address => handleStartLocationChange(address)} placeholder="Enter starting point (e.g., UW-Madison)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">🎯 Destination</Label>
              <PlacesAutocompleteInput defaultValue={formData.endLocation} onSelect={address => handleEndLocationChange(address)} placeholder="Enter destination" />
            </div>
          </div>

          {/* Travel Mode */}
          <div className="space-y-2 bg-sky-200">
            <Label>Travel Mode</Label>
            <Select value={formData.travelMode} onValueChange={(value: 'driving' | 'walking' | 'biking') => setFormData(prev => ({
            ...prev,
            travelMode: value
          }))}>
              <SelectTrigger className="bg-white border border-gray-300 text-gray-800 shadow-sm rounded-md">
                <SelectValue placeholder="Select how you'll travel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driving">🚗 Driving</SelectItem>
                <SelectItem value="walking">🚶 Walking</SelectItem>
                <SelectItem value="biking">🚴 Biking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Info (only for driving) */}
          {isDriving && <Card className="p-4 border-accent/50 rounded-xl bg-sky-100">
              <h3 className="font-semibold mb-3 text-foreground">Vehicle Information</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select value={formData.vehicleInfo?.type || ''} onValueChange={(value: 'sedan' | 'suv' | 'truck') => setFormData(prev => ({
                ...prev,
                vehicleInfo: {
                  ...prev.vehicleInfo!,
                  type: value
                }
              }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedan">🚗 Sedan</SelectItem>
                      <SelectItem value="suv">🚙 SUV</SelectItem>
                      <SelectItem value="truck">🛻 Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tire Type</Label>
                  <Select value={formData.vehicleInfo?.tires || ''} onValueChange={(value: 'regular' | 'snow') => setFormData(prev => ({
                ...prev,
                vehicleInfo: {
                  ...prev.vehicleInfo!,
                  tires: value
                }
              }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tires" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">🛞 Regular Tires</SelectItem>
                      <SelectItem value="snow">❄️ Snow Tires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Drive System</Label>
                  <Select value={formData.vehicleInfo?.drive || ''} onValueChange={(value: 'fwd' | 'awd' | '4wd') => setFormData(prev => ({
                ...prev,
                vehicleInfo: {
                  ...prev.vehicleInfo!,
                  drive: value
                }
              }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drive" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fwd">⚙️ FWD</SelectItem>
                      <SelectItem value="awd">⚙️ AWD</SelectItem>
                      <SelectItem value="4wd">⚙️ 4WD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>}

          <Button type="submit" disabled={loading || !formData.startLocation || !formData.endLocation || !formData.travelMode} className="w-full text-base !bg-white hover:!bg-white disabled:!bg-white text-red-500 disabled:!text-red-500 border border-gray-300 hover:!bg-gray-50 focus:!bg-white">
            {loading ? <>
                <Snowflake className="mr-2 h-4 w-4 animate-spin" />
                Finding Safe Route...
              </> : <>
                <Target className="mr-2 h-4 w-4" />
                Find Winter-Safe Route
              </>}
          </Button>
        </form>
      </div>
    </Card>;
};
export default RouteSearchForm;
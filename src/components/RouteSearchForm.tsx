import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Snowflake, Target } from 'lucide-react';

interface VehicleInfo {
  type: 'sedan' | 'suv' | 'truck' | '';
  tires: 'regular' | 'snow' | '';
  drive: 'fwd' | 'awd' | '4wd' | '';
}

interface RouteSearchData {
  startLocation: string;
  endLocation: string;
  travelMode: 'driving' | 'walking' | 'biking' | '';
  vehicleInfo?: VehicleInfo;
}

interface Props {
  onSearch: (data: RouteSearchData) => void;
  loading?: boolean;
}

const RouteSearchForm: React.FC<Props> = ({ onSearch, loading = false }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.startLocation && formData.endLocation && formData.travelMode) {
      onSearch(formData);
    }
  };

  const isDriving = formData.travelMode === 'driving';

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gradient-winter shadow-snow border-0">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Snowflake className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">MadSnowi</h1>
            <p className="text-sm text-muted-foreground">Winter-Safe Route Planner for Wisconsin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location Inputs */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">🧀 Start Location</Label>
              <Input
                id="start"
                placeholder="Enter starting point (e.g., UW-Madison)"
                value={formData.startLocation}
                onChange={(e) => setFormData(prev => ({ ...prev, startLocation: e.target.value }))}
                className="bg-card/50 backdrop-blur-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">🎯 Destination</Label>
              <Input
                id="end"
                placeholder="Enter destination"
                value={formData.endLocation}
                onChange={(e) => setFormData(prev => ({ ...prev, endLocation: e.target.value }))}
                className="bg-card/50 backdrop-blur-sm"
              />
            </div>
          </div>

          {/* Travel Mode */}
          <div className="space-y-2">
            <Label>Travel Mode</Label>
            <Select 
              value={formData.travelMode} 
              onValueChange={(value: 'driving' | 'walking' | 'biking') => 
                setFormData(prev => ({ ...prev, travelMode: value }))
              }
            >
              <SelectTrigger className="bg-card/50 backdrop-blur-sm">
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
          {isDriving && (
            <Card className="p-4 bg-accent/30 border-accent/50">
              <h3 className="font-semibold mb-3 text-foreground">Vehicle Information</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select 
                    value={formData.vehicleInfo?.type || ''} 
                    onValueChange={(value: 'sedan' | 'suv' | 'truck') => 
                      setFormData(prev => ({ 
                        ...prev, 
                        vehicleInfo: { ...prev.vehicleInfo!, type: value }
                      }))
                    }
                  >
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
                  <Select 
                    value={formData.vehicleInfo?.tires || ''} 
                    onValueChange={(value: 'regular' | 'snow') => 
                      setFormData(prev => ({ 
                        ...prev, 
                        vehicleInfo: { ...prev.vehicleInfo!, tires: value }
                      }))
                    }
                  >
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
                  <Select 
                    value={formData.vehicleInfo?.drive || ''} 
                    onValueChange={(value: 'fwd' | 'awd' | '4wd') => 
                      setFormData(prev => ({ 
                        ...prev, 
                        vehicleInfo: { ...prev.vehicleInfo!, drive: value }
                      }))
                    }
                  >
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
            </Card>
          )}

          <Button 
            type="submit" 
            variant="winter"
            className="w-full"
            disabled={loading || !formData.startLocation || !formData.endLocation || !formData.travelMode}
          >
            {loading ? (
              <>
                <Snowflake className="mr-2 h-4 w-4 animate-spin" />
                Finding Safe Route...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Find Winter-Safe Route
              </>
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default RouteSearchForm;
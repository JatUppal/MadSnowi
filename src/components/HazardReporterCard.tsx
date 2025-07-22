import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIHazardInput } from './AIHazardInput';
import { supabase } from '@/integrations/supabase/client';

interface HazardReport {
  id: string;
  hazard_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  created_at: string;
}

const HazardReporterCard = () => {
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardReport | null>(null);

  // Load hazards from the past 24 hours only (performance optimization)
  useEffect(() => {
    const loadHazards = async () => {
      try {
        // Backend filtering: Only fetch hazard reports from the last 24 hours
        // This reduces API payload size and improves performance with indexed queries
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        console.log('📊 Loading hazards from the past 24 hours...');
        const { data, error } = await supabase
          .from('hazard_reports')
          .select('*')
          .gte('created_at', twentyFourHoursAgo) // Only show reports from last 24 hours
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error loading hazards:', error);
          return;
        }

        console.log(`✅ Loaded ${data?.length || 0} recent hazards (24h filter applied)`);
        setHazards((data || []) as HazardReport[]);
      } catch (error) {
        console.log('Could not load hazards:', error);
      }
    };

    loadHazards();
  }, []);

  const handleAISubmit = (hazardData: { text: string; location?: any }) => {
    submitHazard(hazardData);
  };

  const submitHazard = async (hazardData: { text: string; location?: any }) => {
    setIsSubmitting(true);
    try {
      // Clean up the location address by removing duplicate pin emojis
      const cleanAddress = hazardData.location?.address?.replace(/📍\s*📍/g, '📍')?.replace(/^📍\s*/, '');
      
      // Prepare data for database insertion
      const insertData = {
        hazard_type: hazardData.text.split(' ').slice(0, 5).join(' '), // First few words as type
        description: hazardData.text,
        severity: 'medium' as const, // Default severity
        location_address: cleanAddress,
        location_lat: hazardData.location?.coordinates?.lat,
        location_lng: hazardData.location?.coordinates?.lng,
        user_id: (await supabase.auth.getUser()).data.user?.id || null,
      };

      const { data, error } = await supabase
        .from('hazard_reports')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error submitting hazard:', error);
        return;
      }

      // Add to local state for immediate UI update
      setHazards(prev => [data as HazardReport, ...prev.slice(0, 4)]);
      
    } catch (error) {
      console.log('Could not submit hazard report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ago`;
  };

  if (selectedHazard) {
    return (
      <Card className="bg-gradient-winter shadow-snow border-accent/30 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            🚧 {selectedHazard.hazard_type}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              {selectedHazard.description}
            </p>
            {selectedHazard.location_address && (
              <p className="text-xs text-muted-foreground">
                📍 {selectedHazard.location_address}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Reported {formatTimeAgo(selectedHazard.created_at)}
            </p>
          </div>
          <div className="flex justify-start">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedHazard(null)}
              className="bg-background/50 hover:bg-background/80"
            >
              ← Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-winter shadow-snow border-accent/30 rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          🚧 Live Hazard Reports
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Showing hazards reported in the last 24 hours
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI hazard input */}
        <AIHazardInput onHazardSubmit={handleAISubmit} />

        {/* Recent hazards list */}
        <div className="max-h-40 overflow-y-auto space-y-2">
          {hazards.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No recent hazard reports
            </p>
          ) : (
            hazards.map((hazard) => (
              <div
                key={hazard.id}
                className="flex items-start gap-2 p-2 rounded-xl bg-background/30 border border-accent/20"
              >
                <span className="text-sm mt-0.5">❗</span>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedHazard(hazard)}
                    className="text-left w-full hover:bg-background/20 rounded-lg p-1 -m-1 transition-colors"
                  >
                    <p className="text-sm text-foreground leading-tight font-medium underline hover:no-underline">
                      {hazard.hazard_type}
                    </p>
                  </button>
                  {hazard.location_address && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📍 {hazard.location_address}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(hazard.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HazardReporterCard;

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIHazardInput } from './AIHazardInput';

interface HazardReport {
  id: string;
  text: string;
  timestamp: number;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

const HazardReporterCard = () => {
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useAI, setUseAI] = useState(true);

  // Load initial hazards on mount
  useEffect(() => {
    const loadHazards = async () => {
      try {
        const response = await fetch('/api/hazard?latest=5');
        if (response.ok) {
          const data = await response.json();
          setHazards(data);
        }
      } catch (error) {
        console.log('Could not load hazards:', error);
        // For demo purposes, add some mock data
        setHazards([
          { id: '1', text: 'Ice patch on Highway 151 near Verona', timestamp: Date.now() - 1800000 },
          { id: '2', text: 'Snow drift blocking right lane on I-94', timestamp: Date.now() - 3600000 },
          { id: '3', text: 'Fallen tree on County Road M', timestamp: Date.now() - 5400000 },
        ]);
      }
    };

    loadHazards();
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim() || isSubmitting) return;

    submitHazard({ text: reportText.trim() });
  };

  const handleAISubmit = (hazardData: { text: string; location?: any }) => {
    submitHazard(hazardData);
  };

  const submitHazard = async (hazardData: { text: string; location?: any }) => {
    setIsSubmitting(true);
    try {
      const body = { 
        text: hazardData.text, 
        timestamp: Date.now(),
        location: hazardData.location 
      };
      
      const response = await fetch('/api/hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Add to local state
        const newHazard: HazardReport = {
          id: Date.now().toString(),
          text: hazardData.text,
          timestamp: Date.now(),
          location: hazardData.location
        };
        setHazards(prev => [newHazard, ...prev.slice(0, 4)]);
        setReportText('');
      }
    } catch (error) {
      console.log('Could not submit hazard report:', error);
      // For demo, still add to local state
      const newHazard: HazardReport = {
        id: Date.now().toString(),
        text: hazardData.text,
        timestamp: Date.now(),
        location: hazardData.location
      };
      setHazards(prev => [newHazard, ...prev.slice(0, 4)]);
      setReportText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ago`;
  };

  return (
    <Card className="bg-gradient-winter shadow-snow border-accent/30 rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          🚧 Live Hazard Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI/Manual Toggle */}
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={useAI ? "default" : "outline"}
            onClick={() => setUseAI(true)}
            className="text-xs"
          >
            🤖 AI Assistant
          </Button>
          <Button
            size="sm"
            variant={!useAI ? "default" : "outline"}
            onClick={() => setUseAI(false)}
            className="text-xs"
          >
            ✏️ Manual Entry
          </Button>
        </div>

        {/* Report submission form */}
        {useAI ? (
          <AIHazardInput onHazardSubmit={handleAISubmit} />
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <Textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Spotted ice, snow drift, fallen tree…"
              rows={2}
              className="resize-none bg-background/50 border-accent/30"
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={!reportText.trim() || isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </Button>
          </form>
        )}

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
                  <p className="text-sm text-foreground leading-tight">
                    {hazard.text}
                  </p>
                  {hazard.location?.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📍 {hazard.location.address}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(hazard.timestamp)}
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

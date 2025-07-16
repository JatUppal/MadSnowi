import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HazardReport {
  id: string;
  text: string;
  timestamp: number;
}

const HazardReporterCard = () => {
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const body = { text: reportText.trim(), timestamp: Date.now() };
      const response = await fetch('/api/hazard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Add to local state
        const newHazard: HazardReport = {
          id: Date.now().toString(),
          text: reportText.trim(),
          timestamp: Date.now()
        };
        setHazards(prev => [newHazard, ...prev.slice(0, 4)]);
        setReportText('');
      }
    } catch (error) {
      console.log('Could not submit hazard report:', error);
      // For demo, still add to local state
      const newHazard: HazardReport = {
        id: Date.now().toString(),
        text: reportText.trim(),
        timestamp: Date.now()
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
    <Card className="bg-gradient-winter shadow-snow border-accent/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          🚧 Live Hazard Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Report submission form */}
        <form onSubmit={handleSubmit} className="space-y-3">
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
                className="flex items-start gap-2 p-2 rounded bg-background/30 border border-accent/20"
              >
                <span className="text-sm mt-0.5">❗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-tight">
                    {hazard.text}
                  </p>
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
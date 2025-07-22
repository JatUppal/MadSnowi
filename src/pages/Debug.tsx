import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Search, Target, Clock, TrendingUp } from 'lucide-react';

interface PlacesSearchLog {
  id: string;
  search_query: string;
  user_lat: number;
  user_lng: number;
  radius_meters: number;
  radius_miles: number;
  place_name: string;
  place_address: string;
  place_lat: number;
  place_lng: number;
  place_types: string[];
  distance_miles: number;
  similarity_score: number;
  was_selected: boolean;
  confidence_level: string;
  created_at: string;
}

interface SearchSummary {
  query: string;
  totalPlaces: number;
  selectedPlace: PlacesSearchLog | null;
  radiusLayers: { [key: number]: number };
  averageSimilarity: number;
  created_at: string;
}

const DebugPage = () => {
  const [searchLogs, setSearchLogs] = useState<PlacesSearchLog[]>([]);
  const [searchSummaries, setSearchSummaries] = useState<SearchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<string>('');

  useEffect(() => {
    fetchSearchLogs();
  }, []);

  const fetchSearchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('places_search_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      setSearchLogs(data || []);
      generateSearchSummaries(data || []);
    } catch (error) {
      console.error('Error fetching search logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSearchSummaries = (logs: PlacesSearchLog[]) => {
    const grouped = logs.reduce((acc, log) => {
      const key = `${log.search_query}_${log.created_at.split('T')[0]}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(log);
      return acc;
    }, {} as { [key: string]: PlacesSearchLog[] });

    const summaries = Object.entries(grouped).map(([key, logs]) => {
      const firstLog = logs[0];
      const radiusLayers = logs.reduce((acc, log) => {
        acc[log.radius_meters] = (acc[log.radius_meters] || 0) + 1;
        return acc;
      }, {} as { [key: number]: number });

      const selectedPlace = logs.find(log => log.was_selected) || null;
      const averageSimilarity = logs.reduce((sum, log) => sum + log.similarity_score, 0) / logs.length;

      return {
        query: firstLog.search_query,
        totalPlaces: logs.length,
        selectedPlace,
        radiusLayers,
        averageSimilarity,
        created_at: firstLog.created_at
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSearchSummaries(summaries);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.85) return 'text-green-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading debug data...</div>
      </div>
    );
  }

  const filteredLogs = selectedQuery 
    ? searchLogs.filter(log => log.search_query === selectedQuery)
    : searchLogs;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Places Search Debug</h1>
          <p className="text-muted-foreground">
            Analyze Google Places API search results and AI matching performance
          </p>
        </div>
        <Button onClick={fetchSearchLogs} variant="outline">
          <Search className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Search Summary</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Results</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4">
            {searchSummaries.map((summary, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedQuery(summary.query)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      "{summary.query}"
                    </CardTitle>
                    <Badge variant="outline">
                      {new Date(summary.created_at).toLocaleString()}
                    </Badge>
                  </div>
                  <CardDescription>
                    Found {summary.totalPlaces} places across {Object.keys(summary.radiusLayers).length} radius layers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{summary.totalPlaces}</div>
                      <div className="text-sm text-muted-foreground">Total Places</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{(summary.averageSimilarity * 100).toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Avg Similarity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {summary.selectedPlace ? '✅' : '❌'}
                      </div>
                      <div className="text-sm text-muted-foreground">Match Found</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {summary.selectedPlace?.confidence_level || 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">Confidence</div>
                    </div>
                  </div>

                  {summary.selectedPlace && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="font-medium text-green-800">Selected Match:</div>
                      <div className="text-green-700">
                        {summary.selectedPlace.place_name} - {summary.selectedPlace.place_address}
                      </div>
                      <div className="text-sm text-green-600">
                        Distance: {summary.selectedPlace.distance_miles.toFixed(2)} mi, 
                        Similarity: {(summary.selectedPlace.similarity_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(summary.radiusLayers).map(([radius, count]) => (
                      <Badge key={radius} variant="secondary">
                        {(parseInt(radius) * 0.000621371).toFixed(1)}mi: {count} places
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          {selectedQuery && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Detailed Results for "{selectedQuery}"
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedQuery('')}
                >
                  Show All Results
                </Button>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4">
            {filteredLogs.map((log) => (
              <Card key={log.id} className={log.was_selected ? 'ring-2 ring-green-500' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {log.place_name}
                      {log.was_selected && <Badge className="bg-green-500">SELECTED</Badge>}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge className={getConfidenceColor(log.confidence_level)}>
                        {log.confidence_level}
                      </Badge>
                      <Badge variant="outline">
                        {log.radius_miles.toFixed(1)} mi radius
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{log.place_address}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Distance</div>
                      <div className="font-medium">{log.distance_miles.toFixed(2)} miles</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Similarity Score</div>
                      <div className={`font-medium ${getSimilarityColor(log.similarity_score)}`}>
                        {(log.similarity_score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Coordinates</div>
                      <div className="font-medium text-xs">
                        {log.place_lat.toFixed(4)}, {log.place_lng.toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Search Query</div>
                      <div className="font-medium text-xs">"{log.search_query}"</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Place Types</div>
                    <div className="flex gap-1 flex-wrap">
                      {log.place_types.map((type, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {type.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchSummaries.length > 0 
                    ? ((searchSummaries.filter(s => s.selectedPlace).length / searchSummaries.length) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">
                  {searchSummaries.filter(s => s.selectedPlace).length} of {searchSummaries.length} searches found matches
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Similarity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchLogs.length > 0 
                    ? ((searchLogs.reduce((sum, log) => sum + log.similarity_score, 0) / searchLogs.length) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Across {searchLogs.length} places analyzed
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Common Radius</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {searchLogs.length > 0 
                    ? Object.entries(searchLogs.reduce((acc, log) => {
                        acc[log.radius_meters] = (acc[log.radius_meters] || 0) + 1;
                        return acc;
                      }, {} as { [key: number]: number }))
                      .sort(([,a], [,b]) => b - a)[0]?.[0] 
                      ? (parseInt(Object.entries(searchLogs.reduce((acc, log) => {
                          acc[log.radius_meters] = (acc[log.radius_meters] || 0) + 1;
                          return acc;
                        }, {} as { [key: number]: number }))
                        .sort(([,a], [,b]) => b - a)[0][0]) * 0.000621371).toFixed(1)
                      : 0
                    : 0} mi
                </div>
                <div className="text-sm text-muted-foreground">
                  Where most matches are found
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebugPage;
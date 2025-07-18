
interface HazardLocation {
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

interface HazardAnalysis {
  hazardType: string;
  description: string;
  location: HazardLocation | null;
  severity: 'low' | 'medium' | 'high';
  needsLocationConfirmation: boolean;
}

export class AIService {
  private static instance: AIService;

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async analyzeHazardReport(userInput: string): Promise<HazardAnalysis> {
    // Mock AI analysis - in a real implementation, this would call an AI service
    const analysis = this.mockAnalyzeHazard(userInput);
    
    // If location is mentioned but not specific enough, we'll need user location
    if (analysis.location?.confidence === 'low' || !analysis.location) {
      analysis.needsLocationConfirmation = true;
    }

    return analysis;
  }

  private mockAnalyzeHazard(input: string): HazardAnalysis {
    const lowerInput = input.toLowerCase();
    
    // Extract hazard type
    let hazardType = 'Unknown hazard';
    let severity: 'low' | 'medium' | 'high' = 'medium';
    
    if (lowerInput.includes('ice') || lowerInput.includes('icy')) {
      hazardType = 'Ice patch detected';
      severity = 'high';
    } else if (lowerInput.includes('snow') || lowerInput.includes('drift')) {
      hazardType = 'Snow drift reported';
      severity = 'medium';
    } else if (lowerInput.includes('tree') || lowerInput.includes('fallen')) {
      hazardType = 'Fallen tree blocking road';
      severity = 'high';
    } else if (lowerInput.includes('accident') || lowerInput.includes('crash')) {
      hazardType = 'Traffic accident reported';
      severity = 'high';
    } else if (lowerInput.includes('pothole')) {
      hazardType = 'Pothole reported';
      severity = 'low';
    }

    // Try to extract location information
    let location: HazardLocation | null = null;
    
    // Look for highway/interstate patterns
    const highwayMatch = input.match(/(?:highway|hwy|interstate|i-?)\s*(\d+)/i);
    const roadMatch = input.match(/(?:on|near|at)\s+([^,.\n]+)/i);
    
    if (highwayMatch) {
      location = {
        address: `Highway ${highwayMatch[1]}`,
        confidence: 'medium'
      };
    } else if (roadMatch) {
      location = {
        address: roadMatch[1].trim(),
        confidence: 'low'
      };
    }

    return {
      hazardType,
      description: input,
      location,
      severity,
      needsLocationConfirmation: !location || location.confidence === 'low'
    };
  }

  async geocodeLocation(address: string): Promise<{lat: number, lng: number} | null> {
    // Mock geocoding - in a real implementation, use Google Maps Geocoding API
    const mockLocations: Record<string, {lat: number, lng: number}> = {
      'highway 151': { lat: 43.0731, lng: -89.4012 },
      'i-94': { lat: 43.0642, lng: -89.3998 },
      'county road m': { lat: 43.0845, lng: -89.3654 }
    };

    const key = address.toLowerCase().replace(/\s+/g, ' ');
    return mockLocations[key] || null;
  }
}

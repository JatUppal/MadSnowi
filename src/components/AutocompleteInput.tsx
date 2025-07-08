import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceDetails {
  address: string;
  placeId: string;
  lat?: number;
  lng?: number;
}

interface Props {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string, placeDetails?: PlaceDetails) => void;
  className?: string;
}

const AutocompleteInput: React.FC<Props> = ({ 
  id, 
  placeholder, 
  value, 
  onChange, 
  className 
}) => {
  const [suggestions, setSuggestions] = useState<PlaceDetails[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout>();
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize Google Places services
  useEffect(() => {
    if (window.google?.maps?.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService initialization
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    }
  }, []);

  const fetchSuggestions = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      componentRestrictions: { country: 'us' }, // Restrict to US
      types: ['establishment', 'geocode'],
    };

    autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        const formattedSuggestions = predictions.slice(0, 5).map(prediction => ({
          address: prediction.description,
          placeId: prediction.place_id,
        }));
        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    });
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API calls
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  }, [onChange, fetchSuggestions]);

  const getPlaceDetails = useCallback((placeId: string, address: string) => {
    if (!placesServiceRef.current) {
      onChange(address, { address, placeId });
      return;
    }

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId,
      fields: ['geometry'],
    };

    placesServiceRef.current.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onChange(address, { address, placeId, lat, lng });
      } else {
        onChange(address, { address, placeId });
      }
    });
  }, [onChange]);

  const handleSuggestionClick = useCallback((suggestion: PlaceDetails) => {
    getPlaceDetails(suggestion.placeId, suggestion.address);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [getPlaceDetails]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionClick]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        className={className}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.placeId}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-accent/50",
                index === selectedIndex && "bg-accent/70"
              )}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{suggestion.address}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
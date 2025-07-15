import React, { useState, useRef, useEffect } from 'react';

interface PlacesAutocompleteInputProps {
  placeholder?: string;
  onSelect: (value: string) => void;
  defaultValue?: string;
  className?: string;
}

interface Suggestion {
  description: string;
  place_id: string;
}

interface PlacesApiResponse {
  suggestions: Array<{
    placePrediction?: {
      place: string;
      placeId: string;
      text: {
        text: string;
      };
    };
    queryPrediction?: {
      text: {
        text: string;
      };
    };
  }>;
}

const PlacesAutocompleteInput: React.FC<PlacesAutocompleteInputProps> = ({
  placeholder,
  onSelect,
  defaultValue = '',
  className,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate a random session token
  const generateSessionToken = (): string => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  // Initialize session token
  useEffect(() => {
    sessionTokenRef.current = generateSessionToken();
  }, []);

  // Create new session token when user starts typing
  const createNewSessionToken = () => {
    sessionTokenRef.current = generateSessionToken();
  };

  // Fetch suggestions using the new Places API
  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    setLoading(true);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      setLoading(false);
      return;
    }

    // Prepare request body according to the API documentation
    const requestBody = {
      input: inputValue,
      sessionToken: sessionTokenRef.current,
      languageCode: 'en',
      regionCode: 'us',
      includedRegionCodes: ['us'],
      includeQueryPredictions: false
    };

    fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      signal: abortControllerRef.current.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text'
      },
      body: JSON.stringify(requestBody)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: PlacesApiResponse) => {
        setLoading(false);
        if (data.suggestions && data.suggestions.length > 0) {
          const suggestions = data.suggestions
            .filter(suggestion => suggestion.placePrediction) // Only include place predictions
            .slice(0, 5)
            .map(suggestion => ({
              description: suggestion.placePrediction!.text.text,
              place_id: suggestion.placePrediction!.placeId,
            }));
          setSuggestions(suggestions);
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Error fetching places:', error);
          setLoading(false);
          setSuggestions([]);
          setShowDropdown(false);
        }
      });
  }, [inputValue]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Hide dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !inputRef.current?.contains(event.target as Node) &&
        !dropdownRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setShowDropdown(false);
      setActiveIndex(-1);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    setInputValue(suggestion.description);
    onSelect(suggestion.description);
    setShowDropdown(false);
    setActiveIndex(-1);
    setSuggestions([]); // Clear suggestions immediately
    // Create new session token after selection for next interaction
    createNewSessionToken();
    // Keep input focused after selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Only show dropdown if user is actively typing and has suggestions
    if (value.length >= 2) {
      // Create new session token when user starts typing
      if (!sessionTokenRef.current) {
        createNewSessionToken();
      }
    } else {
      // Hide dropdown if input is too short
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  const handleInputFocus = () => {
    // Only show dropdown if there are suggestions and user is actively typing
    if (suggestions.length > 0 && inputValue.length >= 2) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`w-full ${className || ''}`.trim()}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-autocomplete="list"
          aria-controls="places-autocomplete-list"
          aria-activedescendant={activeIndex >= 0 ? `places-suggestion-${activeIndex}` : undefined}
        />
        {loading && (
          <div className="absolute right-2 top-2 text-gray-400 animate-spin">…</div>
        )}
      </div>
      
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id="places-autocomplete-list"
          className="w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-auto mt-1 transition-opacity duration-150 ease-out"
          role="listbox"
        >
          {suggestions.map((suggestion, idx) => (
            <div
              key={suggestion.place_id}
              id={`places-suggestion-${idx}`}
              role="option"
              aria-selected={activeIndex === idx}
              className={`px-4 py-2 cursor-pointer hover:bg-blue-100 ${activeIndex === idx ? 'bg-blue-100' : ''}`}
              onMouseDown={e => { e.preventDefault(); selectSuggestion(suggestion); }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {suggestion.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlacesAutocompleteInput; 
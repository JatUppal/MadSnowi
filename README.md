# 🛣️ Smart Road Safety Navigator

An intelligent road safety application that combines AI-powered hazard analysis, real-time weather monitoring, and route optimization to help drivers navigate safely.

## 🚀 Key Features

### 🤖 AI-Powered Hazard Reporting
- **Smart Hazard Analysis**: Natural language processing to understand and categorize road hazards
- **Location Intelligence**: Automatic location detection and reverse geocoding for precise hazard mapping
- **Severity Assessment**: AI-driven severity classification (low, medium, high, critical)
- **Real-time Validation**: Cross-reference with multiple data sources for accuracy

### 🗺️ Advanced Mapping & Navigation
- **Interactive Maps**: Google Maps integration with custom markers and overlays
- **Route Planning**: Intelligent route calculation with multiple options
- **Safety-Focused Routing**: Route recommendations based on current hazards and conditions
- **Real-time Traffic**: Integration with live traffic data

### 🌤️ Weather Intelligence
- **Live Weather Data**: Real-time weather conditions using OpenWeather API
- **Weather-Aware Routing**: Route adjustments based on weather conditions
- **Precipitation Tracking**: Snow depth and precipitation monitoring
- **Temperature & Wind**: Comprehensive weather metrics for safety planning

### 📍 Location Services
- **Precise Geolocation**: High-accuracy GPS positioning
- **Address Autocomplete**: Google Places API integration for smart address suggestions
- **Reverse Geocoding**: Convert coordinates to human-readable addresses
- **Location Context**: Smart location memory and route history

### 🔧 Backend Infrastructure
- **Edge Functions**: Serverless functions for AI processing and API integration
- **Real-time Database**: Supabase for hazard storage and retrieval
- **Data Analytics**: Route safety analysis and hazard trend monitoring
- **API Orchestration**: Seamless integration of multiple external services

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern component-based UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component library
- **React Router**: Client-side routing
- **TanStack Query**: Server state management

### Backend & Infrastructure
- **Supabase**: Backend-as-a-Service platform
  - Edge Functions (Deno runtime)
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication ready
- **Serverless Architecture**: Auto-scaling edge functions

### APIs & Services
- **Google Maps Platform**:
  - Maps JavaScript API
  - Directions API
  - Places API
  - Geocoding API
- **OpenWeather API**: Weather data and forecasting
- **OpenAI API**: AI-powered text analysis and hazard classification

### Development Tools
- **ESLint**: Code linting and quality checks
- **Bun**: Fast package manager
- **Git**: Version control
- **GitHub Integration**: Bidirectional sync with Lovable

## 🔧 Environment Setup

### Required API Keys

1. **Google Maps API Key**
   - Enable: Maps JavaScript API, Directions API, Places API, Geocoding API
   - Get from: [Google Cloud Console](https://console.cloud.google.com/)

2. **OpenWeather API Key**
   - Get from: [OpenWeather](https://openweathermap.org/api)

3. **OpenAI API Key** (for AI features)
   - Get from: [OpenAI Platform](https://platform.openai.com/)

### Supabase Configuration
All API keys are securely stored in Supabase secrets and accessed via edge functions. The application uses:
- `GOOGLE_MAPS_API_KEY`
- `OPENWEATHER_API_KEY` 
- `OPENAI_API_KEY`

## 🚀 Getting Started

### Local Development
```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Install dependencies
npm install

# Start development server
npm run dev
```

### GitHub Codespaces
1. Click "Code" → "Codespaces" → "New codespace"
2. Edit directly in the browser
3. Commit and push changes

## 🌐 Deployment

Deploy instantly using Lovable:
1. Open your [Lovable project](https://lovable.dev/projects/8d665636-8133-41bf-ab45-d210df8993a9)
2. Click **Share** → **Publish**
3. Optional: Connect a custom domain in Project Settings

## 📱 Application Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   React Frontend    │    │  Supabase Backend    │    │   External APIs     │
│                     │    │                      │    │                     │
│ • Route Planning    │◄──►│ • Edge Functions     │◄──►│ • Google Maps       │
│ • Hazard Reporting  │    │ • PostgreSQL DB      │    │ • OpenWeather       │
│ • Weather Display   │    │ • Real-time Sync     │    │ • OpenAI            │
│ • Interactive Maps  │    │ • Authentication     │    │ • 511 APIs          │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## 🔒 Security & Privacy

- **API Key Protection**: All sensitive keys stored in Supabase secrets
- **Client-side Safety**: No sensitive data exposed to frontend
- **Location Privacy**: User location data handled securely
- **CORS Protection**: Proper cross-origin request handling

## 📊 Data Flow

1. **User Input**: Natural language hazard description
2. **AI Processing**: OpenAI analyzes and categorizes hazard
3. **Location Resolution**: Google Maps geocoding and place lookup
4. **Database Storage**: Hazard stored in Supabase with metadata
5. **Real-time Updates**: Live hazard display on maps
6. **Route Integration**: Hazards considered in route planning

## 🤝 Contributing

This project uses Lovable's bidirectional GitHub sync:
- **Push to GitHub**: Changes automatically appear in Lovable
- **Edit in Lovable**: Changes automatically push to GitHub
- **No manual sync required**: Real-time bidirectional updates


**Project URL**: https://lovable.dev/projects/8d665636-8133-41bf-ab45-d210df8993a9

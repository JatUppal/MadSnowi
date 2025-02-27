from fastapi import FastAPI
import requests
import os

app = FastAPI()

# Load API keys (replace with your actual keys)
GOOGLE_MAPS_API_KEY = "AIzaSyB4QJhSxEL-9qJz6Qaqvu_BVDBErBOiTY4"
WEATHER_API_KEY = "b9fa05a49149f30d1866cce6e006fbe9"

@app.get("/")
def home():
    return {"message": "AI Snow Route Finder API is running"}

@app.get("/weather/{city}")
def get_weather(city: str):
    """Fetch real-time weather data"""
    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={WEATHER_API_KEY}&units=metric"
    response = requests.get(url)
    return response.json()

@app.get("/routes")
def get_routes(start: str, end: str):
    """Fetch route data from Google Maps API"""
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={start}&destination={end}&key={GOOGLE_MAPS_API_KEY}"
    response = requests.get(url)
    return response.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


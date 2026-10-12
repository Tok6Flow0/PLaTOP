export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm';
export type WeatherPhase = 'day' | 'night' | 'dawn' | 'dusk';
export interface WindowWeather {
  condition: WeatherCondition;
  phase: WeatherPhase;
  isDay: boolean;
  temperature: number;
  precipitation: number;
  cloudCover: number;
  rainIntensity: number;
  observedAt: string;
  fetchedAt: string;
  source: 'Open-Meteo';
}
export interface WeatherLocation { name: string; latitude: number; longitude: number }
export interface WindowWeatherController {
  weather: WindowWeather | null;
  location: WeatherLocation | null;
  status: 'off' | 'loading' | 'ready' | 'unavailable';
  error: string | null;
  requestingLocation: boolean;
  lookupCity(query: string): Promise<WeatherLocation[]>;
  chooseLocation(location: WeatherLocation): void;
  useDeviceLocation(): void;
  clearLocation(): void;
}

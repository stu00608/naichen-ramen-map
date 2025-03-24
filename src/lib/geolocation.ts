// src/lib/geolocation.ts
import { useState, useEffect } from 'react';

// Default locations for each country
export const COUNTRY_DEFAULTS = {
  TW: { // Taiwan
    latitude: 23.6978,
    longitude: 120.9605,
    zoom: 7 // Country-level zoom
  },
  JP: { // Japan
    latitude: 36.2048,
    longitude: 138.2529,
    zoom: 5 // Country-level zoom
  },
  TAIPEI: { // Taipei city
    latitude: 25.0330,
    longitude: 121.5654, 
    zoom: 11
  },
  TOKYO: { // Tokyo city
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 10
  }
};

// Using a free IP geolocation API
export const getLocationFromIP = async (): Promise<{
  country?: string;
  latitude?: number;
  longitude?: number;
}> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      country: data.country_code,
      latitude: data.latitude,
      longitude: data.longitude
    };
  } catch (error) {
    console.error('Error fetching location from IP:', error);
    return {}; // Return empty object if API fails
  }
};

// Get user location with fallbacks
export const getUserLocation = async (): Promise<{
  latitude: number;
  longitude: number;
  zoom: number;
}> => {
  // Try browser geolocation first
  if (navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        zoom: 13 // User's precise location gets higher zoom
      };
    } catch (error) {
      console.log('Geolocation permission denied or error:', error);
      // Fall through to IP geolocation
    }
  }
  
  // Try IP geolocation as fallback
  try {
    const ipLocation = await getLocationFromIP();
    
    if (ipLocation.country) {
      // If we got a country, use country-specific defaults
      if (ipLocation.country === 'TW') {
        return COUNTRY_DEFAULTS.TW;
      } else if (ipLocation.country === 'JP') {
        return COUNTRY_DEFAULTS.JP;
      } else if (ipLocation.latitude && ipLocation.longitude) {
        // If we have coordinates but not TW/JP, use them with a default zoom
        return {
          latitude: ipLocation.latitude,
          longitude: ipLocation.longitude,
          zoom: 10
        };
      }
    }
  } catch (error) {
    console.error('IP geolocation failed:', error);
    // Fall through to default
  }
  
  // Default to Japan if all else fails
  return COUNTRY_DEFAULTS.JP;
};

// React hook for getting user location
export const useUserLocation = () => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const userLocation = await getUserLocation();
        setLocation(userLocation);
      } catch (err) {
        setError('Could not determine location');
        // Default to Japan
        setLocation(COUNTRY_DEFAULTS.JP);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, []);

  return { location, loading, error };
};
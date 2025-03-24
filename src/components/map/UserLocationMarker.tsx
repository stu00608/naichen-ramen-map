'use client';

import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { MapPin, Navigation } from 'lucide-react';

interface UserLocationMarkerProps {
  onLocationUpdate?: (location: { latitude: number; longitude: number }) => void;
}

export default function UserLocationMarker({ onLocationUpdate }: UserLocationMarkerProps) {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to get the user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('您的瀏覽器不支援定位功能');
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(newLocation);
        setIsLocating(false);
        
        // Notify parent component of location update
        if (onLocationUpdate) {
          onLocationUpdate(newLocation);
        }
      },
      (err) => {
        setError(`無法獲取您的位置: ${err.message}`);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Get user location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // If we don't have the user's location yet, don't render anything
  if (!userLocation) return null;

  return (
    <Marker 
      longitude={userLocation.longitude} 
      latitude={userLocation.latitude}
      anchor="center"
    >
      <div className="relative flex items-center justify-center">
        {/* Outer pulse animation */}
        <div className="absolute w-8 h-8 bg-primary/20 rounded-full animate-ping" />
        
        {/* Middle ring */}
        <div className="absolute w-6 h-6 bg-primary/40 rounded-full" />
        
        {/* Inner circle with icon */}
        <div className="relative w-4 h-4 bg-primary rounded-full flex items-center justify-center z-10">
          <Navigation className="h-3 w-3 text-white" />
        </div>
      </div>
    </Marker>
  );
}
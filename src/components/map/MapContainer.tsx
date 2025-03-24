// src/components/map/MapContainer.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { collection, query, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shop } from '@/types';
import { mapStyle, getMarkerColor, getBoundingViewport } from '@/lib/mapbox';
import { getUserLocation, COUNTRY_DEFAULTS } from '@/lib/geolocation';
import { useIsMobile } from '@/hooks/use-mobile';
import MapControls from './MapControls';
import SearchResults from './SearchResults';
import UserLocationMarker from './UserLocationMarker';
import 'mapbox-gl/dist/mapbox-gl.css';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define sidebar width for desktop view
const SIDEBAR_WIDTH = 450;

interface Review {
  id: string;
  title: string;
  content: string;
  rating: number;
  shopId: string;
  shopName: string;
  userId: string;
  userName: string;
  createdAt: any;
}

interface SearchCache {
  query: string;
  shops: Shop[];
  reviews: Review[];
  timestamp: number;
}

const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds

const MapContainer = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLocationLoading, setInitialLocationLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [viewport, setViewport] = useState(COUNTRY_DEFAULTS.JP); // Default to Japan, will be updated
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const mapRef = useRef<any>(null);
  const isMobile = useIsMobile();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    shops: [] as Shop[],
    reviews: [] as Review[]
  });
  
  // Search cache for storing previous searches
  const [searchCache, setSearchCache] = useState<SearchCache[]>([]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine initial map location using our enhanced geolocation system
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        setInitialLocationLoading(true);
        const location = await getUserLocation();
        setViewport(location);
      } catch (error) {
        console.error('Failed to get initial location:', error);
        // Fallback to Japan if all location methods fail
        setViewport(COUNTRY_DEFAULTS.JP);
      } finally {
        setInitialLocationLoading(false);
      }
    };

    getInitialLocation();
  }, []);

  // 獲取店家資料
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const q = query(collection(db, 'shops'));
        const querySnapshot = await getDocs(q);
        
        const shopsData: Shop[] = [];
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop);
        });
        
        setShops(shopsData);
      } catch (error) {
        console.error("Error fetching shops:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  // 獲取評論資料
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        
        const reviewsData: Review[] = [];
        querySnapshot.forEach((doc) => {
          reviewsData.push({ id: doc.id, ...doc.data() } as Review);
        });
        
        setReviews(reviewsData);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  // 處理使用者位置更新
  const handleLocationUpdate = useCallback((location: { latitude: number; longitude: number }) => {
    setUserLocation(location);
    
    // If we're still using the default location, update to user's location
    if (initialLocationLoading) {
      setViewport({
        latitude: location.latitude,
        longitude: location.longitude,
        zoom: 15 // 使用者位置通常使用較高的縮放級別
      });
      setInitialLocationLoading(false);
    }
  }, [initialLocationLoading]);

  // Check cache for existing search results
  const checkCache = (query: string): { shops: Shop[], reviews: Review[] } | null => {
    const now = Date.now();
    const cachedSearch = searchCache.find(cache => 
      cache.query.toLowerCase() === query.toLowerCase() && 
      (now - cache.timestamp) < CACHE_EXPIRY
    );
    
    return cachedSearch ? { shops: cachedSearch.shops, reviews: cachedSearch.reviews } : null;
  };

  // Add results to cache
  const addToCache = (query: string, shops: Shop[], reviews: Review[]) => {
    // Remove old cache entries first
    const now = Date.now();
    const updatedCache = searchCache
      .filter(cache => (now - cache.timestamp) < CACHE_EXPIRY)
      .filter(cache => cache.query.toLowerCase() !== query.toLowerCase());
    
    // Add new entry
    setSearchCache([
      ...updatedCache,
      { query, shops, reviews, timestamp: now }
    ]);
  };

  // 搜尋功能
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults({ shops: [], reviews: [] });
      return;
    }

    // Check cache first
    const cachedResults = checkCache(query);
    if (cachedResults) {
      setSearchResults(cachedResults);
      
      // Always ensure sidebar is open
      if (!isResultsOpen) {
        setIsResultsOpen(true);
      }
      
      // Adjust map to show results
      if (cachedResults.shops.length > 0) {
        fitMapToShops(cachedResults.shops, false);
      }
      
      return;
    }

    const lowerQuery = query.toLowerCase();
    
    // 搜尋店家
    const matchedShops = shops.filter(shop => 
      shop.name.toLowerCase().includes(lowerQuery) || 
      shop.address.toLowerCase().includes(lowerQuery) ||
      shop.region.toLowerCase().includes(lowerQuery) ||
      shop.shop_types.some(type => type.toLowerCase().includes(lowerQuery))
    );
    
    // 搜尋評論
    const matchedReviews = reviews.filter(review => 
      review.title?.toLowerCase().includes(lowerQuery) || 
      review.content?.toLowerCase().includes(lowerQuery) ||
      review.shopName?.toLowerCase().includes(lowerQuery)
    );
    
    const results = {
      shops: matchedShops,
      reviews: matchedReviews
    };
    
    setSearchResults(results);
    
    // Add to cache
    addToCache(query, matchedShops, matchedReviews);

    // Always ensure sidebar is open
    if (!isResultsOpen) {
      setIsResultsOpen(true);
    }

    // 當有搜尋結果時，自動調整地圖視圖以顯示所有結果
    if (matchedShops.length > 0) {
      fitMapToShops(matchedShops, false);
    }
  };

  // Simplified fitMapToShops function that centers the map on selected shops
  const fitMapToShops = (shopsToShow: Shop[], toggleSidebar = true) => {
    if (!shopsToShow.length) return;

    // If toggleSidebar is true and sidebar is closed, open it
    if (toggleSidebar && !isResultsOpen) {
      setIsResultsOpen(true);
    }

    // Calculate the center point of all shops
    const sumLat = shopsToShow.reduce((sum, shop) => sum + shop.location.latitude, 0);
    const sumLng = shopsToShow.reduce((sum, shop) => sum + shop.location.longitude, 0);
    const centerLat = sumLat / shopsToShow.length;
    const centerLng = sumLng / shopsToShow.length;

    // Calculate appropriate zoom level based on the number of shops
    let zoom = shopsToShow.length === 1 ? 15 : 13;

    // Update viewport state
    setViewport({
      latitude: centerLat,
      longitude: centerLng,
      zoom: zoom
    });

    // Use smooth transition with flyTo
    if (mapRef.current && mapRef.current.flyTo) {
      mapRef.current.flyTo({
        center: [centerLng, centerLat],
        zoom: zoom,
        duration: 1200
      });
    }
  };

  // 處理店家選擇
  const handleSelectShop = (shop: Shop | null) => {
    setSelectedShop(shop);
    
    if (!shop) return;
    
    if (mapRef.current && mapRef.current.flyTo) {
      mapRef.current.flyTo({
        center: [shop.location.longitude, shop.location.latitude],
        zoom: 16, // Higher zoom level for single shop view
        duration: 1000
      });
    }
  };

  // 處理搜尋結果視窗的切換
  const toggleResults = () => {
    const newIsOpen = !isResultsOpen;
    setIsResultsOpen(newIsOpen);
    
    // 如果側邊欄狀態改變且有選中的店家或搜尋結果，重新調整地圖視圖
    if (selectedShop) {
      // 短暫延遲以等待側邊欄開關動畫
      setTimeout(() => {
        handleSelectShop(selectedShop);
      }, 50);
    } else if (searchResults.shops.length > 0) {
      setTimeout(() => {
        fitMapToShops(searchResults.shops, false);
      }, 50);
    }
  };

  // 處理地圖移動
  const handleMapMove = (evt: ViewStateChangeEvent) => {
    setViewport({
      latitude: evt.viewState.latitude,
      longitude: evt.viewState.longitude,
      zoom: evt.viewState.zoom
    });
  };

  // Calculate map container style based on mobile mode and sidebar state
  const getMapContainerStyle = (): React.CSSProperties => {
    if (isMobile && isResultsOpen) {
      // For mobile with sidebar open, map has 1/3 of the height at the bottom
      return { width: '100%', height: '34vh', position: 'absolute' as const, bottom: 0 };
    }
    else if (!isMobile && isResultsOpen) {
      // For desktop with sidebar open, map takes the full height but with a margin
      return { width: `calc(100% - ${SIDEBAR_WIDTH}px)`, height: '100%', marginLeft: `${SIDEBAR_WIDTH}px` };
    }
    // Default case: full screen
    return { width: '100%', height: '100%', position: 'absolute' as const };
  };

  return (
    <div className="h-screen w-full relative bg-background">
      {loading || initialLocationLoading ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-foreground">載入資料中...</p>
        </div>
      ) : (
        <>
          <Map
            ref={mapRef}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
            initialViewState={viewport}
            onMove={handleMapMove}
            style={getMapContainerStyle()}
            mapStyle={mapStyle}
            attributionControl={false}
          >
            <NavigationControl position="top-right" />
            
            {/* 顯示用戶位置 */}
            <UserLocationMarker onLocationUpdate={handleLocationUpdate} />
            
            {/* 顯示店家標記 */}
            {shops.map((shop) => (
              <Marker
                key={shop.id}
                latitude={shop.location.latitude}
                longitude={shop.location.longitude}
                color={getMarkerColor(80)} // Default color instead of using rating
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handleSelectShop(shop);
                }}
              />
            ))}
            
            {/* 顯示選中店家的詳細信息 */}
            {selectedShop && (
              <Popup
                latitude={selectedShop.location.latitude}
                longitude={selectedShop.location.longitude}
                closeOnClick={false}
                onClose={() => setSelectedShop(null)}
                anchor="bottom"
                className="rounded-md shadow-lg z-10 p-0 overflow-hidden"
                closeButton={false}
              >
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedShop(null)} 
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground p-1 z-10"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                  
                  <div className="p-3 bg-card text-card-foreground">
                    <h3 className="font-bold">{selectedShop.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedShop.address}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedShop.shop_types.map((type, idx) => (
                        <span key={idx} className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                          {type}
                        </span>
                      ))}
                      <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                        {selectedShop.region}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            )}
          </Map>
          
          {/* Map Controls - Avatar Menu and Search Bar */}
          <MapControls 
            onSearch={handleSearch} 
            onToggleResults={toggleResults}
            isResultsOpen={isResultsOpen}
          />
          
          {/* Search Results Sidebar */}
          <SearchResults 
            isOpen={isResultsOpen} 
            onClose={() => setIsResultsOpen(false)}
            shopResults={searchResults.shops}
            reviewResults={searchResults.reviews}
            selectedShop={selectedShop}
            onSelectShop={handleSelectShop}
            searchQuery={searchQuery}
          />
        </>
      )}
    </div>
  );
};

export default MapContainer;
// src/components/map/MapContainer.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shop } from '@/types';
import { mapStyle, getMarkerColor } from '@/lib/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapContainer = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [viewport, setViewport] = useState({
    latitude: 25.0330,  // 台北市中心
    longitude: 121.5654,
    zoom: 12
  });

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
        console.error('Error fetching shops:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  return (
    <div className="h-screen w-full">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <p>載入資料中...</p>
        </div>
      ) : (
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
          initialViewState={viewport}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
        >
          <NavigationControl position="top-right" />
          
          {shops.map((shop) => (
            <Marker
              key={shop.id}
              latitude={shop.location.latitude}
              longitude={shop.location.longitude}
              color={getMarkerColor(90)} // 這裡應該使用實際評分
              onClick={() => setSelectedShop(shop)}
            />
          ))}
          
          {selectedShop && (
            <Popup
              latitude={selectedShop.location.latitude}
              longitude={selectedShop.location.longitude}
              closeOnClick={false}
              onClose={() => setSelectedShop(null)}
              anchor="bottom"
            >
              <div className="p-2">
                <h3 className="font-bold">{selectedShop.name}</h3>
                <p className="text-sm">{selectedShop.address}</p>
                {/* FIX: shop_types now has multiple items, think how to display it properly. */}
                <p className="text-sm mt-1">{selectedShop.shop_types[0]} | {selectedShop.region}</p>
              </div>
            </Popup>
          )}
        </Map>
      )}
    </div>
  );
};

export default MapContainer;
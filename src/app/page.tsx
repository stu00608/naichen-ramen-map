// src/app/page.tsx
'use client';

import dynamic from 'next/dynamic';

// 動態載入Map元件，避免SSR問題
const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => <div className="h-screen w-full flex items-center justify-center">載入地圖中...</div>
});

export default function Home() {
  return (
    <main className="min-h-screen">
      <MapContainer />
    </main>
  );
}
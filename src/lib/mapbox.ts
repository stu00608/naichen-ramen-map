// src/lib/mapbox.ts
import { Shop } from '@/types';

// 定義Mapbox樣式URL
export const mapStyle = 'mapbox://styles/mapbox/dark-v11';

// 根據評分獲取標記顏色
export const getMarkerColor = (score: number) => {
  if (score >= 90) return '#4CAF50'; // 綠色
  if (score >= 80) return '#8BC34A'; // 淺綠色
  if (score >= 70) return '#CDDC39'; // 黃綠色
  if (score >= 60) return '#FFEB3B'; // 黃色
  if (score >= 50) return '#FFC107'; // 琥珀色
  if (score >= 40) return '#FF9800'; // 橙色
  return '#F44336'; // 紅色
};

// 計算兩點之間的距離（公里）
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
) => {
  const R = 6371; // 地球半徑，單位為公里
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // 距離，單位為公里
  return d;
};

// 將度數轉換為弧度
const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

// 根據當前位置排序店家
export const sortShopsByDistance = (
  shops: Shop[], 
  currentLat: number, 
  currentLon: number
) => {
  return [...shops].sort((a, b) => {
    const distanceA = calculateDistance(
      currentLat, 
      currentLon, 
      a.location.latitude, 
      a.location.longitude
    );
    const distanceB = calculateDistance(
      currentLat, 
      currentLon, 
      b.location.latitude, 
      b.location.longitude
    );
    return distanceA - distanceB;
  });
};

/**
 * 獲取包含所有標記的最佳視圖範圍
 * @param coordinates 坐標點列表
 * @param sidebarWidth 側邊欄寬度
 * @param containerWidth 容器總寬度
 */
export const getBoundingViewport = (
  coordinates: { latitude: number; longitude: number }[], 
  sidebarWidth = 450,
  containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
) => {
  if (!coordinates.length) return null;
  
  // 如果只有一個點，返回以該點為中心的視圖
  if (coordinates.length === 1) {
    const viewport = {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      zoom: 15, // 單個地點使用較高的縮放級別
    };
    
    return viewport;
  }

  // 找出所有點的最大和最小緯度/經度
  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  // 計算中心點
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // 計算所需的縮放級別（近似）
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  
  
  // 更大的差值決定縮放級別
  const maxDiff = Math.max(latDiff, lngDiff);
  
  // 縮放級別越小，顯示的區域越大
  let zoom = 12; // 預設中等縮放
  
  if (maxDiff > 0.5) zoom = 8;      // 非常大範圍
  else if (maxDiff > 0.2) zoom = 9; // 大範圍
  else if (maxDiff > 0.1) zoom = 10; // 中等範圍
  else if (maxDiff > 0.05) zoom = 11; // 較小範圍
  else if (maxDiff > 0.01) zoom = 12; // 小範圍
  else if (maxDiff > 0.005) zoom = 13; // 更小範圍
  else zoom = 14;                     // 非常小範圍
  
  let viewport = {
    latitude: centerLat,
    longitude: centerLng,
    zoom,
  };
  
  return viewport;
};

/**
 * 計算經度偏移量：基於緯度、縮放級別和需要偏移的比例
 * 在高緯度地區需要更小的經度偏移，在赤道附近需要更大的偏移
 */
const calculateLongitudeOffset = (latitude: number, zoom: number, offsetRatio: number): number => {
  // 經度偏移與緯度餘弦成反比（緯度越高，同樣的經度差對應的實際距離越小）
  const latFactor = 1 / Math.cos(latitude * Math.PI / 180);
  
  // 縮放因子：縮放級別越高，偏移量越小
  // 這個公式基於 Mapbox 的縮放行為，是一個經驗值
  // 每增加一級縮放，地圖寬度顯示的距離縮小一半
  const zoomFactor = Math.pow(2, 13 - zoom); // 基準是 zoom 13
  
  // 基礎偏移量（經驗值）
  const baseOffset = 0.02;
  
  // 計算最終偏移量
  return baseOffset * latFactor * zoomFactor * offsetRatio;
};
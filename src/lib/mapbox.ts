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
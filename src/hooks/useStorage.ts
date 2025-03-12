// src/hooks/useStorage.ts
import { useState } from 'react';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export function useStorage() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 處理圖片尺寸調整
  const resizeImage = async (file: File, maxWidth: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('無法獲取Canvas上下文'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('轉換為Blob失敗'));
            }
          },
          'image/webp',
          0.85 // 壓縮質量
        );
      };
      
      img.onerror = () => {
        reject(new Error('圖片載入失敗'));
      };
    });
  };

  // 上傳檔案到Firebase Storage並記錄到Firestore
  const uploadImage = async (
    file: File, 
    shopId: string, 
    reviewId?: string, 
    isPrimary: boolean = false
  ) => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // 生成唯一檔案名
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      
      // 原圖處理
      const originalBlob = await resizeImage(file, 1200);
      const originalPath = `images/${fileName}`;
      const originalRef = ref(storage, originalPath);
      
      // 縮圖處理
      const thumbnailBlob = await resizeImage(file, 400);
      const thumbnailPath = `images/thumbnails/${fileName}`;
      const thumbnailRef = ref(storage, thumbnailPath);
      
      // 上傳原圖
      const uploadTask = uploadBytesResumable(originalRef, originalBlob);
      
      return new Promise<any>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
          },
          (error) => {
            setError(error.message);
            setLoading(false);
            reject(error);
          },
          async () => {
            try {
              // 上傳縮圖
              await uploadBytesResumable(thumbnailRef, thumbnailBlob);
              
              // 獲取下載URL
              const downloadURL = await getDownloadURL(originalRef);
              const thumbnailURL = await getDownloadURL(thumbnailRef);
              
              setUrl(downloadURL);
              
              // 創建圖片文檔
              const imageData = {
                shop_id: shopId,
                review_id: reviewId || null,
                storage_path: originalPath,
                thumbnail_path: thumbnailPath,
                url: downloadURL,
                thumbnail_url: thumbnailURL,
                is_primary: isPrimary,
                width: originalBlob.size,
                height: thumbnailBlob.size,
                size: file.size,
                created_at: serverTimestamp()
              };
              
              const docRef = await addDoc(collection(db, 'images'), imageData);
              
              setLoading(false);
              resolve({ id: docRef.id, ...imageData });
            } catch (err: any) {
              setError(err.message);
              setLoading(false);
              reject(err);
            }
          }
        );
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  // 刪除圖片
  const deleteImage = async (storagePath: string, imageId: string) => {
    setLoading(true);
    setError(null);

    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
      
      // 這裡應該也要刪除Firestore中的圖片文檔
      // 可以使用之前定義的useFirestore hook
      
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  return {
    progress,
    error,
    url,
    loading,
    uploadImage,
    deleteImage
  };
}
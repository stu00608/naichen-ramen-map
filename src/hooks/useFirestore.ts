// src/hooks/useFirestore.ts
import { useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useFirestore(collectionName: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if document exists by field value
  const checkDocumentExists = async (field: string, value: any) => {
    setLoading(true);
    setError(null);

    try {
      const q = query(collection(db, collectionName), where(field, '==', value), limit(1));
      const querySnapshot = await getDocs(q);
      setLoading(false);
      return !querySnapshot.empty;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  // 添加文檔
  const addDocument = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      setLoading(false);
      return { id: docRef.id, ...data };
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  };

  // 更新文檔
  const updateDocument = async (id: string, data: any) => {
    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  // 刪除文檔
  const deleteDocument = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await deleteDoc(doc(db, collectionName, id));
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  // 獲取單個文檔
  const getDocument = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      setLoading(false);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  };

  // 獲取多個文檔
  const getDocuments = async (constraints: QueryConstraint[] = []) => {
    setLoading(true);
    setError(null);

    try {
      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setLoading(false);
      return documents;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  };

  return {
    loading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    getDocuments,
    checkDocumentExists
  };
}

// 輔助函數，便於使用查詢約束
export const firestoreConstraints = {
  where,
  orderBy,
  limit
};
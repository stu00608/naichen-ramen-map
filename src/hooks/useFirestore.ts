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
  writeBatch,
  runTransaction,
  increment,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useFirestore(collectionName: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify and repair counter for shops collection
  const verifyAndRepairCounter = async () => {
    if (collectionName !== 'shops') {
      setError('Counter verification is only available for shops collection');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the actual count of shops
      const shopsCol = collection(db, 'shops');
      const snapshot = await getCountFromServer(shopsCol);
      const actualCount = snapshot.data().count;

      // Get the current counter value
      const statsRef = doc(db, 'stats', 'shops');
      const statsSnap = await getDoc(statsRef);
      const currentCount = statsSnap.exists() ? (statsSnap.data().total || 0) : 0;

      // If counts match, no repair needed
      if (actualCount === currentCount) {
        setLoading(false);
        return {
          needsRepair: false,
          actualCount,
          previousCount: currentCount
        };
      }

      // Counts don't match, repair needed
      await runTransaction(db, async (transaction) => {
        transaction.set(statsRef, {
          total: actualCount,
          updated_at: Timestamp.now(),
          last_repaired_at: Timestamp.now(),
          previous_count: currentCount
        }, { merge: true });
      });

      setLoading(false);
      return {
        needsRepair: true,
        actualCount,
        previousCount: currentCount,
        repaired: true
      };

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return {
        needsRepair: null,
        error: err.message
      };
    }
  };

  // Check if document exists by field value
  const checkDocumentExists = async (fieldName: string, fieldValue: any) => {
    try {
      const q = query(
        collection(db, collectionName),
        where(fieldName, "==", fieldValue),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (err) {
      console.error("Error checking document existence:", err);
      throw err;
    }
  };

  // Add document with counter update for shops
  const addDocument = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      if (collectionName === 'shops') {
        const batch = writeBatch(db);
        
        // Create new document reference
        const docRef = doc(collection(db, collectionName));
        
        // Add the shop document
        batch.set(docRef, {
          ...data,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        
        // Update the counter
        const statsRef = doc(db, 'stats', 'shops');
        batch.set(statsRef, {
          total: increment(1),
          updated_at: Timestamp.now()
        }, { merge: true });
        
        await batch.commit();
        setLoading(false);
        return { id: docRef.id, ...data };
      } else {
        // Regular document addition for other collections
        const docRef = await addDoc(collection(db, collectionName), {
          ...data,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        setLoading(false);
        return { id: docRef.id, ...data };
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  };

  // Update document (no counter update needed)
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

  // Delete document with counter update for shops
  const deleteDocument = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      if (collectionName === 'shops') {
        await runTransaction(db, async (transaction) => {
          // Delete the shop document
          const docRef = doc(db, collectionName, id);
          transaction.delete(docRef);
          
          // Update the counter
          const statsRef = doc(db, 'stats', 'shops');
          transaction.set(statsRef, {
            total: increment(-1),
            updated_at: Timestamp.now()
          }, { merge: true });
        });
      } else {
        // Regular document deletion for other collections
        await deleteDoc(doc(db, collectionName, id));
      }
      
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
    checkDocumentExists,
    verifyAndRepairCounter
  };
}

// 輔助函數，便於使用查詢約束
export const firestoreConstraints = {
  where,
  orderBy,
  limit
};
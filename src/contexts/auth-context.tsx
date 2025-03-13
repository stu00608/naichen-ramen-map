'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AuthContextType, UserProfile, InviteCode } from '@/types/auth';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
      }
    });

    return () => unsubscribe();
  }, []);

  const validateInviteCode = async (code: string): Promise<InviteCode> => {
    const inviteCodesRef = collection(db, 'inviteCodes');
    const q = query(inviteCodesRef, where('code', '==', code), where('isUsed', '==', false));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Invalid or used invite code');
    }
    
    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    } as InviteCode;
  };

  const createUserProfile = async (firebaseUser: FirebaseUser, inviteCode: InviteCode) => {
    const userProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
      avatar: firebaseUser.photoURL || '',
      role: 'NORMAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);
    
    // Mark invite code as used
    await setDoc(doc(db, 'inviteCodes', inviteCode.id), {
      ...inviteCode,
      isUsed: true,
      usedBy: firebaseUser.uid,
      usedAt: new Date(),
    });

    return userProfile;
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        setUser(userDoc.data() as UserProfile);
      } else {
        throw new Error('User not found. Please sign up first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign in');
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const { user: firebaseUser } = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        setUser(userDoc.data() as UserProfile);
      } else {
        throw new Error('User not found. Please sign up first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during Google sign in');
      throw err;
    }
  };

  const signUp = async (email: string, password: string, inviteCode: string) => {
    try {
      setError(null);
      const validInviteCode = await validateInviteCode(inviteCode);
      
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      const userProfile = await createUserProfile(firebaseUser, validInviteCode);
      setUser(userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign up');
      throw err;
    }
  };

  const signUpWithGoogle = async (inviteCode: string) => {
    try {
      setError(null);
      const validInviteCode = await validateInviteCode(inviteCode);
      
      const provider = new GoogleAuthProvider();
      const { user: firebaseUser } = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        const userProfile = await createUserProfile(firebaseUser, validInviteCode);
        setUser(userProfile);
      } else {
        throw new Error('User already exists. Please sign in instead.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during Google sign up');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign out');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        error,
        signIn,
        signInWithGoogle,
        signUp,
        signUpWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
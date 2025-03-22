'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  linkWithPopup,
  fetchSignInMethodsForEmail,
  AuthErrorCodes,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AuthContextType, UserProfile, InviteCode, AuthMethod } from '@/types/auth';

// Function to get user-friendly error messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/too-many-requests':
      return '登入嘗試次數過多，請稍後再試或使用密碼重設功能';
    case 'auth/wrong-password':
      return '密碼錯誤，請重試';
    case 'auth/user-not-found':
      return '找不到此用戶，請確認電子郵件或註冊新帳號';
    case 'auth/invalid-email':
      return '無效的電子郵件格式';
    case 'auth/email-already-in-use':
      return '此電子郵件已被使用';
    case 'auth/weak-password':
      return '密碼強度太弱，請使用至少6個字符';
    case 'auth/requires-recent-login':
      return '此操作需要重新登入，請登出後重新登入';
    case 'auth/popup-closed-by-user':
      return '登入視窗已關閉，請重試';
    default:
      return '發生錯誤，請稍後再試';
  }
};

// Helper function to set cookies with proper attributes
const setCookie = (name: string, value: string, days = 14) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
  const sameSite = window.location.hostname.includes('vercel.app') ? 'None' : 'Strict';
  
  document.cookie = `${name}=${value}; path=/; expires=${expiryDate.toUTCString()}; SameSite=${sameSite}; ${secure}`;
};

// Helper function to remove cookies
const removeCookie = (name: string) => {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Set up persistent login on mount
  useEffect(() => {
    console.log("Setting up Firebase persistence...");
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("Error setting persistence:", err);
    });
  }, []);

  // Check for stored authentication data (localStorage fallback mechanism)
  useEffect(() => {
    const checkStoredAuth = () => {
      const pendingAuthUID = localStorage.getItem('pendingAuthUID');
      const pendingAuthToken = localStorage.getItem('pendingAuthToken');
      const pendingAuthEmailVerified = localStorage.getItem('pendingAuthEmailVerified');
      const pendingAuthTimestamp = localStorage.getItem('pendingAuthTimestamp');
      
      if (pendingAuthUID && pendingAuthToken) {
        const timestamp = parseInt(pendingAuthTimestamp || '0', 10);
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        
        // Use stored auth data if it's less than 5 minutes old
        if (timestamp > fiveMinutesAgo) {
          console.log("Found valid stored auth data, applying it...");
          
          // Set cookies from stored data
          setCookie('token', pendingAuthToken);
          setCookie('emailVerified', pendingAuthEmailVerified || 'false');
          
          // Clear stored auth data
          localStorage.removeItem('pendingAuthUID');
          localStorage.removeItem('pendingAuthToken');
          localStorage.removeItem('pendingAuthEmailVerified');
          localStorage.removeItem('pendingAuthTimestamp');
          
          // If we're on the login page, redirect to dashboard
          if (window.location.pathname === '/login') {
            window.location.href = `/dashboard?auth=${now}`;
          }
        } else {
          // Clear old auth data
          localStorage.removeItem('pendingAuthUID');
          localStorage.removeItem('pendingAuthToken');
          localStorage.removeItem('pendingAuthEmailVerified');
          localStorage.removeItem('pendingAuthTimestamp');
        }
      }
    };

    checkStoredAuth();
  }, []);

  // Auth state observer setup
  useEffect(() => {
    console.log("Setting up auth state observer...");
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log("Auth state changed: User logged in", firebaseUser.uid);
          
          // Get and set the auth token cookie
          const idToken = await firebaseUser.getIdToken(true);
          setCookie('token', idToken);
          
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            
            // Update Firestore if email verification status has changed
            if (userData.emailVerified !== firebaseUser.emailVerified) {
              await updateDoc(userRef, {
                emailVerified: firebaseUser.emailVerified,
                updatedAt: new Date()
              });

              // If email is newly verified, mark the invite code as used
              if (firebaseUser.emailVerified && userData.inviteCode) {
                const inviteCodeRef = doc(db, 'inviteCodes', userData.inviteCode);
                await updateDoc(inviteCodeRef, {
                  isUsed: true,
                  usedBy: firebaseUser.uid,
                  usedAt: new Date()
                });
              }
            }
            
            // Set email verification cookie
            setCookie('emailVerified', String(firebaseUser.emailVerified));
            
            setUser({
              ...userData,
              emailVerified: firebaseUser.emailVerified
            });
            
            // Check if we're stuck on login page but should be redirected
            if (window.location.pathname === '/login') {
              const authTime = firebaseUser.metadata.creationTime || firebaseUser.metadata.lastSignInTime;
              const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
              
              // If authenticated in the last 5 minutes and on login page, redirect to dashboard
              if (authTime && new Date(authTime).getTime() > fiveMinutesAgo) {
                console.log("Recently authenticated but on login page, redirecting to dashboard");
                window.location.href = `/dashboard?auth=${Date.now()}`;
              }
            }
          }
        } else {
          console.log("Auth state changed: User logged out");
          setUser(null);
          // Remove cookies
          removeCookie('token');
          removeCookie('emailVerified');
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper functions
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

  const createUserProfile = async (
    firebaseUser: FirebaseUser,
    displayName?: string | null,
    inviteCodeId?: string,
    authMethod: AuthMethod = 'password'
  ): Promise<UserProfile> => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const userData: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: displayName || firebaseUser.displayName || null,
        displayName: displayName || firebaseUser.displayName || null,
        avatar: firebaseUser.photoURL,
        role: 'NORMAL',
        isAdmin: false,
        emailVerified: firebaseUser.emailVerified,
        inviteCode: inviteCodeId,
        authMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(userRef, userData);
      return userData;
    }

    const existingData = userSnap.data() as UserProfile;
    const updatedData: UserProfile = {
      ...existingData,
      email: firebaseUser.email,
      displayName: displayName || firebaseUser.displayName || existingData.displayName || null,
      avatar: firebaseUser.photoURL || existingData.avatar,
      emailVerified: firebaseUser.emailVerified,
      updatedAt: new Date(),
    };

    await setDoc(userRef, updatedData, { merge: true });
    return updatedData;
  };

  // Auth methods
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Check sign-in methods for this email first
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      // If user has Google sign-in method, guide them to use it
      if (methods.includes('google.com')) {
        throw new Error('此帳號已使用 Google 登入。請點擊「使用 Google 登入」按鈕。');
      }
      
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
      
      // Set auth token cookie
      const idToken = await firebaseUser.getIdToken(true);
      setCookie('token', idToken);
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        
        // Double check if this account should use Google auth
        if (userData.authMethod === 'google') {
          throw new Error('此帳號已使用 Google 登入。請點擊「使用 Google 登入」按鈕。');
        }

        // Set email verification cookie
        setCookie('emailVerified', String(firebaseUser.emailVerified));

        setUser({
          ...userData,
          emailVerified: firebaseUser.emailVerified
        });
      } else {
        throw new Error('User not found. Please sign up first.');
      }
    } catch (err: any) {
      // Check for specific Firebase error codes
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred during sign in');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setIsLoading(true);
    
      // Ensure persistent login
      await setPersistence(auth, browserLocalPersistence);
    
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
    
      console.log("Starting Google sign-in process");
    
      // SIMPLIFIED: Let Firebase handle the popup directly
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in successful", result.user.uid);
    
      // Set auth token cookie
      const idToken = await result.user.getIdToken(true);
      setCookie('token', idToken);
    
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
      
        // Set email verification cookie
        setCookie('emailVerified', String(result.user.emailVerified));
      
        // Update user state
        setUser({
          ...userData,
          emailVerified: result.user.emailVerified
        });
      
        // Redirect to dashboard
        window.location.href = '/dashboard?auth=' + Date.now();
      } else {
        // New user needs to sign up
        console.log("User authenticated but profile not found, redirecting to signup");
        window.location.href = '/signup?google=1';
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
    
      // Handle popup closed error gracefully
      if (err.code === 'auth/popup-closed-by-user') {
        setError('登入視窗已關閉，請重試');
        return;
      }
    
      // Handle existing account with different auth method
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          setError(`此電子郵件已使用${methods.includes('password') ? '密碼' : '其他'}方式註冊。請使用該方式登入。`);
        } else {
          setError('此帳號已使用其他方式註冊，請使用該方式登入。');
        }
        return;
      }
    
      // General error handling
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'Authentication error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, inviteCode: string, displayName: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const validInviteCode = await validateInviteCode(inviteCode);
        
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Store the invite code ID in the user profile for later use
      const userProfile = await createUserProfile(firebaseUser, displayName, validInviteCode.id, 'password');
      
      // Send email verification
      await sendEmailVerification(firebaseUser);
      
      // Set auth token and email verification cookies
      const idToken = await firebaseUser.getIdToken(true);
      setCookie('token', idToken);
      setCookie('emailVerified', String(firebaseUser.emailVerified));
      
      setUser({
        ...userProfile,
        emailVerified: firebaseUser.emailVerified
      });
    } catch (err: any) {
      // Special handling for email-already-in-use error
      if (err.code === AuthErrorCodes.EMAIL_EXISTS) {
        setError('此電子郵件已註冊，或者請嘗試用相同Google帳號註冊');
        throw new Error('此電子郵件已註冊，或者請嘗試用相同Google帳號註冊');
      }
      
      // Check for specific Firebase error codes
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred during sign up');
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = async (inviteCode: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Validate invite code first
      const validInviteCode = await validateInviteCode(inviteCode);
      
      // Use same approach for both environments - consistent popup method
      console.log("Starting Google signup with invite code");
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const popupWindow = window.open('about:blank', 'googleAuthPopup', 
        'width=500,height=600,top=50,left=50');
      
      if (!popupWindow) {
        throw new Error("彈出視窗被阻擋，請允許彈出視窗後再試一次");
      }
      
      // Show loading message in popup
      popupWindow.document.write(`
        <html>
          <head>
            <title>Google 註冊</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .loader { border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .container { text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="loader"></div>
              <h3>Google 註冊中，請稍候...</h3>
            </div>
          </body>
        </html>
      `);
      
      // Handle authentication in popup
      setTimeout(async () => {
        try {
          const result = await signInWithPopup(auth, provider);
          const userDoc = await getDoc(doc(db, 'users', result.user.uid));
          
          if (userDoc.exists()) {
            popupWindow.close();
            throw new Error('此帳號已存在，請直接登入');
          }
          
          const userProfile = await createUserProfile(
            result.user,
            result.user.displayName,
            validInviteCode.id,
            'google'
          );
          
          // Mark invite code as used immediately
          await updateDoc(doc(db, 'inviteCodes', validInviteCode.id), {
            isUsed: true,
            usedBy: result.user.uid,
            usedAt: new Date()
          });
          
          // Set auth token in localStorage for main window
          const idToken = await result.user.getIdToken(true);
          localStorage.setItem('pendingAuthUID', result.user.uid);
          localStorage.setItem('pendingAuthToken', idToken);
          localStorage.setItem('pendingAuthEmailVerified', String(result.user.emailVerified));
          localStorage.setItem('pendingAuthTimestamp', String(Date.now()));
          
          popupWindow.close();
          
          // Redirect main window to dashboard
          window.location.href = '/dashboard?auth=' + Date.now();
        } catch (err: any) {
          console.error("Google signup error in popup:", err);
          popupWindow.close();
          
          // Handle error in main window
          if (err.code) {
            setError(getAuthErrorMessage(err.code));
          } else {
            setError(err instanceof Error ? err.message : 'An error occurred during Google sign up');
          }
        }
      }, 500);
    } catch (err: any) {
      // Check for specific Firebase error codes
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred during Google sign up');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (displayName: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    try {
      setIsLoading(true);
      await updateProfile(auth.currentUser, { displayName });
      const updatedProfile = await createUserProfile(auth.currentUser, displayName);
      setUser(updatedProfile);
    } catch (err: any) {
      if (err.code) {
        throw new Error(getAuthErrorMessage(err.code));
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      if (err.code) {
        throw new Error(getAuthErrorMessage(err.code));
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await firebaseSignOut(auth);
      setUser(null);
      
      // Clear auth cookies
      removeCookie('token');
      removeCookie('emailVerified');
    } catch (err: any) {
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred during sign out');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const linkGoogleAccount = async () => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in');
    }

    if (!auth.currentUser.email) {
      throw new Error('Current user has no email address');
    }

    try {
      setError(null);
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      
      try {
        // Get the Google account email before linking
        const result = await signInWithPopup(auth, provider);
        
        // Verify email matches
        if (result.user.email !== auth.currentUser.email) {
          throw new Error('Google 帳號的電子郵件必須與目前帳號相同');
        }

        // Update user profile with Google info and auth method
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          avatar: result.user.photoURL,
          authMethod: 'google',
          updatedAt: new Date()
        });

        // Update local user state
        if (user) {
          setUser({
            ...user,
            avatar: result.user.photoURL,
            authMethod: 'google'
          });
        }

        return true;
      } catch (err: any) {
        // Handle the case where the Google account is already linked to another account
        if (err.code === 'auth/credential-already-in-use') {
          throw new Error('此 Google 帳號已連結至其他帳號');
        }
        
        // Check for specific Firebase error codes
        if (err.code) {
          throw new Error(getAuthErrorMessage(err.code));
        }
        
        throw err;
      }
    } catch (err: any) {
      if (err.code) {
        setError(getAuthErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred while linking Google account');
      }
      throw err;
    } finally {
      setIsLoading(false);
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
        updateUserProfile,
        sendPasswordReset,
        linkGoogleAccount,
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
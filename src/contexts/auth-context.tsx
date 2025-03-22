'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  unlink,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AuthContextType, UserProfile, InviteCode, AuthMethod } from '@/types/auth';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

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

// Helper to detect production environment
const isProductionEnvironment = () => {
  return process.env.NODE_ENV === 'production' || 
         window.location.hostname.includes('vercel.app');
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Initialize Firebase persistence
  useEffect(() => {
    // Set persistent login
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("Error setting persistence:", err);
    });
  }, []);

  // Now modify your handleRedirectResult function
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // First check if we're in a pending auth state
        const isPendingAuth = sessionStorage.getItem('pendingGoogleAuth');
    
        console.log("Checking for redirect result...", { isPendingAuth });
    
        // Set a flag to prevent multiple redirect attempts
        let redirectHandled = false;
    
        // NEW: First check if we're already logged in
        const currentUser = auth.currentUser;
        console.log("Current Firebase user:", currentUser?.uid);
        
        // Check for redirect result
        const result = await getRedirectResult(auth).catch(err => {
          console.error("Error getting redirect result:", err);
          return null;
        });
        
        // NEW: Prioritize current user over redirect result
        const firebaseUser = result?.user || currentUser;
    
        if (firebaseUser) {
          console.log("Authentication user found:", firebaseUser.uid);
          
          // IMPORTANT: Remove pending auth flag immediately
          sessionStorage.removeItem('pendingGoogleAuth');
      
          // Get and set the auth token cookie with a long expiration
          const idToken = await firebaseUser.getIdToken(true); // Force refresh
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 14); // 14 days
      
          document.cookie = `token=${idToken}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
      
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
        
            // Update user state
            setUser({
              ...userData,
              emailVerified: firebaseUser.emailVerified
            });
        
            // Set email verification cookie with the same expiration
            document.cookie = `emailVerified=${firebaseUser.emailVerified}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
        
            console.log("User data retrieved, login successful");
            
            // NEW: Break redirect loop by using a special flag in sessionStorage
            if (window.location.pathname === '/login') {
              sessionStorage.setItem('forceBreakRedirectLoop', 'true');
              
              // Add a short delay to ensure cookies are processed
              await new Promise(resolve => setTimeout(resolve, 800));
              
              console.log("Redirecting to dashboard from login page");
              redirectHandled = true;
              window.location.href = `/dashboard?auth=${Date.now()}`;
            }
          } else {
            // Handle existing code for users without profiles...
            console.log("User authenticated but no profile found");
          }
        } else if (isPendingAuth === 'true') {
          console.log("In pending auth state but no user found");
          
          // NEW: Add special case for when we're stuck in a login loop
          const isBreakingLoop = sessionStorage.getItem('forceBreakRedirectLoop');
          if (isBreakingLoop === 'true') {
            console.log("Breaking redirect loop with force flag");
            sessionStorage.removeItem('forceBreakRedirectLoop');
            sessionStorage.removeItem('pendingGoogleAuth');
            
            // Try to navigate to dashboard again as a last resort
            redirectHandled = true;
            window.location.href = `/dashboard?auth=${Date.now()}&force=true`;
            return;
          }
          
          // Just clear the flag and let the middleware handle it
          console.log("Clearing pending auth flag, will try again");
          sessionStorage.removeItem('pendingGoogleAuth');
        }
      } catch (err) {
        console.error("Error handling redirect result:", err);
        sessionStorage.removeItem('pendingGoogleAuth');
        sessionStorage.removeItem('forceBreakRedirectLoop');
        setError(err instanceof Error ? err.message : 'Authentication error from redirect');
      }
    };

    // Check for auth redirect result first
    handleRedirectResult();

    // Then set up the auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get and set the auth token cookie
          const idToken = await firebaseUser.getIdToken();
          document.cookie = `token=${idToken}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
          
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
            
            // Set email verification cookie with secure settings
            document.cookie = `emailVerified=${firebaseUser.emailVerified}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
            
            setUser({
              ...userData,
              emailVerified: firebaseUser.emailVerified
            });
          }
        } else {
          setUser(null);
          // Remove auth and verification cookies
          document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
          document.cookie = 'emailVerified=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
      }
    });

    return () => unsubscribe();
  }, []);

  // Rest of your code remains the same
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
    const userRef = doc(db, "users", firebaseUser.uid)
    const userSnap = await getDoc(userRef)

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
      }

      await setDoc(userRef, userData)
      return userData
    }

    const existingData = userSnap.data() as UserProfile
    const updatedData: UserProfile = {
      ...existingData,
      email: firebaseUser.email,
      displayName: displayName || firebaseUser.displayName || existingData.displayName || null,
      avatar: firebaseUser.photoURL || existingData.avatar,
      emailVerified: firebaseUser.emailVerified,
      updatedAt: new Date(),
    }

    await setDoc(userRef, updatedData, { merge: true })
    return updatedData
  };

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
      const idToken = await firebaseUser.getIdToken();
      document.cookie = `token=${idToken}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        
        // Double check if this account should use Google auth
        if (userData.authMethod === 'google') {
          throw new Error('此帳號已使用 Google 登入。請點擊「使用 Google 登入」按鈕。');
        }

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

  // Modify signInWithGoogle to use persistence
  const signInWithGoogle = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // NEW: Ensure we're using persistent authentication
      await setPersistence(auth, browserLocalPersistence);
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        // Force account selection even if only one account is available
        prompt: 'select_account'
      });
    
      console.log("Starting Google sign-in process");
    
      if (isProductionEnvironment()) {
        console.log("Using redirect method for production environment");
      
        // Set pending auth flag in sessionStorage
        sessionStorage.setItem('pendingGoogleAuth', 'true');
        sessionStorage.removeItem('forceBreakRedirectLoop');
      
        // FIXED: Always redirect to dashboard after successful Google login
        const redirectPath = '/dashboard'; // Always redirect to dashboard to avoid loops
      
        localStorage.setItem('authRedirectPath', redirectPath);
        console.log("Storing redirect path:", redirectPath);
      
        // Use redirect for production environments (Vercel)
        await signInWithRedirect(auth, provider);
        // This won't return - the page will redirect to Google
        return;
      } else {
        console.log("Using popup method for development environment");
        // Use popup for local development
        const { user: firebaseUser } = await signInWithPopup(auth, provider);
        
        // Set auth token cookie
        const idToken = await firebaseUser.getIdToken();
        document.cookie = `token=${idToken}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
        
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          
          // If user exists but was created with password, prevent Google sign-in
          if (userData.authMethod === 'password') {
            throw new Error('此帳號已使用密碼註冊。請使用密碼登入。');
          }
          
          setUser({
            ...userData,
            emailVerified: firebaseUser.emailVerified
          });
        } else {
          // Check if email is already used with password auth
          const methods = await fetchSignInMethodsForEmail(auth, firebaseUser.email!);
          if (methods.includes('password')) {
            throw new Error('此電子郵件已使用密碼註冊。請使用密碼登入。');
          }
          
          // New user attempting to sign in with Google
          throw new Error('NEEDS_INVITE_CODE');
        }
      }
    } catch (err: any) {
      sessionStorage.removeItem('pendingGoogleAuth');
      // Handle the case where email exists but with different auth method
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          // Get sign in methods for this email
          const methods = await fetchSignInMethodsForEmail(auth, email);
          throw new Error(`此電子郵件已使用${methods.includes('password') ? '密碼' : '其他'}方式註冊。請使用該方式登入。`);
        }
      }
      
      // Check for specific Firebase error codes
      if (err.code) {
        console.error("Google sign-in error code:", err.code);
        setError(getAuthErrorMessage(err.code));
      } else {
        console.error("Google sign-in error:", err);
        setError(err instanceof Error ? err.message : 'An error occurred during Google sign in');
      }
      
      throw err;
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
      
      await validateInviteCode(inviteCode);
      
      // In production, use redirect flow
      if (isProductionEnvironment()) {
        console.log("Using redirect method for Google signup in production");
        
        // Store invite code for post-redirect processing
        localStorage.setItem('pendingInviteCode', inviteCode);
        
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
        // This won't return - the page will redirect to Google
        return;
      } else {
        // In development, use popup flow
        const validInviteCode = await validateInviteCode(inviteCode);
        
        const provider = new GoogleAuthProvider();
        const { user: firebaseUser } = await signInWithPopup(auth, provider);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (!userDoc.exists()) {
          const userProfile = await createUserProfile(
            firebaseUser,
            firebaseUser.displayName,
            validInviteCode.id,
            'google'
          );

          // Mark invite code as used immediately since Google accounts are pre-verified
          await updateDoc(doc(db, 'inviteCodes', validInviteCode.id), {
            isUsed: true,
            usedBy: firebaseUser.uid,
            usedAt: new Date()
          });

          setUser({
            ...userProfile,
            emailVerified: firebaseUser.emailVerified
          });
        } else {
          throw new Error('已存在之使用者，請直接登入');
        }
      }
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
export type UserRole = 'NORMAL' | 'ADMIN';
export type AuthMethod = 'password' | 'google';

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  avatar: string | null;
  role: UserRole;
  isAdmin: boolean;
  emailVerified: boolean;
  inviteCode?: string;  // ID of the invite code used for signup
  authMethod: AuthMethod;  // Track how the user was originally created
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteCode {
  id: string;
  code: string;
  createdBy: string;
  createdAt: Date;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
}

export interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, inviteCode: string, displayName: string) => Promise<void>;
  signUpWithGoogle: (inviteCode: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  linkGoogleAccount: () => Promise<boolean>;
} 
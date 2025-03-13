export type UserRole = 'NORMAL' | 'ADMIN';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
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
  signUp: (email: string, password: string, inviteCode: string) => Promise<void>;
  signUpWithGoogle: (inviteCode: string) => Promise<void>;
  signOut: () => Promise<void>;
} 
import { auth } from "@/lib/firebase";
import {
	type User,
	createUserWithEmailAndPassword,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
} from "firebase/auth";
// src/hooks/useAuth.ts
import { useEffect, useState } from "react";

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			setUser(user);
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const login = async (email: string, password: string) => {
		try {
			await signInWithEmailAndPassword(auth, email, password);
			return { success: true };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	};

	const register = async (email: string, password: string) => {
		try {
			await createUserWithEmailAndPassword(auth, email, password);
			return { success: true };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	};

	const logout = async () => {
		try {
			await signOut(auth);
			return { success: true };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	};

	return {
		user,
		loading,
		login,
		register,
		logout,
		isAuthenticated: !!user,
	};
}

"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
	children: React.ReactNode;
	requireAdmin?: boolean;
}

export function ProtectedRoute({
	children,
	requireAdmin = false,
}: ProtectedRouteProps) {
	const { user, isAdmin, isLoading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!isLoading) {
			if (!user) {
				router.push("/login");
			} else if (requireAdmin && !isAdmin) {
				router.push("/");
			}
		}
	}, [user, isAdmin, isLoading, requireAdmin, router]);

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!user || (requireAdmin && !isAdmin)) {
		return null;
	}

	return <>{children}</>;
}

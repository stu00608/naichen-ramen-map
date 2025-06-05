// src/app/login/page.tsx
"use client";

import { LoginForm } from "@/components/login-form";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && user) {
			router.push("/dashboard");
		}
	}, [user, loading, router]);

	if (loading || user) {
		return (
			<div className="container flex h-screen w-screen flex-col items-center justify-center">
				<p>Loading...</p>
			</div>
		);
	}

	return (
		<div className="container flex h-screen w-screen flex-col items-center justify-center">
			<LoginForm />
		</div>
	);
}

"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { auth } from "@/lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { ExternalLink, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function VerifyEmailNoticePage() {
	const { user, isLoading } = useAuth();
	const router = useRouter();

	// If user is already verified or not logged in, redirect
	useEffect(() => {
		if (!isLoading) {
			if (!user) {
				// Not logged in
				router.push("/login");
			} else if (user.emailVerified) {
				// Already verified, go to dashboard
				router.push("/dashboard");
			}
		}
	}, [user, isLoading, router]);

	const handleResendVerification = async () => {
		try {
			if (!user) return;

			// Send verification using Firebase auth
			const currentUser = auth.currentUser;
			if (currentUser) {
				await sendEmailVerification(currentUser);
				toast.success("驗證信已重新發送，請檢查您的收件箱");
			} else {
				toast.error("無法找到當前用戶");
			}
		} catch (err) {
			console.error("Error sending verification email:", err);
			toast.error("發送驗證信時發生錯誤");
		}
	};

	const handleClose = () => {
		window.close();
		// Fallback if window.close() doesn't work
		router.push("/");
	};

	if (isLoading || !user || user.emailVerified) {
		return (
			<div className="container flex h-screen w-screen flex-col items-center justify-center">
				<Card className="w-full max-w-[450px]">
					<CardContent className="pt-6">
						<div className="flex justify-center">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
						<p className="mt-4 text-center text-sm text-muted-foreground">
							處理中...
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container flex h-screen w-screen flex-col items-center justify-center">
			<Card className="w-full max-w-[450px]">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">請驗證您的電子郵件</CardTitle>
					<CardDescription>
						在開始使用所有功能之前，請先驗證您的電子郵件
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-6">
					<div className="rounded-full bg-primary/10 p-4">
						<Mail className="h-10 w-10 text-primary" />
					</div>
					<div className="text-center">
						<p className="mb-2">我們已發送驗證郵件至：</p>
						<p className="font-medium">{user.email}</p>
						<p className="mt-4 text-sm text-muted-foreground">
							請點擊郵件中的驗證連結來完成驗證程序。
							如果您沒有收到郵件，請檢查您的垃圾郵件資料夾或點擊下方按鈕重新發送。
						</p>
					</div>
					<Button
						variant="outline"
						className="flex items-center gap-2"
						onClick={handleResendVerification}
					>
						重新發送驗證信
					</Button>
				</CardContent>
				<CardFooter className="flex flex-col gap-4">
					<Button
						variant="default"
						className="w-full flex items-center gap-2"
						onClick={() => window.open("https://mail.google.com", "_blank")}
					>
						<ExternalLink className="h-4 w-4" />
						前往 Gmail
					</Button>
					<Button variant="ghost" className="w-full" onClick={handleClose}>
						關閉此頁面
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

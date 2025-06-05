"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function SignUpForm({
	className,
	...props
}: React.ComponentPropsWithoutRef<"div">) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [inviteCode, setInviteCode] = useState("");
	const [error, setError] = useState("");
	const { signUp, signUpWithGoogle, isLoading } = useAuth();
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (
			!email ||
			!password ||
			!passwordConfirm ||
			!inviteCode ||
			!displayName
		) {
			setError("請填寫所有必填欄位");
			return;
		}

		if (password !== passwordConfirm) {
			setError("密碼不一致");
			return;
		}

		if (password.length < 6) {
			setError("密碼長度至少需要 6 個字元");
			return;
		}

		try {
			await signUp(email, password, inviteCode, displayName);
			toast.success("註冊成功！請查收驗證信");
			router.push("/verify/notice");
		} catch (err) {
			setError(err instanceof Error ? err.message : "註冊失敗");
		}
	};

	const handleGoogleSignUp = async () => {
		if (!inviteCode) {
			setError("請填寫邀請碼");
			return;
		}

		setError("");

		try {
			await signUpWithGoogle(inviteCode);
			toast.success("註冊成功！");
			router.push("/dashboard");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Google 註冊失敗");
		}
	};

	return (
		<div className={cn("flex flex-col gap-6 w-[400px]", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">奶辰拉麵地圖・註冊</CardTitle>
					<CardDescription>使用邀請碼註冊新帳號</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-6 rounded bg-destructive/15 p-3 text-sm text-destructive">
							{error}
						</div>
					)}
					<form onSubmit={handleSubmit}>
						<div className="flex flex-col gap-6">
							<div className="grid gap-2">
								<Label htmlFor="email">電子郵件</Label>
								<Input
									id="email"
									type="email"
									placeholder="m@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="password">密碼</Label>
								<Input
									id="password"
									type="password"
									placeholder="至少 6 個字元"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="password-confirm">確認密碼</Label>
								<Input
									id="password-confirm"
									type="password"
									placeholder="再次輸入密碼"
									value={passwordConfirm}
									onChange={(e) => setPasswordConfirm(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="display-name">名稱</Label>
								<Input
									id="display-name"
									type="text"
									placeholder="您的名稱"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="invite-code">邀請碼</Label>
								<Input
									id="invite-code"
									type="text"
									placeholder="輸入邀請碼"
									value={inviteCode}
									onChange={(e) => setInviteCode(e.target.value)}
									required
								/>
							</div>
							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "註冊中..." : "註冊"}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="w-full"
								disabled={isLoading}
								onClick={handleGoogleSignUp}
							>
								以 Google 註冊
							</Button>
						</div>
						<div className="mt-4 text-center text-sm">
							已經有帳號了？{" "}
							<Link href="/login" className="underline underline-offset-4">
								登入
							</Link>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

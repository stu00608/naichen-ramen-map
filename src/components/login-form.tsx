"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const { signIn, signInWithGoogle, signUpWithGoogle, sendPasswordReset, isLoading } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("請填寫電子郵件和密碼")
      return
    }

    try {
      await signIn(email, password)
      router.push("/dashboard/shops")
    } catch (err: any) {
      // If we get too many requests error, suggest password reset
      if (err?.code === 'auth/too-many-requests') {
        setError('登入嘗試次數過多，請稍後再試或使用密碼重設功能')
        // Pre-fill reset email field
        setResetEmail(email)
      } else {
        setError(err instanceof Error ? err.message : "登入失敗")
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    try {
      await signInWithGoogle()
      router.push("/dashboard/shops")
    } catch (err: any) {
      if (err instanceof Error && err.message === 'NEEDS_INVITE_CODE') {
        setIsInviteDialogOpen(true)
      } else {
        setError(err instanceof Error ? err.message : "Google 登入失敗")
      }
    }
  }

  const handleGoogleSignUpWithInviteCode = async () => {
    if (!inviteCode) {
      setError("請輸入邀請碼")
      return
    }

    try {
      await signUpWithGoogle(inviteCode)
      router.push("/dashboard/shops")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google 註冊失敗")
    } finally {
      setIsInviteDialogOpen(false)
      setInviteCode("")
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) {
      setError("請輸入電子郵件")
      return
    }

    try {
      await sendPasswordReset(resetEmail)
      setSuccess("重設密碼信已發送，請查看您的電子郵件")
      setIsResetDialogOpen(false)
      setResetEmail("")
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "發送重設密碼信失敗")
    }
  }

  // Check if error is related to too many requests
  const isTooManyRequestsError = error.includes('登入嘗試次數過多') || error.includes('too-many-requests')

  return (
    <div className={cn("flex flex-col gap-6 w-[400px]", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">奶辰拉麵地圖・後台管理</CardTitle>
          <CardDescription>
            登入以新增、修改拉麵店及評價資料
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 rounded bg-destructive/15 p-3 text-sm text-destructive">
              {error}
              {isTooManyRequestsError && (
                <div className="mt-2">
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-destructive"
                    onClick={() => {
                      setResetEmail(email)
                      setIsResetDialogOpen(true)
                    }}
                  >
                    點此重設密碼
                  </Button>
                </div>
              )}
            </div>
          )}
          {success && (
            <Alert className="mb-6">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
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
                <div className="flex items-center">
                  <Label htmlFor="password">密碼</Label>
                  <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="ml-auto h-auto p-0">
                        忘記密碼？
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handlePasswordReset}>
                        <DialogHeader>
                          <DialogTitle>重設密碼</DialogTitle>
                          <DialogDescription>
                            輸入您的電子郵件，我們將發送重設密碼連結給您
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="reset-email">電子郵件</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            發送重設密碼信
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "登入中..." : "登入"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
              >
                以 Google 登入
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              還沒有帳號嗎?{" "}
              <Link
                href="/signup"
                className="underline underline-offset-4"
              >
                註冊
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>需要邀請碼</DialogTitle>
            <DialogDescription>
              請輸入邀請碼以完成註冊
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-code">邀請碼</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="輸入邀請碼"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsInviteDialogOpen(false)
                setInviteCode("")
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleGoogleSignUpWithInviteCode}
              disabled={isLoading || !inviteCode}
            >
              {isLoading ? "處理中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
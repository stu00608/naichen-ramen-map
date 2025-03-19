"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth" 
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const oobCode = searchParams.get("oobCode")

  useEffect(() => {
    // If no oobCode, immediately show error state
    if (!oobCode) {
      setError("無效的密碼重設連結")
      setIsVerifying(false)
      return
    }

    async function verifyCode() {
      try {
        const email = await verifyPasswordResetCode(auth, oobCode as string)
        setEmail(email)
        setIsVerifying(false)
      } catch (err) {
        console.error("Password reset code verification error:", err)
        setError("此密碼重設連結已失效或已過期")
        setIsVerifying(false)
      }
    }

    verifyCode()
  }, [oobCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError("密碼不一致")
      return
    }

    if (newPassword.length < 6) {
      setError("密碼長度至少需要 6 個字元")
      return
    }

    if (!oobCode) {
      setError("無效的密碼重設連結")
      return
    }

    setIsLoading(true)
    setError("")
    
    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
      setSuccess("密碼已重設成功！請用新密碼登入。")
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err) {
      console.error("Password reset error:", err)
      setError("重設密碼失敗，請重試")
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              正在驗證您的請求...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Direct access with no oobCode
  if (!oobCode) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className={cn("flex w-full max-w-[400px] flex-col gap-6")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">重設密碼</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <AlertTriangle className="h-16 w-16 text-amber-500" />
                <div className="text-center">
                  <p className="font-semibold">需要有效的重設連結</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    此頁面只能透過電子郵件中的重設密碼連結訪問
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => router.push("/login")}
                className="w-full"
              >
                回到登入頁面
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className={cn("flex w-full max-w-[400px] flex-col gap-6")}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">重設密碼</CardTitle>
            <CardDescription>
              {email && `為 ${email} 設定新密碼`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 rounded bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <Alert className="mb-6">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            {!error || (error && !error.includes("連結已失效")) ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">新密碼</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">確認新密碼</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  設定新密碼
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <Button onClick={() => router.push("/login")} className="w-full">
                  回到登入頁面
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
"use client"

import { useState, useEffect, Suspense } from "react"
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

function ResetPasswordContent() {
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
            <p className="mt-4 text-center">正在驗證密碼重設連結...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle>重設密碼</CardTitle>
          {email && (
            <CardDescription>
              為 <span className="font-medium">{email}</span> 設定新密碼
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-green-50 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-password">新密碼</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={!!success}
                  placeholder="至少 6 個字元"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">確認密碼</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!!success}
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !!success}
                className={cn(isLoading && "opacity-70")}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                重設密碼
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-center">正在載入...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
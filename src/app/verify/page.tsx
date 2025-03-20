"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { 
  applyActionCode, 
  confirmPasswordReset, 
  verifyPasswordResetCode,
  checkActionCode
} from "firebase/auth"
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
} from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Main content that will change based on mode
function AccountActionContent() {
  const [isProcessing, setIsProcessing] = useState(true)
  const [mode, setMode] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const actionMode = searchParams.get("mode")
  const oobCode = searchParams.get("oobCode")

  useEffect(() => {
    if (!oobCode || !actionMode) {
      setError("無效的操作連結")
      setIsProcessing(false)
      return
    }

    setMode(actionMode)

    async function processAction() {
      try {
        // First check the action code to verify it's valid
        const actionInfo = await checkActionCode(auth, oobCode as string)
        
        if (actionMode === "resetPassword") {
          // For password reset, verify the code and get the email
          const email = await verifyPasswordResetCode(auth, oobCode as string)
          setEmail(email)
        }
      } catch (err) {
        console.error("Action code verification error:", err)
        setError(actionMode === "resetPassword" ? "此密碼重設連結已失效或已過期" : "此驗證連結已失效或已過期")
        toast.error(actionMode === "resetPassword" ? "密碼重設連結無效" : "驗證連結無效")
      } finally {
        setIsProcessing(false)
      }
    }

    processAction()
  }, [oobCode, actionMode])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError("密碼不一致")
      toast.error("密碼不一致")
      return
    }

    if (newPassword.length < 6) {
      setError("密碼長度至少需要 6 個字元")
      toast.error("密碼長度至少需要 6 個字元")
      return
    }

    if (!oobCode) {
      setError("無效的密碼重設連結")
      toast.error("無效的密碼重設連結")
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
      toast.error("重設密碼失敗，請重試")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyEmail = async () => {
    try {
      await applyActionCode(auth, oobCode as string)
      setSuccess("您的電子郵件已成功驗證！")
      setIsProcessing(false)
    } catch (err) {
      console.error("Email verification error:", err)
      setError("此驗證連結已失效或已過期")
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (mode === "verifyEmail" && !isProcessing && !error) {
      handleVerifyEmail()
    }
  }, [mode, isProcessing])

  if (isProcessing) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-center">
              {mode === "resetPassword" ? "正在驗證密碼重設連結..." : 
               mode === "verifyEmail" ? "正在驗證您的電子郵件..." :
               "正在處理您的請求..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password Reset UI
  if (mode === "resetPassword") {
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
            {/* {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </AlertDescription>
              </Alert>
            )} */}
            {success ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <div className="text-center">
                  <p className="font-semibold text-green-600">{success}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    請稍候，即將為您重新導向至登入頁面...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset}>
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
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Email Verification UI
  if (mode === "verifyEmail") {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">電子郵件驗證</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex flex-col items-center gap-4">
                  <XCircle className="h-16 w-16 text-destructive" />
                  <div className="text-center">
                    <p className="font-semibold text-destructive">{error}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      請回到應用程式重新發送驗證信
                    </p>
                  </div>
                </div>
              )}
              {success && (
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle2 className="h-16 w-16 text-green-600" />
                  <div className="text-center">
                    <p className="font-semibold text-green-600">{success}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      您現在可以使用所有功能
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <Button 
                  onClick={() => router.push("/dashboard/shops")}
                  className="w-full"
                >
                  進入應用程式
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Fallback for unsupported modes
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-[400px]">
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <p className="mt-4 text-center font-semibold text-destructive">
            {error || "不支援的操作類型"}
          </p>
          <div className="mt-6 flex justify-center">
            <Button 
              onClick={() => router.push("/")}
              variant="outline"
            >
              返回首頁
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AccountActionPage() {
  return (
    <Suspense fallback={
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              正在載入...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <AccountActionContent />
    </Suspense>
  )
}
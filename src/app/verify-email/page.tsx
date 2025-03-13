"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { sendEmailVerification } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (user.emailVerified) {
      router.push("/dashboard/shops")
    }
  }, [user, router])

  const handleResendVerification = async () => {
    if (!auth.currentUser) return

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      await sendEmailVerification(auth.currentUser)
      setSuccess("驗證信已重新發送，請查看您的電子郵件")
    } catch (err) {
      setError("發送驗證信失敗")
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className={cn("flex w-full max-w-[400px] flex-col gap-6")}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">驗證電子郵件</CardTitle>
            <CardDescription>
              我們已發送驗證信至您的電子郵件：{user.email}
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
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">
                請點擊驗證信中的連結以完成驗證。驗證完成後，您將可以使用所有功能。
              </p>
              <Button
                onClick={handleResendVerification}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                重新發送驗證信
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
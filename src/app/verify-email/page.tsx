"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { applyActionCode } from "firebase/auth"
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
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

function VerifyEmailContent() {
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const oobCode = searchParams.get("oobCode")

  useEffect(() => {
    if (!oobCode) {
      setError("無效的驗證連結")
      setIsVerifying(false)
      return
    }

    async function verifyEmail() {
      try {
        await applyActionCode(auth, oobCode as string)
        setSuccess("您的電子郵件已成功驗證！")
        setIsVerifying(false)
      } catch (err) {
        setError("此驗證連結已失效或已過期")
        setIsVerifying(false)
      }
    }

    verifyEmail()
  }, [oobCode])

  if (isVerifying) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              正在驗證您的電子郵件...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className={cn("flex w-full max-w-[400px] flex-col gap-6")}>
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

export default function VerifyEmailActionPage() {
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
      <VerifyEmailContent />
    </Suspense>
  )
}
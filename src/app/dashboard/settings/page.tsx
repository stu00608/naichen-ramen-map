"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dice6, Copy, Check, Loader2, Trash2 } from "lucide-react"
import { collection, addDoc, query, where, getDocs, Timestamp, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { generateRandomCode } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function SettingsPage() {
  const { user, isAdmin } = useAuth()
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteCodes, setInviteCodes] = useState<any[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null)

  // Fetch invite codes
  useEffect(() => {
    if (!isAdmin) return
    
    const fetchInviteCodes = async () => {
      const q = query(
        collection(db, "inviteCodes"),
        where("createdBy", "==", user?.uid)
      )
      const querySnapshot = await getDocs(q)
      const codes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setInviteCodes(codes)
    }

    fetchInviteCodes()
  }, [user?.uid, isAdmin])

  const validateInviteCode = async (code: string): Promise<boolean> => {
    // Check if code exists in database
    const q = query(
      collection(db, "inviteCodes"),
      where("code", "==", code)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.empty // true if code is unique
  }

  const handleGenerateInviteCode = async () => {
    if (!inviteCode) {
      setError("請輸入邀請碼")
      return
    }

    if (inviteCodes.length >= 5) {
      setError("已達到邀請碼上限 (5個)")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      // Check if code is unique
      const isUnique = await validateInviteCode(inviteCode)
      if (!isUnique) {
        setError("此邀請碼已存在，請使用其他邀請碼")
        return
      }
      
      const docRef = await addDoc(collection(db, "inviteCodes"), {
        code: inviteCode,
        createdBy: user?.uid,
        createdAt: Timestamp.now(),
        isUsed: false
      })

      setSuccess("邀請碼已生成")
      setInviteCodes([...inviteCodes, {
        id: docRef.id,
        code: inviteCode,
        createdAt: Timestamp.now(),
        isUsed: false
      }])

      // Copy to clipboard automatically
      await navigator.clipboard.writeText(inviteCode)
      setCopiedCode(inviteCode)
      setTimeout(() => setCopiedCode(null), 2000)
      setInviteCode("")
    } catch (err) {
      setError("生成邀請碼時發生錯誤")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!codeToDelete) return

    try {
      setLoading(true)
      await deleteDoc(doc(db, "inviteCodes", codeToDelete))
      setInviteCodes(inviteCodes.filter(code => code.id !== codeToDelete))
      setSuccess("邀請碼已刪除")
    } catch (err) {
      setError("刪除邀請碼時發生錯誤")
      console.error(err)
    } finally {
      setLoading(false)
      setCodeToDelete(null)
    }
  }

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>帳號資訊</CardTitle>
          <CardDescription>查看您的帳號資訊</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>電子郵件</Label>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
          <div className="space-y-2">
            <Label>名稱</Label>
            <div className="text-sm text-muted-foreground">{user?.name}</div>
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <div className="text-sm text-muted-foreground">{user?.role}</div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>邀請碼管理</CardTitle>
            <CardDescription>生成並管理邀請碼 ({inviteCodes.length}/5)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Dice6 
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" 
                  onClick={() => setInviteCode(generateRandomCode())}
                />
                <Input
                  placeholder="輸入或點擊骰子生成邀請碼"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="pl-8 pr-8 h-10"
                />
              </div>
              <Button 
                onClick={handleGenerateInviteCode} 
                disabled={loading}
                size="default"
                className="h-10"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                生成
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邀請碼</TableHead>
                    <TableHead>建立時間</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-[150px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inviteCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>{code.code}</TableCell>
                      <TableCell>
                        {code.createdAt?.toDate().toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {code.isUsed ? (
                          <span className="text-muted-foreground">已使用</span>
                        ) : (
                          <span className="text-green-600">可使用</span>
                        )}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code.code)}
                          className="h-8 w-8 p-0"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {!code.isUsed && (
                          <AlertDialog open={codeToDelete === code.id} onOpenChange={(open) => !open && setCodeToDelete(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive/90"
                                onClick={() => setCodeToDelete(code.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確定要刪除此邀請碼嗎？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作無法復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setCodeToDelete(null)}>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDelete}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  確定刪除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
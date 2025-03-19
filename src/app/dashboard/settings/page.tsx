"use client"

import { useState, useEffect, useRef, KeyboardEvent as ReactKeyboardEvent } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dice6, Copy, Check, Loader2, Trash2, Shield, ShieldOff, HelpCircle, Search, X } from "lucide-react"
import { collection, addDoc, query, where, getDocs, Timestamp, deleteDoc, doc, updateDoc, runTransaction, limit, orderBy, startAt, endAt } from "firebase/firestore"
import { sendEmailVerification } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { generateRandomCode } from "@/lib/utils"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { UserProfile, UserRole } from "@/types/auth"

export default function SettingsPage() {
  const { user, isAdmin, updateUserProfile, linkGoogleAccount } = useAuth()
  const [inviteCode, setInviteCode] = useState("")
  const [inviteCodes, setInviteCodes] = useState<any[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(user?.displayName || "")
  const [isLoading, setIsLoading] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [userToUpdate, setUserToUpdate] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [totalResults, setTotalResults] = useState<number>(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchBy, setSearchBy] = useState<'displayName' | 'email'>('displayName')
  const itemsPerPage = 10 // Fixed page size for user results

  // No initial data load - we'll search instead
  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName)
    }
  }, [user?.displayName])

  // Fetch invite codes for current user
  useEffect(() => {
    if (!isAdmin || !user?.uid) return
    
    const fetchInviteCodes = async () => {
      try {
        const inviteCodesRef = collection(db, "inviteCodes")
        const q = query(
          inviteCodesRef, 
          where("createdBy", "==", user.uid),
          where("isUsed", "==", false)
        )
        const querySnapshot = await getDocs(q)
        const inviteCodesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setInviteCodes(inviteCodesData)
      } catch (err) {
        console.error("Error fetching invite codes:", err)
        toast.error("載入邀請碼時發生錯誤")
      }
    }
    fetchInviteCodes()
  }, [isAdmin, user?.uid])

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
      toast.error("請輸入邀請碼")
      return
    }
    if (inviteCodes.length >= 5) {
      toast.error("已達到可用邀請碼上限 (5個)")
      return
    }
    try {
      setLoading(true)
      // Check if code is unique
      const isUnique = await validateInviteCode(inviteCode)
      if (!isUnique) {
        toast.error("此邀請碼已存在，請使用其他邀請碼")
        return
      }
      
      const docRef = await addDoc(collection(db, "inviteCodes"), {
        code: inviteCode,
        createdBy: user?.uid,
        createdAt: Timestamp.now(),
        isUsed: false
      })
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
      toast.success("邀請碼已生成並複製到剪貼簿")
    } catch (err) {
      toast.error("生成邀請碼時發生錯誤")
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
      toast.success("邀請碼已刪除")
    } catch (err) {
      toast.error("刪除邀請碼時發生錯誤")
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
      toast.success("已複製到剪貼簿")
    } catch (err) {
      toast.error("複製失敗")
      console.error("Failed to copy:", err)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error("請輸入名稱")
      return
    }
    setIsLoading(true)
    try {
      await updateUserProfile(displayName)
      toast.success("名稱更新成功")
    } catch (err) {
      toast.error("更新失敗")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    try {
      setLoading(true)
      await sendEmailVerification(auth.currentUser!)
      toast.success("驗證信已重新發送")
    } catch (err) {
      toast.error("發送驗證信時發生錯誤")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      toast.error("請輸入搜尋內容")
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    
    try {
      const usersRef = collection(db, "users")
      const searchTermLower = searchTerm.toLowerCase()
      
      // Create the query based on search field
      let userQuery
      let countQuery
      
      if (searchBy === 'email') {
        // Email search - we can use range queries for email
        userQuery = query(
          usersRef,
          orderBy("email"),
          startAt(searchTermLower),
          endAt(searchTermLower + '\uf8ff'),
          limit(itemsPerPage)
        )
        
        // Count query for total results (same query without limit)
        countQuery = query(
          usersRef,
          orderBy("email"),
          startAt(searchTermLower),
          endAt(searchTermLower + '\uf8ff')
        )
      } else {
        // Display name search - unfortunately we can't do partial text search directly
        // This would be a good place to implement a searchTokens array like in shops
        // For now, we're using range queries which will work for prefixes
        userQuery = query(
          usersRef,
          orderBy("displayName"),
          startAt(searchTermLower),
          endAt(searchTermLower + '\uf8ff'),
          limit(itemsPerPage)
        )
        
        // Count query for total results (same query without limit)
        countQuery = query(
          usersRef,
          orderBy("displayName"),
          startAt(searchTermLower),
          endAt(searchTermLower + '\uf8ff')
        )
      }
      
      // Get results with pagination
      const querySnapshot = await getDocs(userQuery)
      
      // Count total results
      const countSnapshot = await getDocs(countQuery)
      setTotalResults(countSnapshot.size)
      
      // Process results
      const filteredUsers = querySnapshot.docs
        .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
        .filter(u => u.uid !== user?.uid) // Exclude current user
      
      setUsers(filteredUsers)

      if (filteredUsers.length === 0) {
        toast.info("沒有找到符合條件的用戶")
      } else {
        toast.success(`找到 ${countSnapshot.size} 個用戶`)
      }
    } catch (err) {
      console.error("Error searching users:", err)
      toast.error("搜尋用戶時發生錯誤")
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchTerm("")
    setUsers([])
    setHasSearched(false)
    setTotalResults(0)
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      searchUsers()
    }
  }

  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    if (!isAdmin || userId === user?.uid) return
    try {
      setUserToUpdate(userId)
      
      // Start a transaction to update role and handle invite codes
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", userId)
        const userDoc = await transaction.get(userRef)
        
        if (!userDoc.exists()) {
          throw new Error("User not found")
        }
        const userData = userDoc.data()
        
        // If user is being demoted from ADMIN, delete their invite codes
        if (userData.role === 'ADMIN' && newRole === 'NORMAL') {
          const inviteCodesRef = collection(db, "inviteCodes")
          const q = query(inviteCodesRef, where("createdBy", "==", userId))
          const inviteCodesSnapshot = await getDocs(q)
          
          // Delete each invite code in the transaction
          inviteCodesSnapshot.docs.forEach((doc) => {
            if (!doc.data().isUsed) {  // Only delete unused invite codes
              transaction.delete(doc.ref)
            }
          })
        }
        // Update user role
        transaction.update(userRef, {
          role: newRole,
          updatedAt: new Date()
        })
      })
      // Update local state
      setUsers(users.map(u => 
        u.uid === userId 
          ? { ...u, role: newRole }
          : u
      ))
      toast.success("用戶權限已更新")
    } catch (err) {
      console.error("Error updating user role:", err)
      toast.error("更新用戶權限時發生錯誤")
    } finally {
      setUserToUpdate(null)
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
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="max-w-[300px] h-10"
              />
              <Button 
                onClick={handleUpdateProfile}
                disabled={isLoading || !displayName || displayName === user?.displayName}
                className="h-10"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                更新
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                {user?.role === 'ADMIN' ? '管理員' : '一般用戶'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>電子郵件驗證</Label>
            <div className="text-sm">
              {user?.emailVerified ? (
                <span className="text-green-600">已驗證</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">未驗證</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleResendVerification}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    重新發送驗證信
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Google 帳號連結</Label>
            <div className="text-sm">
              {auth.currentUser?.providerData.some(
                provider => provider.providerId === 'google.com'
              ) ? (
                <span className="text-green-600">已連結</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">未連結</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        try {
                          await linkGoogleAccount()
                          toast.success("Google 帳號連結成功")
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "連結失敗")
                        }
                      }}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      連結 Google 帳號
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>請使用與目前帳號相同電子郵件的 Google 帳號進行連結</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>用戶管理</CardTitle>
              <CardDescription>管理其他用戶的角色</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder='搜尋用戶...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pl-8 pr-8 h-10"
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Select
                    value={searchBy}
                    onValueChange={(value: 'displayName' | 'email') => setSearchBy(value)}
                  >
                    <SelectTrigger className="w-[140px] h-10">
                      <SelectValue placeholder="搜尋欄位" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="displayName">名稱</SelectItem>
                      <SelectItem value="email">電子郵件</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={searchUsers} 
                    disabled={isSearching || !searchTerm.trim()}
                    className="whitespace-nowrap h-10"
                  >
                    {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    搜尋
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchBy === 'displayName' 
                    ? '搜尋用戶名稱（注意：僅支援名稱開頭符合的結果）' 
                    : '搜尋電子郵件（注意：僅支援電子郵件開頭符合的結果）'}
                </p>
              </div>

              {isSearching ? (
                <div className="text-center py-10">
                  <p>搜尋中...</p>
                </div>
              ) : !hasSearched ? (
                <div className="bg-card rounded-lg p-6 text-center">
                  <p className="text-muted-foreground">
                    請輸入搜尋內容進行搜尋
                  </p>
                </div>
              ) : users.length === 0 ? (
                <div className="bg-card rounded-lg p-6 text-center">
                  <p className="text-muted-foreground">
                    沒有符合搜尋條件的用戶
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名稱</TableHead>
                        <TableHead>電子郵件</TableHead>
                        <TableHead>角色</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.uid}>
                          <TableCell>{u.displayName || '未設定'}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.role === 'ADMIN' ? '管理員' : '一般用戶'}
                          </TableCell>
                          <TableCell>
                            <AlertDialog open={userToUpdate === u.uid} onOpenChange={(open) => !open && setUserToUpdate(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setUserToUpdate(u.uid)}
                                  className="h-8"
                                >
                                  {u.role === 'ADMIN' ? (
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                  ) : (
                                    <Shield className="h-4 w-4 mr-2" />
                                  )}
                                  {u.role === 'ADMIN' ? '移除管理員' : '設為管理員'}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    確定要{u.role === 'ADMIN' ? '移除' : '設為'}管理員嗎？
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.role === 'ADMIN' 
                                      ? '此用戶將失去管理員權限。'
                                      : '此用戶將獲得管理員權限。'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUserToUpdate(null)}>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRoleUpdate(u.uid, u.role === 'ADMIN' ? 'NORMAL' : 'ADMIN')}
                                    className={u.role === 'ADMIN' 
                                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      : ""
                                    }
                                  >
                                    確定
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {totalResults > 0 && (
                    <div className="py-4 px-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        顯示 {Math.min(users.length, itemsPerPage)} 筆資料，共 {totalResults} 筆結果
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>邀請碼管理</CardTitle>
              <CardDescription>生成並管理可用邀請碼 ({inviteCodes.length}/5)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Dice6 
                    className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" 
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
                          <span className="text-green-600">可使用</span>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
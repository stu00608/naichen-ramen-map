'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doc, collection, addDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types/auth';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inviteCodes, setInviteCodes] = useState<{ id: string; code: string; isUsed: boolean }[]>([]);

  const loadUsers = async () => {
    if (!isAdmin) return;
    const querySnapshot = await getDocs(collection(db, 'users'));
    setUsers(querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }) as UserProfile));
  };

  const loadInviteCodes = async () => {
    if (!isAdmin) return;
    const querySnapshot = await getDocs(collection(db, 'inviteCodes'));
    setInviteCodes(querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as { code: string; isUsed: boolean }
    })));
  };

  const generateNewInviteCode = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const code = generateInviteCode();
      await addDoc(collection(db, 'inviteCodes'), {
        code,
        createdBy: user!.uid,
        createdAt: new Date(),
        isUsed: false,
      });
      setSuccess('邀請碼已生成');
      loadInviteCodes();
    } catch (err) {
      setError('生成邀請碼時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserRole = async (targetUser: UserProfile) => {
    if (!isAdmin || targetUser.uid === user?.uid) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const newRole = targetUser.role === 'ADMIN' ? 'NORMAL' : 'ADMIN';
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        updatedAt: new Date(),
      });
      setSuccess('用戶權限已更新');
      loadUsers();
    } catch (err) {
      setError('更新用戶權限時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>帳號設定</CardTitle>
          <CardDescription>
            管理你的帳號設定{isAdmin && '和系統設定'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList>
              <TabsTrigger value="profile">個人資料</TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="users">用戶管理</TabsTrigger>
                  <TabsTrigger value="invites">邀請碼</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="profile">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={user?.email} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>名稱</Label>
                  <Input value={user?.name} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>權限</Label>
                  <Input value={user?.role} disabled />
                </div>
              </div>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="users">
                <div className="grid gap-4 py-4">
                  <Button onClick={loadUsers} variant="outline">
                    載入用戶列表
                  </Button>
                  <div className="grid gap-4">
                    {users.map((user) => (
                      <div key={user.uid} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="text-sm text-muted-foreground">權限: {user.role}</div>
                        </div>
                        <Button
                          onClick={() => toggleUserRole(user)}
                          variant="outline"
                          disabled={user.uid === user.uid}
                        >
                          {user.role === 'ADMIN' ? '降級為一般用戶' : '升級為管理員'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="invites">
                <div className="grid gap-4 py-4">
                  <Button onClick={loadInviteCodes} variant="outline">
                    載入邀請碼列表
                  </Button>
                  <Button onClick={generateNewInviteCode} disabled={isLoading}>
                    生成新邀請碼
                  </Button>
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
                  <div className="grid gap-4">
                    {inviteCodes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{code.code}</div>
                          <div className="text-sm text-muted-foreground">
                            狀態: {code.isUsed ? '已使用' : '未使用'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 
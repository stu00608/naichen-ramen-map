// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 獲取當前用戶的身份驗證狀態
  // 注意：由於Next.js中間件在伺服器端執行，無法直接訪問Firebase Auth
  // 我們需要使用cookie或自定義header來判斷登入狀態
  // 這裡使用簡化的邏輯，實際項目中應該使用更安全的方法
  const authCookie = request.cookies.get('auth')?.value;
  
  // 檢查是否是訪問管理後台的請求
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  
  // 如果是訪問管理後台且未登入，重定向到登入頁面
  if (isAdminRoute && !authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
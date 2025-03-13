// src/app/login/page.tsx
"use client"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <LoginForm />
    </div>
  )
}
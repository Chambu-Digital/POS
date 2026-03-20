'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated by attempting to fetch /api/auth/me
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          router.push('/dashboard')
        } else {
          router.push('/auth/login')
        }
      } catch {
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  return null
}

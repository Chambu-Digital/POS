'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
}

export function PermissionGuard({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  fallback,
}: PermissionGuardProps) {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    checkPermissions()
  }, [])

  async function checkPermissions() {
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
        // Try to use cached permissions if offline
        const cachedUser = localStorage.getItem('cachedUserInfo')
        if (cachedUser) {
          const data = JSON.parse(cachedUser)
          setUserInfo(data)
          evaluatePermissions(data)
          return
        }
        router.push('/auth/login')
        return
      }

      const data = await response.json()
      setUserInfo(data.user)
      
      // Cache user info for offline use
      localStorage.setItem('cachedUserInfo', JSON.stringify(data.user))
      
      evaluatePermissions(data.user)
    } catch (error) {
      console.error('Permission check error:', error)
      // Try to use cached permissions if offline
      const cachedUser = localStorage.getItem('cachedUserInfo')
      if (cachedUser) {
        const data = JSON.parse(cachedUser)
        setUserInfo(data)
        evaluatePermissions(data)
        return
      }
      setHasAccess(false)
    }
  }

  function evaluatePermissions(user: any) {
    // Admin/Owner has all permissions
    if (user.type === 'user') {
      setHasAccess(true)
      return
    }

    // Check staff permissions
    const permissions = user.permissions || {}

    if (requiredPermission) {
      setHasAccess(permissions[requiredPermission] === true)
    } else if (requiredPermissions && requiredPermissions.length > 0) {
      if (requireAll) {
        // User must have all permissions
        setHasAccess(
          requiredPermissions.every((perm) => permissions[perm] === true)
        )
      } else {
        // User must have at least one permission
        setHasAccess(
          requiredPermissions.some((perm) => permissions[perm] === true)
        )
      }
    } else {
      // No specific permission required
      setHasAccess(true)
    }
  }

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Checking permissions...</div>
      </div>
    )
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Please contact your manager.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}

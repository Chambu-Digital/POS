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
        router.push('/auth/login')
        return
      }

      const data = await response.json()
      setUserInfo(data.user)

      // Admin/Owner has all permissions
      if (data.user.type === 'user') {
        setHasAccess(true)
        return
      }

      // Check staff permissions
      const permissions = data.user.permissions || {}

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
    } catch (error) {
      console.error('Permission check error:', error)
      setHasAccess(false)
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

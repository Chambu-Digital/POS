'use client'

import { useEffect, useState } from 'react'

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user?.isDemo) setIsDemo(true) })
      .catch(() => {})
  }, [])

  if (!isDemo) return null

  return (
    <div className="bg-amber-400 text-amber-900 text-center text-xs font-semibold py-1.5 px-4 w-full">
      Demo Mode — you are exploring a demo account. Changes are not saved.
    </div>
  )
}

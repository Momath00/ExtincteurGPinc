'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TechnicienDashboard() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/technicien/rapports-extincteurs')
  }, [])

  return null
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CitoyenPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/citoyen/rapports-extincteurs')
  }, [])

  return null
}

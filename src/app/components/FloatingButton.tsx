//app\components\FloatingButton.tsx

'use client'

import { useRouter } from 'next/navigation'

export default function FloatingButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/upload')}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white rounded-full w-14 h-14 text-3xl shadow-lg hover:scale-105 transition-transform z-50"
    >
      +
    </button>
  )
}

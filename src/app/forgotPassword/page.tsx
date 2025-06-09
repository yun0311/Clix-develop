'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    try {
      await sendPasswordResetEmail(auth, email)
      setMessage('✅ 비밀번호 재설정 이메일이 전송되었습니다.')
      setEmail('')
    } catch (err: any) {
      console.error('비밀번호 재설정 오류:', err)
      if (err.code === 'auth/user-not-found') {
        setError('❌ 등록된 이메일이 아닙니다.')
        setEmail('')
      } else {
        setError('❌ 이메일 전송에 실패했습니다. 다시 시도해 주세요.')
      }
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-black px-4">
      <div className="bg-white text-black rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">비밀번호 재설정</h1>

        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="가입한 이메일을 입력해 주세요."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 rounded border border-gray-300 text-black"
          />

          <button
            type="submit"
            className="bg-black text-white py-2 rounded hover:bg-gray-800"
          >
            재설정 메일 보내기
          </button>

          {/* ✅ 로그인 페이지로 돌아가기 버튼 */}
          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-blue-500 text-sm hover:underline"
            >
              로그인 페이지로 돌아가기
            </button>
          </div>

          {/* 메시지 출력 */}
          {message && (
            <p className="text-green-600 text-sm text-center">{message}</p>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <p className="text-gray-500 text-xs mt-4 text-center">
            메일이 도착하지 않았다면 스팸함을 확인해 주세요.
          </p>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Link from 'next/link'
import styles from './layout.module.css'

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
  createdAt: {
    toDate: () => Date
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          if (userData.role === 'admin' || userData.role === 'subAdmin') {
            const { email: _, ...userInfo } = userData
            setCurrentUser({ email: user.email, ...userInfo })
          } else {
            router.push('/')
          }
        } else {
          router.push('/')
        }
      } else {
        router.push('/')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          <Link
            href="/admin"
            className={`${styles.navLink} ${
              pathname === '/admin' ? styles.active : ''
            }`}
          >
            대시보드
          </Link>
          <Link
            href="/admin/users"
            className={`${styles.navLink} ${
              pathname === '/admin/users' ? styles.active : ''
            }`}
          >
            사용자 관리
          </Link>
          <Link
            href="/admin/posts"
            className={`${styles.navLink} ${
              pathname === '/admin/posts' ? styles.active : ''
            }`}
          >
            게시글 관리
          </Link>
          <Link
            href="/admin/banners"
            className={`${styles.navLink} ${
              pathname === '/admin/banners' ? styles.active : ''
            }`}
          >
            배너 관리
          </Link>
          <Link
            href="/admin/statistics"
            className={`${styles.navLink} ${
              pathname === '/admin/statistics' ? styles.active : ''
            }`}
          >
            통계
          </Link>
        </nav>
      </aside>
      <main className={styles.main}>
        <div className={styles.welcome}>
          <p>환영합니다, {currentUser.name}님!</p>
          <p>
            관리자 권한: {currentUser.role === 'admin' ? '관리자' : '부관리자'}
          </p>
        </div>
        {children}
      </main>
    </div>
  )
}

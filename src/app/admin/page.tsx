'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import styles from './page.module.css'

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
  createdAt: {
    toDate: () => Date
  }
}

interface Stats {
  totalUsers: number
  totalPosts: number
  totalComments: number
  activeBanners: number
}

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    activeBanners: 0,
  })

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
            fetchStats()
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

  const fetchStats = async () => {
    try {
      // 전체 사용자 수 조회
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const totalUsers = usersSnapshot.size

      // 전체 게시물 수 조회
      const postsSnapshot = await getDocs(collection(db, 'posts'))
      const totalPosts = postsSnapshot.size

      // 전체 댓글 수 조회
      const commentsSnapshot = await getDocs(collection(db, 'comments'))
      const totalComments = commentsSnapshot.size

      // 활성 배너 수 조회
      const bannersQuery = query(
        collection(db, 'banners'),
        where('isActive', '==', true)
      )
      const bannersSnapshot = await getDocs(bannersQuery)
      const activeBanners = bannersSnapshot.size

      setStats({
        totalUsers,
        totalPosts,
        totalComments,
        activeBanners,
      })
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error)
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.dashboardTitle}>관리자 대시보드</h2>
      <div className={styles.statsGrid}>
        <Link href="/admin/users" className={styles.statCard}>
          <h3>전체 사용자</h3>
          <p>{stats.totalUsers.toLocaleString()}명</p>
        </Link>
        <Link href="/admin/posts" className={styles.statCard}>
          <h3>전체 게시물</h3>
          <p>{stats.totalPosts.toLocaleString()}개</p>
        </Link>
        <div className={styles.statCard}>
          <h3>전체 댓글</h3>
          <p>{stats.totalComments.toLocaleString()}개</p>
        </div>
        <Link href="/admin/banners" className={styles.statCard}>
          <h3>활성 배너</h3>
          <p>{stats.activeBanners.toLocaleString()}개</p>
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  where,
  orderBy,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import styles from './page.module.css'

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
  createdAt: {
    toDate: () => Date
  }
}

interface UserStats extends User {
  commentCount: number
  likeCount: number
  totalActivity: number
}

type SortField = 'commentCount' | 'likeCount' | 'totalActivity' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export default function StatisticsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserStats[]>([])
  const [sortField, setSortField] = useState<SortField>('totalActivity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

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
            fetchUserStats()
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

  const fetchUserStats = async () => {
    try {
      // 모든 사용자 정보 가져오기
      const usersRef = collection(db, 'users')
      const usersSnapshot = await getDocs(usersRef)
      const usersData = usersSnapshot.docs.map((doc) => ({
        email: doc.id,
        ...doc.data(),
      })) as User[]

      // 각 사용자의 댓글 수와 좋아요 수 가져오기
      const userStats = await Promise.all(
        usersData.map(async (user) => {
          // 댓글 수 가져오기
          const commentsRef = collection(db, 'comments')
          const commentsQuery = query(
            commentsRef,
            where('author.email', '==', user.email)
          )
          const commentsSnapshot = await getDocs(commentsQuery)
          const commentCount = commentsSnapshot.size

          // 좋아요 수 가져오기
          const postsRef = collection(db, 'posts')
          const postsSnapshot = await getDocs(postsRef)
          let likeCount = 0
          postsSnapshot.docs.forEach((doc) => {
            const post = doc.data()
            if (post.likes?.includes(user.email)) {
              likeCount++
            }
          })

          return {
            ...user,
            commentCount,
            likeCount,
            totalActivity: commentCount + likeCount,
          }
        })
      )

      setUsers(userStats)
    } catch (error) {
      console.error('사용자 통계 로딩 중 오류:', error)
      toast.error('사용자 통계를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1
    if (sortField === 'createdAt') {
      return (
        multiplier *
        (a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime())
      )
    }
    return multiplier * (a[sortField] - b[sortField])
  })

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>사용자 활동 통계</h1>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th
                className={styles.sortable}
                onClick={() => handleSort('createdAt')}
              >
                가입일
                {sortField === 'createdAt' && (
                  <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th
                className={styles.sortable}
                onClick={() => handleSort('commentCount')}
              >
                작성한 댓글 수
                {sortField === 'commentCount' && (
                  <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th
                className={styles.sortable}
                onClick={() => handleSort('likeCount')}
              >
                누른 좋아요 수
                {sortField === 'likeCount' && (
                  <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
              <th
                className={styles.sortable}
                onClick={() => handleSort('totalActivity')}
              >
                활동 합계
                {sortField === 'totalActivity' && (
                  <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => (
              <tr key={user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.createdAt.toDate().toLocaleDateString('ko-KR')}</td>
                <td>{user.commentCount.toLocaleString()}</td>
                <td>{user.likeCount.toLocaleString()}</td>
                <td>{user.totalActivity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

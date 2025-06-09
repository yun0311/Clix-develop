'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import styles from './Header.module.css'

interface UserData {
  name: string
  role?: 'admin' | 'subAdmin' | 'user'
}

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState<string>('')
  const [userRole, setUserRole] = useState<
    'admin' | 'subAdmin' | 'user' | null
  >(null)
  const [years, setYears] = useState<string[]>([])
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [userMenuTimer, setUserMenuTimer] = useState<NodeJS.Timeout | null>(
    null
  )
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user)
      if (user?.email) {
        // 사용자 정보 가져오기
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserData
          setUserName(userData.name)
          setUserRole(userData.role || 'user')
        }
      }
    })

    // 연도 목록 가져오기
    const fetchYears = async () => {
      try {
        const postsRef = collection(db, 'posts')
        const q = query(postsRef, orderBy('createdAt', 'desc'))
        const querySnapshot = await getDocs(q)

        const yearSet = new Set<string>()
        querySnapshot.docs.forEach((doc) => {
          const year = doc.data().createdAt.toDate().getFullYear().toString()
          yearSet.add(year)
        })

        setYears(Array.from(yearSet).sort((a, b) => Number(b) - Number(a)))
      } catch (error) {
        console.error('연도 목록 로딩 중 오류:', error)
      }
    }

    fetchYears()
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      await auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('로그아웃 중 오류 발생:', error)
    }
  }

  const handleYearClick = (year: string) => {
    router.push(`/yearly?year=${year}`)
    setIsYearMenuOpen(false)
  }

  const handleUserMenuEnter = () => {
    if (userMenuTimer) {
      clearTimeout(userMenuTimer)
      setUserMenuTimer(null)
    }
    setIsUserMenuOpen(true)
  }

  const handleUserMenuLeave = () => {
    const timer = setTimeout(() => {
      setIsUserMenuOpen(false)
    }, 1000) // 1초 지연
    setUserMenuTimer(timer)
  }

  const handleAdminClick = () => {
    router.push('/admin')
    setIsUserMenuOpen(false)
  }

  useEffect(() => {
    return () => {
      if (userMenuTimer) {
        clearTimeout(userMenuTimer)
      }
    }
  }, [userMenuTimer])

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.logo}>
          Clix
        </Link>

        <nav className={styles.nav}>
          <Link
            href="/hall-of-fame"
            className={`${styles.navItem} ${
              pathname === '/hall-of-fame' ? styles.active : ''
            }`}
          >
            명예전당
          </Link>
          <div
            className={styles.yearNavItem}
            onMouseEnter={() => setIsYearMenuOpen(true)}
            onMouseLeave={() => setIsYearMenuOpen(false)}
          >
            <span
              className={`${styles.navItem} ${
                pathname === '/yearly' ? styles.active : ''
              }`}
            >
              연도별
            </span>
            {isYearMenuOpen && (
              <div className={styles.yearDropdown}>
                {years.map((year) => (
                  <button
                    key={year}
                    className={styles.yearOption}
                    onClick={() => handleYearClick(year)}
                  >
                    {year}년
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className={styles.authSection}>
          {user ? (
            <div
              className={styles.userMenu}
              onMouseEnter={handleUserMenuEnter}
              onMouseLeave={handleUserMenuLeave}
            >
              <button
                className={styles.userNameButton}
                onMouseEnter={handleUserMenuEnter}
                onMouseLeave={handleUserMenuLeave}
              >
                {userName}
                {(userRole === 'admin' || userRole === 'subAdmin') && (
                  <span className={styles.adminBadge}>관리자</span>
                )}
              </button>
              {isUserMenuOpen && (
                <div
                  className={styles.userDropdown}
                  onMouseEnter={handleUserMenuEnter}
                  onMouseLeave={handleUserMenuLeave}
                >
                  <Link href="/mypage" className={styles.userMenuItem}>
                    마이페이지
                  </Link>
                  {(userRole === 'admin' || userRole === 'subAdmin') && (
                    <Link href="/admin" className={styles.userMenuItem}>
                      관리자 페이지
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className={styles.userMenuItem}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className={styles.loginButton}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

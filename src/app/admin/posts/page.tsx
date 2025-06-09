'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  updateDoc,
  increment,
} from 'firebase/firestore'
import Link from 'next/link'
import styles from './page.module.css'

interface Post {
  id: string
  title: string
  author: {
    name: string
    email: string
  }
  createdAt: {
    toDate: () => Date
  }
  views: number
  likes: string[]
}

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
}

export default function PostManagement() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [users, setUsers] = useState<{ [key: string]: User }>({}) // 이메일: 유저정보 매핑
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const postsPerPage = 7

  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'))
      const querySnapshot = await getDocs(usersQuery)
      const usersMap: { [key: string]: User } = {}
      querySnapshot.docs.forEach((doc) => {
        const { email: _, ...userData } = doc.data() as User
        usersMap[doc.id] = { email: doc.id, ...userData }
      })
      console.log('가져온 유저 정보:', usersMap) // 유저 정보 확인
      setUsers(usersMap)
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error)
    }
  }

  const fetchPosts = async () => {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(postsQuery)
      const postsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data()

          // author 정보가 없는 경우 처리
          if (!data.author) {
            return {
              id: docSnapshot.id,
              ...data,
              author: {
                name: '익명',
                email: 'unknown',
              },
              likes: data.likes || [],
              views: data.views || 0,
            } as Post
          }

          // author.email 정보가 없는 경우 처리
          if (!data.author.email) {
            return {
              id: docSnapshot.id,
              ...data,
              author: {
                ...data.author,
                name: data.author.name || '익명',
                email: 'unknown',
              },
              likes: data.likes || [],
              views: data.views || 0,
            } as Post
          }

          // 작성자 정보 가져오기
          const authorRef = doc(db, 'users', data.author.email)
          const authorSnap = await getDoc(authorRef)
          const authorData = authorSnap.data() as { name?: string } | undefined

          // 작성자 이름이 있는 경우에만 사용
          const authorName = authorData?.name || data.author.name || '익명'

          return {
            id: docSnapshot.id,
            ...data,
            author: {
              name: authorName,
              email: data.author.email,
            },
            likes: data.likes || [],
            views: data.views || 0,
          } as Post
        })
      )
      setPosts(postsData)
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      setError('게시물 목록을 불러오는데 실패했습니다.')
    }
  }

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
            await Promise.all([fetchUsers(), fetchPosts()]) // 유저 정보와 게시물 정보를 병렬로 가져옴
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

  // 페이지네이션 관련 계산
  const indexOfLastPost = currentPage * postsPerPage
  const indexOfFirstPost = indexOfLastPost - postsPerPage
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost)
  const totalPages = Math.ceil(posts.length / postsPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleDeletePost = async (postId: string) => {
    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'subAdmin')
    ) {
      alert('권한이 없습니다.')
      return
    }

    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteDoc(doc(db, 'posts', postId))
      await fetchPosts()
      alert('게시물이 삭제되었습니다.')
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      alert('게시물 삭제에 실패했습니다.')
    }
  }

  const handleView = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId)
      await updateDoc(postRef, {
        views: increment(1),
      })

      // 게시물 목록 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              views: (post.views || 0) + 1,
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('조회수 증가 중 오류:', error)
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (error) {
    return <div className={styles.error}>{error}</div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>게시물 관리</h1>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>제목</th>
              <th>작성자</th>
              <th>작성일</th>
              <th>조회수</th>
              <th>좋아요</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {currentPosts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link
                    href={`/post/${post.id}`}
                    className={styles.postLink}
                    onClick={() => handleView(post.id)}
                  >
                    {post.title}
                  </Link>
                </td>
                <td>{post.author.name}</td>
                <td>
                  {post.createdAt
                    ? new Date(post.createdAt.toDate()).toLocaleDateString()
                    : '-'}
                </td>
                <td>{post.views.toLocaleString()}</td>
                <td>{post.likes.length.toLocaleString()}</td>
                <td>
                  {(currentUser?.role === 'admin' ||
                    currentUser?.role === 'subAdmin') && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className={styles.deleteButton}
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
            <button
              key={number}
              onClick={() => handlePageChange(number)}
              className={`${styles.pageButton} ${
                currentPage === number ? styles.activePage : ''
              }`}
            >
              {number}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={styles.pageButton}
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

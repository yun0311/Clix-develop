'use client'

import React, { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'

interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  detailImages?: string[]
  author: {
    name: string
    email: string
  }
  createdAt: {
    toDate: () => Date
  }
  likes: string[]
  views: number
  teamName?: string
}

export default function YearlyPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  // 연도 목록 가져오기
  useEffect(() => {
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

        const yearsArray = Array.from(yearSet).sort(
          (a, b) => Number(b) - Number(a)
        )
        setYears(yearsArray)

        // URL에서 연도 파라미터 가져오기
        const yearFromUrl = searchParams.get('year')
        if (yearFromUrl && yearsArray.includes(yearFromUrl)) {
          setSelectedYear(yearFromUrl)
        } else if (yearsArray.length > 0) {
          setSelectedYear(yearsArray[0])
        }
      } catch (error) {
        console.error('연도 목록 로딩 중 오류:', error)
      }
    }

    fetchYears()
  }, [searchParams])

  // 선택된 연도의 게시물 가져오기
  useEffect(() => {
    const fetchPosts = async () => {
      if (!selectedYear) return

      setLoading(true)
      try {
        const startDate = new Date(Number(selectedYear), 0, 1)
        const endDate = new Date(Number(selectedYear) + 1, 0, 1)

        const postsRef = collection(db, 'posts')
        const q = query(
          postsRef,
          where('createdAt', '>=', startDate),
          where('createdAt', '<', endDate),
          orderBy('createdAt', 'desc')
        )

        const querySnapshot = await getDocs(q)
        const postsData = await Promise.all(
          querySnapshot.docs.map(async (docSnapshot) => {
            const postData = docSnapshot.data() as any
            return {
              id: docSnapshot.id,
              ...postData,
              author: {
                name: postData.author?.name || '익명',
                email: postData.author?.email || 'unknown',
              },
              likes: postData.likes || [],
              views: postData.views || 0,
            } as Post
          })
        )

        setPosts(postsData)
      } catch (error) {
        console.error('게시물 로딩 중 오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [selectedYear])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>연도별 게시물 {selectedYear}</h1>

      <div className={styles.yearSelector}>
        {years.map((year) => (
          <button
            key={year}
            className={`${styles.yearButton} ${
              selectedYear === year ? styles.active : ''
            }`}
            onClick={() => setSelectedYear(year)}
          >
            {year}년
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : (
        <div className={styles.postsGrid}>
          {posts.map((post) => (
            <div key={post.id} className={styles.card}>
              <Link href={`/post/${post.id}`}>
                <div className={styles.imageContainer}>
                  {post.thumbnailUrl ? (
                    <img
                      src={post.thumbnailUrl}
                      alt={post.title}
                      className={styles.cardImage}
                    />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <span>이미지 없음</span>
                    </div>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <h3>{post.title}</h3>
                  <div className={styles.cardInfo}>
                    <span>팀명: {post.teamName || '미지정'}</span>
                    <span>작성자: {post.author.name}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardStats}>
                      <button className={styles.likeButton}>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={styles.heartIcon}
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <span>{post.likes.length}</span>
                      </button>
                      <span className={styles.views}>
                        조회수: {post.views.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

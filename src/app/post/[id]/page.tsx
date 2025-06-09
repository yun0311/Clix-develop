'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  increment,
} from 'firebase/firestore'
import { auth, db, storage } from '@/firebase/firebase'
import { ref, getDownloadURL } from 'firebase/storage'
import styles from './page.module.css'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const Comments = dynamic(() => import('@/app/components/Comments'), {
  ssr: false,
  loading: () => <div className={styles.loading}>댓글 로딩중...</div>,
})

interface TeamMember {
  name: string
  githubLink?: string
  portfolioLink?: string
}

interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  detailImages?: string[]
  youtubeVideoId?: string
  teamMembers?: TeamMember[]
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

interface PostData extends Omit<Post, 'id' | 'createdAt'> {
  createdAt: any // Firestore Timestamp
}

export default function PostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [views, setViews] = useState(0)
  const commentRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const commentId = searchParams?.get('commentId') || undefined

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRef = doc(db, 'posts', postId)
        const postSnap = await getDoc(postRef)

        if (!postSnap.exists()) {
          setError('게시물을 찾을 수 없습니다.')
          setLoading(false)
          return
        }

        const postData = postSnap.data() as Post
        setPost(postData)
        setLikesCount(postData.likes.length)
        setViews(postData.views || 0)

        const user = auth.currentUser
        if (user?.email) {
          setIsAuthor(user.email === postData.author.email)
          setLiked(postData.likes.includes(user.email))
        }

        // 세션 스토리지에서 조회 기록 확인
        const viewedPosts = JSON.parse(
          sessionStorage.getItem('viewedPosts') || '[]'
        )
        if (!viewedPosts.includes(postId)) {
          // 조회 기록이 없으면 조회수 증가
          await updateDoc(postRef, {
            views: increment(1),
          })
          setViews((prev) => prev + 1)
          // 조회 기록 추가
          sessionStorage.setItem(
            'viewedPosts',
            JSON.stringify([...viewedPosts, postId])
          )
        }

        setLoading(false)
      } catch (error) {
        console.error('게시물 로딩 중 오류 발생:', error)
        setError('게시물을 불러오는 중 오류가 발생했습니다.')
        setLoading(false)
      }
    }

    fetchPost()
  }, [postId])

  useEffect(() => {
    // URL에서 commentId 파라미터 확인
    const searchParams = new URLSearchParams(window.location.search)
    const commentId = searchParams.get('commentId')

    if (commentId && commentRef.current) {
      // 댓글 섹션이 로드된 후 스크롤
      setTimeout(() => {
        commentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 1000) // 댓글이 로드될 때까지 잠시 대기
    }
  }, [post]) // post가 로드된 후 실행

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return

    if (typeof postId !== 'string') return

    try {
      await deleteDoc(doc(db, 'posts', postId))
      alert('게시물이 삭제되었습니다.')
      router.push('/')
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('게시물 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleLike = async () => {
    const user = auth.currentUser
    if (!user?.email) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    if (!post) {
      console.error('게시물 정보가 없습니다.')
      return
    }

    try {
      const postRef = doc(db, 'posts', postId)
      const currentLikes = post.likes || []
      const newLikes = liked
        ? currentLikes.filter((email) => email !== user.email)
        : [...currentLikes, user.email]

      await updateDoc(postRef, {
        likes: newLikes,
      })

      setPost((prevPost) => {
        if (!prevPost) return null
        return { ...prevPost, likes: newLikes }
      })
      setLiked(!liked)
      setLikesCount(newLikes.length)
    } catch (error) {
      console.error('좋아요 처리 중 오류 발생:', error)
      alert('좋아요 처리 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>
  }

  if (!post) {
    return <div className={styles.error}>게시물을 찾을 수 없습니다.</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.postContainer}>
        <div className={styles.postHeader}>
          {post.thumbnailUrl && (
            <div className={styles.thumbnailContainer}>
              <img
                src={post.thumbnailUrl}
                alt={post.title}
                className={styles.thumbnail}
              />
            </div>
          )}
          <div className={styles.postMetaContainer}>
            <h1 className={styles.title}>{post.title}</h1>
            <div className={styles.postMeta}>
              <span className={styles.teamName}>
                팀명: {post.teamName || '팀명 없음'}
              </span>
              <span className={styles.author}>작성자: {post.author.name}</span>
              {post.teamMembers && post.teamMembers.length > 0 && (
                <div className={styles.teamMembers}>
                  <div className={styles.teamMembersHeader}>
                    <div className={styles.teamMembersList}>
                      {post.teamMembers.map((member, index) => (
                        <div key={index} className={styles.teamMember}>
                          <span className={styles.teamMemberLabel}>
                            {index === 0 ? '팀원: ' : ''}
                            {member.name}
                          </span>
                          <div className={styles.memberLinks}>
                            {member.githubLink && (
                              <a
                                href={member.githubLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.memberLink}
                                title="GitHub"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="18"
                                  height="18"
                                  fill="currentColor"
                                >
                                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                              </a>
                            )}
                            {member.portfolioLink && (
                              <a
                                href={member.portfolioLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.memberLink}
                                title="포트폴리오"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="18"
                                  height="18"
                                  fill="currentColor"
                                >
                                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.dateContainer}>
                <span className={styles.dateLabel}>작성날짜:</span>
                <span className={styles.date}>
                  {post.createdAt.toDate().toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className={styles.statsContainer}>
                <div className={styles.viewCount}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="20"
                    height="20"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>조회수: {post.views || 0}</span>
                </div>
                <button
                  onClick={handleLike}
                  className={`${styles.likeButton} ${
                    liked ? styles.liked : ''
                  }`}
                  title={liked ? '좋아요 취소' : '좋아요'}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="currentColor"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span className={styles.likeCount}>{post.likes.length}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>설명</h2>
          <div className={styles.content}>{post.content}</div>
        </div>

        {post.detailImages && post.detailImages.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>상세 이미지</h2>
            <div className={styles.detailImagesGrid}>
              {post.detailImages.map((imageUrl, index) => (
                <div key={index} className={styles.detailImageContainer}>
                  <img
                    src={imageUrl}
                    alt={`${post.title} 상세 이미지 ${index + 1}`}
                    className={styles.detailImage}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {post.youtubeVideoId && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>자료영상</h2>
            <div className={styles.youtubeContainer}>
              <iframe
                width="560"
                height="315"
                src={`https://www.youtube.com/embed/${post.youtubeVideoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}

        <div ref={commentRef}>
          <Comments postId={postId} highlightCommentId={commentId} />
        </div>

        {isAuthor && post && (
          <div className={styles.buttons}>
            <Link href={`/post/${postId}/edit`} className={styles.editButton}>
              수정
            </Link>
            <button onClick={handleDelete} className={styles.deleteButton}>
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

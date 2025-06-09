'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { User } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  updateDoc,
  arrayRemove,
  arrayUnion,
  increment,
} from 'firebase/firestore'
import Link from 'next/link'
import styles from './page.module.css'
import { toast } from 'react-hot-toast'

interface Post {
  id: string
  title: string
  content: string
  imageUrl?: string
  author: {
    name: string
    email: string
  }
  likes: string[]
  views: number
  createdAt: {
    toDate: () => Date
  }
  thumbnailUrl?: string
  teamName?: string
}

interface Comment {
  id: string
  postId: string
  content: string
  createdAt: {
    toDate: () => Date
  }
  postTitle: string
  postCreatedAt?: {
    toDate: () => Date
  }
  author: {
    name: string
    email: string
  }
  likes: string[]
}

interface UserData {
  name: string
  createdAt: {
    toDate: () => Date
  }
}

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [myComments, setMyComments] = useState<Comment[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<
    'posts' | 'comments' | 'likedPosts'
  >('posts')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      console.log('User authenticated:', user.email)
      setUser(user)
      if (user.email) {
        await fetchUserData(user.email)
        await fetchUserContent(user.email)
      }
    })

    return () => unsubscribe()
  }, [router])

  const fetchUserData = async (email: string) => {
    try {
      const userRef = doc(db, 'users', email)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setUserData(userSnap.data() as UserData)
      }
    } catch (error) {
      console.error('사용자 정보 로딩 중 오류:', error)
    }
  }

  const fetchUserContent = async (email: string) => {
    try {
      console.log('Fetching content for user:', email)

      // 내가 작성한 게시물 가져오기
      const postsRef = collection(db, 'posts')
      const allPostsSnapshot = await getDocs(postsRef)
      console.log(
        'All posts structure:',
        allPostsSnapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data(),
        }))
      )

      // 게시물 정보를 가져오기 위한 맵 생성
      const postsMap = new Map()
      allPostsSnapshot.docs.forEach((doc) => {
        postsMap.set(doc.id, { id: doc.id, ...doc.data() })
      })

      // 모든 게시물을 가져온 후 클라이언트에서 필터링
      const posts = allPostsSnapshot.docs
        .map((doc) => {
          const data = doc.data()
          console.log('Processing post:', doc.id, data)
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt,
            likes: data.likes || [],
            views: data.views || 0,
            author: data.author || { name: '알 수 없음', email },
          } as Post
        })
        .filter((post) => post.author.email === email)
        .sort(
          (a, b) =>
            b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
        )

      console.log('Filtered posts:', posts.length)
      setMyPosts(posts)

      // 내가 좋아요한 게시물 필터링
      const likedPosts = allPostsSnapshot.docs
        .map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt,
            likes: data.likes || [],
            views: data.views || 0,
            author: data.author || { name: '알 수 없음', email },
          } as Post
        })
        .filter((post) => post.likes.includes(email))
        .sort(
          (a, b) =>
            b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
        )

      console.log('Filtered liked posts:', likedPosts.length)
      setLikedPosts(likedPosts)

      // 내가 작성한 댓글 가져오기
      const commentsRef = collection(db, 'comments')
      const allCommentsSnapshot = await getDocs(commentsRef)

      // 모든 댓글을 가져온 후 클라이언트에서 필터링
      const comments = allCommentsSnapshot.docs
        .map((doc) => {
          const comment = doc.data()
          const postData = postsMap.get(comment.postId)

          // 게시물이 존재하지 않으면 null 반환
          if (!postData) {
            return null
          }

          return {
            id: doc.id,
            postId: comment.postId,
            content: comment.content,
            createdAt: comment.createdAt,
            author: comment.author || { name: '알 수 없음', email },
            likes: comment.likes || [],
            postTitle: postData.title,
            postCreatedAt: postData.createdAt,
          } as Comment
        })
        .filter(
          (comment): comment is Comment =>
            comment !== null && comment.author.email === email
        )
        .sort(
          (a, b) =>
            b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
        )

      console.log('Filtered comments:', comments.length)
      setMyComments(comments)
    } catch (error) {
      console.error('컨텐츠 로딩 중 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (
    postId: string,
    currentLikes: string[],
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user || !user.email) {
      toast.error('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    try {
      const postRef = doc(db, 'posts', postId)
      const isLiked = currentLikes.includes(user.email)

      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.email),
        })
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.email),
        })
      }

      // 게시물 목록 업데이트
      setMyPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter((email) => email !== user.email)
                : [...post.likes, user.email!],
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('좋아요 처리 중 오류:', error)
      toast.error('좋아요 처리 중 오류가 발생했습니다.')
    }
  }

  const handleView = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId)
      await updateDoc(postRef, {
        views: increment(1),
      })

      // 게시물 목록 업데이트
      setMyPosts((prevPosts) =>
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

      setLikedPosts((prevPosts) =>
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

  if (!user || !userData) {
    return null
  }

  function setShowEditModal(arg0: boolean): void {
    throw new Error('Function not implemented.')
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileSection}>
        <div className={styles.profileInfo}>
          <div>
            <h1 className={styles.userName}>{userData.name}</h1>
            <p className={styles.joinDate}>
              가입일: {userData.createdAt.toDate().toLocaleDateString()}
              <p className={styles.description}>이메일&내정보 간단 설명</p>
              <p>인스타와 깃허브 로고(링크 첨부 가능)</p>
            </p>
          </div>
          <button
            className={styles.editProfileButton}
            onClick={() => setShowEditModal(true)}
          >
            프로필 수정
          </button>
        </div>
      </div>


      <div className={styles.contentSection}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'posts' ? styles.active : ''
              }`}
            onClick={() => setActiveTab('posts')}
          >
            내가 작성한 글 ({myPosts.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'comments' ? styles.active : ''
              }`}
            onClick={() => setActiveTab('comments')}
          >
            내가 작성한 댓글 ({myComments.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'likedPosts' ? styles.active : ''
              }`}
            onClick={() => setActiveTab('likedPosts')}
          >
            좋아요한 게시물 ({likedPosts.length})
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'posts' && (
            <div className={styles.postsGrid}>
              {myPosts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.imageContainer}>
                    <Link
                      href={`/post/${post.id}`}
                      onClick={() => handleView(post.id)}
                    >
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
                    </Link>
                  </div>
                  <div className={styles.postInfo}>
                    <h2 className={styles.postTitle}>{post.title}</h2>
                    <div className={styles.postMeta}>
                      <span>팀명: {post.teamName || '미지정'}</span>
                      <span>작성자: {post.author.name}</span>
                    </div>
                    <div className={styles.stats}>
                      <div className={styles.cardStats}>
                        <button
                          className={`${styles.likeButton} ${post.likes.includes(user?.email ?? '')
                            ? styles.liked
                            : ''
                            }`}
                          onClick={(e) => handleLike(post.id, post.likes, e)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={
                              post.likes.includes(user?.email ?? '')
                                ? '#ff4d4d'
                                : 'none'
                            }
                            stroke="currentColor"
                            strokeWidth="2"
                            className={styles.heartIcon}
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span>{post.likes.length}</span>
                        </button>
                        <div className={styles.viewCount}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>{post.views || 0}</span>
                        </div>
                      </div>
                      <span className={styles.createdAt}>
                        {post.createdAt.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className={styles.commentsList}>
              {myComments.map((comment) => (
                <Link
                  href={`/post/${comment.postId}?commentId=${comment.id}`}
                  key={comment.id}
                  className={styles.commentCard}
                >
                  <div className={styles.commentInfo}>
                    <div className={styles.commentContent}>
                      <p>{comment.content}</p>
                    </div>
                    <div className={styles.commentMeta}>
                      <div className={styles.postInfo}>
                        <h3 className={styles.postTitle}>
                          {comment.postTitle}
                        </h3>
                        <div className={styles.postMeta}>
                          <span className={styles.author}>
                            작성자: {comment.author.name}
                          </span>
                          <span className={styles.commentDate}>
                            댓글 작성일:{' '}
                            {comment.createdAt.toDate().toLocaleDateString()}
                          </span>
                          <span className={styles.postDate}>
                            게시물 작성일:{' '}
                            {comment.postCreatedAt
                              ?.toDate()
                              .toLocaleDateString() || '날짜 정보 없음'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {activeTab === 'likedPosts' && (
            <div className={styles.likedPostsGrid}>
              {likedPosts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.imageContainer}>
                    <Link
                      href={`/post/${post.id}`}
                      onClick={() => handleView(post.id)}
                    >
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
                    </Link>
                  </div>
                  <div className={styles.postInfo}>
                    <h2 className={styles.postTitle}>{post.title}</h2>
                    <div className={styles.postMeta}>
                      <span>팀명: {post.teamName || '미지정'}</span>
                      <span>작성자: {post.author.name}</span>
                    </div>
                    <div className={styles.stats}>
                      <div className={styles.cardStats}>
                        <button
                          className={`${styles.likeButton} ${post.likes.includes(user?.email ?? '')
                            ? styles.liked
                            : ''
                            }`}
                          onClick={(e) => handleLike(post.id, post.likes, e)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={
                              post.likes.includes(user?.email ?? '')
                                ? '#ff4d4d'
                                : 'none'
                            }
                            stroke="currentColor"
                            strokeWidth="2"
                            className={styles.heartIcon}
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span>{post.likes.length}</span>
                        </button>
                        <div className={styles.viewCount}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>{post.views || 0}</span>
                        </div>
                      </div>
                      <span className={styles.createdAt}>
                        {post.createdAt.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

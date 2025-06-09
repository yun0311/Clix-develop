'use client'

import { useState, useEffect, useRef } from 'react'
import { auth, db } from '@/firebase/firebase'
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc as firestoreDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  DocumentData,
} from 'firebase/firestore'
import styles from './Comments.module.css'

interface Comment {
  id: string
  content: string
  author: {
    email: string
    name: string
  }
  createdAt: {
    toDate: () => Date
  }
  parentId?: string
  isEdited?: boolean
}

interface UserData {
  name?: string
  email: string
}

interface CommentsProps {
  postId: string
  highlightCommentId?: string
}

export default function Comments({
  postId,
  highlightCommentId,
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const highlightedCommentRef = useRef<HTMLDivElement>(null)

  // 댓글 불러오기
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const q = query(
          collection(db, 'comments'),
          where('postId', '==', postId)
        )
        const querySnapshot = await getDocs(q)
        const commentsData = await Promise.all(
          querySnapshot.docs.map(async (docSnapshot) => {
            const data = docSnapshot.data()
            // 작성자 정보 가져오기
            const authorRef = firestoreDoc(db, 'users', data.author.email)
            const authorSnap = await getDoc(authorRef)
            const authorData = authorSnap.data() as UserData | undefined

            return {
              id: docSnapshot.id,
              ...data,
              author: {
                ...data.author,
                name: authorData?.name || data.author.name,
              },
            } as Comment
          })
        )
        // 클라이언트 측에서 정렬
        commentsData.sort(
          (a, b) =>
            a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
        )
        setComments(commentsData)
      } catch (error) {
        console.error('댓글 불러오기 실패:', error)
      }
    }

    fetchComments()
  }, [postId])

  // 댓글 작성
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = auth.currentUser
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요.')
      return
    }

    try {
      const userRef = firestoreDoc(db, 'users', user.email || '')
      const userSnap = await getDoc(userRef)
      const userData = userSnap.data() as UserData | undefined

      await addDoc(collection(db, 'comments'), {
        postId,
        content: newComment,
        author: {
          email: user.email,
          name: userData?.name || '익명',
        },
        parentId: replyTo,
        createdAt: serverTimestamp(),
        isEdited: false,
      })

      setNewComment('')
      setReplyTo(null)
      // 댓글 목록 새로고침
      const q = query(collection(db, 'comments'), where('postId', '==', postId))
      const querySnapshot = await getDocs(q)
      const commentsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data()
          const authorRef = firestoreDoc(db, 'users', data.author.email)
          const authorSnap = await getDoc(authorRef)
          const authorData = authorSnap.data() as UserData | undefined

          return {
            id: docSnapshot.id,
            ...data,
            author: {
              ...data.author,
              name: authorData?.name || data.author.name,
            },
          } as Comment
        })
      )
      // 클라이언트 측에서 정렬
      commentsData.sort(
        (a, b) =>
          a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
      )
      setComments(commentsData)
    } catch (error) {
      console.error('댓글 작성 실패:', error)
      alert('댓글 작성 중 오류가 발생했습니다.')
    }
  }

  // 댓글 수정
  const handleEditComment = async (commentId: string) => {
    const user = auth.currentUser
    if (!user) return

    try {
      const commentRef = firestoreDoc(db, 'comments', commentId)
      await updateDoc(commentRef, {
        content: editContent,
        isEdited: true,
      })

      setEditingComment(null)
      setEditContent('')
      // 댓글 목록 새로고침
      const q = query(collection(db, 'comments'), where('postId', '==', postId))
      const querySnapshot = await getDocs(q)
      const commentsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data()
          const authorRef = firestoreDoc(db, 'users', data.author.email)
          const authorSnap = await getDoc(authorRef)
          const authorData = authorSnap.data() as UserData | undefined

          return {
            id: docSnapshot.id,
            ...data,
            author: {
              ...data.author,
              name: authorData?.name || data.author.name,
            },
          } as Comment
        })
      )
      // 클라이언트 측에서 정렬
      commentsData.sort(
        (a, b) =>
          a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
      )
      setComments(commentsData)
    } catch (error) {
      console.error('댓글 수정 실패:', error)
      alert('댓글 수정 중 오류가 발생했습니다.')
    }
  }

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return

    try {
      await deleteDoc(firestoreDoc(db, 'comments', commentId))
      // 댓글 목록 새로고침
      const q = query(collection(db, 'comments'), where('postId', '==', postId))
      const querySnapshot = await getDocs(q)
      const commentsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data()
          const authorRef = firestoreDoc(db, 'users', data.author.email)
          const authorSnap = await getDoc(authorRef)
          const authorData = authorSnap.data() as UserData | undefined

          return {
            id: docSnapshot.id,
            ...data,
            author: {
              ...data.author,
              name: authorData?.name || data.author.name,
            },
          } as Comment
        })
      )
      // 클라이언트 측에서 정렬
      commentsData.sort(
        (a, b) =>
          a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
      )
      setComments(commentsData)
    } catch (error) {
      console.error('댓글 삭제 실패:', error)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  // 댓글 렌더링 함수
  const renderComment = (comment: Comment, level: number = 0) => {
    const isAuthor = auth.currentUser?.email === comment.author.email
    const replies = comments.filter((c) => c.parentId === comment.id)
    const isHighlighted = comment.id === highlightCommentId

    return (
      <div
        key={comment.id}
        className={styles.commentContainer}
        ref={isHighlighted ? highlightedCommentRef : null}
      >
        <div
          className={`${styles.comment} ${
            isHighlighted ? styles.highlighted : ''
          }`}
          style={{ marginLeft: `${level * 40}px` }}
        >
          <div className={styles.commentHeader}>
            <span className={styles.author}>{comment.author.name}</span>
            <span className={styles.date}>
              {comment.createdAt.toDate().toLocaleDateString()}
              {comment.isEdited && ' (수정됨)'}
            </span>
          </div>
          {editingComment === comment.id ? (
            <div className={styles.editForm}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={styles.editTextarea}
              />
              <div className={styles.editButtons}>
                <button
                  onClick={() => handleEditComment(comment.id)}
                  className={styles.editButton}
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingComment(null)
                    setEditContent('')
                  }}
                  className={styles.cancelButton}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.commentContent}>{comment.content}</div>
          )}
          <div className={styles.commentActions}>
            {!replyTo && (
              <button
                onClick={() => {
                  setReplyTo(comment.id)
                  commentInputRef.current?.focus()
                }}
                className={styles.replyButton}
              >
                답글
              </button>
            )}
            {isAuthor && (
              <>
                <button
                  onClick={() => {
                    setEditingComment(comment.id)
                    setEditContent(comment.content)
                  }}
                  className={styles.editButton}
                >
                  수정
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className={styles.deleteButton}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
        {replies.map((reply) => renderComment(reply, level + 1))}
      </div>
    )
  }

  // 강조된 댓글이 있으면 스크롤
  useEffect(() => {
    if (highlightCommentId && highlightedCommentRef.current) {
      highlightedCommentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [highlightCommentId, comments])

  return (
    <div className={styles.commentsSection}>
      <h2 className={styles.sectionTitle}>댓글</h2>
      <form onSubmit={handleSubmitComment} className={styles.commentForm}>
        <textarea
          ref={commentInputRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={
            replyTo ? '답글을 입력하세요...' : '댓글을 입력하세요...'
          }
          className={styles.commentInput}
        />
        <div className={styles.formActions}>
          {replyTo && (
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className={styles.cancelButton}
            >
              답글 취소
            </button>
          )}
          <button type="submit" className={styles.submitButton}>
            {replyTo ? '답글 작성' : '댓글 작성'}
          </button>
        </div>
      </form>
      <div className={styles.commentsList}>
        {comments
          .filter((comment) => !comment.parentId)
          .map((comment) => renderComment(comment))}
      </div>
    </div>
  )
}

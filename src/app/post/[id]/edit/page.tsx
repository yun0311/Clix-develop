'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db, storage } from '@/firebase/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import styles from './edit.module.css'

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
  teamName: string
  teamMembers: TeamMember[]
  author: {
    email: string
    name: string
  }
  createdAt: {
    toDate: () => Date
  }
  likes: string[]
  views: number
}

// 이미지 리사이징 함수
const resizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const targetHeight = 400
        const targetWidth = (img.width * targetHeight) / img.height

        canvas.width = targetWidth
        canvas.height = targetHeight

        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('이미지 변환 실패'))
              }
            },
            'image/jpeg',
            0.9
          )
        } else {
          reject(new Error('Canvas context 생성 실패'))
        }
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
  })
}

export default function EditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [detailImageFiles, setDetailImageFiles] = useState<File[]>([])
  const [detailImagePreviews, setDetailImagePreviews] = useState<string[]>([])
  const [youtubeLink, setYoutubeLink] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRef = doc(db, 'posts', id as string)
        const postSnap = await getDoc(postRef)

        if (!postSnap.exists()) {
          alert('게시물을 찾을 수 없습니다.')
          router.push('/')
          return
        }

        const postData = postSnap.data() as Post

        // 작성자 확인
        const user = auth.currentUser
        if (!user || postData.author.email !== user.email) {
          alert('수정 권한이 없습니다.')
          router.push('/')
          return
        }

        setPost({ ...postData, id: postSnap.id })
        setTitle(postData.title)
        setContent(postData.content)
        setTeamName(postData.teamName)
        setThumbnailPreview(postData.thumbnailUrl || null)
        setDetailImagePreviews(postData.detailImages || [])
        setYoutubeLink(
          postData.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${postData.youtubeVideoId}`
            : ''
        )
        setTeamMembers(postData.teamMembers || [])
      } catch (error) {
        console.error('게시물 불러오기 실패:', error)
        alert('게시물을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id, router])

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      try {
        const resizedBlob = await resizeImage(file)
        const resizedFile = new File([resizedBlob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })

        setThumbnailFile(resizedFile)
        const reader = new FileReader()
        reader.onloadend = () => {
          setThumbnailPreview(reader.result as string)
        }
        reader.readAsDataURL(resizedFile)
      } catch (error) {
        console.error('썸네일 이미지 리사이징 실패:', error)
        alert('이미지 처리 중 오류가 발생했습니다.')
      }
    }
  }

  const handleDetailImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      if (files.some((file) => file.size > 5 * 1024 * 1024)) {
        alert('각 파일의 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      try {
        const newDetailImageFiles = [...detailImageFiles]
        const newDetailImagePreviews = [...detailImagePreviews]

        for (const file of files) {
          const resizedBlob = await resizeImage(file)
          const resizedFile = new File([resizedBlob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          newDetailImageFiles.push(resizedFile)
          const reader = new FileReader()
          reader.onloadend = () => {
            newDetailImagePreviews.push(reader.result as string)
            setDetailImagePreviews([...newDetailImagePreviews])
          }
          reader.readAsDataURL(resizedFile)
        }

        setDetailImageFiles(newDetailImageFiles)
      } catch (error) {
        console.error('상세 이미지 리사이징 실패:', error)
        alert('이미지 처리 중 오류가 발생했습니다.')
      }
    }
  }

  const removeDetailImage = (index: number) => {
    setDetailImageFiles(detailImageFiles.filter((_, i) => i !== index))
    setDetailImagePreviews(detailImagePreviews.filter((_, i) => i !== index))
  }

  const addTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      { name: '', githubLink: '', portfolioLink: '' },
    ])
  }

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index))
  }

  const updateTeamMember = (
    index: number,
    field: keyof TeamMember,
    value: string
  ) => {
    const newTeamMembers = [...teamMembers]
    newTeamMembers[index] = { ...newTeamMembers[index], [field]: value }
    setTeamMembers(newTeamMembers)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let thumbnailUrl = post?.thumbnailUrl || null
      let detailImageUrls = post?.detailImages || []

      // 썸네일 이미지 업로드
      if (thumbnailFile) {
        const storageRef = ref(
          storage,
          `posts/thumbnails/${Date.now()}_${thumbnailFile.name}`
        )
        await uploadBytes(storageRef, thumbnailFile)
        thumbnailUrl = await getDownloadURL(storageRef)
      }

      // 상세 이미지들 업로드
      for (const file of detailImageFiles) {
        const storageRef = ref(
          storage,
          `posts/detail/${Date.now()}_${file.name}`
        )
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)
        detailImageUrls.push(url)
      }

      // 유튜브 링크에서 비디오 ID 추출
      let youtubeVideoId = null
      if (youtubeLink) {
        const regExp =
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = youtubeLink.match(regExp)
        youtubeVideoId = match && match[2].length === 11 ? match[2] : null
      }

      const postRef = doc(db, 'posts', id as string)
      await updateDoc(postRef, {
        title,
        content,
        thumbnailUrl,
        detailImages: detailImageUrls,
        youtubeVideoId,
        teamName,
        teamMembers: teamMembers.filter((member) => member.name.trim() !== ''),
        updatedAt: new Date(),
      })

      alert('게시물이 수정되었습니다.')
      router.push(`/post/${id}`)
    } catch (error) {
      console.error('게시물 수정 실패:', error)
      alert('게시물 수정 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>게시물 수정</h1>
        <div className={styles.inputGroup}>
          <label className={styles.label}>제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.input}
            placeholder="제목을 입력하세요"
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>팀명</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className={styles.input}
            placeholder="팀명을 입력하세요"
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label}>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={styles.textarea}
            placeholder="내용을 입력하세요"
            rows={10}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>썸네일</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            ref={fileInputRef}
            className={styles.fileInput}
          />
          {thumbnailPreview && (
            <div className={styles.imagePreview}>
              <img src={thumbnailPreview} alt="썸네일 미리보기" />
              <button
                onClick={() => {
                  setThumbnailFile(null)
                  setThumbnailPreview(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className={styles.removeImage}
              >
                썸네일 제거
              </button>
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>상세 이미지</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleDetailImagesChange}
            className={styles.fileInput}
          />
          {detailImagePreviews.length > 0 && (
            <div className={styles.detailImagePreviews}>
              {detailImagePreviews.map((preview, index) => (
                <div key={index} className={styles.detailImagePreview}>
                  <img src={preview} alt={`상세 이미지 ${index + 1}`} />
                  <button
                    onClick={() => removeDetailImage(index)}
                    className={styles.removeImage}
                  >
                    이미지 제거
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>유튜브 링크</label>
          <input
            type="text"
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
            className={styles.input}
            placeholder="유튜브 영상 링크를 입력하세요"
          />
          {youtubeLink && (
            <div className={styles.youtubePreview}>
              <iframe
                width="560"
                height="315"
                src={`https://www.youtube.com/embed/${
                  youtubeLink.match(
                    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*).*/
                  )?.[1]
                }`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>팀원 정보</label>
          {teamMembers.map((member, index) => (
            <div key={index} className={styles.teamMemberInput}>
              <input
                type="text"
                value={member.name}
                onChange={(e) =>
                  updateTeamMember(index, 'name', e.target.value)
                }
                className={styles.teamMemberName}
                placeholder="팀원 이름"
              />
              <input
                type="text"
                value={member.githubLink}
                onChange={(e) =>
                  updateTeamMember(index, 'githubLink', e.target.value)
                }
                className={styles.teamMemberLink}
                placeholder="GitHub 링크"
              />
              <input
                type="text"
                value={member.portfolioLink}
                onChange={(e) =>
                  updateTeamMember(index, 'portfolioLink', e.target.value)
                }
                className={styles.teamMemberLink}
                placeholder="포트폴리오 링크"
              />
              {index > 0 && (
                <button
                  onClick={() => removeTeamMember(index)}
                  className={styles.removeTeamMember}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          <button onClick={addTeamMember} className={styles.addTeamMember}>
            팀원 추가
          </button>
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={handleUpdate}
            className={styles.submitButton}
            disabled={uploading}
          >
            {uploading ? '수정 중...' : '수정하기'}
          </button>
          <button
            onClick={() => router.push(`/post/${id}`)}
            className={styles.cancelButton}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

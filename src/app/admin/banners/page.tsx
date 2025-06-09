'use client'

import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  where,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { db, storage, auth } from '@/firebase/firebase'
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

interface Banner {
  id: string
  imageUrl: string
  position: 'right'
  isActive: boolean
  order: number
  createdAt: {
    toDate: () => Date
  }
}

export default function BannerManagement() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [banners, setBanners] = useState<Banner[]>([])
  const [uploading, setUploading] = useState(false)

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
            fetchBanners()
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

  const fetchBanners = async () => {
    try {
      const bannersRef = collection(db, 'banners')
      const querySnapshot = await getDocs(bannersRef)
      const bannersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Banner[]
      setBanners(bannersData)
    } catch (error) {
      console.error('배너 로딩 중 오류:', error)
      toast.error('배너를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.')
      return
    }

    setUploading(true)
    try {
      // 현재 활성화된 배너들의 최대 order 값 찾기
      const activeBanners = banners.filter(
        (b) => b.isActive && b.position === 'right'
      )
      const maxOrder =
        activeBanners.length > 0
          ? Math.max(...activeBanners.map((b) => b.order))
          : 0

      // 새 이미지 업로드
      const storageRef = ref(
        storage,
        `banners/right/${Date.now()}_${file.name}`
      )
      await uploadBytes(storageRef, file)
      const imageUrl = await getDownloadURL(storageRef)

      // Firestore에 배너 정보 저장
      await addDoc(collection(db, 'banners'), {
        imageUrl,
        position: 'right',
        isActive: true,
        order: maxOrder + 1,
        createdAt: new Date(),
      })

      toast.success('배너가 성공적으로 업로드되었습니다.')
      fetchBanners()
    } catch (error) {
      console.error('배너 업로드 중 오류:', error)
      toast.error('배너 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateDoc(doc(db, 'banners', banner.id), {
        isActive: !banner.isActive,
        order: !banner.isActive
          ? banners.filter((b) => b.isActive).length + 1
          : 0,
      })
      toast.success(
        banner.isActive
          ? '배너가 비활성화되었습니다.'
          : '배너가 활성화되었습니다.'
      )
      fetchBanners()
    } catch (error) {
      console.error('배너 상태 변경 중 오류:', error)
      toast.error('배너 상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleMove = async (banner: Banner, direction: 'up' | 'down') => {
    const activeBanners = banners
      .filter((b) => b.isActive)
      .sort((a, b) => a.order - b.order)
    const currentIndex = activeBanners.findIndex((b) => b.id === banner.id)

    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === activeBanners.length - 1)
    ) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetBanner = activeBanners[targetIndex]

    try {
      await updateDoc(doc(db, 'banners', banner.id), {
        order: targetBanner.order,
      })
      await updateDoc(doc(db, 'banners', targetBanner.id), {
        order: banner.order,
      })
      toast.success('배너 순서가 변경되었습니다.')
      fetchBanners()
    } catch (error) {
      console.error('배너 순서 변경 중 오류:', error)
      toast.error('배너 순서 변경 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (banner: Banner) => {
    if (!confirm('정말로 이 배너를 삭제하시겠습니까?')) return

    try {
      // Storage에서 이미지 삭제
      const imageRef = ref(storage, banner.imageUrl)
      await deleteObject(imageRef)

      // Firestore에서 배너 정보 삭제
      await deleteDoc(doc(db, 'banners', banner.id))

      toast.success('배너가 성공적으로 삭제되었습니다.')
      fetchBanners()
    } catch (error) {
      console.error('배너 삭제 중 오류:', error)
      toast.error('배너 삭제 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>배너 관리</h1>

      <div className={styles.bannerSection}>
        <h2>우측 배너</h2>
        <div className={styles.uploadBox}>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            id="bannerUpload"
          />
          <label htmlFor="bannerUpload" className={styles.uploadButton}>
            {uploading ? '업로드 중...' : '이미지 업로드'}
          </label>
        </div>
        <div className={styles.bannerList}>
          {banners
            .filter((banner) => banner.position === 'right')
            .sort((a, b) => a.order - b.order)
            .map((banner) => (
              <div key={banner.id} className={styles.bannerItem}>
                <img src={banner.imageUrl} alt="배너" />
                <div className={styles.bannerInfo}>
                  <div className={styles.bannerControls}>
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`${styles.controlButton} ${
                        banner.isActive
                          ? styles.activeButton
                          : styles.inactiveButton
                      }`}
                    >
                      {banner.isActive ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => handleDelete(banner)}
                      className={`${styles.controlButton} ${styles.deleteButton}`}
                    >
                      삭제
                    </button>
                  </div>
                  <div className={styles.orderControls}>
                    <button
                      onClick={() => handleMove(banner, 'up')}
                      className={styles.orderButton}
                      disabled={banner.order === 1}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(banner, 'down')}
                      className={styles.orderButton}
                      disabled={
                        banner.order ===
                        banners.filter((b) => b.position === 'right').length
                      }
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

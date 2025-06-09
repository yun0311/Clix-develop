'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import styles from './BannerSidebar.module.css'

interface Banner {
  id: string
  imageUrl: string
  isActive: boolean
  order: number
}

export default function BannerSidebar() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const q = query(
          collection(db, 'banners'),
          where('isActive', '==', true),
          orderBy('order', 'asc')
        )
        const querySnapshot = await getDocs(q)
        const bannersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Banner[]
        setBanners(bannersData)
      } catch (error) {
        console.error('배너 로딩 중 오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBanners()
  }, [])

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (banners.length === 0) {
    return null
  }

  return (
    <div className={styles.bannerContainer}>
      {banners.map((banner) => (
        <div key={banner.id} className={styles.bannerItem}>
          <img
            src={banner.imageUrl}
            alt="배너"
            className={styles.bannerImage}
          />
        </div>
      ))}
    </div>
  )
}

// lib/uploadFile.ts
import { auth } from '@/firebase/firebase'

interface UploadResponse {
  url: string
  error?: string
  details?: string
}

/**
 * 파일을 Storage에 업로드하고 다운로드 URL을 반환하는 함수
 * @param file 업로드할 파일
 * @param path 저장할 경로 (예: 'images/파일명' 또는 'ppts/파일명')
 * @returns 다운로드 URL
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  if (!file) {
    throw new Error('업로드할 파일이 없습니다.')
  }

  const user = auth.currentUser
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const fileType = path.split('/')[0]
  if (!['images', 'ppts'].includes(fileType)) {
    throw new Error('잘못된 파일 타입입니다. images 또는 ppts만 허용됩니다.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileType', fileType)
  formData.append('userId', user.uid)

  try {
    const token = await user.getIdToken()
    const response = await fetch(
      'https://us-central1-management-service-fcfe3.cloudfunctions.net/api/uploadFile',
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      throw new Error(
        errorData.error || errorData.message || `서버 오류: ${response.status}`
      )
    }

    const data: UploadResponse = await response.json()

    if (!data.url) {
      throw new Error('서버로부터 URL을 받지 못했습니다.')
    }

    return data.url
  } catch (error) {
    console.error('파일 업로드 중 오류 발생:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('알 수 없는 오류가 발생했습니다.')
  }
}

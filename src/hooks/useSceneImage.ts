import { useCallback, useState } from 'react'

// TEMP STORAGE — this app has no auth/database yet (Supabase work is
// planned but not built), so a user's uploaded scene photo is persisted in
// localStorage, per-browser/per-device only: it won't follow them to a new
// phone or survive clearing site data, and there's no size headroom for
// more than one photo. Move this to real Supabase storage (keyed by user
// id) once auth exists — swap the read/write below for a fetch/upload and
// this hook's return shape shouldn't need to change for its callers.
const STORAGE_KEY = 'bernafas.sceneImage.v1'

// Long side capped and re-encoded as JPEG before ever touching
// localStorage — an uncompressed phone photo (often 3-10MB+) would burn
// through the ~5MB per-origin localStorage quota almost immediately, and a
// full-bleed background doesn't benefit from more resolution than this
// anyway.
const MAX_DIMENSION = 1440
const JPEG_QUALITY = 0.82
// Sanity cap on the *source* file before attempting to decode/resize it —
// rejects obviously-wrong picks (a video, a multi-page PDF someone's photo
// app exported oddly) without hanging the browser trying to process them.
const MAX_SOURCE_BYTES = 15 * 1024 * 1024

function readStoredImage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private-browsing/storage-disabled — fall back to "no custom image"
    // rather than throwing on every mount.
    return null
  }
}

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(objectUrl)
      if (!ctx) {
        reject(new Error('canvas 2d context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image failed to load/decode'))
    }
    img.src = objectUrl
  })
}

export function useSceneImage() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(readStoredImage)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setImage = useCallback(async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Fail mesti imej (JPEG, PNG, dll).')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('Fail terlalu besar (maks 15MB).')
      return
    }
    setIsProcessing(true)
    try {
      const dataUrl = await resizeToDataUrl(file)
      try {
        window.localStorage.setItem(STORAGE_KEY, dataUrl)
      } catch (err) {
        // Most likely QuotaExceededError — still show it in this session
        // even though it couldn't be persisted, so the upload doesn't feel
        // like it silently failed.
        console.error('[useSceneImage] localStorage.setItem failed', err)
        setError('Imej dipaparkan tetapi tidak dapat disimpan (storan penuh).')
      }
      setImageDataUrl(dataUrl)
    } catch (err) {
      console.error('[useSceneImage] failed to process image', err)
      setError('Tidak dapat memproses imej ini.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const clearImage = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setImageDataUrl(null)
    setError(null)
  }, [])

  return { imageDataUrl, setImage, clearImage, isProcessing, error }
}

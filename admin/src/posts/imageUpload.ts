import { api } from '../api/client'
import type { StoredImage } from '../api/types'

/** The API's own limit. Pictures are shrunk here first, so a real upload is normally far below it. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

/** Wide enough to look sharp across the reading column on a high-density screen, and no wider. */
export const MAX_EDGE = 1600

/** A small picture in a format the site accepts is sent untouched, so it is not re-compressed for nothing. */
const KEEP_ORIGINAL_BELOW = 400 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/** The size to draw a picture at so its longer edge fits the limit. Never enlarges. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= 0) return { width: 0, height: 0 }
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) }

  const scale = maxEdge / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function extensionFor(contentType: string): string {
  return contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** Shrinks and re-encodes a picture in the browser, so uploads stay small whatever the camera produced. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a picture.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That picture could not be read. Try a JPEG or PNG.')
  }

  try {
    const size = fitWithin(bitmap.width, bitmap.height)
    const unchanged = size.width === bitmap.width && size.height === bitmap.height
    if (unchanged && file.size <= KEEP_ORIGINAL_BELOW && ACCEPTED.includes(file.type)) return file

    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot prepare pictures for upload.')
    context.drawImage(bitmap, 0, 0, size.width, size.height)

    // WebP is the smallest; a browser that cannot write it hands back another type, and JPEG is used instead.
    let blob = await toBlob(canvas, 'image/webp', 0.82)
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!blob) throw new Error('This browser cannot prepare pictures for upload.')
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That picture is still too large after shrinking. Try a smaller one.')

    return blob
  } finally {
    bitmap.close()
  }
}

export async function uploadImage(file: File): Promise<StoredImage> {
  const blob = await prepareImage(file)
  return api.uploadImage(blob, `upload.${extensionFor(blob.type)}`)
}

/** Small rules for the "generate a picture" panel. No React, so they can be unit tested. */

import { MAX_CAPTION } from './sections'

export const MIN_PROMPT = 3
export const MAX_PROMPT = 500

/** Why the Generate button cannot be pressed yet, or null when it can. */
export function promptProblem(prompt: string): string | null {
  const length = prompt.trim().length
  if (length < MIN_PROMPT) return 'Describe the picture in a few words.'
  if (length > MAX_PROMPT) return `Keep the description under ${MAX_PROMPT} characters.`
  return null
}

/** How much of the day's allowance is left, in plain words. */
export function remainingText(used: number, limit: number): string {
  const left = Math.max(0, limit - used)
  if (left === 0) return 'No pictures left today. The count resets at midnight UTC.'
  return left === 1 ? '1 picture left today.' : `${left} of ${limit} pictures left today.`
}

/** The description becomes the picture's text for screen readers, unless the writer already wrote one. */
export function altFromPrompt(prompt: string): string {
  return prompt.trim().slice(0, MAX_CAPTION)
}

/** Turns the API's base64 reply into a file, so it goes through the same shrink-and-upload path as a picture from the device. */
export function base64ToFile(base64: string, contentType: string, name: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: contentType })
}

export const previewSrc = (base64: string, contentType: string) => `data:${contentType};base64,${base64}`

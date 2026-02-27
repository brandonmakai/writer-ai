import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Split text into non-empty paragraphs by double newlines. */
export function splitParagraphs(text: string): string[] {
  return text.split("\n\n").filter((p) => p.trim().length > 0)
}

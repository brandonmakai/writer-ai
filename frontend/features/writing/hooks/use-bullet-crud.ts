"use client"

import { useCallback } from "react"
import type { StoryBullet } from "@/features/writing/types"

export interface UseBulletCrudOptions {
  bullets: StoryBullet[]
  onBulletsChange: (bullets: StoryBullet[]) => void
  suggestedBulletId: string | null
  onSuggestedChange?: (id: string | null) => void
}

export function useBulletCrud({
  bullets,
  onBulletsChange,
  suggestedBulletId,
  onSuggestedChange,
}: UseBulletCrudOptions) {
  const updateBullet = useCallback(
    (id: string, field: "label" | "content", value: string) => {
      onBulletsChange(
        bullets.map((b) => (b.id === id ? { ...b, [field]: value } : b))
      )
    },
    [bullets, onBulletsChange]
  )

  const deleteBullet = useCallback(
    (id: string) => {
      const next = bullets.filter((b) => b.id !== id)
      onBulletsChange(next)
      if (
        onSuggestedChange &&
        suggestedBulletId &&
        !next.some((b) => b.id === suggestedBulletId)
      ) {
        onSuggestedChange(next[0]?.id ?? null)
      }
    },
    [bullets, onBulletsChange, suggestedBulletId, onSuggestedChange]
  )

  const addBullet = useCallback(() => {
    onBulletsChange([
      ...bullets,
      {
        id: crypto.randomUUID(),
        label: "",
        content: "",
      },
    ])
  }, [bullets, onBulletsChange])

  return { updateBullet, deleteBullet, addBullet }
}

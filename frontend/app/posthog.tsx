"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!key) return // do nothing in local dev without key set

    posthog.init(key, {
      api_host: host ?? "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      // Disable session recording for privacy — writers paste their work here
      disable_session_recording: true,
      // Do not capture text inputs or text content anywhere
      autocapture: false,
      loaded(ph) {
        if (process.env.NODE_ENV === "development") {
          // Silence PostHog in dev so it doesn't pollute your prod data
          ph.opt_out_capturing()
        }
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

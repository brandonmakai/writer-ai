import { test, expect } from "@playwright/test"

test("homepage loads without client-side console errors", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text()
      consoleErrors.push(text)
    }
  })

  await page.goto("/")

  await expect(
    page.getByPlaceholder("Paste your messy chapter here...")
  ).toBeVisible()

  if (consoleErrors.length > 0) {
    throw new Error(
      `Client-side console errors:\n${consoleErrors.join("\n")}`
    )
  }
})

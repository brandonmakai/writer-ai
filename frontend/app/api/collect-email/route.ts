import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: unknown }
  const email = body.email

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const { error } = await resend.contacts.create({ email, unsubscribed: false })

  if (error) {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

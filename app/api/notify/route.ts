import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      console.warn("Telegram Notification skipped: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in env.")
      console.log("Mock Notification Output:\n", message)
      return NextResponse.json({ success: true, warning: 'Missing tokens' })
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    })

    if (!res.ok) {
      const errorData = await res.text()
      console.error("Telegram API Error:", errorData)
      return NextResponse.json({ success: false, error: 'Telegram API Error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Notification Error:", err)
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 })
  }
}

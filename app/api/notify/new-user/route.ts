import { sendNewUserNotificationToAdmin } from '@/lib/utils/emails'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { full_name, email, company } = body

    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 })

    await sendNewUserNotificationToAdmin({ full_name: full_name ?? null, email, company: company ?? null })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[notify/new-user]', err)
    // Non-blocking — don't fail the registration flow
    return Response.json({ ok: false }, { status: 200 })
  }
}

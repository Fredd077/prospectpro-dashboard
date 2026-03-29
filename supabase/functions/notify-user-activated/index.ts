// Supabase Edge Function: notify-user-activated
// Triggered via Supabase Database Webhook on UPDATE to public.profiles
//   Filter: role = 'active' (only fires when role changes to active)
// Setup in Supabase Dashboard → Database → Webhooks → Create webhook
//   Table: profiles, Events: UPDATE
//   URL: https://<project>.supabase.co/functions/v1/notify-user-activated

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000'

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const oldRecord = payload.old_record

    // Only fire when role changes to 'active'
    if (record?.role !== 'active' || oldRecord?.role === 'active') {
      return new Response('Skipped', { status: 200 })
    }

    if (!record?.email) {
      return new Response('No email', { status: 400 })
    }

    const firstName = (record.full_name ?? record.email).split(' ')[0]

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ProspectPro <onboarding@resend.dev>',
        to: record.email,
        subject: '¡Tu cuenta en ProspectPro está activa!',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #00D9FF;">¡Bienvenido, ${firstName}!</h2>
            <p style="color: #ccc;">Tu acceso a ProspectPro ha sido aprobado. Ya puedes iniciar sesión y comenzar a trackear tus actividades comerciales.</p>
            <a href="${APP_URL}/login" style="display: inline-block; background: #00D9FF; color: #0A0A0F; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
              Entrar a ProspectPro →
            </a>
            <p style="color: #666; margin-top: 24px; font-size: 12px;">
              Si tienes alguna pregunta, responde a este email.
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(`Resend error: ${err}`, { status: 500 })
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(String(err), { status: 500 })
  }
})

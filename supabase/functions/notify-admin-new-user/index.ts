// Supabase Edge Function: notify-admin-new-user
// Triggered via Supabase Database Webhook on INSERT to public.profiles
// Setup in Supabase Dashboard → Database → Webhooks → Create webhook
//   Table: profiles, Events: INSERT
//   URL: https://<project>.supabase.co/functions/v1/notify-admin-new-user

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ADMIN_EMAIL = 'freddy.g84@gmail.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000'

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    if (!record?.email) {
      return new Response('No email in payload', { status: 400 })
    }

    // Don't notify for the admin account itself
    if (record.email === ADMIN_EMAIL) {
      return new Response('OK', { status: 200 })
    }

    const registeredAt = new Date(record.created_at).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ProspectPro <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `Nuevo usuario en ProspectPro: ${record.full_name ?? record.email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #00D9FF;">Nuevo usuario registrado</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #999; width: 120px;">Nombre</td><td>${record.full_name ?? '—'}</td></tr>
              <tr><td style="padding: 8px 0; color: #999;">Email</td><td>${record.email}</td></tr>
              <tr><td style="padding: 8px 0; color: #999;">Empresa</td><td>${record.company ?? '—'}</td></tr>
              <tr><td style="padding: 8px 0; color: #999;">Registrado</td><td>${registeredAt}</td></tr>
            </table>
            <a href="${APP_URL}/admin" style="display: inline-block; background: #00D9FF; color: #0A0A0F; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Activar usuario →
            </a>
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

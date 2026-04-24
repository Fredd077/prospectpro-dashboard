const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://prospectpro-dashboard.vercel.app'
const ADMIN_EMAIL    = 'freddy.g84@gmail.com'
const FROM_ADDRESS   = 'ProspectPro <onboarding@resend.dev>'

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

export async function sendNewUserNotificationToAdmin(user: {
  full_name: string | null
  email:     string
  company:   string | null
  created_at?: string
}): Promise<void> {
  if (user.email === ADMIN_EMAIL) return

  const registeredAt = user.created_at
    ? new Date(user.created_at).toLocaleString('es-CO', {
        timeZone:  'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;border:1px solid rgba(0,217,255,0.15);overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#0a0a0a 0%,#0d1a1f 100%);padding:32px 36px 28px;border-bottom:1px solid rgba(0,217,255,0.12);">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#00D9FF;width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                      <span style="font-size:18px;font-weight:bold;color:#0a0a0a;">↗</span>
                    </td>
                    <td style="padding-left:12px;">
                      <span style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">ProspectPro</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                  Nuevo usuario solicita acceso
                </p>
                <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.45);">
                  Revisa y activa la cuenta desde el panel de administración
                </p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:28px 36px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;">
                  <tr style="background:rgba(0,217,255,0.04);">
                    <td style="padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);">Campo</td>
                    <td style="padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);">Valor</td>
                  </tr>
                  <tr style="border-top:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.4);">Nombre</td>
                    <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#ffffff;">${user.full_name ?? '—'}</td>
                  </tr>
                  <tr style="border-top:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.4);">Email</td>
                    <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#00D9FF;">${user.email}</td>
                  </tr>
                  <tr style="border-top:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.4);">Empresa</td>
                    <td style="padding:12px 16px;font-size:13px;font-weight:500;color:#ffffff;">${user.company ?? '—'}</td>
                  </tr>
                  <tr style="border-top:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.4);">Registrado</td>
                    <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.6);">${registeredAt}</td>
                  </tr>
                </table>

                <div style="margin-top:28px;text-align:center;">
                  <a href="${APP_URL}/admin"
                     style="display:inline-block;background:#00D9FF;color:#0a0a0a;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:-0.01em;">
                    Activar usuario en el panel →
                  </a>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);text-align:center;">
                  ProspectPro · Notificación automática
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  await sendEmail(ADMIN_EMAIL, `Nuevo usuario en ProspectPro: ${user.full_name ?? user.email}`, html)
}

export async function sendUserActivatedWelcome(user: {
  full_name: string | null
  email:     string
}): Promise<void> {
  const firstName = (user.full_name ?? user.email).split(' ')[0]

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;border:1px solid rgba(0,217,255,0.15);overflow:hidden;">
            <!-- Header with glow -->
            <tr>
              <td style="background:linear-gradient(135deg,#031a1f 0%,#0a1520 50%,#0a0a0a 100%);padding:40px 36px 32px;border-bottom:1px solid rgba(0,217,255,0.12);text-align:center;">
                <div style="display:inline-block;background:#00D9FF;width:52px;height:52px;border-radius:12px;line-height:52px;text-align:center;font-size:24px;margin-bottom:20px;">✓</div>
                <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.03em;">
                  ¡Bienvenido, ${firstName}!
                </p>
                <p style="margin:10px 0 0;font-size:15px;color:#00D9FF;font-weight:500;">
                  Tu cuenta en ProspectPro está activa
                </p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px 36px;">
                <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7;">
                  Hola <strong style="color:#ffffff;">${firstName}</strong>, tu solicitud de acceso fue aprobada.
                  Ya puedes ingresar a ProspectPro y comenzar a gestionar tus actividades comerciales,
                  hacer check-ins diarios y ver tu progreso en tiempo real.
                </p>

                <!-- Feature highlights -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                  ${[
                    ['📊', 'Dashboard en tiempo real', 'Visualiza tu cumplimiento y proyecciones'],
                    ['✅', 'Check-in diario', 'Registra tus actividades Inbound y Outbound'],
                    ['🎯', 'Recetario comercial', 'Calcula cuántas actividades necesitas para tu meta'],
                  ].map(([icon, title, desc]) => `
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-size:20px;width:36px;vertical-align:top;padding-top:2px;">${icon}</td>
                          <td style="padding-left:12px;">
                            <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;">${title}</p>
                            <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">${desc}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`).join('')}
                </table>

                <div style="text-align:center;">
                  <a href="${APP_URL}/login"
                     style="display:inline-block;background:#00D9FF;color:#0a0a0a;padding:15px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:-0.01em;">
                    Entrar a ProspectPro →
                  </a>
                </div>

                <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.35);text-align:center;line-height:1.6;">
                  ¿Tienes preguntas? Responde este correo y con gusto te ayudamos.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);text-align:center;">
                  ProspectPro · ${APP_URL}
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  await sendEmail(user.email, '¡Tu cuenta en ProspectPro está activa! Bienvenido 🎉', html)
}

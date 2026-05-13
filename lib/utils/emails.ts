const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.prospectpro.cloud'
const ADMIN_EMAIL    = 'freddy.g84@gmail.com'
const FROM_ADDRESS   = 'ProspectPro <hola@prospectpro.cloud>'

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
          <table width="500" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;border:1px solid rgba(0,217,255,0.15);overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#031a1f 0%,#0a1520 60%,#0a0a0a 100%);padding:44px 40px 36px;border-bottom:1px solid rgba(0,217,255,0.12);text-align:center;">
                <table cellpadding="0" cellspacing="0" align="center" style="margin-bottom:24px;">
                  <tr>
                    <td style="background:#00D9FF;width:44px;height:44px;border-radius:10px;text-align:center;vertical-align:middle;">
                      <span style="font-size:22px;font-weight:900;color:#0a0a0a;line-height:44px;">↗</span>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">ProspectPro</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">
                  ${firstName}, tu acceso<br/>está listo. 🎯
                </p>
                <p style="margin:14px 0 0;font-size:15px;color:#00D9FF;font-weight:500;">
                  Es hora de ir por tu meta.
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 40px 28px;">
                <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.72);line-height:1.75;">
                  Hola <strong style="color:#ffffff;">${firstName}</strong> — tu cuenta fue activada y ya tienes acceso completo a ProspectPro.
                  <br/><br/>
                  Tu equipo espera resultados. Esta herramienta existe para que sepas exactamente qué hacer cada día, midas tu avance en tiempo real y llegues a tu meta <strong style="color:#ffffff;">antes de lo esperado</strong>.
                </p>

                <!-- Steps -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;">
                  <tr style="background:rgba(0,217,255,0.05);">
                    <td colspan="2" style="padding:12px 20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);">
                      Empieza aquí — 3 pasos
                    </td>
                  </tr>
                  ${[
                    ['1', 'Configura tu Recetario', 'Define tu meta de ingresos y descubre cuántas actividades necesitas por día.'],
                    ['2', 'Haz tu primer Check-in', 'Registra tus actividades de hoy. Un minuto al día, claridad total.'],
                    ['3', 'Revisa tu Dashboard', 'Ve tu ritmo, tu cumplimiento y si vas en camino a cerrar el mes.'],
                  ].map(([num, title, desc]) => `
                  <tr style="border-top:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:16px 20px;vertical-align:top;width:36px;">
                      <div style="width:26px;height:26px;border-radius:50%;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);text-align:center;line-height:26px;font-size:12px;font-weight:700;color:#00D9FF;">${num}</div>
                    </td>
                    <td style="padding:16px 20px 16px 0;vertical-align:top;">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${title}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.42);line-height:1.5;">${desc}</p>
                    </td>
                  </tr>`).join('')}
                </table>

                <!-- CTA -->
                <div style="text-align:center;margin-bottom:28px;">
                  <a href="${APP_URL}"
                     style="display:inline-block;background:#00D9FF;color:#0a0a0a;padding:16px 44px;border-radius:9px;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:-0.01em;">
                    Entrar a ProspectPro →
                  </a>
                  <p style="margin:14px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">
                    ${APP_URL}
                  </p>
                </div>

                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);text-align:center;line-height:1.7;">
                  ¿Tienes dudas? Escríbenos a
                  <a href="mailto:hola@prospectpro.cloud" style="color:#00D9FF;text-decoration:none;">hola@prospectpro.cloud</a>
                  y te ayudamos de inmediato.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);text-align:center;line-height:1.6;">
                  ProspectPro · Tu Command Center comercial<br/>
                  <a href="${APP_URL}" style="color:rgba(0,217,255,0.4);text-decoration:none;">${APP_URL}</a>
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  await sendEmail(user.email, `${firstName}, tu acceso a ProspectPro está listo — empieza hoy`, html)
}

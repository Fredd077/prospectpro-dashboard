'use client'

import { useState } from 'react'
import { TrendingUp, ChevronDown, ArrowLeft, BookOpen, User, Users, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'start' | 'seller' | 'manager' | 'integration'

interface Step {
  label: string
  detail?: string
}

interface Section {
  title: string
  icon: string
  steps: (string | Step)[]
  tip?: string
  warning?: string
}

/* ─── CONTENT ─────────────────────────────────────────────────────────────── */

const SECTIONS: Record<Tab, Section[]> = {

  /* ── PRIMEROS PASOS ─────────────────────────────────────────────────────── */
  start: [
    {
      icon: '👤',
      title: 'Paso 1 — Acceso y perfil',
      steps: [
        'Al registrarte, tu cuenta queda en revisión. El administrador la activará y recibirás un correo de bienvenida.',
        'Tienes 14 días de prueba gratuita desde el momento de activación. Un banner en la parte superior te avisa cuándo se acerca el vencimiento.',
        'Una vez activo, ingresa con tu email y contraseña o con Google.',
        'Al entrar por primera vez pasarás por el onboarding: configura tu nombre, empresa y preferencias básicas.',
      ],
      tip: 'Si tu cuenta lleva más de 24h en revisión, escríbenos por WhatsApp.',
    },
    {
      icon: '🎯',
      title: 'Paso 2 — Define tus Actividades',
      steps: [
        { label: 'Ve a "Actividades" en el menú lateral.', detail: 'Las actividades son los tipos de prospección que realizas: llamadas frías, DMs de LinkedIn, networking, referidos, leads, etc.' },
        'Crea cada actividad con: nombre, canal, tipo (OUTBOUND o INBOUND) y metas diarias, semanales y mensuales.',
        { label: 'Asigna una Tasa de conversión a cada actividad (opcional pero recomendado).', detail: 'Es el % de esas actividades que históricamente generan una reunión. Ej: si envías 10 emails fríos y consigues 1 reunión, tu tasa es 10%. Esto conecta tu actividad con el pipeline y muestra cuántas actividades necesitas para cumplir tu cuota.' },
        { label: 'Asigna Reuniones esperadas por mes.', detail: 'Cuántas reuniones esperas generar mensualmente con esa actividad. El Recetario usa este dato para calcular la alineación de citas.' },
        'Solo las actividades en estado "Activo" se cuentan en el dashboard y el check-in.',
      ],
      tip: 'Entre más precisas sean las tasas de conversión, más útil será el análisis de rendimiento.',
    },
    {
      icon: '🧪',
      title: 'Paso 3 — Crea tu Recetario comercial',
      steps: [
        { label: 'Ve a "Recetario" en el menú lateral.', detail: 'El recetario es tu fórmula de prospección: define cuántas actividades de cada tipo debes ejecutar para alcanzar tu cuota de ingresos.' },
        'Crea un escenario con nombre (ej. "Q3 2026"), meta mensual de ingresos, ticket promedio y porcentaje OUTBOUND/INBOUND.',
        'ProspectPro calculará automáticamente cuántos cierres, citas y actividades necesitas por semana.',
        'Activa el escenario. Solo puede haber uno activo a la vez.',
        { label: 'Explora la pestaña "Rendimiento" dentro del escenario.', detail: 'Muestra en tiempo real si tus actividades reales están generando las reuniones y cierres necesarios para cumplir la meta. Es el puente entre tu actividad diaria y tu pipeline real.' },
      ],
      tip: 'El recetario es tu fórmula. Si la sigues cada semana, la cuota se cumple matemáticamente.',
    },
    {
      icon: '✅',
      title: 'Paso 4 — Haz tu primer Check-in',
      steps: [
        'Ve a "Check-in Diario" en el menú lateral.',
        'Verás una tarjeta por cada actividad activa. Ingresa cuántas veces la ejecutaste hoy.',
        'El sistema calcula automáticamente tu cumplimiento del día según tus metas.',
        'Guarda el check-in. Solo se registra uno por día — si vuelves, puedes editarlo.',
        'También puedes registrar check-ins de días anteriores navegando por el calendario.',
      ],
      tip: '2 minutos al final de tu jornada. Esa constancia es lo que hace funcionar todo el sistema.',
    },
    {
      icon: '💼',
      title: 'Paso 5 — Registra tus negocios en el Pipeline',
      steps: [
        'Ve a "Mi Pipeline" en el menú lateral.',
        { label: 'Las 5 etapas del pipeline son:', detail: '① Cita agendada → ② Reagendar → ③ 1ra Reunión ejecutada → ④ Propuesta Presentada → ⑤ Por facturar/cobrar' },
        'Crea una entrada por cada negocio: nombre del prospecto, empresa, valor estimado, etapa actual y origen (OUTBOUND o INBOUND).',
        { label: 'Vincula el negocio a la actividad de origen.', detail: 'Esto permite que el Recetario y el Dashboard muestren cuántas reuniones y cierres generó cada tipo de actividad, y cuánto dinero aportó.' },
        'Avanza la etapa a medida que el negocio progresa. Al marcarlo como "Ganado" quedará en "Por facturar/cobrar".',
      ],
      tip: 'Pipeline actualizado = forecast honesto. Sin datos, el sistema no puede darte proyecciones reales.',
    },
    {
      icon: '🔗',
      title: 'Paso 6 — Conecta tu CRM (opcional)',
      steps: [
        { label: 'Ve a "Integraciones" en el menú lateral.', detail: 'Si usas un CRM como Pipedrive, puedes conectarlo para que los movimientos de negocios se sincronicen automáticamente con tu pipeline en ProspectPro.' },
        'La sección de Integraciones tiene el paso a paso completo dentro de la app — incluyendo cómo crear el webhook, mapear etapas y verificar que funciona.',
        'Una vez conectado, cada vez que mueves un trato en tu CRM, ProspectPro lo registra automáticamente.',
        'Consulta la pestaña "Integraciones" en esta guía para el tutorial completo paso a paso.',
      ],
    },
  ],

  /* ── VENDEDOR ───────────────────────────────────────────────────────────── */
  seller: [
    {
      icon: '☀️',
      title: 'Check-in diario — La rutina de 2 minutos',
      steps: [
        'Abre ProspectPro al final de tu jornada laboral.',
        'Ve a "Check-in Diario" y registra cuántas veces ejecutaste cada actividad.',
        'No dejes pasar el día sin hacerlo — el sistema solo acepta un check-in por fecha.',
        { label: 'Si olvidaste un día:', detail: 'Entra al Check-in, haz clic en el ícono de calendario y selecciona la fecha que quieres registrar.' },
        'El semáforo del día cambia en tiempo real a medida que ingresas los datos.',
      ],
      tip: 'Sin check-in no hay datos. Sin datos, el Coach IA no puede ayudarte ni el manager puede verte.',
    },
    {
      icon: '📊',
      title: 'Dashboard — Todo tu rendimiento en una pantalla',
      steps: [
        { label: 'KPIs principales (fila superior):', detail: 'Cumplimiento % ponderado · Actividades reales vs meta · Desviación acumulada · Proyección al cierre del período' },
        { label: 'Recetario (card izquierda):', detail: 'Muestra la Alineación de Citas: cuántas citas estás proyectando generar vs cuántas necesitas para cumplir la meta de ingresos. Verde = vas bien, rojo = brecha crítica.' },
        { label: 'Funnel Real (card derecha):', detail: 'Conteos de negocios por etapa + Revenue (Ganado / Pipeline abierto / Perdido / Ticket promedio) + Tasas de conversión (Reunión→Propuesta, Propuesta→Cierre, Tasa ganados) + Desglose por origen OUTBOUND/INBOUND.' },
        'Cambia el período con el selector superior (Hoy / Semana / Mes / Trimestre / Año). Los datos del Funnel se actualizan según el período seleccionado.',
        { label: 'Rendimiento de actividades (fila inferior):', detail: 'Tabla con cada actividad: reuniones esperadas, reuniones reales generadas, eficiencia de canal %, cierres reales y contribución en $ al período. Semáforo individual por actividad.' },
      ],
      tip: 'El dashboard no es solo para reportar — es para decidir. Si ves rojo en una actividad, esa es la que necesita más ejecución hoy.',
    },
    {
      icon: '💼',
      title: 'Mi Pipeline — Gestiona tus negocios',
      steps: [
        { label: 'Las 5 etapas en orden:', detail: '① Cita agendada — tienes la reunión confirmada\n② Reagendar — la reunión se pospuso\n③ 1ra Reunión ejecutada / Propuesta en preparación — tuviste el primer contacto real\n④ Propuesta Presentada — el cliente tiene la propuesta en mano\n⑤ Por facturar/cobrar — negocio ganado' },
        'Crea cada negocio con: nombre del prospecto, empresa, valor estimado ($), fecha de entrada y etapa inicial.',
        { label: 'Origen del negocio:', detail: 'Marca si es OUTBOUND (tú lo iniciaste) o INBOUND (el cliente llegó a ti). Esto afecta las estadísticas de conversión por canal en el dashboard.' },
        'El filtro de "Estado" te permite ver solo los negocios Abiertos, Ganados o Perdidos.',
        { label: 'Analytics del pipeline (parte inferior):', detail: 'Revenue: progreso hacia meta mensual, ganado, pipeline abierto, perdido, ticket promedio. Conversión: tasas entre etapas. Por etapa y origen: cuántos OUTBOUND e INBOUND tienes en cada fase.' },
      ],
      tip: 'Un pipeline desactualizado da falsas proyecciones. 5 minutos al día moviendo etapas vale más que un reporte mensual.',
    },
    {
      icon: '🧪',
      title: 'Recetario — Tu fórmula y tu rendimiento real',
      steps: [
        { label: 'Pestaña "Escenario":', detail: 'Muestra la matemática de tu plan: dada tu meta de ingresos y tu ticket promedio, ¿cuántos cierres, citas y actividades necesitas por semana?' },
        { label: 'Pestaña "Rendimiento" (la más importante):', detail: 'Compara lo que el recetario espera vs lo que estás ejecutando realmente. Filtra por mes para ver períodos históricos.' },
        { label: 'Columnas clave del Rendimiento:', detail: '• Reuniones Esperadas: cuántas reuniones debería generar esa actividad según tu configuración\n• Tasa %: tu tasa de conversión de actividad a reunión\n• Act. Req./mes: cuántas actividades necesitas ejecutar mensualmente para generar esas reuniones\n• Reuniones Reales: reuniones realmente generadas en el pipeline (vinculadas por origen)\n• Eficiencia Canal %: Reuniones Reales ÷ Reuniones Esperadas × 100\n• Cierres Reales: negocios en etapa "Por facturar/cobrar" originados por esa actividad\n• Contrib. $: monto real ganado gracias a esa actividad en el período' },
        'La fila "Total OUTBOUND", "Total INBOUND" y "TOTAL GLOBAL" al final resumen el rendimiento por canal.',
        { label: 'Alineación de Citas (tarjetas superiores):', detail: 'Compara tus Citas Proyectadas (suma de reuniones esperadas configuradas) vs las Citas Requeridas (las que matemáticamente necesitas para cerrar tu meta). Verde = estás encaminado. Rojo = necesitas ajustar tasas o actividades.' },
      ],
      tip: 'Si la Eficiencia de un canal es 0%, no estás generando reuniones con esa actividad. O ajusta la actividad, o redirige esa energía a donde sí convierte.',
    },
    {
      icon: '🤖',
      title: 'Reportes Coach IA — Tu análisis inteligente',
      steps: [
        'Ve a "Reportes Coach IA" en el menú. El punto rojo indica reportes sin leer.',
        { label: 'Tipos de reporte:', detail: '• DIARIO: generado cada día hábil con análisis de tu actividad, alerta de pipeline, proyección y acciones prioritarias\n• SEMANAL: resumen de la semana, tendencias y recomendaciones para la siguiente\n• MENSUAL: cierre del período, análisis de canales y proyección del siguiente mes' },
        'Los reportes se muestran colapsados — solo verás el tipo, período y una línea del resumen. Haz clic para expandir el que te interese.',
        { label: 'Secciones del reporte:', detail: '• Resumen ejecutivo: diagnóstico en 2-3 líneas\n• Diagnóstico: qué está pasando con tu actividad\n• Proyección: probabilidad de cumplir la meta al ritmo actual\n• Acciones prioritarias: ALTO / MEDIO / BAJO con plazo concreto\n• Efectividad de canales: qué canales están convirtiendo y cuáles no\n• Mensaje motivacional' },
        'Puedes generar un reporte manualmente con el botón "Generar reporte" (no esperes al automático).',
        'Usa el filtro Todos / Diarios / Semanales / Mensuales para navegar el historial.',
      ],
      tip: 'Lee el reporte diario al inicio del día siguiente. Te dice exactamente qué hacer hoy para recuperar terreno.',
    },
  ],

  /* ── MANAGER ────────────────────────────────────────────────────────────── */
  manager: [
    {
      icon: '👥',
      title: 'Vista del equipo en tiempo real',
      steps: [
        'Ve a "Mi Equipo" en el menú lateral (visible solo para managers y admins).',
        'Verás todos los vendedores de tu equipo con semáforo individual de cumplimiento.',
        { label: 'Semáforos:', detail: '🟢 Verde = ≥ 90% · 🟡 Amarillo = 70–89% · 🔴 Rojo = < 70%' },
        'Haz clic en un vendedor para ver su detalle completo: actividades, dashboard, pipeline y reportes individuales.',
        'Usa el filtro de período para comparar rendimiento semanal vs mensual de todo el equipo de un vistazo.',
      ],
      tip: 'Revisa el equipo cada lunes. Los semáforos rojos del viernes son señal de acción inmediata para la semana.',
    },
    {
      icon: '🧠',
      title: 'Gerente IA — Análisis inteligente del equipo',
      steps: [
        'Ve a "Gerente AI" en el menú lateral.',
        'Selecciona el vendedor que quieres analizar, o deja "Equipo completo" para una visión global.',
        'Haz clic en "Generar análisis" para que la IA procese los datos actuales del equipo.',
        { label: 'El análisis incluye:', detail: '• Resumen ejecutivo del equipo\n• Diagnóstico: quién está bien, quién está en riesgo y por qué\n• Ranking de rendimiento por cumplimiento %\n• Alertas individuales con acción recomendada por vendedor\n• Proyección del período\n• Acciones de gestión priorizadas (ALTO / MEDIO / BAJO)' },
        'Genera el análisis antes de cada 1-a-1 o reunión de equipo. Llega con datos concretos.',
      ],
      tip: 'El análisis de equipo es diferente al del vendedor: se enfoca en gestión, no en ejecución personal.',
    },
    {
      icon: '🧪',
      title: 'Recetario del equipo — Rendimiento por vendedor',
      steps: [
        'Cada vendedor tiene su propio Recetario y su pestaña de Rendimiento.',
        'Desde el perfil de un vendedor (en Mi Equipo → Ver perfil), puedes acceder a su Recetario activo.',
        { label: 'Lo que debes monitorear en el Rendimiento de cada vendedor:', detail: '• Eficiencia de canal %: ¿sus actividades están generando reuniones?\n• Cierres Reales vs Esperados: ¿el pipeline que genera se está convirtiendo?\n• Contribución $: ¿cuánto dinero real está produciendo cada canal?' },
        'Si un vendedor tiene alta actividad pero baja eficiencia, el problema está en la calidad de la ejecución, no en el volumen.',
        'Si tiene alta eficiencia pero baja actividad, el problema es disciplina y constancia.',
      ],
    },
    {
      icon: '📬',
      title: 'Reportes automáticos del equipo',
      steps: [
        'Los reportes del equipo se generan automáticamente cada viernes (semanal) y al cierre de cada mes (mensual).',
        { label: 'Reporte semanal del equipo incluye:', detail: '• Cumplimiento global del equipo\n• Ranking de vendedores\n• Alertas individuales\n• Acciones de gestión recomendadas para la semana siguiente' },
        { label: 'Reporte mensual del equipo incluye:', detail: '• Cierre del período vs meta\n• Tendencia mensual por vendedor\n• Proyección del siguiente mes\n• Análisis de pipeline del equipo' },
        'Accede a los reportes desde "Reportes Coach IA" → pestaña "Equipo".',
        'Los reportes están colapsados por defecto — el más reciente arranca expandido.',
      ],
      tip: 'Los reportes son el insumo para tus reuniones de equipo. No hay que preparar nada — el sistema lo hace por ti.',
    },
    {
      icon: '📈',
      title: 'Pipeline del equipo',
      steps: [
        'Desde el perfil de un vendedor puedes ver su pipeline individual con todas sus oportunidades.',
        'Identifica negocios estancados: oportunidades que llevan demasiado tiempo en la misma etapa.',
        { label: 'Métricas del pipeline por vendedor:', detail: '• Valor ganado en el período\n• Pipeline abierto (propuestas activas)\n• Ticket promedio real\n• Tasas de conversión: Reunión→Propuesta y Propuesta→Cierre\n• Desglose OUTBOUND / INBOUND por etapa' },
        'Usa las tasas de conversión para identificar dónde se pierde el negocio: ¿en la primera reunión? ¿en la propuesta? ¿al cierre?',
        'Un vendedor con 100% Reunión→Propuesta pero 10% Propuesta→Cierre tiene un problema de negociación, no de prospección.',
      ],
    },
  ],

  /* ── INTEGRACIONES ──────────────────────────────────────────────────────── */
  integration: [
    {
      icon: '🔗',
      title: '¿Para qué sirve la integración con tu CRM?',
      steps: [
        { label: '¿Qué hace?', detail: 'Conecta tu CRM (por ejemplo Pipedrive) con ProspectPro mediante un webhook. Cada vez que mueves un negocio de etapa en tu CRM, ProspectPro lo registra automáticamente en tu pipeline.' },
        { label: '¿Qué se sincroniza?', detail: 'La etapa del negocio, el nombre del prospecto y la empresa, el valor del trato (monto), el estado (abierto / ganado / perdido) y la fuente (Pipedrive).' },
        { label: '¿Qué NO hace?', detail: 'No reemplaza el check-in de actividades — eso lo sigues registrando tú. La integración solo mueve los negocios del pipeline automáticamente.' },
        'Una vez configurada, no necesitas hacer nada más. La sincronización es automática y en tiempo real.',
      ],
      tip: 'Si usas Pipedrive y también registras manualmente en ProspectPro, usa el botón "Limpiar pipeline de Pipedrive" para evitar duplicados antes de activar la integración.',
    },
    {
      icon: '⚙️',
      title: 'Paso 1 — Configura las credenciales en ProspectPro',
      steps: [
        { label: 'Ve a "Integraciones" en el menú lateral de ProspectPro.', detail: 'Esta sección solo la verás si tu administrador la habilitó para tu cuenta.' },
        'En el campo "Nombre del CRM", escribe: Pipedrive',
        'En "URL base de la API del CRM", escribe: https://api.pipedrive.com/v1',
        { label: 'En "API Key del CRM", pega tu API Key de Pipedrive.', detail: 'Para encontrarla en Pipedrive: haz clic en tu avatar (arriba a la derecha) → Configuración personal → API → Copia tu "API token personal".' },
        'Haz clic en "Guardar configuración".',
      ],
    },
    {
      icon: '🗺️',
      title: 'Paso 2 — Genera tu API Key de ProspectPro',
      steps: [
        'En la misma página de Integraciones, desplázate hacia abajo hasta la sección "API Key".',
        { label: 'Si aún no tienes una clave, haz clic en "Generar API Key".', detail: 'Esta clave es la contraseña que usará Pipedrive para autenticarse con ProspectPro. Guárdala en un lugar seguro.' },
        'Copia la URL del Endpoint que aparece arriba. La necesitarás en el siguiente paso.',
        '⚠️ Si regeneras la clave, el webhook anterior dejará de funcionar. Tendrás que actualizarlo en Pipedrive.',
      ],
      warning: 'Nunca compartas tu API Key. Es como una contraseña de acceso a tus datos.',
    },
    {
      icon: '🔌',
      title: 'Paso 3 — Crea el Webhook en Pipedrive',
      steps: [
        { label: 'En Pipedrive, ve a: Herramientas → Webhooks → Crear nuevo webhook', detail: '(Si no ves "Webhooks", ve a Configuración → Integraciones → Webhooks)' },
        { label: 'Configura el webhook así:', detail: '• Acción del evento: * (todas)\n• Event objects: deal\n• URL de punto de término: pega la URL del Endpoint de ProspectPro\n• Al final de la URL agrega: ?key=TU_API_KEY (reemplaza TU_API_KEY por la clave que copiaste)' },
        'Deja los campos de autenticación HTTP vacíos.',
        'Haz clic en "Guardar".',
        { label: 'Para verificar que funciona:', detail: 'Mueve cualquier trato de etapa en Pipedrive. Vuelve a Integraciones en ProspectPro y revisa "Últimas llamadas". Deberías ver una entrada nueva con estado "processed".' },
      ],
      tip: 'Ejemplo de URL completa: https://app.prospectpro.cloud/api/webhooks/inbound/TuEmpresa?key=abc123xyz',
    },
    {
      icon: '🗂️',
      title: 'Paso 4 — Mapea las etapas de Pipedrive',
      steps: [
        { label: '¿Qué es el mapeo de etapas?', detail: 'Pipedrive maneja sus etapas con números internos (IDs). Necesitas decirle a ProspectPro qué número de etapa de Pipedrive corresponde a qué etapa de ProspectPro.' },
        { label: 'Cómo encontrar los IDs de etapa en Pipedrive:', detail: 'Opción 1: Mueve un trato a cada etapa y revisa en ProspectPro → Integraciones → Últimas llamadas. El payload del webhook muestra el campo "stage_id" con el número.\n\nOpción 2: En Pipedrive, ve a Configuración → Personalizar Pipedrive → Etapas del pipeline. La URL del navegador mostrará el ID de cada etapa.' },
        { label: 'En ProspectPro → Integraciones → Configuración de Pipedrive:', detail: 'Ingresa el número de ID correspondiente en cada campo:\n• Cita agendada = ID de tu etapa "Reunión agendada" en Pipedrive\n• Reagendar = ID de tu etapa de reagendamiento\n• 1ra Reunión = ID de tu etapa "Primera reunión"\n• Propuesta = ID de tu etapa "Propuesta presentada"\n• Cierre = ID de tu etapa "Ganado" o "Por facturar"' },
        'Haz clic en "Guardar configuración".',
        { label: 'Si una etapa de Pipedrive no tiene equivalente en ProspectPro:', detail: 'Déjala vacía. Los tratos en esas etapas serán ignorados hasta que los muevas a una etapa mapeada.' },
      ],
      tip: 'No necesitas mapear todas las etapas. Con mapear Reunión, Propuesta y Cierre es suficiente para empezar.',
    },
    {
      icon: '🔒',
      title: 'Paso 5 — Filtra solo tus negocios (recomendado)',
      steps: [
        { label: '¿Por qué es importante este paso?', detail: 'Si tu cuenta de Pipedrive es compartida con compañeros, sin este filtro ProspectPro sincronizaría los tratos de TODOS los usuarios, no solo los tuyos.' },
        { label: 'Cómo encontrar tu ID de usuario en Pipedrive:', detail: 'Ve a tu perfil en Pipedrive → Configuración personal → busca el campo "ID de usuario". También puedes ver el número en la URL cuando estás en tu perfil: la parte después de "/user/" es tu ID.' },
        'En ProspectPro → Integraciones → Configuración de Pipedrive, pega tu ID en el campo "Tu ID de usuario en Pipedrive".',
        'Guarda la configuración.',
        { label: 'Prueba el filtro:', detail: 'Mueve un trato tuyo en Pipedrive. Revisa en "Últimas llamadas" que aparezca como "processed". Luego pídele a un compañero que mueva un trato suyo — ese debería aparecer como "skipped".' },
      ],
      warning: 'Sin este filtro, los tratos de tus compañeros se mezclarán en tu pipeline de ProspectPro.',
    },
    {
      icon: '🔍',
      title: 'Verificación y solución de problemas',
      steps: [
        { label: 'La sección "Últimas llamadas" en Integraciones muestra el historial de webhooks:', detail: '• 🔵 received: ProspectPro recibió el evento (aún procesando)\n• 🟢 processed: El trato se sincronizó correctamente. La columna Detalle muestra la etapa, estado y monto (ej: "pipedrive:12345 → Propuesta Presentada / abierto | $5.000")\n• 🟡 skipped: El evento fue ignorado (trato de otro usuario, etapa no mapeada, etc.)\n• 🔴 error: Algo salió mal. Lee el detalle para entender qué ocurrió.' },
        { label: 'El trato se procesó pero no veo el monto ($0 o vacío):', detail: 'El trato en Pipedrive no tiene valor asignado. Abre el trato en Pipedrive, asigna el valor y muévelo a cualquier etapa para que el webhook se vuelva a disparar.' },
        { label: 'El webhook aparece como "skipped: Stage ID XX not mapped":', detail: 'El trato está en una etapa de Pipedrive que no mapeaste. Ve a Configuración de Pipedrive en ProspectPro y agrega el mapeo de esa etapa.' },
        { label: 'No aparece nada en "Últimas llamadas":', detail: 'El webhook no está llegando. Verifica: (1) que la URL del webhook en Pipedrive es correcta, (2) que el ?key= al final coincide con tu API Key actual, (3) que el webhook en Pipedrive está activo.' },
        { label: 'Hay negocios duplicados en mi pipeline:', detail: 'Usa el botón "Limpiar pipeline de Pipedrive" para eliminar todas las entradas sincronizadas desde Pipedrive y empezar limpio. Luego mueve tus tratos en Pipedrive para re-sincronizarlos.' },
      ],
      tip: 'Si después de estos pasos aún tienes problemas, haz clic en cualquier fila de "Últimas llamadas" para ver el payload completo y copiarlo. Envíaselo al soporte — con ese dato resolvemos el problema en minutos.',
    },
  ],
}

/* ─── TABS ───────────────────────────────────────────────────────────────── */
const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'start',       label: 'Primeros pasos', icon: BookOpen },
  { id: 'seller',      label: 'Vendedor',       icon: User    },
  { id: 'manager',     label: 'Manager',        icon: Users   },
  { id: 'integration', label: 'Integraciones',  icon: Plug    },
]

const TAB_DESCRIPTION: Record<Tab, string> = {
  start:       'Si acabas de registrarte, empieza aquí. Estos 6 pasos te dejan listo para que los datos fluyan desde el día uno.',
  seller:      'Tu guía diaria como vendedor: check-in, dashboard, pipeline, recetario con tasas de conversión y reportes del Coach IA.',
  manager:     'Accede al equipo en tiempo real, analiza con el Gerente IA, interpreta el rendimiento por vendedor y recibe reportes automáticos.',
  integration: 'Conecta tu CRM (Pipedrive u otro) con ProspectPro. Paso a paso para usuarios no técnicos — sin código, sin configuraciones complicadas.',
}

/* ─── ACCORDION ─────────────────────────────────────────────────────────── */
function AccordionItem({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      open ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-border/80'
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">{section.icon}</span>
          <span className="text-sm font-semibold text-foreground">{section.title}</span>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="h-px bg-border/60" />
          <ol className="space-y-3">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {typeof step === 'string' ? (
                    step
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{step.label}</span>
                      {step.detail && (
                        <>
                          <br />
                          <span className="text-xs opacity-80 whitespace-pre-line">{step.detail}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {section.warning && (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-amber-400 leading-relaxed">{section.warning}</p>
            </div>
          )}
          {section.tip && (
            <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="text-sm">💡</span>
              <p className="text-xs text-primary/90 leading-relaxed">{section.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── PAGE ───────────────────────────────────────────────────────────────── */
export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<Tab>('start')

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
          <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">ProspectPro</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm text-muted-foreground">Guía de uso</span>
          </div>
          <a href="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
            Ir a la app →
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            📖 Guía completa de uso
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Empieza a prosperar con sistema
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Todo lo que necesitas saber para sacarle el máximo provecho a ProspectPro — desde tu primer check-in hasta conectar tu CRM.
          </p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-border bg-card p-1 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all',
                activeTab === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div className="rounded-xl border border-border bg-card/50 px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{TAB_DESCRIPTION[activeTab]}</p>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS[activeTab].map((section, i) => (
            <AccordionItem key={i} section={section} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">¿Tienes dudas puntuales?</p>
          <p className="text-xs text-muted-foreground">
            Escríbenos por WhatsApp y te ayudamos en minutos.
          </p>
          <a
            href="https://wa.me/573164283749"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#20b858] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contactar soporte
          </a>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'ProspectPro — Tu War Room Comercial con IA',
  description: 'Coach IA diario, pipeline en tiempo real y reportes automáticos para equipos de ventas B2B en LATAM.',
}

export default function RootPage() {
  return <LandingPage />
}

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Providers } from '@/components/providers'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'ProspectPro',
    template: '%s — ProspectPro',
  },
  description: 'Seguimiento profesional de actividades de prospección comercial',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="flex h-full bg-background text-foreground antialiased">
        <Providers>
          <KeyboardShortcuts />
          <Sidebar />
          {/* Offset by sidebar: icon-only on md, full on lg */}
          <div className="ml-16 lg:ml-60 flex flex-1 flex-col overflow-hidden transition-all">
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}

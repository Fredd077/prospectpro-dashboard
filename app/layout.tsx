import type { Metadata } from 'next'
import { Syne } from 'next/font/google'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Providers } from '@/components/providers'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
      className={`${syne.variable} ${jetbrainsMono.variable} dark h-full`}
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

import type { Metadata } from 'next'
import React from 'react'

import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import './styles.css'

export const metadata: Metadata = {
  description: 'Medical writing, systematic review and publication support insights | Pubrica',
  title: 'Pubrica',
  icons: { icon: '/pubrica-icon.webp' },
  robots: {
    index: false,
    follow: false,
  },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}

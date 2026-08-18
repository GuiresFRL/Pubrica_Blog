import type { Metadata } from 'next'
import React from 'react'

import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import './styles.css'

export const metadata: Metadata = {
  description: 'Masters and MBA Research Writing Services | Tutors India',
  title: 'Tutors India',
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

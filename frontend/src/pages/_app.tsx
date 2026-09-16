import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

import '../styles/globals.css'
import '../styles/app-surfaces.css'

const sans = Inter({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-sans',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.documentElement.classList.add(sans.variable)
    return () => document.documentElement.classList.remove(sans.variable)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <div className={`${sans.variable} ${sans.className} font-normal antialiased`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  )
}

import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from "./providers"

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Heygen Claude Avatar',
  description: 'An interactive avatar powered by Heygen and Claude',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
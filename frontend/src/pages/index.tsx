import Head from 'next/head'
import Link from 'next/link'
import { BrandLockup, IconArrow } from '../components/icons'
import { SandboxBanner } from '../components/SandboxBanner'
import { ThemeToggle } from '../components/ThemeToggle'

export default function Home() {
  return (
    <>
      <Head><title>MoMo Sentry</title></Head>
      <div className="gate">
        <SandboxBanner />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 28px 0' }}>
          <ThemeToggle />
        </div>
        <div className="gate-body">
          <Link href="/agent" className="gate-pane">
            <div>
              <BrandLockup />
              <h2>Booth check</h2>
              <p>Check a customer&rsquo;s number before paying out. Returns SAFE, CAUTION or STOP.</p>
            </div>
            <div className="gate-go">Open booth check <IconArrow /></div>
          </Link>
          <Link href="/sentry" className="gate-pane">
            <div>
              <div className="brand-kicker" style={{ color: '#e0a276' }}>Operations</div>
              <h2>Queue and map</h2>
              <p>Every check from every booth, as a table and as pins on Lusaka.</p>
            </div>
            <div className="gate-go">Open operations <IconArrow /></div>
          </Link>
        </div>
      </div>
    </>
  )
}

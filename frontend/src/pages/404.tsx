import Head from 'next/head'
import Link from 'next/link'
import { BrandLockup, IconArrow } from '../components/icons'

export default function Custom404() {
  return (
    <>
      <Head><title>Not found — Lintel Zambia</title></Head>
      <div className="auth-page">
        <div className="auth-main">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><BrandLockup /></div>
            <div className="metric-label" style={{ marginTop: 26 }}>Error 404</div>
            <h1 style={{ marginTop: 8 }}>This page is not part of Sentry.</h1>
            <p className="lede">Use the booth check or the owner queue.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/agent" className="btn">Booth check <IconArrow /></Link>
              <Link href="/sentry" className="btn btn-ghost">Operations</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

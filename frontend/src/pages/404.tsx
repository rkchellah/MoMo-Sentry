import Head from 'next/head'
import Link from 'next/link'

export default function Custom404() {
  return (
    <>
      <Head><title>Not found — MoMo Sentry</title></Head>
      <div className="auth-page">
        <div className="auth-center">
          <h1>Page not found</h1>
          <div className="auth-actions" style={{ width: '100%' }}>
            <Link href="/agent">Log in</Link>
            <Link href="/sentry" className="auth-continue">Continue</Link>
          </div>
        </div>
      </div>
    </>
  )
}

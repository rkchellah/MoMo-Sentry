import { Html, Head, Main, NextScript } from 'next/document'

/** Applied before paint so the first frame already has the right theme. */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('sentry-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export default function Document() {
  return (
    <Html lang="en" data-theme="light">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#f4f4f4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

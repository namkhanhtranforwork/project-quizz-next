import Head from 'next/head'
import { LegacyPortalFrame } from '@/components/layouts/legacy-portal-frame'

export default function Home() {
  return (
    <>
      <Head>
        <title>Lớp học của cô</title>
        <meta name="description" content="Nền tảng học tập và quản lý lớp học" />
      </Head>
      <LegacyPortalFrame title="Lớp học của cô" src="/legacy/index.html" />
    </>
  )
}

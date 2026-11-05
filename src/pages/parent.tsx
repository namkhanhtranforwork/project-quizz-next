import Head from 'next/head'
import { LegacyPortalFrame } from '@/components/layouts/legacy-portal-frame'

export default function ParentPage() {
  return (
    <>
      <Head>
        <title>Phụ huynh | Lớp học của cô</title>
      </Head>
      <div className="portal-route portal-route-parent">
        <LegacyPortalFrame title="Cổng Phụ huynh" src="/legacy/parent.html" />
      </div>
    </>
  )
}

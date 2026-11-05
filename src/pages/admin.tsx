import Head from 'next/head'
import { LegacyPortalFrame } from '@/components/layouts/legacy-portal-frame'

export default function AdminPage() {
  return (
    <>
      <Head>
        <title>Quản trị | Lớp học của cô</title>
      </Head>
      <div className="portal-route portal-route-admin">
        <LegacyPortalFrame title="Cổng Quản trị" src="/legacy/admin.html" />
      </div>
    </>
  )
}

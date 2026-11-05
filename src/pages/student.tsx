import Head from 'next/head'
import { LegacyPortalFrame } from '@/components/layouts/legacy-portal-frame'

export default function StudentPage() {
  return (
    <>
      <Head>
        <title>Học sinh | Lớp học của cô</title>
      </Head>
      <div className="portal-route portal-route-student">
        <LegacyPortalFrame title="Cổng Học sinh" src="/legacy/student.html" />
      </div>
    </>
  )
}

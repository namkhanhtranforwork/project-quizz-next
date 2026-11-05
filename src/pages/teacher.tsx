import Head from 'next/head'
import { LegacyPortalFrame } from '@/components/layouts/legacy-portal-frame'

export default function TeacherPage() {
  return (
    <>
      <Head>
        <title>Giáo viên | Lớp học của cô</title>
      </Head>
      <div className="portal-route portal-route-teacher">
        <LegacyPortalFrame title="Cổng Giáo viên" src="/legacy/teacher.html" />
      </div>
    </>
  )
}

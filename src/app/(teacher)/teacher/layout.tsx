import type { ReactNode } from "react";

export const metadata = { title: "Giáo viên | Lớp học của cô" };

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <div className="portal-route portal-route-teacher">{children}</div>;
}

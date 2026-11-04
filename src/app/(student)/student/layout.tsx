import type { ReactNode } from "react";

export const metadata = { title: "Học sinh | Lớp học của cô" };

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <div className="portal-route portal-route-student">{children}</div>;
}

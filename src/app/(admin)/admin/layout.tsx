import type { ReactNode } from "react";

export const metadata = { title: "Quản trị | Lớp học của cô" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="portal-route portal-route-admin">{children}</div>;
}

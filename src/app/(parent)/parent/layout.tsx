import type { ReactNode } from "react";

export const metadata = { title: "Phụ huynh | Lớp học của cô" };

export default function ParentLayout({ children }: { children: ReactNode }) {
  return <div className="portal-route portal-route-parent">{children}</div>;
}

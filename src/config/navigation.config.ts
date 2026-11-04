import type { AppRole } from "@/types/app";

type PortalNavigationItem = {
  href: `/${AppRole}`;
  role: AppRole;
  title: string;
  description: string;
};

export const portalNavigation = [
  {
    href: "/admin",
    role: "admin",
    title: "Quản trị",
    description: "Quản lý tài khoản, lớp học và dữ liệu hệ thống.",
  },
  {
    href: "/teacher",
    role: "teacher",
    title: "Giáo viên",
    description: "Quản lý lớp, bài tập, bài nộp và sổ điểm.",
  },
  {
    href: "/student",
    role: "student",
    title: "Học sinh",
    description: "Xem bài tập, làm bài và theo dõi kết quả.",
  },
  {
    href: "/parent",
    role: "parent",
    title: "Phụ huynh",
    description: "Theo dõi bài tập và quá trình học tập của con.",
  },
] satisfies readonly PortalNavigationItem[];

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { appConfig } from "@/config/app.config";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

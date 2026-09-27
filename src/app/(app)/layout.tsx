import { AppShell } from "@/components/shell/app-shell";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/");

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

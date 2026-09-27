import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/simulator");

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

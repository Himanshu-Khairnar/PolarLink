import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/personnel");

export default function PersonnelLayout({ children }: { children: React.ReactNode }) {
  return children;
}

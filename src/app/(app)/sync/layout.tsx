import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/sync");

export default function SyncLayout({ children }: { children: React.ReactNode }) {
  return children;
}

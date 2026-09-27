import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/waste");

export default function WasteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

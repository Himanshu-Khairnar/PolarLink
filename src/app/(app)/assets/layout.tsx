import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/assets");

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/inventory");

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

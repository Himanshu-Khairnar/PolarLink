import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/cargo");

export default function CargoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/emergency");

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

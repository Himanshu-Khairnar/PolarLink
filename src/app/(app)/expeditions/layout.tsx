import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata("/expeditions");

export default function ExpeditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

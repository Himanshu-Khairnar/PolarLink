import type { MetadataRoute } from "next";
import { ROUTES } from "@/components/shell/nav";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: new URL(route.href, baseUrl).toString(),
    lastModified,
    changeFrequency: route.href === "/" ? "daily" : "weekly",
    priority: route.href === "/" ? 1 : 0.7,
  }));
}

import type { Metadata } from "next";
import { PAGES } from "@/app/components/shell/nav";

export function routeMetadata(href: string): Metadata {
  const page = PAGES[href];
  if (!page) return {};
  return { title: `${page.title} · PolarLink`, description: page.subtitle };
}

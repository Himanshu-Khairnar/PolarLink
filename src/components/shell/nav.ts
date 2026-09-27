import {
  Activity,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  Package,
  Radio,
  Recycle,
  Route,
  Siren,
  Users,
  Wrench,
} from "lucide-react";

export interface RouteDef {
  href: string;
  title: string;
  subtitle: string;
  icon: typeof Activity;
  group: "Operations" | "Intelligence";
}

export const ROUTES: RouteDef[] = [
  { href: "/", title: "Command Centre", subtitle: "One live view across Goa, Cape Town, the ship and every station", icon: LayoutDashboard, group: "Operations" },
  { href: "/expeditions", title: "Expeditions & Legs", subtitle: "Season windows, multi-leg timelines and manifests", icon: Route, group: "Operations" },
  { href: "/cargo", title: "Cargo & Custody", subtitle: "QR scan state machine with a tamper-evident ledger", icon: Package, group: "Operations" },
  { href: "/inventory", title: "Inventory & Days of Autonomy", subtitle: "Stock as survival time against the next resupply window", icon: Boxes, group: "Operations" },
  { href: "/personnel", title: "Personnel & Roll-call", subtitle: "Nomination to de-induction, with live muster", icon: Users, group: "Operations" },
  { href: "/assets", title: "Assets & Maintenance", subtitle: "Condition, service schedules and field readiness", icon: Wrench, group: "Operations" },
  { href: "/emergency", title: "Emergency Response", subtitle: "SOS, incident lifecycle and international evacuation routing", icon: Siren, group: "Operations" },
  { href: "/simulator", title: "What-if Season Simulator", subtitle: "Replay delays and score the confidence of a season plan", icon: FlaskConical, group: "Intelligence" },
  { href: "/waste", title: "Madrid Protocol Waste Ledger", subtitle: "Reverse cargo tracked to removal, per Annex III", icon: Recycle, group: "Intelligence" },
  { href: "/sync", title: "Satellite Sync", subtitle: "Priority lanes, delta sync and compact SOS over a weak link", icon: Radio, group: "Intelligence" },
];

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Activity;
  group: RouteDef["group"];
}

export const NAV: NavItem[] = ROUTES.map(({ href, title, icon, group }) => ({
  href,
  label: title,
  icon,
  group,
}));

export const PAGES: Record<string, RouteDef> = Object.fromEntries(
  ROUTES.map((route) => [route.href, route])
);

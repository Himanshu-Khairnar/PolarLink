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

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: "count";
  group: "Operations" | "Intelligence";
}

export const NAV: NavItem[] = [
  { href: "/", label: "Command Centre", icon: LayoutDashboard, group: "Operations" },
  { href: "/expeditions", label: "Expeditions & Legs", icon: Route, group: "Operations" },
  { href: "/cargo", label: "Cargo & Custody", icon: Package, group: "Operations" },
  { href: "/inventory", label: "Inventory & Autonomy", icon: Boxes, group: "Operations" },
  { href: "/personnel", label: "Personnel & Roll-call", icon: Users, group: "Operations" },
  { href: "/assets", label: "Assets & Maintenance", icon: Wrench, group: "Operations" },
  { href: "/emergency", label: "Emergency Response", icon: Siren, group: "Operations" },
  { href: "/simulator", label: "What-if Simulator", icon: FlaskConical, group: "Intelligence" },
  { href: "/waste", label: "Madrid Waste Ledger", icon: Recycle, group: "Intelligence" },
  { href: "/sync", label: "Satellite Sync", icon: Radio, group: "Intelligence" },
];

export const PAGES: Record<string, { title: string; subtitle: string; icon: typeof Activity }> = {
  "/": { title: "Command Centre", subtitle: "One live view across Goa, Cape Town, the ship and every station", icon: LayoutDashboard },
  "/expeditions": { title: "Expeditions & Legs", subtitle: "Season windows, multi-leg timelines and manifests", icon: Route },
  "/cargo": { title: "Cargo & Custody", subtitle: "QR scan state machine with a tamper-evident ledger", icon: Package },
  "/inventory": { title: "Inventory & Days of Autonomy", subtitle: "Stock as survival time against the next resupply window", icon: Boxes },
  "/personnel": { title: "Personnel & Roll-call", subtitle: "Nomination to de-induction, with live muster", icon: Users },
  "/assets": { title: "Assets & Maintenance", subtitle: "Condition, service schedules and field readiness", icon: Wrench },
  "/emergency": { title: "Emergency Response", subtitle: "SOS, incident lifecycle and international evacuation routing", icon: Siren },
  "/simulator": { title: "What-if Season Simulator", subtitle: "Replay delays and score the confidence of a season plan", icon: FlaskConical },
  "/waste": { title: "Madrid Protocol Waste Ledger", subtitle: "Reverse cargo tracked to removal, per Annex III", icon: Recycle },
  "/sync": { title: "Satellite Sync", subtitle: "Priority lanes, delta sync and compact SOS over a weak link", icon: Radio },
};

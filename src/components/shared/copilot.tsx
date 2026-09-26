"use client";

import * as React from "react";
import { Bot, CornerDownLeft, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rankEvacRoutes, buildEvacEdges } from "@/lib/engine";
import { fmtDate } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "What is critical at Bharati?",
  "Where is consignment POLAR-46ISEA-1000?",
  "When is the next ship?",
  "Evacuation options from Maitri",
  "What if the ship is delayed 12 days?",
];

export function Copilot({ className }: { className?: string }) {
  const store = useStore();
  const { data, autonomy, today } = store;
  const counter = React.useRef(0);
  const nextId = () => {
    counter.current += 1;
    return counter.current;
  };
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "seed",
      role: "assistant",
      content:
        "Ask me about stock cover, a consignment, the next transport window, evacuation options, or a delay scenario. I answer from the live plan.",
      ts: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const answer = React.useCallback(
    (q: string): string => {
      const text = q.toLowerCase();
      const station = data.stations.find(
        (s) =>
          text.includes(s.shortName.toLowerCase().split(" ")[0]) ||
          text.includes(s.name.toLowerCase())
      );

      // delay / what-if
      const delayMatch = text.match(/delay(?:ed)?\s*(\d+)/) || text.match(/(\d+)\s*days?/);
      if (text.includes("delay") || text.includes("what if") || text.includes("what-if")) {
        const days = delayMatch ? Number(delayMatch[1]) : 12;
        const impacted = Object.entries(autonomy)
          .flatMap(([sid, rows]) => rows.map((r) => ({ sid, ...r })))
          .filter((r) => r.risk === "CRITICAL")
          .slice(0, 3);
        return `If access slips by ${days} days, the plan confidence drops sharply. The lines that break first are ${impacted
          .map((r) => `${r.name} at ${data.stations.find((s) => s.id === r.sid)?.shortName} (${r.daysLeft}d cover)`)
          .join("; ") || "none — but buffers get thin"}. Open the What-if Simulator to replay it leg by leg.`;
      }

      // consignment lookup
      const qrMatch = q.match(/polar-[\w-]+/i);
      if (qrMatch || text.includes("consignment") || text.includes("where is")) {
        const token = qrMatch ? qrMatch[0].toLowerCase() : null;
        const cs = token
          ? data.consignments.find((c) => c.qrCode.toLowerCase().includes(token))
          : data.consignments.find((c) => text.includes(c.description.toLowerCase()));
        if (cs) {
          const chain = data.custody
            .filter((c) => c.consignmentId === cs.id)
            .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
          const last = chain[chain.length - 1];
          const at = data.stations.find((s) => s.id === last?.stationId);
          return `${cs.qrCode} — "${cs.description}" is ${cs.status.replaceAll("_", " ").toLowerCase()} at ${at?.shortName ?? "unknown"}, last scan ${last ? fmtDate(last.ts, { hour: undefined }) : "n/a"}, ${chain.length} hash-chained events. Destination: ${data.stations.find((s) => s.id === cs.destinationStationId)?.shortName}.`;
        }
        return "I could not match that consignment. Try the QR code (e.g. POLAR-46ISEA-1000) or the description.";
      }

      // evacuation
      if (text.includes("evac") || text.includes("sos") || text.includes("emergency") || text.includes("rescue")) {
        const from = station?.id ?? "st-maitri";
        const edges = buildEvacEdges(data.stations, data.legs);
        const routes = rankEvacRoutes(from, data.stations, edges);
        if (!routes.length) return `No feasible route modelled from ${data.stations.find((s) => s.id === from)?.shortName} right now (weather/season gates).`;
        return `Top routes from ${data.stations.find((s) => s.id === from)?.shortName}: ${routes
          .slice(0, 3)
          .map((r) => `${r.label} (${r.totalHours}h, ${Math.round(r.weatherOkProb * 100)}% weather-ok)`)
          .join("  |  ")}. The ranking weighs time, weather gate, transfers and the medical capability at the destination.`;
      }

      // next leg
      if (text.includes("next") && (text.includes("ship") || text.includes("flight") || text.includes("leg") || text.includes("resupply"))) {
        const upcoming = [...data.legs]
          .filter((l) => Date.parse(l.plannedDepart) >= store.today.getTime())
          .sort((a, b) => Date.parse(a.plannedDepart) - Date.parse(b.plannedDepart));
        if (!upcoming.length) return "No open legs left in this season window.";
        return upcoming
          .slice(0, 3)
          .map(
            (l) =>
              `${l.mode}: ${data.stations.find((s) => s.id === l.fromStationId)?.shortName} → ${data.stations.find((s) => s.id === l.toStationId)?.shortName} on ${fmtDate(l.plannedDepart)} (${l.status})`
          )
          .join("\n");
      }

      // inventory / autonomy
      if (text.includes("autonomy") || text.includes("stock") || text.includes("critical") || text.includes("cover") || text.includes("inventory") || station) {
        const targets = station
          ? [{ id: station.id, rows: autonomy[station.id] ?? [] }]
          : Object.entries(autonomy).map(([id, rows]) => ({ id, rows }));
        const lines = targets
          .flatMap((t) =>
            t.rows
              .filter((r) => (text.includes("critical") ? r.risk === "CRITICAL" : r.risk !== "OK"))
              .map((r) => `${data.stations.find((s) => s.id === t.id)?.shortName}: ${r.name} ${r.daysLeft}d (${r.risk})`)
          )
          .slice(0, 6);
        if (lines.length) return `Worth watching:\n${lines.join("\n")}`;
        return `All monitored lines ${station ? `at ${station.shortName}` : "across stations"} currently have cover beyond the next resupply window.`;
      }

      // incidents
      if (text.includes("incident") || text.includes("sos") || text.includes("medical") || text.includes("injury")) {
        const open = data.incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "REVIEWED");
        return open.length
          ? `Open incidents: ${open.map((i) => `${i.type} (${i.severity}) at ${data.stations.find((s) => s.id === i.stationId)?.shortName} — ${i.status.replaceAll("_", " ")}`).join("; ")}.`
          : "No open incidents.";
      }

      // personnel
      if (text.includes("crew") || text.includes("personnel") || text.includes("roll")) {
        const onStation = data.personnel.filter((p) => p.state === "AT_STATION");
        return `${onStation.length} personnel are on station (${onStation.filter((p) => p.team === "winter").length} winter-over, ${onStation.filter((p) => p.team === "summer").length} summer). ${data.personnel.filter((p) => p.state === "IN_TRANSIT").length} are in transit through Cape Town.`;
      }

      return `I can help with stock cover, consignment tracking, transport windows, evacuation options or delay scenarios. Right now ${criticalCount(autonomy)} autonomy lines are critical and ${data.incidents.filter((i) => i.status !== "RESOLVED").length} incidents are open.`;
    },
    [autonomy, data, store.today]
  );

  const send = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const userMsg: ChatMessage = { id: `u-${nextId()}`, role: "user", content: question, ts: today.toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `a-${nextId()}`,
        role: "assistant",
        content: answer(question),
        ts: today.toISOString(),
      };
      setMessages((m) => [...m, reply]);
      setBusy(false);
    }, 380);
  };

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.slice(0, 4).map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1 no-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
            {m.role === "assistant" ? (
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Bot className="size-3.5" />
              </span>
            ) : null}
            <p
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg rounded-br-sm bg-foreground px-3 py-2 text-xs text-background"
                  : "max-w-[90%] rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-xs whitespace-pre-line"
              }
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 animate-pulse" /> Reasoning over the plan…
          </div>
        ) : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about stock, cargo, routes…"
          className="h-8 text-xs"
        />
        <Button type="submit" size="icon-sm" disabled={busy}>
          <CornerDownLeft />
        </Button>
      </form>
    </div>
  );
}

function criticalCount(autonomy: Record<string, { risk: string }[]>) {
  return Object.values(autonomy).flat().filter((r) => r.risk === "CRITICAL").length;
}

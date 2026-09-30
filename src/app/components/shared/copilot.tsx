"use client";

import * as React from "react";
import { ArrowUp, MessageSquareText, RotateCcw, X } from "lucide-react";
import { cn } from "cn";
import { useStore } from "@/lib/store";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { LiveDot } from "@/app/components/shared/kit";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
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

function seedMessages(): ChatMessage[] {
  return [
    {
      id: "seed",
      role: "assistant",
      content:
        "Ask me about stock cover, a consignment, the next transport window, evacuation options, or a delay scenario. I answer from the live plan.",
      ts: new Date().toISOString(),
    },
  ];
}

export function Copilot() {
  const store = useStore();
  const { data, autonomy, today, stationById } = store;
  const counter = React.useRef(0);
  const nextId = () => {
    counter.current += 1;
    return counter.current;
  };
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>(seedMessages);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const reset = () => {
    setMessages(seedMessages());
    setInput("");
    inputRef.current?.focus();
  };

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const answer = React.useCallback(
    (q: string): string => {
      const text = q.toLowerCase();
      const station = data.stations.find(
        (s) =>
          text.includes(s.shortName.toLowerCase().split(" ")[0]) ||
          text.includes(s.name.toLowerCase()),
      );

      // delay / what-if
      const delayMatch =
        text.match(/delay(?:ed)?\s*(\d+)/) || text.match(/(\d+)\s*days?/);
      if (
        text.includes("delay") ||
        text.includes("what if") ||
        text.includes("what-if")
      ) {
        const days = delayMatch ? Number(delayMatch[1]) : 12;
        const impacted = Object.entries(autonomy)
          .flatMap(([sid, rows]) => rows.map((r) => ({ sid, ...r })))
          .filter((r) => r.risk === "CRITICAL")
          .slice(0, 3);
        return `If access slips by ${days} days, the plan confidence drops sharply. The lines that break first are ${
          impacted
            .map(
              (r) =>
                `${r.name} at ${stationById.get(r.sid)?.shortName} (${r.daysLeft}d cover)`,
            )
            .join("; ") || "none — but buffers get thin"
        }. Open the What-if Simulator to replay it leg by leg.`;
      }

      // consignment lookup
      const qrMatch = q.match(/polar-[\w-]+/i);
      if (
        qrMatch ||
        text.includes("consignment") ||
        text.includes("where is")
      ) {
        const token = qrMatch ? qrMatch[0].toLowerCase() : null;
        const cs = token
          ? data.consignments.find((c) =>
              c.qrCode.toLowerCase().includes(token),
            )
          : data.consignments.find((c) =>
              text.includes(c.description.toLowerCase()),
            );
        if (cs) {
          const chain = data.custody
            .filter((c) => c.consignmentId === cs.id)
            .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
          const last = chain[chain.length - 1];
          const at = last ? stationById.get(last.stationId) : undefined;
          return `${cs.qrCode} — "${cs.description}" is ${cs.status.replaceAll("_", " ").toLowerCase()} at ${at?.shortName ?? "unknown"}, last scan ${last ? fmtDate(last.ts, { hour: undefined }) : "n/a"}, ${chain.length} hash-chained events. Destination: ${stationById.get(cs.destinationStationId)?.shortName}.`;
        }
        return "I could not match that consignment. Try the QR code (e.g. POLAR-46ISEA-1000) or the description.";
      }

      // evacuation
      if (
        text.includes("evac") ||
        text.includes("sos") ||
        text.includes("emergency") ||
        text.includes("rescue")
      ) {
        const from = station?.id ?? "st-maitri";
        const edges = buildEvacEdges(data.stations, data.legs);
        const routes = rankEvacRoutes(from, data.stations, edges);
        if (!routes.length)
          return `No feasible route modelled from ${stationById.get(from)?.shortName} right now (weather/season gates).`;
        return `Top routes from ${stationById.get(from)?.shortName}: ${routes
          .slice(0, 3)
          .map(
            (r) =>
              `${r.label} (${r.totalHours}h, ${Math.round(r.weatherOkProb * 100)}% weather-ok)`,
          )
          .join(
            "  |  ",
          )}. The ranking weighs time, weather gate, transfers and the medical capability at the destination.`;
      }

      // next leg
      if (
        text.includes("next") &&
        (text.includes("ship") ||
          text.includes("flight") ||
          text.includes("leg") ||
          text.includes("resupply"))
      ) {
        const upcoming = [...data.legs]
          .filter((l) => Date.parse(l.plannedDepart) >= store.today.getTime())
          .sort(
            (a, b) => Date.parse(a.plannedDepart) - Date.parse(b.plannedDepart),
          );
        if (!upcoming.length) return "No open legs left in this season window.";
        return upcoming
          .slice(0, 3)
          .map(
            (l) =>
              `${l.mode}: ${stationById.get(l.fromStationId)?.shortName} → ${stationById.get(l.toStationId)?.shortName} on ${fmtDate(l.plannedDepart)} (${l.status})`,
          )
          .join("\n");
      }

      // inventory / autonomy
      if (
        text.includes("autonomy") ||
        text.includes("stock") ||
        text.includes("critical") ||
        text.includes("cover") ||
        text.includes("inventory") ||
        station
      ) {
        const targets = station
          ? [{ id: station.id, rows: autonomy[station.id] ?? [] }]
          : Object.entries(autonomy).map(([id, rows]) => ({ id, rows }));
        const lines = targets
          .flatMap((t) =>
            t.rows
              .filter((r) =>
                text.includes("critical")
                  ? r.risk === "CRITICAL"
                  : r.risk !== "OK",
              )
              .map(
                (r) =>
                  `${stationById.get(t.id)?.shortName}: ${r.name} ${r.daysLeft}d (${r.risk})`,
              ),
          )
          .slice(0, 6);
        if (lines.length) return `Worth watching:\n${lines.join("\n")}`;
        return `All monitored lines ${station ? `at ${station.shortName}` : "across stations"} currently have cover beyond the next resupply window.`;
      }

      // incidents
      if (
        text.includes("incident") ||
        text.includes("sos") ||
        text.includes("medical") ||
        text.includes("injury")
      ) {
        const open = data.incidents.filter(
          (i) => i.status !== "RESOLVED" && i.status !== "REVIEWED",
        );
        return open.length
          ? `Open incidents: ${open.map((i) => `${i.type} (${i.severity}) at ${stationById.get(i.stationId)?.shortName} — ${i.status.replaceAll("_", " ")}`).join("; ")}.`
          : "No open incidents.";
      }

      // personnel
      if (
        text.includes("crew") ||
        text.includes("personnel") ||
        text.includes("roll")
      ) {
        const onStation = data.personnel.filter(
          (p) => p.state === "AT_STATION",
        );
        return `${onStation.length} personnel are on station (${onStation.filter((p) => p.team === "winter").length} winter-over, ${onStation.filter((p) => p.team === "summer").length} summer). ${data.personnel.filter((p) => p.state === "IN_TRANSIT").length} are in transit through Cape Town.`;
      }

      return `I can help with stock cover, consignment tracking, transport windows, evacuation options or delay scenarios. Right now ${criticalCount(autonomy)} autonomy lines are critical and ${data.incidents.filter((i) => i.status !== "RESOLVED").length} incidents are open.`;
    },
    [autonomy, data, stationById, store.today],
  );

  const send = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const userMsg: ChatMessage = {
      id: `u-${nextId()}`,
      role: "user",
      content: question,
      ts: today.toISOString(),
    };
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label="Ask the PolarLink AI assistant"
            className="fixed right-4 bottom-4 z-40 h-14 w-16 rounded-2xl shadow-lg shadow-foreground/10 sm:right-6 sm:bottom-6"
          />
        }
      >
        <MessageSquareText className="size-5" />
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        overlayClassName="supports-backdrop-filter:backdrop-blur-none bg-black/5"
        className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[85vh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none bg-card text-card-foreground ring-1 ring-border shadow-2xl p-0 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:left-auto sm:max-h-[min(38rem,80vh)] sm:w-[26rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl"
      >
        <DialogHeader className="flex-row items-center gap-3 border-b bg-muted/50 px-5 py-4 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold">
              Ask PolarLink
            </DialogTitle>
            <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
              <LiveDot />
              Grounded in the live plan
            </DialogDescription>
          </div>
          {messages.length > 1 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={reset}
              aria-label="Start a new chat"
              className="text-muted-foreground"
            >
              <RotateCcw />
            </Button>
          ) : null}
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4 text-muted-foreground"
              />
            }
          >
            <X />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div
          ref={scrollRef}
          aria-live="polite"
          className="flex min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 no-scrollbar"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex animate-in gap-2.5 fade-in slide-in-from-bottom-1 duration-200",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <p
                className={cn(
                  "max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line",
                  m.role === "user"
                    ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-2xl rounded-tl-sm bg-muted",
                )}
              >
                {m.content}
              </p>
            </div>
          ))}

          {busy ? (
            <div className="flex animate-in gap-2.5 fade-in duration-200">
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {messages.length <= 1 ? (
            <div className="mt-1 space-y-2.5">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Try asking
              </p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="group flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/20 hover:bg-muted hover:text-foreground"
                  >
                    <span className="truncate">{s}</span>
                    <ArrowUp className="size-3.5 shrink-0 rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t px-5 py-3.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="relative"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stock, cargo, routes…"
              className="h-11 rounded-xl pr-12 text-sm"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send"
              disabled={busy || !input.trim()}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg"
            >
              <ArrowUp />
            </Button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Answers are generated from the live plan. Press Enter to send.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function criticalCount(autonomy: Record<string, { risk: string }[]>) {
  return Object.values(autonomy)
    .flat()
    .filter((r) => r.risk === "CRITICAL").length;
}

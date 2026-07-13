"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wind, LogOut, Users, TrendingUp, MapPin, AlertTriangle, Settings } from "lucide-react";
import { AirGauge } from "@/components/AirGauge";
import { getCurrentClaims, clearTokens, JwtClaims } from "@/lib/auth";
import {
  getOutletDashboard, getDistrictDashboard, getAdminOverview, getTickets, updateTicket,
  OutletDashboardData, DistrictDashboardData, AdminOverviewData, TicketsData,
} from "@/lib/dashboardApi";

const ratingColor: Record<string, string> = {
  SATISFIED: "var(--color-success)",
  NEUTRAL: "var(--color-warning)",
  NOT_SATISFIED: "var(--color-danger)",
};

export default function DashboardPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<JwtClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [outletData, setOutletData] = useState<OutletDashboardData["data"] | null>(null);
  const [districtData, setDistrictData] = useState<DistrictDashboardData["data"] | null>(null);
  const [adminData, setAdminData] = useState<AdminOverviewData["data"] | null>(null);
  const [tickets, setTickets] = useState<TicketsData["data"]["tickets"]>([]);

  useEffect(() => {
    const c = getCurrentClaims();
    if (!c) {
      router.push("/login");
      return;
    }
    setClaims(c);

    async function load() {
      try {
        if (c!.role === "RO_USER" && c!.scope_id) {
          const res = await getOutletDashboard(c!.scope_id);
          setOutletData(res.data);
        } else if (c!.role === "DISTRICT_ADMIN" && c!.scope_id) {
          const res = await getDistrictDashboard(c!.scope_id);
          setDistrictData(res.data);
        } else if (["STATE_ADMIN", "SUPER_ADMIN", "DO_ADMIN"].includes(c!.role)) {
          const res = await getAdminOverview();
          setAdminData(res.data);
        }
        const ticketRes = await getTickets();
        setTickets(ticketRes.data.tickets);
      } catch {
        setError("Could not load dashboard data. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function handleLogout() {
    clearTokens();
    router.push("/login");
  }

  async function handleResolveTicket(ticketId: number) {
    try {
      await updateTicket(ticketId, "RESOLVED", "Resolved via dashboard");
      setTickets((prev) => prev.map((t) => (t.ticket_id === ticketId ? { ...t, status: "RESOLVED" } : t)));
    } catch {
      setError("Could not update ticket.");
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--color-muted)" }}>Loading dashboard…</div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--color-navy)" }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full p-1.5" style={{ backgroundColor: "var(--color-orange)" }}>
            <Wind className="text-white" size={16} />
          </div>
          <div>
            <div className="text-white text-sm font-bold font-[var(--font-display)]">AirCare Challenge</div>
            <div className="text-xs" style={{ color: "#B9C4DA" }}>{claims?.role.replace("_", " ")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {claims?.role === "SUPER_ADMIN" && (
            <button onClick={() => router.push("/dashboard/users")} className="text-white/80 hover:text-white flex items-center gap-1 text-xs">
              <Settings size={14} /> Manage Users
            </button>
          )}
          <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-1 text-xs">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg text-sm px-3 py-2" style={{ backgroundColor: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        {outletData && <OutletView data={outletData} />}
        {districtData && <DistrictView data={districtData} />}
        {adminData && <AdminView data={adminData} />}

        <TicketsPanel tickets={tickets} onResolve={handleResolveTicket} />
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 bg-[var(--color-card)] border border-[var(--color-border)] ${className}`}>
      {children}
    </div>
  );
}

function OutletView({ data }: { data: OutletDashboardData["data"] }) {
  return (
    <>
      <h1 className="font-[var(--font-display)] text-lg font-bold mb-4" style={{ color: "var(--color-navy)" }}>
        {data.ro_name}
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card className="flex flex-col items-center">
          <AirGauge value={data.today.weightage} size={100} />
          <span className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>Today&apos;s Weightage</span>
        </Card>
        <Card>
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>Feedback Today</div>
          <div className="text-2xl font-bold font-[var(--font-data)] mt-1">{data.today.total_feedback}</div>
          <div className="text-xs mt-1" style={{ color: data.today.is_qualified ? "var(--color-success)" : "var(--color-muted)" }}>
            {data.today.is_qualified ? "Qualified for ranking" : "Below daily minimum"}
          </div>
        </Card>
        <Card>
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>Satisfaction Split</div>
          <div className="text-xs mt-2 space-y-1">
            <div className="flex justify-between"><span style={{ color: "var(--color-success)" }}>Satisfied</span><span>{data.today.positive_count}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--color-warning)" }}>Neutral</span><span>{data.today.neutral_count}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--color-danger)" }}>Not Satisfied</span><span>{data.today.negative_count}</span></div>
          </div>
        </Card>
      </div>
      <Card className="mb-4">
        <div className="text-sm font-semibold mb-3">Recent Feedback</div>
        <div className="space-y-2">
          {data.recent_feedback.length === 0 && (
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>No feedback yet.</p>
          )}
          {data.recent_feedback.map((f) => (
            <div key={f.feedback_id} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: ratingColor[f.rating] }} />
              <div className="flex-1">
                <div className="text-xs font-medium">{f.rating.replace("_", " ")} <span style={{ color: "var(--color-muted)" }}>· {new Date(f.submitted_at).toLocaleString()}</span></div>
                {f.comment && <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{f.comment}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function DistrictView({ data }: { data: DistrictDashboardData["data"] }) {
  return (
    <>
      <h1 className="font-[var(--font-display)] text-lg font-bold mb-1" style={{ color: "var(--color-navy)" }}>
        District Ranking
      </h1>
      <p className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>{data.score_date}</p>
      <Card>
        {data.rankings.length === 0 && <p className="text-xs" style={{ color: "var(--color-muted)" }}>No scores yet for today.</p>}
        {data.rankings.map((r, i) => (
          <div key={r.ro_id} className="flex items-center gap-3 py-3" style={{ borderBottom: i < data.rankings.length - 1 ? "1px solid var(--color-border)" : "none" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-[var(--font-data)] flex-shrink-0"
              style={{ backgroundColor: r.rank === 1 ? "var(--color-orange)" : "var(--color-bg)", color: r.rank === 1 ? "#fff" : "var(--color-navy)" }}
            >
              {r.rank ?? "–"}
            </div>
            <div className="flex-1 text-sm font-medium">{r.ro_name}</div>
            <AirGauge value={r.weightage} size={56} />
          </div>
        ))}
      </Card>
    </>
  );
}

function AdminView({ data }: { data: AdminOverviewData["data"] }) {
  const kpis = [
    { icon: Users, label: "Total Feedback Today", value: data.total_feedback },
    { icon: TrendingUp, label: "ROs Reporting", value: `${data.ro_reporting_count} / ${data.ro_total_count}` },
    { icon: MapPin, label: "Districts", value: data.by_district.length },
    { icon: AlertTriangle, label: "Open Tickets", value: data.open_tickets_count },
  ];
  return (
    <>
      <h1 className="font-[var(--font-display)] text-lg font-bold mb-4" style={{ color: "var(--color-navy)" }}>
        State Overview — Odisha
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {kpis.map((k, i) => (
          <Card key={i}>
            <k.icon size={16} style={{ color: "var(--color-orange)" }} />
            <div className="text-xl font-bold font-[var(--font-data)] mt-2">{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{k.label}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="text-sm font-semibold mb-3">Average Weightage by District</div>
        <div className="space-y-2">
          {data.by_district.map((d) => (
            <div key={d.district_id} className="flex items-center gap-3">
              <div className="w-24 text-xs flex-shrink-0">{d.district_name}</div>
              <div className="flex-1 h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${d.avg_weightage}%`, backgroundColor: "var(--color-orange)" }} />
              </div>
              <div className="text-xs font-[var(--font-data)] w-10 text-right">{d.avg_weightage}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function TicketsPanel({ tickets, onResolve }: { tickets: TicketsData["data"]["tickets"]; onResolve: (id: number) => void }) {
  const openTickets = tickets.filter((t) => t.status !== "RESOLVED");
  if (tickets.length === 0) return null;
  return (
    <Card className="mt-4">
      <div className="text-sm font-semibold mb-3">Maintenance Tickets</div>
      <div className="space-y-2">
        {openTickets.length === 0 && <p className="text-xs" style={{ color: "var(--color-muted)" }}>No open tickets.</p>}
        {openTickets.map((t) => (
          <div key={t.ticket_id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
            <AlertTriangle size={14} style={{ color: "var(--color-danger)" }} />
            <div className="flex-1">
              <div className="text-xs font-medium">{t.ro_name} — {t.category.replace(/_/g, " ")}</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>{new Date(t.opened_at).toLocaleString()} · {t.status}</div>
            </div>
            <button
              onClick={() => onResolve(t.ticket_id)}
              className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
              style={{ backgroundColor: "var(--color-orange)" }}
            >
              Resolve
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

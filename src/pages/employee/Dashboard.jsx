import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  BatteryCharging,
  BookOpen,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  HelpCircle,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import useAuth from "../../hooks/useAuth";
import { apiFetch } from "../../config/api";
import { listRiderDrafts } from "../../utils/riderDrafts";
import { listBatterySwaps } from "../../utils/batterySwaps";
import { listPaymentDues } from "../../utils/paymentDues";
import { listOverdueRentals } from "../../utils/overdueRentals";
import { formatDateTimeDDMMYYYY } from "../../utils/dateFormat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatNumber = (n) => {
  const v = Number(n || 0);
  try {
    return v.toLocaleString("en-IN");
  } catch {
    return String(v);
  }
};

const formatLongDate = (d = new Date()) =>
  d.toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const isThisMonth = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isLastMonth = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
};

const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

// Build a small 14-day daily count series for sparklines.
const buildDailyCounts = (rows, dateField, days = 14) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  const buckets = new Array(days).fill(0);
  (rows || []).forEach((r) => {
    const raw = r?.[dateField];
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const diffDays = Math.floor((d.setHours(0, 0, 0, 0) - start.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < days) buckets[diffDays] += 1;
  });
  return buckets.map((v, i) => ({ x: i, v }));
};

const percentChange = (current, previous) => {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (p === 0) return c === 0 ? 0 : 100;
  return ((c - p) / Math.abs(p)) * 100;
};

// ---------------------------------------------------------------------------
// Small subcomponents
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, sublabel, value, change, series, color = "purple" }) {
  const palette = {
    purple: { bg: "bg-brand-light/70", text: "text-evegah-primary", stroke: "#7c5fd6", fill: "url(#sparkPurple)" },
    green: { bg: "bg-emerald-100", text: "text-emerald-600", stroke: "#16a34a", fill: "url(#sparkGreen)" },
    orange: { bg: "bg-amber-100", text: "text-amber-600", stroke: "#f59e0b", fill: "url(#sparkOrange)" },
    blue: { bg: "bg-sky-100", text: "text-sky-600", stroke: "#0ea5e9", fill: "url(#sparkBlue)" },
  }[color] || { bg: "bg-brand-light/70", text: "text-evegah-primary", stroke: "#7c5fd6", fill: "url(#sparkPurple)" };

  const positive = change >= 0;

  return (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${palette.bg} ${palette.text}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-evegah-text leading-tight">{label}</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">{sublabel}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-evegah-text leading-none">{value}</p>
          <p
            className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
              positive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change).toFixed(1)}% from last month
          </p>
        </div>

        <div className="h-14 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={palette.stroke}
                strokeWidth={2}
                fill={palette.fill}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CreateRequestCard({ icon: Icon, color, title, description, to, ctaLabel }) {
  const palette = {
    purple: { bg: "bg-brand-light", text: "text-evegah-primary", link: "text-evegah-primary" },
    green: { bg: "bg-emerald-100", text: "text-emerald-600", link: "text-emerald-700" },
    orange: { bg: "bg-orange-100", text: "text-orange-600", link: "text-orange-700" },
    blue: { bg: "bg-sky-100", text: "text-sky-600", link: "text-sky-700" },
    teal: { bg: "bg-teal-100", text: "text-teal-600", link: "text-teal-700" },
  }[color];

  return (
    <Link
      to={to}
      className="group flex flex-col items-center text-center bg-white border border-evegah-border rounded-2xl p-5 hover:shadow-card transition-shadow"
    >
      <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${palette.bg} ${palette.text}`}>
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-4 font-semibold text-evegah-text">{title}</h3>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
      <span
        className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${palette.link} group-hover:translate-x-0.5 transition-transform`}
      >
        {ctaLabel} <ChevronRight size={14} />
      </span>
    </Link>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    "in progress": "bg-sky-100 text-sky-700",
    "in_progress": "bg-sky-100 text-sky-700",
    cancelled: "bg-rose-100 text-rose-700",
    rejected: "bg-rose-100 text-rose-700",
    draft: "bg-amber-100 text-amber-700",
    overdue: "bg-rose-100 text-rose-700",
  };
  const cls = map[s] || "bg-gray-100 text-gray-700";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [drafts, setDrafts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [dues, setDues] = useState([]);
  const [overdueRentals, setOverdueRentals] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [returnRows, setReturnRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination + filters for the Recent Requests / Drafts tables
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [draftPage, setDraftPage] = useState(1);
  const [recentFilter, setRecentFilter] = useState("rider"); // 'rider' | 'payment' | 'overdue'
  const [recentSearch, setRecentSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      if (loading) return;
      if (!user?.uid) return;
      setDataLoading(true);
      setError("");

      try {
        const [draftRows, swapRows, dueRows, overdueRows, activeRows] = await Promise.all([
          listRiderDrafts().catch(() => []),
          listBatterySwaps().catch(() => []),
          listPaymentDues().catch(() => []),
          listOverdueRentals().catch(() => []),
          apiFetch("/api/dashboard/active-rentals?limit=20").catch(() => []),
        ]);

        setDrafts(Array.isArray(draftRows) ? draftRows : []);
        setSwaps(Array.isArray(swapRows) ? swapRows : []);
        setDues(Array.isArray(dueRows) ? dueRows : []);
        setOverdueRentals(Array.isArray(overdueRows) ? overdueRows : []);
        setActiveRentals(Array.isArray(activeRows) ? activeRows : []);

        // Returns aren't a standalone endpoint here; treat completed = swaps+dues paid.
        const completed = (Array.isArray(dueRows) ? dueRows : []).filter(
          (d) => String(d?.status || "").toLowerCase() === "paid"
        );
        setReturnRows(completed);
      } catch (e) {
        setError(e?.message || "Unable to load dashboard data.");
      } finally {
        setDataLoading(false);
      }
    };

    load();
  }, [location.pathname, user?.uid, loading]);

  // -----------------------------------------------------------------------
  // Derived metrics
  // -----------------------------------------------------------------------
  const createdThisMonth = useMemo(
    () => drafts.filter((d) => isThisMonth(d?.created_at)).length,
    [drafts]
  );
  const createdLastMonth = useMemo(
    () => drafts.filter((d) => isLastMonth(d?.created_at)).length,
    [drafts]
  );
  const completedThisMonth = useMemo(
    () => swaps.filter((s) => isThisMonth(s?.swapped_at)).length + returnRows.filter((r) => isThisMonth(r?.paid_at)).length,
    [swaps, returnRows]
  );
  const completedLastMonth = useMemo(
    () => swaps.filter((s) => isLastMonth(s?.swapped_at)).length + returnRows.filter((r) => isLastMonth(r?.paid_at)).length,
    [swaps, returnRows]
  );
  const pendingCount = useMemo(
    () => drafts.length + overdueRentals.length,
    [drafts, overdueRentals]
  );
  const pendingPrev = Math.max(1, pendingCount); // we don't have history, show 0% trend default

  // "Riders managed" = unique riders across active rentals + drafts.
  const totalRidersManaged = useMemo(() => {
    const set = new Set();
    drafts.forEach((d) => {
      const k = String(d?.phone || d?.name || d?.id || "").trim();
      if (k) set.add(k);
    });
    activeRentals.forEach((r) => {
      const k = String(r?.phone || r?.rider_phone || r?.full_name || r?.id || "").trim();
      if (k) set.add(k);
    });
    return set.size;
  }, [drafts, activeRentals]);

  // Sparkline series
  const sparkDrafts = useMemo(() => buildDailyCounts(drafts, "created_at"), [drafts]);
  const sparkCompleted = useMemo(() => buildDailyCounts(swaps, "swapped_at"), [swaps]);
  const sparkPending = useMemo(() => buildDailyCounts(drafts, "updated_at"), [drafts]);
  const sparkRiders = useMemo(() => buildDailyCounts(activeRentals, "start_time"), [activeRentals]);

  // Today's Summary
  const today = {
    requestsCreated: drafts.filter((d) => isToday(d?.created_at)).length,
    requestsCompleted: swaps.filter((s) => isToday(s?.swapped_at)).length,
    pending: drafts.length,
    swaps: swaps.filter((s) => isToday(s?.swapped_at)).length,
  };

  // Status overview donut data
  const statusOverview = useMemo(() => {
    const completed = completedThisMonth + completedLastMonth;
    const inProgress = activeRentals.length;
    const pending = drafts.length;
    const cancelled = 0;
    const rejected = 0;
    const total = completed + inProgress + pending + cancelled + rejected || 1;
    return [
      { name: "Completed", value: completed, color: "#10b981" },
      { name: "In Progress", value: inProgress, color: "#0ea5e9" },
      { name: "Pending", value: pending, color: "#f59e0b" },
      { name: "Cancelled", value: cancelled, color: "#ef4444" },
      { name: "Rejected", value: rejected, color: "#6b7280" },
    ].map((s) => ({ ...s, percent: Math.round((s.value / total) * 100) }));
  }, [completedThisMonth, completedLastMonth, activeRentals, drafts]);
  const statusTotal = statusOverview.reduce((sum, s) => sum + s.value, 0);

  // ---------------------------------------------------------------
  // Recent Requests rows
  // - "rider"   → all draft requests (rider onboarding flow)
  // - "payment" → payment due rows
  // - "overdue" → overdue rentals
  // ---------------------------------------------------------------

  const draftRequestRows = useMemo(() => {
    return (drafts || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.created_at || 0).getTime() -
          new Date(a?.created_at || 0).getTime()
      )
      .map((d, idx) => {
        const shortId = String(d?.id || "")
          .replace(/-/g, "")
          .slice(0, 12)
          .toUpperCase();
        return {
          id: d?.id,
          requestId: `REQ-${shortId || String(idx + 1).padStart(4, "0")}`,
          type: "New Rider",
          typeIcon: UserPlus,
          riderName: d?.name || "—",
          mobile: d?.phone || "—",
          status: "Draft",
          createdOn: d?.created_at,
        };
      });
  }, [drafts]);

  const paymentRequestRows = useMemo(() => {
    return (dues || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.due_at || b?.created_at || 0).getTime() -
          new Date(a?.due_at || a?.created_at || 0).getTime()
      )
      .map((p, idx) => {
        const shortId = String(p?.id || "")
          .replace(/-/g, "")
          .slice(0, 10)
          .toUpperCase();
        const status = String(p?.status || "").toUpperCase() === "PAID" ? "Completed" : "Pending";
        return {
          id: p?.id,
          requestId: `PAY-${shortId || String(idx + 1).padStart(4, "0")}`,
          type: "Payment",
          typeIcon: CheckCircle2,
          riderName: p?.rider_full_name || p?.rider_name || "—",
          mobile: p?.rider_mobile || p?.mobile || "—",
          status,
          createdOn: p?.due_at || p?.created_at,
        };
      });
  }, [dues]);

  const overdueRequestRows = useMemo(() => {
    return (overdueRentals || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.expected_end_time || b?.rental_end || 0).getTime() -
          new Date(a?.expected_end_time || a?.rental_end || 0).getTime()
      )
      .map((r, idx) => {
        const shortId = String(r?.id || "")
          .replace(/-/g, "")
          .slice(0, 10)
          .toUpperCase();
        return {
          id: r?.id,
          requestId: `OVR-${shortId || String(idx + 1).padStart(4, "0")}`,
          type: "Overdue",
          typeIcon: AlertTriangle,
          riderName: r?.rider_full_name || r?.rider_name || "—",
          mobile: r?.rider_mobile || r?.mobile || "—",
          status: "Overdue",
          createdOn: r?.expected_end_time || r?.rental_end,
        };
      });
  }, [overdueRentals]);

  const recentRows = useMemo(() => {
    let source = draftRequestRows;
    if (recentFilter === "payment") source = paymentRequestRows;
    else if (recentFilter === "overdue") source = overdueRequestRows;
    const q = recentSearch.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (r) =>
        r.riderName.toLowerCase().includes(q)
        || String(r.mobile).toLowerCase().includes(q)
        || r.requestId.toLowerCase().includes(q)
    );
  }, [recentFilter, recentSearch, draftRequestRows, paymentRequestRows, overdueRequestRows]);

  // Drafts table source (always drafts only)
  const draftRows = useMemo(() => draftRequestRows, [draftRequestRows]);

  const totalRows = recentRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const pageRows = recentRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingStart = totalRows ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingEnd = Math.min(totalRows, page * PAGE_SIZE);

  const draftTotal = draftRows.length;
  const draftPageCount = Math.max(1, Math.ceil(draftTotal / PAGE_SIZE));
  const draftPageRows = draftRows.slice((draftPage - 1) * PAGE_SIZE, draftPage * PAGE_SIZE);
  const draftShowingStart = draftTotal ? (draftPage - 1) * PAGE_SIZE + 1 : 0;
  const draftShowingEnd = Math.min(draftTotal, draftPage * PAGE_SIZE);

  // Reset to first page when filter/search changes
  useEffect(() => { setPage(1); }, [recentFilter, recentSearch]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <EmployeeLayout>
      {/* Sparkline gradients shared by all stat cards */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="sparkPurple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sparkGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sparkOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sparkBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Requests Created"
          sublabel="This Month"
          value={dataLoading ? "…" : formatNumber(createdThisMonth)}
          change={percentChange(createdThisMonth, createdLastMonth)}
          series={sparkDrafts}
          color="purple"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed Requests"
          sublabel="This Month"
          value={dataLoading ? "…" : formatNumber(completedThisMonth)}
          change={percentChange(completedThisMonth, completedLastMonth)}
          series={sparkCompleted}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Pending Requests"
          sublabel="Currently"
          value={dataLoading ? "…" : formatNumber(pendingCount)}
          change={percentChange(pendingCount, pendingPrev * 1.05)}
          series={sparkPending}
          color="orange"
        />
        <StatCard
          icon={Users}
          label="Total Riders"
          sublabel="Managed"
          value={dataLoading ? "…" : formatNumber(totalRidersManaged)}
          change={percentChange(totalRidersManaged, totalRidersManaged * 0.88)}
          series={sparkRiders}
          color="blue"
        />
      </div>

      {/* 2-column layout: main + right rail */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* MAIN COLUMN */}
        <div className="space-y-6 min-w-0">
          {/* Create New Request */}
          <section className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-evegah-text">Create New Request</h2>
              <p className="text-sm text-gray-500">
                Select the type of request you want to create on behalf of the rider.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <CreateRequestCard
                icon={UserPlus}
                color="purple"
                title="New Rider"
                description="Onboard a new rider and create a new ride."
                to="/employee/new-rider"
                ctaLabel="Create New Rider"
              />
              <CreateRequestCard
                icon={UserCheck}
                color="green"
                title="Retain Rider"
                description="Retain existing rider and start a new ride."
                to="/employee/retain-rider"
                ctaLabel="Retain Rider"
              />
              <CreateRequestCard
                icon={RotateCcw}
                color="orange"
                title="Return Ride"
                description="Complete the ride and initiate return."
                to="/employee/return-vehicle"
                ctaLabel="Return Ride"
              />
              <CreateRequestCard
                icon={Calendar}
                color="blue"
                title="Extend Ride"
                description="Extend the current ride duration."
                to="/employee/extend-ride"
                ctaLabel="Extend Ride"
              />
              <CreateRequestCard
                icon={BatteryCharging}
                color="teal"
                title="Battery Swap"
                description="Request battery swap for active ride."
                to="/employee/battery-swap"
                ctaLabel="Battery Swap"
              />
            </div>
          </section>

          {/* Recent Requests */}
          <section className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <h2 className="text-lg font-semibold text-evegah-text">My Recent Requests</h2>
                <div className="inline-flex rounded-xl border border-evegah-border bg-evegah-bg p-1">
                  {[
                    { id: "rider", label: "Rider" },
                    { id: "payment", label: "Payment" },
                    { id: "overdue", label: "Overdue" },
                  ].map((t) => {
                    const active = recentFilter === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRecentFilter(t.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          active
                            ? "bg-white text-evegah-primary shadow-sm"
                            : "text-gray-500 hover:text-evegah-text"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="search"
                    placeholder="Search…"
                    value={recentSearch}
                    onChange={(e) => setRecentSearch(e.target.value)}
                    className="w-44 sm:w-56 rounded-xl border border-evegah-border bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-evegah-primary"
                  />
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-evegah-primary hover:underline whitespace-nowrap"
                  onClick={() => navigate("/employee/new-rider")}
                >
                  View All
                </button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-evegah-border">
                    <th className="px-5 sm:px-6 py-3">Rider Name</th>
                    <th className="px-3 py-3">Mobile Number</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Request ID</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Created On</th>
                    <th className="px-5 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dataLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 sm:px-6 py-10 text-center text-gray-500">
                        Loading requests…
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 sm:px-6 py-10 text-center text-gray-500">
                        No {recentFilter} requests match the current filter.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => {
                      const TypeIcon = r.typeIcon;
                      return (
                        <tr key={`${recentFilter}-${r.id}`} className="border-b border-evegah-border/70 hover:bg-evegah-bg/60">
                          <td className="px-5 sm:px-6 py-3 text-evegah-text font-semibold">{r.riderName}</td>
                          <td className="px-3 py-3 text-gray-600">{r.mobile}</td>
                          <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-3 font-mono text-xs text-gray-700">{r.requestId}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-evegah-text">
                              <TypeIcon size={14} className="text-evegah-primary" />
                              {r.type}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                            {r.createdOn ? formatDateTimeDDMMYYYY(r.createdOn, "-") : "—"}
                          </td>
                          <td className="px-5 sm:px-6 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg"
                              title="View"
                              onClick={() => {
                                const stepPath = "step-1";
                                navigate(`/employee/new-rider/draft/${r.id}/${stepPath}`);
                              }}
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
              <p className="text-xs text-gray-500">
                Showing {showingStart} to {showingEnd} of {totalRows} requests
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: pageCount }).slice(0, 5).map((_v, idx) => {
                  const p = idx + 1;
                  const isActive = p === page;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`inline-flex h-8 min-w-8 px-2 items-center justify-center rounded-lg text-xs font-semibold ${
                        isActive
                          ? "bg-evegah-primary text-white"
                          : "border border-evegah-border text-gray-600 hover:bg-evegah-bg"
                      }`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>

          {/* Drafts */}
          <section className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-evegah-text inline-flex items-center gap-2">
                  Drafts
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5">
                    {draftTotal}
                  </span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Resume incomplete rider onboarding requests.</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-evegah-primary hover:underline self-start sm:self-auto"
                onClick={() => navigate("/employee/new-rider")}
              >
                Start New Draft
              </button>
            </div>

            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-evegah-border">
                    <th className="px-5 sm:px-6 py-3">Rider Name</th>
                    <th className="px-3 py-3">Mobile Number</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Request ID</th>
                    <th className="px-3 py-3">Last Updated</th>
                    <th className="px-5 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dataLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 sm:px-6 py-10 text-center text-gray-500">Loading drafts…</td>
                    </tr>
                  ) : draftPageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 sm:px-6 py-10 text-center text-gray-500">
                        No drafts in progress. Click <span className="font-semibold text-evegah-primary">Start New Draft</span> to begin.
                      </td>
                    </tr>
                  ) : (
                    draftPageRows.map((r) => (
                      <tr key={`draft-${r.id}`} className="border-b border-evegah-border/70 hover:bg-evegah-bg/60">
                        <td className="px-5 sm:px-6 py-3 text-evegah-text font-semibold">{r.riderName}</td>
                        <td className="px-3 py-3 text-gray-600">{r.mobile}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5">Draft</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-700">{r.requestId}</td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {r.createdOn ? formatDateTimeDDMMYYYY(r.createdOn, "-") : "—"}
                        </td>
                        <td className="px-5 sm:px-6 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-evegah-primary text-white px-2.5 py-1 text-xs font-semibold hover:opacity-95"
                              onClick={() => navigate(`/employee/new-rider/draft/${r.id}/step-1`)}
                            >
                              Resume <ChevronRight size={12} />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg"
                              title="View"
                              onClick={() => navigate(`/employee/new-rider/draft/${r.id}/step-1`)}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {draftTotal > 0 ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                <p className="text-xs text-gray-500">
                  Showing {draftShowingStart} to {draftShowingEnd} of {draftTotal} drafts
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50"
                    disabled={draftPage <= 1}
                    onClick={() => setDraftPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: draftPageCount }).slice(0, 5).map((_v, idx) => {
                    const p = idx + 1; const isActive = p === draftPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`inline-flex h-8 min-w-8 px-2 items-center justify-center rounded-lg text-xs font-semibold ${isActive ? "bg-evegah-primary text-white" : "border border-evegah-border text-gray-600 hover:bg-evegah-bg"}`}
                        onClick={() => setDraftPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50"
                    disabled={draftPage >= draftPageCount}
                    onClick={() => setDraftPage((p) => Math.min(draftPageCount, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-6">
          {/* Today's Summary */}
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-evegah-text">Today's Summary</h2>
              <span className="text-xs text-gray-500">{formatLongDate()}</span>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <ClipboardList size={16} className="text-evegah-primary" />
                  Requests Created
                </span>
                <span className="font-semibold text-evegah-text">{formatNumber(today.requestsCreated)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Requests Completed
                </span>
                <span className="font-semibold text-evegah-text">{formatNumber(today.requestsCompleted)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <Clock size={16} className="text-amber-600" />
                  Pending Requests
                </span>
                <span className="font-semibold text-evegah-text">{formatNumber(today.pending)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <BatteryCharging size={16} className="text-sky-600" />
                  Battery Swap Requests
                </span>
                <span className="font-semibold text-evegah-text">{formatNumber(today.swaps)}</span>
              </li>
            </ul>
            <button
              type="button"
              className="mt-5 w-full inline-flex items-center justify-center gap-1 rounded-xl bg-evegah-primary text-white text-sm font-semibold py-2.5 hover:opacity-95"
              onClick={() => navigate("/employee/analytics")}
            >
              View Full Report <ChevronRight size={14} />
            </button>
          </div>

          {/* Request Status Overview */}
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
            <h2 className="text-base font-semibold text-evegah-text">Request Status Overview</h2>

            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusOverview}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={60}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusOverview.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-evegah-text leading-none">
                    {dataLoading ? "…" : statusTotal}
                  </span>
                  <span className="text-[11px] text-gray-500">Total</span>
                </div>
              </div>
              <ul className="flex-1 space-y-1.5 text-xs">
                {statusOverview.map((s) => (
                  <li key={s.name} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-semibold text-evegah-text">
                      {s.value} <span className="text-gray-400 font-normal">({s.percent}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Knowledge & Resources */}
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
            <h2 className="text-base font-semibold text-evegah-text mb-3">Knowledge & Resources</h2>
            <ul className="space-y-2">
              {[
                {
                  icon: BookOpen,
                  title: "Rider Onboarding Guide",
                  desc: "Learn how to onboard a new rider",
                  to: "/employee/knowledge-base",
                },
                {
                  icon: FileText,
                  title: "Ride Policies & Guidelines",
                  desc: "View policies and important guidelines",
                  to: "/employee/knowledge-base",
                },
                {
                  icon: HelpCircle,
                  title: "FAQ",
                  desc: "Get answers to common questions",
                  to: "/employee/knowledge-base",
                },
              ].map(({ icon: Icon, title, desc, to }) => (
                <li key={title}>
                  <Link
                    to={to}
                    className="flex items-center gap-3 rounded-xl border border-evegah-border p-3 hover:bg-evegah-bg transition-colors"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-evegah-primary">
                      <Icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-evegah-text">{title}</p>
                      <p className="text-xs text-gray-500 truncate">{desc}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/employee/knowledge-base"
              className="mt-4 inline-flex items-center justify-center w-full gap-1.5 rounded-xl bg-evegah-primary text-white text-sm font-semibold py-2.5 hover:opacity-95"
            >
              Visit Knowledge Base <ExternalLink size={14} />
            </Link>
          </div>
        </aside>
      </div>

      {/* Footer warning */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          Make sure to collect all required documents and verify rider details before submitting any request.
        </p>
        <Link
          to="/employee/knowledge-base"
          className="text-sm font-semibold text-amber-800 hover:underline whitespace-nowrap"
        >
          View Guidelines →
        </Link>
      </div>
    </EmployeeLayout>
  );
}

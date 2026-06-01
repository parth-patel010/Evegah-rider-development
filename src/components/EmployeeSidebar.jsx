import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BatteryCharging,
  BookOpen,
  Bot,
  Calendar,
  ChevronDown,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  MessageSquare,
  RotateCcw,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import logo from "../assets/logo.png";
import { openChatbot } from "./Chatbot";

const sectionTitle =
  "px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400";

const navItemBase =
  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors";
const navActive = "bg-evegah-primary text-white shadow-sm";
const navInactive = "text-gray-600 hover:bg-brand-light/60 hover:text-evegah-text";

const iconWrap =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light/70 text-evegah-primary transition-colors";
const iconWrapActive = "bg-white/15 text-white";

const RIDE_OPS_PATHS = [
  "/employee/retain-rider",
  "/employee/return-vehicle",
  "/employee/extend-ride",
  "/employee/exchange-vehicle",
];

const SECTIONS = [
  {
    label: null,
    items: [
      ["/employee/dashboard", "Dashboard", "Overview & KPIs", LayoutGrid],
    ],
  },
  {
    label: "Create Request",
    items: [
      ["/employee/new-rider", "New Rider", "Onboard a new rider", UserPlus],
      {
        type: "group",
        key: "ride-ops",
        label: "Ride Operations",
        subtitle: "Retain, Return, Extend & Exchange",
        icon: RotateCcw,
        children: [
          ["/employee/retain-rider", "Retain Rider", "Extend rider (within due date)", UserCheck],
          ["/employee/return-vehicle", "Return Rider", "Complete & return ride", RotateCcw],
          ["/employee/extend-ride", "Extend Ride", "Extend ride period", Calendar],
        ],
      },
      ["/employee/battery-swap", "Battery Swap", "Request battery swap", BatteryCharging],
    ],
  },
  {
    label: "Other",
    items: [
      ["/employee/knowledge-base", "Knowledge Base", "Policies & guidelines", BookOpen],
      ["/employee/support", "Support Ticket", "Raise a support ticket", LifeBuoy],
      ["/employee/analytics", "Analytics", "Reports & insights", BarChart3],
      ["/employee/profile", "Profile", "Account & preferences", User],
    ],
  },
];

function NavLeaf({ to, label, subtitle, Icon, onClose }) {
  return (
    <NavLink
      to={to}
      end={to === "/employee/dashboard"}
      onClick={() => onClose?.()}
      className={({ isActive }) =>
        `${navItemBase} ${isActive ? navActive : navInactive}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`${iconWrap} ${isActive ? iconWrapActive : ""}`}>
            <Icon size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold leading-tight">{label}</span>
            <span
              className={`block text-[11px] leading-tight ${
                isActive ? "text-white/75" : "text-gray-400"
              }`}
            >
              {subtitle}
            </span>
          </span>
        </>
      )}
    </NavLink>
  );
}

function RideOpsGroup({ group, onClose }) {
  const location = useLocation();
  const childPaths = useMemo(() => group.children.map(([p]) => p), [group.children]);
  const isAnyChildActive = childPaths.some((p) => location.pathname.startsWith(p));

  const [open, setOpen] = useState(isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [isAnyChildActive]);

  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${navItemBase} w-full text-left ${
          isAnyChildActive ? "text-evegah-text bg-brand-light/40" : "text-gray-600 hover:bg-brand-light/60 hover:text-evegah-text"
        }`}
      >
        <span className={`${iconWrap}`}>
          <Icon size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold leading-tight">{group.label}</span>
          <span className="block text-[11px] leading-tight text-gray-400">{group.subtitle}</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${open ? "max-h-96 mt-1" : "max-h-0"}`}
      >
        <div className="ml-5 pl-3 border-l border-evegah-border space-y-1 py-1">
          {group.children.map(([to, label, subtitle, ChildIcon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-evegah-primary text-white shadow-sm"
                    : "text-gray-600 hover:bg-brand-light/40 hover:text-evegah-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${isActive ? "bg-white/15 text-white" : "bg-brand-light/60 text-evegah-primary"}`}>
                    <ChildIcon size={14} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold leading-tight">{label}</span>
                    <span className={`block text-[10px] leading-tight ${isActive ? "text-white/70" : "text-gray-400"}`}>{subtitle}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeSidebar({ isMobile = false, onClose, onLogout }) {
  return (
    <aside className="relative h-full w-full bg-white border-r border-evegah-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <img src={logo} className="h-16 w-auto" alt="eVEGAH" />
        {isMobile ? (
          <button
            type="button"
            aria-label="Close menu"
            className="w-10 h-10 rounded-xl grid place-items-center text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      {/* Nav — scrolls if needed, but the scrollbar is visually hidden */}
      <nav className="px-3 pb-4 space-y-4 flex-1 overflow-y-auto scrollbar-hide">
        {SECTIONS.map((section, idx) => (
          <div key={section.label || `section-${idx}`}>
            {section.label ? (
              <h3 className={sectionTitle}>{section.label}</h3>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => {
                if (Array.isArray(item)) {
                  const [to, label, subtitle, Icon] = item;
                  return (
                    <NavLeaf
                      key={to}
                      to={to}
                      label={label}
                      subtitle={subtitle}
                      Icon={Icon}
                      onClose={onClose}
                    />
                  );
                }
                if (item.type === "group") {
                  return <RideOpsGroup key={item.key} group={item} onClose={onClose} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Chatbot card (replaces Need Help) */}
      <div className="px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl border border-brand-light bg-gradient-to-br from-evegah-primary to-violet-600 p-4 text-white shadow-md">
          <div className="absolute -top-3 -right-3 h-16 w-16 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-center gap-2.5 mb-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
              <Bot size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight inline-flex items-center gap-1">
                Eve <Sparkles size={12} className="text-yellow-300" />
              </p>
              <p className="text-[11px] text-white/80 leading-tight">Your AI assistant</p>
            </div>
          </div>
          <p className="relative text-[11px] text-white/85 mb-3">
            Ask anything about riders, rides, payments, or how to use the app.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose?.();
              openChatbot();
            }}
            className="relative inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-white text-evegah-primary px-3 py-2 text-xs font-bold hover:bg-white/95"
          >
            <MessageSquare size={13} /> Chat with Eve
          </button>
        </div>
      </div>

      {/* Footer + logout */}
      <div className="px-4 pb-4 pt-2 border-t border-evegah-border">
        <button
          type="button"
          className="w-full flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          onClick={onLogout}
        >
          <LogOut size={16} />
          Logout
        </button>
        <div className="px-2 pt-2 text-[11px] text-gray-400 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Evegah</span>
          <span className="font-mono">v2.5.0</span>
        </div>
      </div>

      {isMobile && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="absolute -right-3 top-1/2 flex h-20 w-4 -translate-y-1/2 items-center justify-center rounded-l-full bg-evegah-primary text-white shadow-lg focus-visible:outline focus-visible:ring"
          onClick={() => onClose?.()}
        >
          <span className="block h-12 w-px bg-white" />
        </button>
      )}
    </aside>
  );
}

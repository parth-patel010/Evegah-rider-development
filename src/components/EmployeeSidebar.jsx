import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BatteryCharging,
  BookOpen,
  Calendar,
  ChevronDown,
  LayoutGrid,
  LifeBuoy,
  RotateCcw,
  User,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import logo from "../assets/logo.png";
import logoMark from "../assets/Evegah Logo.svg";

const sectionTitle =
  "px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400";

const navItemBase =
  "group relative flex items-center gap-3 rounded-xl text-sm transition-colors";
const navActive = "bg-evegah-primary text-white shadow-sm";
const navInactive = "text-gray-600 hover:bg-brand-light/40 hover:text-evegah-text";

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
        fallbackPath: "/employee/retain-rider",
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

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

function NavLeaf({ to, label, subtitle, Icon, onClose, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === "/employee/dashboard"}
      onClick={() => onClose?.()}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `${navItemBase} ${isActive ? navActive : navInactive} ${
          collapsed ? "justify-center h-11 w-11 mx-auto" : "px-3 py-2.5"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid place-items-center rounded-xl transition-colors ${
              collapsed ? "h-9 w-9" : "h-9 w-9"
            } ${isActive ? "text-white" : "text-evegah-primary"}`}
          >
            <Icon size={18} />
          </span>
          {!collapsed ? (
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
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function RideOpsGroup({ group, onClose, collapsed }) {
  const location = useLocation();
  const childPaths = useMemo(() => group.children.map(([p]) => p), [group.children]);
  const isAnyChildActive = childPaths.some((p) => location.pathname.startsWith(p));

  const [open, setOpen] = useState(isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [isAnyChildActive]);

  const Icon = group.icon;

  // Collapsed mode: render a single icon-only link to the group's first child.
  // Hover state still highlights when any child route is active.
  if (collapsed) {
    return (
      <NavLink
        to={group.fallbackPath || group.children[0][0]}
        onClick={() => onClose?.()}
        title={group.label}
        className={`${navItemBase} justify-center h-11 w-11 mx-auto ${
          isAnyChildActive ? navActive : navInactive
        }`}
      >
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${isAnyChildActive ? "text-white" : "text-evegah-primary"}`}>
          <Icon size={18} />
        </span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${navItemBase} px-3 py-2.5 w-full text-left ${
          isAnyChildActive ? "text-evegah-text bg-brand-light/40" : navInactive
        }`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl text-evegah-primary">
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
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${isActive ? "text-white" : "text-evegah-primary"}`}>
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

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function EmployeeSidebar({ isMobile = false, onClose, collapsed = false }) {
  return (
    <aside className="relative h-full w-full bg-white border-r border-evegah-border flex flex-col">
      {/* Logo */}
      <div className={`flex items-center justify-between ${collapsed ? "px-3 pt-5 pb-3" : "px-5 pt-5 pb-3"}`}>
        {collapsed ? (
          <img src={logoMark} className="h-9 w-9 mx-auto" alt="eVEGAH" />
        ) : (
          <img src={logo} className="h-24 w-auto" alt="eVEGAH" />
        )}
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

      {/* Nav */}
      <nav className={`pb-4 space-y-4 flex-1 overflow-y-auto scrollbar-hide ${collapsed ? "px-2" : "px-3"}`}>
        {SECTIONS.map((section, idx) => (
          <div key={section.label || `section-${idx}`}>
            {section.label && !collapsed ? (
              <h3 className={sectionTitle}>{section.label}</h3>
            ) : null}
            {section.label && collapsed ? <div className="my-2 border-t border-evegah-border" /> : null}
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
                      collapsed={collapsed}
                    />
                  );
                }
                if (item.type === "group") {
                  return <RideOpsGroup key={item.key} group={item} onClose={onClose} collapsed={collapsed} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </nav>

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

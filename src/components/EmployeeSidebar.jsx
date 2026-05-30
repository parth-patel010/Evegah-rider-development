import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BatteryCharging,
  BookOpen,
  Calendar,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  RotateCcw,
  User,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import logo from "../assets/logo.png";

const sectionTitle =
  "px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400";

const navItem =
  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors";
const active =
  "bg-evegah-primary text-white shadow-sm";
const inactive =
  "text-gray-600 hover:bg-brand-light/60 hover:text-evegah-text";

const iconWrap =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light/70 text-evegah-primary transition-colors";
const iconWrapActive = "bg-white/15 text-white";

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
      ["/employee/retain-rider", "Retain Rider", "Extend rider (within due date)", UserCheck],
      ["/employee/return-vehicle", "Return Rider", "Complete & return ride", RotateCcw],
      ["/employee/extend-ride", "extend Ride", "Extend ride period", Calendar],
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

export default function EmployeeSidebar({ isMobile = false, onClose, onLogout }) {
  return (
    <aside className="relative h-full w-full bg-white border-r border-evegah-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <img src={logo} className="h-14" alt="eVEGAH" />
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
      <nav className="px-3 pb-4 space-y-5 flex-1 overflow-y-auto">
        {SECTIONS.map((section, idx) => (
          <div key={section.label || `section-${idx}`}>
            {section.label ? (
              <h3 className={sectionTitle}>{section.label}</h3>
            ) : null}
            <div className="space-y-1">
              {section.items.map(([to, label, subtitle, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/employee/dashboard"}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    `${navItem} ${isActive ? active : inactive}`
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
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Need help card */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-brand-light bg-gradient-to-br from-brand-light/80 to-white p-4 text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-evegah-primary text-white">
            <LifeBuoy size={18} />
          </div>
          <p className="text-sm font-semibold text-evegah-text">Need Help?</p>
          <p className="mt-1 text-xs text-gray-500">Contact support team</p>
          <NavLink
            to="/employee/support"
            onClick={() => onClose?.()}
            className="mt-3 inline-flex items-center justify-center w-full rounded-xl bg-evegah-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
          >
            Raise a Ticket
          </NavLink>
        </div>
      </div>

      {/* Footer + logout */}
      <div className="px-4 pb-4 space-y-2">
        <button
          type="button"
          className="flex items-center gap-2 text-red-600 text-sm hover:underline"
          onClick={onLogout}
        >
          <LogOut size={16} />
          Logout
        </button>
        <div className="text-[11px] text-gray-400">
          <p>© {new Date().getFullYear()} Evegah</p>
          <p>v2.5.0</p>
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

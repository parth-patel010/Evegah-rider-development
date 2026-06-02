import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeft,
  Search,
  User,
} from "lucide-react";
import useAuth from "../hooks/useAuth";

function getInitials(name, fallback) {
  const src = String(name || fallback || "").trim();
  if (!src) return "U";
  const parts = src.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || src[0].toUpperCase();
}

function firstName(displayName, email) {
  const src = String(displayName || "").trim();
  if (src) return src.split(/\s+/)[0];
  const e = String(email || "").trim();
  if (e) return e.split("@")[0];
  return "there";
}

export default function EmployeeTopbar({
  onMobileSidebarToggle,
  onDesktopSidebarToggle,
  showSidebarButton = true,
  isMobileSidebarOpen = false,
  isDesktopSidebarCollapsed = false,
  onLogout = () => {},
  welcomeSubtitle = "Create and manage rider requests on behalf of customers.",
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.displayName || user?.email || "User";
  const role = String(user?.role || "Employee");
  const initials = getInitials(user?.displayName, user?.email);
  const greeting = firstName(user?.displayName, user?.email);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e) => {
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-evegah-border">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 sm:gap-5">
        {/* Mobile hamburger */}
        {showSidebarButton ? (
          <button
            type="button"
            className="lg:hidden h-11 w-11 shrink-0 rounded-2xl border border-evegah-border bg-white grid place-items-center text-gray-700 hover:bg-gray-50"
            aria-label={isMobileSidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileSidebarOpen}
            onClick={onMobileSidebarToggle}
          >
            <Menu size={20} />
          </button>
        ) : null}

        {/* Desktop sidebar collapse toggle */}
        {showSidebarButton ? (
          <button
            type="button"
            className="hidden lg:grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-evegah-border bg-white text-gray-700 hover:bg-gray-50"
            aria-label={isDesktopSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={isDesktopSidebarCollapsed}
            onClick={onDesktopSidebarToggle}
            title={isDesktopSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <PanelLeft size={18} className={`${isDesktopSidebarCollapsed ? "rotate-180" : ""} transition-transform`} />
          </button>
        ) : null}

        {/* Welcome message (left-aligned) */}
        <div className="hidden md:flex flex-col min-w-0 leading-tight">
          <h1 className="text-sm lg:text-lg font-bold text-evegah-text truncate">
            Welcome back, <span className="capitalize">{greeting}</span>! <span aria-hidden>👋</span>
          </h1>
          <p className="hidden lg:block text-xs text-gray-500 truncate">{welcomeSubtitle}</p>
        </div>

        {/* Spacer pushes the right cluster to the edge */}
        <div className="flex-1" />

        {/* Search — compact, right-aligned */}
        <div className="hidden sm:block w-[200px] md:w-[220px] lg:w-[300px]">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="search"
              placeholder="Search rider, mobile, booking ID…"
              className="w-full rounded-2xl border border-evegah-border bg-evegah-bg pl-9 pr-12 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-evegah-primary/20 focus:border-evegah-primary/30"
            />
            <kbd className="hidden lg:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-evegah-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              ⌘ K
            </kbd>
          </label>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative h-10 w-10 rounded-xl border border-evegah-border bg-white grid place-items-center text-gray-700 hover:bg-gray-50"
            aria-label="Notifications"
          >
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              className="flex items-center gap-2 sm:gap-3 rounded-xl border border-evegah-border bg-white pl-1.5 pr-3 py-1.5 hover:bg-gray-50"
              onClick={() => setProfileOpen((v) => !v)}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-evegah-primary text-white text-xs font-bold">
                {initials}
              </span>
              <span className="hidden sm:flex flex-col items-start min-w-0">
                <span className="text-sm font-semibold text-evegah-text leading-tight truncate max-w-[140px]">
                  {displayName}
                </span>
                <span className="text-[11px] text-gray-500 leading-tight capitalize">
                  {role}
                </span>
              </span>
              <ChevronDown size={16} className="text-gray-500" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-evegah-border bg-white shadow-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/employee/profile");
                  }}
                >
                  <User size={16} />
                  Profile
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-evegah-border"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

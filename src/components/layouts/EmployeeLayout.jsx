import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EmployeeTopbar from "../EmployeeTopbar";
import EmployeeSidebar from "../EmployeeSidebar";
import Chatbot from "../Chatbot";
import { clearAuthSession } from "../../utils/authSession";

const DESKTOP_COLLAPSED_KEY = "evegah:desktopSidebarCollapsed";

export default function EmployeeLayout({ children, showSidebar = true }) {
  const navigate = useNavigate();

  // Mobile drawer (overlay) state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);

  // Desktop "hide sidebar" toggle, persisted across reloads
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DESKTOP_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_COLLAPSED_KEY, desktopCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [desktopCollapsed]);

  const handleLogout = useCallback(async () => {
    try { clearAuthSession(); } catch { /* ignore */ }
    setMobileOpen(false);
    navigate("/", { replace: true });
  }, [navigate]);

  const openMobileSidebar = () => { if (showSidebar) setMobileOpen(true); };
  const closeMobileSidebar = () => setMobileOpen(false);
  const toggleDesktopSidebar = () => setDesktopCollapsed((v) => !v);

  useEffect(() => {
    if (mobileOpen) {
      setMobileVisible(true);
      return;
    }
    if (!mobileVisible) return;
    const timeout = setTimeout(() => setMobileVisible(false), 300);
    return () => clearTimeout(timeout);
  }, [mobileOpen, mobileVisible]);

  return (
    <div className="min-h-screen bg-evegah-bg">
      <div className="flex">
        {/* Permanent sidebar on desktop (hidden when collapsed) */}
        {showSidebar && !desktopCollapsed ? (
          <aside className="hidden lg:flex sticky top-0 h-screen w-72 shrink-0">
            <EmployeeSidebar onLogout={handleLogout} />
          </aside>
        ) : null}

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <EmployeeTopbar
            onMobileSidebarToggle={openMobileSidebar}
            onDesktopSidebarToggle={toggleDesktopSidebar}
            showSidebarButton={showSidebar}
            isMobileSidebarOpen={mobileOpen}
            isDesktopSidebarCollapsed={desktopCollapsed}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>

      {/* Floating chatbot (available on every employee page) */}
      <Chatbot />

      {/* Mobile drawer sidebar */}
      {showSidebar && mobileVisible ? (
        <div
          className={`fixed inset-0 z-50 flex lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-label="Close navigation"
            onClick={closeMobileSidebar}
          />
          <div className="relative flex h-full w-full">
            <div
              className={`h-full w-72 transform transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              <EmployeeSidebar
                isMobile
                onClose={closeMobileSidebar}
                onLogout={async () => { closeMobileSidebar(); await handleLogout(); }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EmployeeTopbar from "../EmployeeTopbar";
import EmployeeSidebar from "../EmployeeSidebar";
import { clearAuthSession } from "../../utils/authSession";

export default function EmployeeLayout({ children, showSidebar = true }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    try {
      clearAuthSession();
    } catch {
      // ignore
    }
    setSidebarOpen(false);
    navigate("/", { replace: true });
  }, [navigate]);

  const openSidebar = () => {
    if (!showSidebar) return;
    setSidebarOpen(true);
  };

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarVisible(true);
      return;
    }
    if (!sidebarVisible) return;
    const timeout = setTimeout(() => setSidebarVisible(false), 300);
    return () => clearTimeout(timeout);
  }, [sidebarOpen, sidebarVisible]);

  return (
    <div className="min-h-screen bg-evegah-bg">
      <div className="flex">
        {/* Permanent sidebar on desktop */}
        {showSidebar ? (
          <aside className="hidden lg:flex sticky top-0 h-screen w-72 shrink-0">
            <EmployeeSidebar onLogout={handleLogout} />
          </aside>
        ) : null}

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <EmployeeTopbar
            onSidebarToggle={openSidebar}
            showSidebarButton={showSidebar}
            isSidebarOpen={sidebarOpen}
            onLogout={handleLogout}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile drawer sidebar */}
      {showSidebar && sidebarVisible ? (
        <div
          className={`fixed inset-0 z-50 flex lg:hidden ${
            sidebarOpen ? "" : "pointer-events-none"
          }`}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${
              sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Close navigation"
            onClick={closeSidebar}
          />
          <div className="relative flex h-full w-full">
            <div
              className={`h-full w-72 transform transition-transform duration-300 ease-out ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <EmployeeSidebar
                isMobile
                onClose={closeSidebar}
                onLogout={async () => {
                  closeSidebar();
                  await handleLogout();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

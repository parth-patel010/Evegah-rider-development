import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Redirect from "./pages/Redirect";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Invoice from "./pages/Invoice";

/* ADMIN */
import AdminDashboard from "./pages/admin/dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminBatterySwaps from "./pages/admin/BatterySwaps";
import RidersTable from "./pages/admin/RidersTable";
import RentalsTable from "./pages/admin/RentalsTable";
import ReturnsTable from "./pages/admin/ReturnsTable";
import Analytics from "./pages/Analytics";

/* EMPLOYEE */
import EmployeeDashboard from "./pages/employee/Dashboard";
import RiderForm from "./pages/employee/RiderForm";
import RetainRider from "./pages/employee/RetainRider";
import ReturnVehicle from "./pages/employee/ReturnVehicle";
import ExchangeVehicle from "./pages/employee/ExchangeVehicle";
import ExtendRide from "./pages/employee/ExtendRide";
import BatterySwap from "./pages/employee/BatterySwap";
import ComingSoon from "./pages/employee/ComingSoon";

/* PROTECTED ROUTES */
import ProtectedRouteAdmin from "./components/ProtectedRouteAdmin";
import ProtectedRouteEmployee from "./components/ProtectedRouteEmployee";

export default function App() {
  return (
    <>
      <div className="relative z-10 min-h-screen">
        <BrowserRouter>
          <Routes>
            {/* ---------- PUBLIC ---------- */}
            <Route path="/" element={<Login />} />
            <Route path="/redirect" element={<Redirect />} />
            <Route path="/invoice/:receiptId" element={<Invoice />} />
            <Route path="/invoice/*" element={<Invoice />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* ---------- ADMIN ---------- */}
            <Route
              path="/admin"
              element={
                <ProtectedRouteAdmin>
                  <Navigate to="/admin/dashboard" replace />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRouteAdmin>
                  <AdminDashboard />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRouteAdmin>
                  <AdminUsers />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/riders"
              element={
                <ProtectedRouteAdmin>
                  <RidersTable />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/rentals"
              element={
                <ProtectedRouteAdmin>
                  <RentalsTable />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/returns"
              element={
                <ProtectedRouteAdmin>
                  <ReturnsTable />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/battery-swaps"
              element={
                <ProtectedRouteAdmin>
                  <AdminBatterySwaps />
                </ProtectedRouteAdmin>
              }
            />

            <Route
              path="/admin/analytics"
              element={
                <ProtectedRouteAdmin>
                  <Analytics />
                </ProtectedRouteAdmin>
              }
            />

            {/* ---------- EMPLOYEE ---------- */}
            <Route
              path="/employee"
              element={
                <ProtectedRouteEmployee>
                  <Navigate to="/employee/dashboard" replace />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRouteEmployee>
                  <EmployeeDashboard />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/new-rider/*"
              element={
                <ProtectedRouteEmployee>
                  <RiderForm />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/new-rider/draft/:draftId/*"
              element={
                <ProtectedRouteEmployee>
                  <RiderForm />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/battery-swap"
              element={
                <ProtectedRouteEmployee>
                  <BatterySwap />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/retain-rider"
              element={
                <ProtectedRouteEmployee>
                  <RetainRider />
                </ProtectedRouteEmployee>
              }
            />

            <Route
              path="/employee/return-vehicle"
              element={
                <ProtectedRouteEmployee>
                  <ReturnVehicle />
                </ProtectedRouteEmployee>
              }
            />

            {/* Placeholder routes for nav items that don't have a real page yet. */}
            <Route
              path="/employee/extend-ride"
              element={
                <ProtectedRouteEmployee>
                  <ExtendRide />
                </ProtectedRouteEmployee>
              }
            />
            <Route
              path="/employee/exchange-vehicle"
              element={
                <ProtectedRouteEmployee>
                  <ExchangeVehicle />
                </ProtectedRouteEmployee>
              }
            />
            <Route
              path="/employee/knowledge-base"
              element={
                <ProtectedRouteEmployee>
                  <ComingSoon title="Knowledge Base" description="Policies, guidelines, and how-to articles will live here." />
                </ProtectedRouteEmployee>
              }
            />
            <Route
              path="/employee/support"
              element={
                <ProtectedRouteEmployee>
                  <ComingSoon title="Support Ticket" description="Raise and track support tickets from this page." />
                </ProtectedRouteEmployee>
              }
            />
            <Route
              path="/employee/analytics"
              element={
                <ProtectedRouteEmployee>
                  <ComingSoon title="Analytics" description="Personal performance analytics will appear here." />
                </ProtectedRouteEmployee>
              }
            />
            <Route
              path="/employee/profile"
              element={
                <ProtectedRouteEmployee>
                  <ComingSoon title="Profile" description="Manage your profile and preferences." />
                </ProtectedRouteEmployee>
              }
            />

            {/* ---------- FALLBACK ---------- */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </>
  );
}

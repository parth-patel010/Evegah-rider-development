import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getValidAuthSession } from "../utils/authSession";

export default function Redirect() {
  const { user, loading } = useAuth();
  const session = getValidAuthSession();

  if (loading) return null;
  if (!session) return <Navigate to="/" replace />;

  if (String(session.role || "").toLowerCase() === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Belt-and-braces: also treat the seeded admin email as admin even if a role
  // claim was missed somewhere upstream.
  if (user?.email && user.email.toLowerCase() === "adminev@gmail.com") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/employee/dashboard" replace />;
}

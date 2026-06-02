import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import Logo from "../assets/logo.png";
import { apiFetch } from "../config/api";
import {
  setAuthSession,
  SESSION_DURATION_MS,
} from "../utils/authSession";

export default function UserLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loginUser = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      const user = data?.user || {};
      setAuthSession({
        token: data?.token || "",
        role: user.role || "employee",
        uid: user.uid || null,
        email: user.email || null,
        displayName: user.displayName || null,
        expiresAt:
          typeof data?.expiresAt === "number"
            ? data.expiresAt
            : Date.now() + SESSION_DURATION_MS,
      });

      navigate("/user/dashboard");
    } catch (err) {
      setError(err?.message || "Invalid login credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="bg-white w-full max-w-md p-10 rounded-2xl shadow-lg border border-gray-200">

        <img src={Logo} className="w-36 mx-auto mb-6" />

        <h1 className="text-2xl font-semibold text-center text-gray-800 mb-6">
          User Login
        </h1>

        <form onSubmit={loginUser} className="space-y-5">
          <input
            type="email"
            placeholder="Enter email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-gray-600">
          <Link to="/privacy" className="hover:text-gray-900 underline">
            Privacy Policy
          </Link>
          <span className="text-gray-300">|</span>
          <Link to="/terms" className="hover:text-gray-900 underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}

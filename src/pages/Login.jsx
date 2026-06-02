import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import Logo from "../assets/logo.png";
import { apiFetch } from "../config/api";
import {
  getValidAuthSession,
  setAuthSession,
  SESSION_DURATION_MS,
} from "../utils/authSession";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const existing = getValidAuthSession();
    if (existing) {
      navigate("/redirect", { replace: true });
    }
  }, [navigate]);

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

      navigate("/redirect", { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full border">

        <div className="flex justify-center mb-5">
          <img src={Logo} className="w-32" />
        </div>

        <h2 className="text-2xl text-center font-semibold mb-6">Login</h2>

        <form onSubmit={loginUser} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 border rounded-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 border rounded-xl"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-purple-600 text-white rounded-xl disabled:opacity-60"
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

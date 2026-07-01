import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../api/patientApi";

export default function Login() {
  const [role, setRole] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function submit(e) {
    // TEMP BYPASS
// if (email === "doctor@test.com") {
//   localStorage.setItem("mv_token", "dummy");
//   localStorage.setItem("mv_role", "doctor");
//   navigate("/doctor");
//   return;
// }

  e.preventDefault();
  setIsLoading(true);

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login failed");
      setIsLoading(false);
      return;
    }

    login(data.token, data.refreshToken, data.role);
    if (role === "patient") {
      navigate("/patient-dashboard");
    } else if (role === "doctor") {
      navigate("/doctor");
    } else if (role === "admin") {
      navigate("/admin");
    }

  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    setIsLoading(false);
  }
}



  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef7ff] via-[#e3f2ff] to-[#eef7ff] pt-28 px-6 relative">

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-24 left-6 text-sky-600 font-medium flex items-center gap-2 hover:text-sky-700 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* MAIN LOGIN SECTION */}
      <div className="max-w-md mx-auto mt-10">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl pb-5 font-extrabold bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
            Sign In
          </h1>
          {/* <p className="text-slate-600 mt-2">
            Access your secure MediVault account
          </p> */}
        </div>

        {/* ROLE SELECTION */}
        <div className="mb-8">
          <label className="block text-slate-700 font-semibold mb-3">Login as</label>
          <div className="grid grid-cols-3 gap-3">

            {/* Patient */}
            <button
              type="button"
              onClick={() => setRole("patient")}
              className={`p-3 rounded-xl border-2 transition ${
                role === "patient"
                  ? "border-sky-500 bg-sky-50 shadow"
                  : "border-slate-200 hover:border-sky-300"
              }`}
            >
              <div className="font-semibold text-slate-800">Patient</div>
            </button>

            {/* Doctor */}
            <button
              type="button"
              onClick={() => setRole("doctor")}
              className={`p-3 rounded-xl border-2 transition ${
                role === "doctor"
                  ? "border-sky-500 bg-sky-50 shadow"
                  : "border-slate-200 hover:border-sky-300"
              }`}
            >
              <div className="font-semibold text-slate-800">Doctor</div>
            </button>

            {/* Admin */}
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`p-3 rounded-xl border-2 transition ${
                role === "admin"
                  ? "border-sky-500 bg-sky-50 shadow"
                  : "border-slate-200 hover:border-sky-300"
              }`}
            >
              <div className="font-semibold text-slate-800">Admin</div>
            </button>

          </div>
        </div>

        {/* LOGIN FORM */}
        <form className="space-y-6" onSubmit={submit}>

          {/* Email */}
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">Email</label>
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl
                focus:border-sky-500 focus:bg-white outline-none transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">Password</label>
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>

              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl
                focus:border-sky-500 focus:bg-white outline-none transition"
              />

              {/* Toggle password */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-sky-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold 
            rounded-xl shadow-lg hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-600 mt-6">
          Don’t have an account?{" "}
          <Link
            to="/register"
            className="text-sky-600 font-semibold hover:underline"
          >
            Register
          </Link>
        </p>

      </div>
    </div>
  );
}

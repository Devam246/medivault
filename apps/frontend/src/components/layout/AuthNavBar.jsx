import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AuthNavBar() {
  const { token, role, logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [hidden, setHidden] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  const isLandingPage = location.pathname === "/";

  function logout() {
    authLogout();
    navigate("/");
  }

  useEffect(() => {
    if (isLandingPage) return;

    function handleScroll() {
      const current = window.scrollY;

      if (current > lastScroll && current > 60) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      setLastScroll(current);
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll, isLandingPage]);

  if (isLandingPage) return null;

  return (
    <nav
      className={`fixed w-full top-0 z-50 bg-white/90 backdrop-blur-lg shadow-md 
      transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="max-w-[1400px] mx-auto py-5 px-10 flex justify-between items-center">

        <Link
          to="/"
          className="text-2xl font-bold bg-gradient-to-br from-sky-500 to-cyan-400 
          bg-clip-text text-transparent flex items-center gap-2"
        >
          🏥 MediVault
        </Link>

        <ul className="flex gap-8 items-center">

          {!token && (
            <Link
              to="/login"
              className="bg-gradient-to-r from-sky-500 to-cyan-400 
              text-white px-6 py-2 rounded-full font-semibold shadow"
            >
              Login
            </Link>
          )}

          {token && (
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg"
            >
              Logout
            </button>
          )}

          {role === "admin" && <Link to="/admin">Admin</Link>}
          {role === "doctor" && <Link to="/doctor">Doctor</Link>}
          {role === "patient" && <Link to="/patient-dashboard">Patient</Link>}
        </ul>
      </div>
    </nav>
  );
}

  import React from "react";

  export default function LandingPage() {
    return (
      <div className="font-inter text-[#1a1a1a] overflow-x-hidden">

        {/* NAVIGATION */}
        <nav className="fixed w-full top-0 z-50 bg-white/95 backdrop-blur-xl shadow-md">
          <div className="max-w-[1400px] mx-auto py-6 px-12 flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-br from-sky-500 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
              <span>🏥</span>MediVault
            </div>

            <ul className="flex gap-12 items-center max-md:hidden">
              <li><a className="text-gray-600 font-medium hover:text-sky-500 relative after:block after:h-[2px] after:bg-gradient-to-r after:from-sky-500 after:to-cyan-400 after:w-0 hover:after:w-full after:transition-all" href="#home">Home</a></li>
              <li><a className="text-gray-600 font-medium hover:text-sky-500 relative after:block after:h-[2px] after:bg-gradient-to-r after:from-sky-500 after:to-cyan-400 after:w-0 hover:after:w-full after:transition-all" href="#about">About</a></li>
              <li><a className="text-gray-600 font-medium hover:text-sky-500 relative after:block after:h-[2px] after:bg-gradient-to-r after:from-sky-500 after:to-cyan-400 after:w-0 hover:after:w-full after:transition-all" href="#features">Features</a></li>
              <li><a className="text-gray-600 font-medium hover:text-sky-500 relative after:block after:h-[2px] after:bg-gradient-to-r after:from-sky-500 after:to-cyan-400 after:w-0 hover:after:w-full after:transition-all" href="#contact">Contact</a></li>

              <li>
                <a
                  href="/login"
                  className="bg-gradient-to-r from-sky-500 to-cyan-400 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:-translate-y-1 transition"
                >
                  Login
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section className="hero pt-[140px] mt-0 px-12 py-32 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#f0f9ff] relative overflow-hidden" id="home">

          {/* radial backgrounds */}
          <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(14,165,233,0.08)_0%,transparent_70%)] top-[-200px] right-[-200px] rounded-full"></div>
          <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_70%)] bottom-[-150px] left-[-150px] rounded-full"></div>

          <div className="hero-container max-w-[1400px] mx-auto grid md:grid-cols-2 gap-16 items-center relative">

            {/* Left content */}
            <div className="hero-content">
              <h1 className="text-[4.5rem] font-extrabold leading-[1.1] bg-gradient-to-br from-sky-500 to-cyan-400 bg-clip-text text-transparent mb-4">
                MediVault
              </h1>

              <p className="text-[1.5rem] text-slate-600 font-semibold mb-4">Secure Digital Health Record System</p>

              <p className="text-[1.2rem] text-slate-500 leading-8 mb-12">
                Your complete medical history, accessible anywhere, anytime.
                Experience modern healthcare with cutting-edge security.
              </p>

              <div className="flex gap-6">
                <button
                  onClick={() => (window.location.href = "/register")}
                  className="bg-gradient-to-r from-sky-500 to-cyan-400 text-white px-12 py-4 rounded-full font-semibold shadow-xl hover:-translate-y-1 transition"
                >
                  Get Started
                </button>

                <button
                  onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white text-sky-500 border-2 border-sky-400 px-12 py-4 rounded-full font-semibold hover:bg-[#f0f9ff] hover:-translate-y-1 transition"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Right floating cards */}
            <div className="relative h-[600px] flex items-center justify-center max-md:hidden">

              {/* Floating cards animation */}
              <style>{`
                @keyframes floatCard {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-20px); }
                }
              `}</style>

              <div className="absolute bg-white border border-slate-200 rounded-2xl p-8 shadow-xl w-[300px] top-[50px] left-[50px] animate-[floatCard_6s_ease-in-out_infinite] hover:shadow-2xl transition">
                <div className="text-4xl mb-4">🔒</div>
                <div className="text-lg font-semibold text-slate-800 mb-2">Bank-Level Security</div>
                <div className="text-slate-500 text-sm">256-bit encryption protects your data</div>
              </div>

              <div className="absolute bg-white border border-slate-200 rounded-2xl p-8 shadow-xl w-[280px] bottom-[100px] right-[80px] animate-[floatCard_6s_ease-in-out_infinite_2s] hover:shadow-2xl transition">
                <div className="text-4xl mb-4">⚡</div>
                <div className="text-lg font-semibold text-slate-800 mb-2">Instant Access</div>
                <div className="text-slate-500 text-sm">Retrieve records in milliseconds</div>
              </div>

              <div className="absolute bg-white border border-slate-200 rounded-2xl p-8 shadow-xl w-[250px] top-[200px] right-[50px] animate-[floatCard_6s_ease-in-out_infinite_4s] hover:shadow-2xl transition">
                <div className="text-4xl mb-4">🌐</div>
                <div className="text-lg font-semibold text-slate-800 mb-2">Universal Platform</div>
                <div className="text-slate-500 text-sm">Access from any device, anywhere</div>
              </div>

            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="py-20 bg-white">
          <div className="max-w-[1400px] mx-auto grid md:grid-cols-4 gap-12 text-center">
            {[
              ["50K+", "Active Patients"],
              ["2K+", "Healthcare Providers"],
              ["99.9%", "Uptime"],
              ["500K+", "Records Secured"],
            ].map(([num, label]) => (
              <div key={label} className="p-6">
                <div className="text-5xl font-bold bg-gradient-to-br from-sky-500 to-cyan-400 bg-clip-text text-transparent mb-2">{num}</div>
                <div className="text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section className="py-28 px-12 bg-white" id="features">
          <div className="max-w-[1400px] mx-auto">
            <h2 className="text-center text-[3.5rem] font-bold bg-gradient-to-br from-sky-500 to-cyan-400 bg-clip-text text-transparent mb-4">
              Powerful Features
            </h2>

            <p className="text-center text-lg text-slate-500 mb-16">
              Everything you need to manage your health records efficiently
            </p>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                ["🛡️", "Secure Health Storage", "Military-grade encryption ensures top-level protection."],
                ["🆔", "Digital Health ID", "One ID to access your complete medical history anywhere."],
                ["⚡", "Fast Report Uploads", "Upload and organize lab reports in seconds."],
              ].map(([icon, title, desc]) => (
                <div
                  key={title}
                  className="bg-white border-2 border-slate-200 p-12 rounded-2xl shadow-md hover:-translate-y-2 hover:border-sky-400 hover:shadow-xl transition relative overflow-hidden"
                >
                  <div className="text-6xl mb-6 drop-shadow-md">{icon}</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">{title}</h3>
                  <p className="text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-28 px-12 bg-gradient-to-b from-[#f8fafc] to-[#f0f9ff]" id="about">
          <div className="max-w-[1400px] mx-auto">
            <h2 className="text-center text-[3.5rem] font-bold bg-gradient-to-br from-sky-500 to-cyan-400 bg-clip-text text-transparent mb-4">
              How It Works
            </h2>

            <p className="text-center text-lg text-slate-500 mb-16">
              Get started with MediVault in three simple steps
            </p>

            <div className="grid md:grid-cols-3 gap-14 relative">
              {[
                ["1", "Create Digital Health ID", "Register in minutes and receive your unique secure identifier."],
                ["2", "Upload Your Records", "Easily upload all medical records in one place."],
                ["3", "Share Securely", "Share records with healthcare providers instantly."],
              ].map(([num, title, desc]) => (
                <div
                  key={num}
                  className="bg-white border-2 border-slate-200 p-10 rounded-2xl text-center shadow-md hover:scale-105 hover:border-sky-400 hover:shadow-xl transition z-10"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-white flex items-center justify-center text-3xl font-bold shadow-xl">
                    {num}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{title}</h3>
                  <p className="text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-[#f8fafc] border-t border-slate-200 py-16 px-12" id="contact">
          <div className="max-w-[1400px] mx-auto">

            {/* footer links */}
            <div className="flex justify-center gap-12 flex-wrap text-slate-500 font-medium mb-8">
              {["Support", "Terms of Service", "Privacy Policy", "About Us", "Careers", "Blog"].map(link => (
                <a key={link} className="hover:text-sky-500 cursor-pointer">{link}</a>
              ))}
            </div>

            {/* social */}
            <div className="flex justify-center gap-6 text-3xl opacity-60 mb-8">
              {["📘", "🐦", "📷", "💼"].map(icon => (
                <span key={icon} className="hover:scale-110 hover:opacity-100 transition cursor-pointer">{icon}</span>
              ))}
            </div>

            <p className="text-center text-slate-400 text-sm pt-6 border-t border-slate-200">
              © 2024 MediVault. All rights reserved. Built with care for your health and privacy.
            </p>

          </div>
        </footer>
      </div>
    );
  }

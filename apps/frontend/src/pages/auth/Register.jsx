import React, { useState } from "react";
import api from "../../api/axiosClient";

export default function Register() {
  const [role, setRole] = useState("patient");
  const [isLoading, setIsLoading] = useState(false);

  // --------------------
  // COMMON FIELDS STATE
  // --------------------
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    regNumber: "",
    degree: "MBBS",
    document: null
  });

  const [showPassword, setShowPassword] = useState(false);

  // --------------------
  // HANDLE INPUT CHANGE
  // --------------------
  const handleChange = e => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // --------------------
  // SUBMIT FORM
  // --------------------
  const submit = async e => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (role === "patient") {
        await api.post("/auth/register", {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: "patient"
        });
        alert("Patient registered successfully!");
      } else if (role === "doctor") {
        const form = new FormData();
        form.append("name", formData.name);
        form.append("email", formData.email);
        form.append("password", formData.password);
        form.append("regNumber", formData.regNumber);
        form.append("degree", formData.degree);
        form.append("role", "doctor");

        if (formData.document) form.append("document", formData.document);

        await api.post("/auth/register-doctor", form);
        alert("Doctor registration submitted for admin approval.");
      }

      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Registration failed!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e0f2ff] via-[#f8fcff] to-[#e6f8ff] px-6 pt-32 pb-20">
      <div className="max-w-3xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-500 to-cyan-500 text-transparent bg-clip-text">
          Create Your Account
        </h1>
        <p className="mt-2 text-slate-600 text-lg">
          Join MediVault – Secure. Smart. Your health in one place.
        </p>
      </div>

      {/* Role Selector */}
      <div className="max-w-3xl mx-auto grid grid-cols-2 gap-5 mb-12">
        {["patient", "doctor"].map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`p-5 rounded-2xl transition-all border-2 ${
              role === r
                ? "border-sky-500 bg-white shadow-xl"
                : "border-slate-300 hover:border-sky-300"
            }`}
          >
            <h3 className="text-lg font-semibold text-slate-800">
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </h3>
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Name */}
        <div>
          <label className="font-semibold text-slate-700">Full Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full mt-1 p-3 rounded-xl bg-white/70 border"
            placeholder={role === "patient" ? "Enter full name" : "Dr. Full Name"}
          />
        </div>

        {/* Email */}
        <div>
          <label className="font-semibold text-slate-700">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full mt-1 p-3 rounded-xl bg-white/70 border"
            placeholder="Enter email"
          />
        </div>

        {/* Password */}
        <div>
          <label className="font-semibold text-slate-700">Password</label>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full mt-1 p-3 rounded-xl bg-white/70 border"
            placeholder="Create password"
          />
        </div>

        {/* Doctor-only fields */}
        {role === "doctor" && (
          <>
            <div>
              <label className="font-semibold text-slate-700">Medical Registration Number</label>
              <input
                type="text"
                name="regNumber"
                value={formData.regNumber}
                onChange={handleChange}
                className="w-full mt-1 p-3 rounded-xl bg-white/70 border"
                placeholder="e.g., MCI-12345"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700">Degree</label>
              <select
                name="degree"
                value={formData.degree}
                onChange={handleChange}
                className="w-full mt-1 p-3 rounded-xl bg-white border"
              >
                <option>MBBS</option>
                <option>MD</option>
                <option>MS</option>
                <option>BAMS</option>
                <option>BHMS</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Upload Medical Proof</label>
              <input
                type="file"
                name="document"
                onChange={handleChange}
                className="w-full mt-1"
              />
            </div>
          </>
        )}

        <button
          onClick={submit}
          className="w-full py-3 rounded-xl bg-sky-500 text-white font-semibold"
          disabled={isLoading}
        >
          {isLoading
            ? role === "patient"
              ? "Processing..."
              : "Submitting..."
            : role === "patient"
            ? "Register as Patient"
            : "Submit for Approval"}
        </button>

        <p className="text-center mt-8 text-slate-600">
          Already have an account?{" "}
          <a href="/login" className="text-sky-600 font-semibold underline">
            Login here
          </a>
        </p>
      </div>
    </div>
  );
}

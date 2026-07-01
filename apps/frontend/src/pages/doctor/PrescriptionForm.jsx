import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../api/patientApi";

export default function PrescriptionForm({ onCreated }) {
  const [patientId, setPatientId] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const { token } = useAuth();

  async function submit(e) {
    e.preventDefault();
    if (!patientId || !medicineName || !dosage) {
      alert("Patient ID, medicine name and dosage are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/doctor/prescriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          medicineName,
          dosage,
          duration,
          instructions,
          endDate: endDate || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to create prescription");
      } else {
        alert("Prescription created");
        // optionally clear or call parent
        setMedicineName("");
        setDosage("");
        setDuration("");
        setInstructions("");
        setEndDate("");
        if (typeof onCreated === "function") onCreated(data.prescription);
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow">
      <h3 className="text-lg font-semibold mb-3">Write e-Prescription</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="Patient ID (required)"
          className="border p-2 rounded"
        />

        <input
          value={medicineName}
          onChange={(e) => setMedicineName(e.target.value)}
          placeholder="Medicine name (required)"
          className="border p-2 rounded"
        />

        <input
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="Dosage (e.g. 500mg twice daily) (required)"
          className="border p-2 rounded"
        />

        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duration (e.g. 7 days)"
          className="border p-2 rounded"
        />

        <input
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          type="date"
          className="border p-2 rounded"
          placeholder="End date (optional)"
        />

        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Instructions (optional)"
          className="border p-2 rounded col-span-1 md:col-span-2"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Prescription"}
        </button>
      </div>
    </form>
  );
}

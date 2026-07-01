import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../api/patientApi";

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState(null);
  const { token } = useAuth();

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/patient/prescriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to load prescriptions");
      } else {
        setPrescriptions(data.prescriptions || data); // depending on backend shape
      }
    } catch (err) {
      alert("Network: " + err.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!prescriptions) return <div>Loading prescriptions...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Your Prescriptions</h1>
      <div className="mt-4 space-y-3">
        {prescriptions.length === 0 ? (
          <p>No prescriptions found.</p>
        ) : (
          prescriptions.map((p) => (
            <div key={p.id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{p.medicine_name} — <span className="text-sm text-gray-600">{p.dosage}</span></p>
                  <p className="text-sm text-gray-500">Prescribed by: {p.doctor_name || p.doctor_id}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{new Date(p.prescribed_date).toLocaleDateString()}</p>
                  {p.end_date && <p>Until: {new Date(p.end_date).toLocaleDateString()}</p>}
                </div>
              </div>
              {p.instructions && <p className="mt-2 text-sm">{p.instructions}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

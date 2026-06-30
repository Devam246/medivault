import React from 'react';
import { Download } from 'lucide-react';
import { usePrescriptions } from '../../hooks/usePatientData';

export default function PrescriptionsSection() {
  const { prescriptions, loading, error } = usePrescriptions();

  if (loading) return <p className="text-slate-500">Loading prescriptions…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-slate-800 mb-6">Prescriptions</h3>
      <div className="space-y-4">
        {prescriptions.map(rx => (
          <div key={rx.id} className="bg-gradient-to-r from-emerald-50 to-cyan-50 p-5 rounded-xl">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">{rx.medicine_name}</p>
                <p className="text-slate-700 mt-1">Dosage: {rx.dosage}</p>
                <p className="text-slate-600 text-sm">Duration: {rx.duration}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                  <span>Prescribed by: {rx.doctor_name}</span>
                  <span>Date: {rx.prescribed_date}</span>
                </div>
              </div>
              <Download className="w-5 h-5 text-slate-400 cursor-pointer hover:text-emerald-500" />
            </div>
          </div>
        ))}
        {!prescriptions.length && <p className="text-center text-slate-500 py-8">No prescriptions found</p>}
      </div>
    </div>
  );
}

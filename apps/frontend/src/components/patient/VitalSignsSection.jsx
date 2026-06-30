import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVitalSigns } from '../../hooks/usePatientData';
import api from '../../api/patientApi';

const EMPTY_FORM = {
  bloodPressure: '', heartRate: '', temperature: '', weight: '',
  recordedDate: new Date().toISOString().split('T')[0], notes: ''
};

export default function VitalSignsSection() {
  const { token } = useAuth();
  const { vitalSigns, refetch, loading, error } = useVitalSigns();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const handleAdd = async () => {
    const { bloodPressure, heartRate, temperature, weight, recordedDate } = form;
    if (!bloodPressure && !heartRate && !temperature && !weight) {
      alert('Fill at least one vital value');
      return;
    }
    try {
      await api.post('/patient/vital-signs', {
        bloodPressure, heartRate, temperature, weight,
        recordedDate, notes: form.notes || null
      }, token);
      await refetch();
      setShowModal(false);
      setForm(EMPTY_FORM);
      alert('Vitals added successfully!');
    } catch (err) {
      alert('Failed to add vitals: ' + err.message);
    }
  };

  if (loading) return <p className="text-slate-500">Loading vitals…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-slate-800">Vital Signs History</h3>
          <button onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition">
            <Plus className="w-4 h-4" /><span>Add Entry</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['Date', 'Blood Pressure', 'Heart Rate', 'Temperature', 'Weight'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitalSigns.map((vital, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{vital.recorded_date}</td>
                  <td className="px-4 py-3 text-slate-800">{vital.blood_pressure}</td>
                  <td className="px-4 py-3 text-slate-800">{vital.heart_rate} bpm</td>
                  <td className="px-4 py-3 text-slate-800">{vital.temperature}°F</td>
                  <td className="px-4 py-3 text-slate-800">{vital.weight} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!vitalSigns.length && <p className="text-center text-slate-500 py-8">No vital signs recorded</p>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Add Vital Entry</h3>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                <input type="date" value={form.recordedDate}
                  onChange={e => setForm({ ...form, recordedDate: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'bloodPressure', label: 'Blood Pressure', placeholder: 'e.g., 120/80', type: 'text' },
                  { key: 'heartRate', label: 'Heart Rate (bpm)', type: 'number' },
                  { key: 'temperature', label: 'Temperature (°F)', type: 'number', step: '0.1' },
                  { key: 'weight', label: 'Weight (kg)', type: 'number', step: '0.1' }
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{f.label}</label>
                    <input type={f.type} step={f.step} placeholder={f.placeholder} value={form[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none" rows={3} />
              </div>
              <button onClick={handleAdd}
                className="w-full py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition">
                Add Vital
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

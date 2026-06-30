import React from 'react';
import { Calendar, Heart } from 'lucide-react';
import { useDashboardOverview } from '../../hooks/usePatientData';

export default function OverviewSection() {
  const { overview, loading, error } = useDashboardOverview();

  if (loading) return <p className="text-slate-500">Loading overview…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!overview) return null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-sky-500" />Upcoming Appointments
        </h3>
        {(overview.upcomingAppointments || []).slice(0, 2).map(apt => (
          <div key={apt.id} className="border-l-4 border-sky-500 pl-4 mb-4 last:mb-0">
            <p className="font-semibold text-slate-800">{apt.doctor_name}</p>
            <p className="text-sm text-slate-600">{apt.specialty}</p>
            <p className="text-sm text-slate-500">{apt.appointment_date} at {apt.appointment_time}</p>
          </div>
        ))}
        {!overview.upcomingAppointments?.length && <p className="text-slate-500">No upcoming appointments</p>}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <Heart className="w-5 h-5 mr-2 text-rose-500" />Latest Vitals
        </h3>
        {overview.latestVitals ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-sky-50 rounded-lg p-3"><p className="text-xs text-slate-600">Blood Pressure</p><p className="text-lg font-bold text-slate-800">{overview.latestVitals.blood_pressure}</p></div>
            <div className="bg-rose-50 rounded-lg p-3"><p className="text-xs text-slate-600">Heart Rate</p><p className="text-lg font-bold text-slate-800">{overview.latestVitals.heart_rate} bpm</p></div>
            <div className="bg-amber-50 rounded-lg p-3"><p className="text-xs text-slate-600">Temperature</p><p className="text-lg font-bold text-slate-800">{overview.latestVitals.temperature}°F</p></div>
            <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-slate-600">Weight</p><p className="text-lg font-bold text-slate-800">{overview.latestVitals.weight} kg</p></div>
          </div>
        ) : <p className="text-slate-500">No vitals recorded</p>}
      </div>
    </div>
  );
}

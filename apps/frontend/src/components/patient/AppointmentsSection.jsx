import React, { useState } from 'react';
import { Calendar, Clock, Key, Check, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppointments } from '../../hooks/usePatientData';
import api from '../../api/patientApi';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDateTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch { return String(value); }
}

function getStatusColor(status) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-700';
    case 'pending':   return 'bg-yellow-100 text-yellow-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default:          return 'bg-gray-100 text-gray-700';
  }
}

export default function AppointmentsSection() {
  const { token } = useAuth();
  const { appointments, refetch, loading, error } = useAppointments();
  const [grantingId, setGrantingId] = useState(null);
  const [grantSuccess, setGrantSuccess] = useState(null);
  const [grantError, setGrantError] = useState(null);

  const handleEasyAccess = async (appointmentId) => {
    setGrantError(null);
    setGrantSuccess(null);
    setGrantingId(appointmentId);
    try {
      let data;
      try {
        data = await api.post(`/appointments/${appointmentId}/easy-access`, {}, token);
      } catch (routeErr) {
        const msg = routeErr?.message || '';
        if (msg.includes('404') || msg.toLowerCase().includes('cannot post')) {
          data = await api.post(`/patient/appointments/${appointmentId}/easy-access`, {}, token);
        } else { throw routeErr; }
      }
      setGrantSuccess({ appointmentId, expiresAt: data.expiresAt });
      refetch();
    } catch (err) {
      const message = err?.message || 'Failed to grant access';
      if (message.includes('404') || message.toLowerCase().includes('cannot post')) {
        setGrantSuccess({ appointmentId, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
        refetch();
      } else {
        setGrantError(message);
      }
    } finally {
      setGrantingId(null);
    }
  };

  if (loading) return <p className="text-slate-500">Loading appointments…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">My Appointments</h3>
          <p className="text-slate-600 mt-1">View your appointment history and access tokens</p>
        </div>
        <button onClick={refetch}
          className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition flex items-center space-x-2 shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-800 mb-2">No appointments yet</h4>
            <p className="text-gray-600">Book your first appointment to get started</p>
          </div>
        ) : appointments.map((apt, index) => (
          <div key={`apt-${apt.id}-${index}`} className="bg-white border rounded-2xl p-6 shadow hover:shadow-xl transition">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-800">{apt.doctor_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(apt.status)}`}>
                    {apt.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-600">{apt.specialty || 'General Practice'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>{formatDate(apt.appointment_date)}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>{formatTime(apt.appointment_time)}</span>
              </div>
            </div>

            {apt.reason && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Reason:</p>
                <p className="text-gray-600">{apt.reason}</p>
              </div>
            )}

            {apt.status === 'confirmed' && (
              <div className="border-t pt-4 mt-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-gray-800">Easy Access (30 minutes)</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Tap once to grant your appointment doctor access to your medical history for the next 30 minutes.
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button onClick={() => handleEasyAccess(apt.id)} disabled={grantingId === apt.id}
                      className="px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center space-x-2 font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                      {grantingId === apt.id ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Granting...</span></>
                      ) : (
                        <><Key className="w-4 h-4" /><span>Grant access for 30 min</span></>
                      )}
                    </button>
                    {grantSuccess?.appointmentId === apt.id && (
                      <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Granted until {formatDateTime(grantSuccess.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                  {grantError && <p className="text-sm text-red-600 mt-3">{grantError}</p>}
                </div>
              </div>
            )}

            {apt.status === 'pending' && (
              <div className="border-t pt-4 mt-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Waiting for doctor confirmation. Access token will be generated once approved.
                  </p>
                </div>
              </div>
            )}

            {apt.status === 'cancelled' && (
              <div className="border-t pt-4 mt-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 flex items-center">
                    <X className="w-4 h-4 mr-2" />❌ This appointment has been cancelled.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

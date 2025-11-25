import React, { useEffect, useState } from "react";
import DoctorScheduleManagement from './DoctorScheduleManagement';
import DoctorPatientHistoryAccess from './DoctorPatientHistoryAccess';
import { Calendar, Users, FileText, Key, Search } from 'lucide-react';

function PatientSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const token = localStorage.getItem("mv_token");

  async function search() {
    if (!query.trim()) return;
    
    try {
      const res = await fetch(`http://localhost:4000/doctor/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(data.patients || []);
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Search className="w-5 h-5 mr-2 text-indigo-600" />
        Search Patients
      </h2>

      <div className="flex gap-3">
        <input 
          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter Patient ID / Name / Phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && search()}
        />
        <button 
          onClick={search}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
        >
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((p) => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
              <p className="font-semibold text-gray-800">{p.name}</p>
              <p className="text-sm text-gray-600">{p.email}</p>
              {p.phone && <p className="text-sm text-gray-500">{p.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DoctorDashboard() {
  const [data, setData] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const token = localStorage.getItem("mv_token");

  async function load() {
    try {
      const res = await fetch("http://localhost:4000/doctor/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  useEffect(() => { 
    load(); 
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Doctor Dashboard</h1>
          <p className="text-gray-600">Manage your practice and patient care</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/70 backdrop-blur rounded-xl p-2 mb-8 flex space-x-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Calendar },
            { id: 'schedule', label: 'Schedule & Appointments', icon: Calendar },
            { id: 'access', label: 'Patient Access', icon: Key },
            { id: 'search', label: 'Search Patients', icon: Search }
          ].map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition whitespace-nowrap ${
                  activeSection === section.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Today's Appointments</h2>
                  <Calendar className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-4xl font-bold text-indigo-600">
                  {data.todayAppointments.length}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Total Patients</h2>
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-4xl font-bold text-emerald-600">
                  {data.totalPatients}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Recent Prescriptions</h2>
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-4xl font-bold text-purple-600">
                  {data.recentPrescriptions.length}
                </p>
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Today's Schedule</h2>
              {data.todayAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No appointments scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.todayAppointments.map((a) => (
                    <div key={a.id} className="border-l-4 border-indigo-500 bg-indigo-50 p-4 rounded-r-xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-800">{a.patient_name}</p>
                          <p className="text-sm text-gray-600">{a.appointment_time}</p>
                        </div>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Section */}
        {activeSection === 'schedule' && <DoctorScheduleManagement />}

        {/* Patient Access Section */}
        {activeSection === 'access' && <DoctorPatientHistoryAccess />}

        {/* Search Section */}
        {activeSection === 'search' && <PatientSearch />}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import DoctorScheduleManagement from './DoctorScheduleManagement';
import DoctorPatientHistoryAccess from './DoctorPatientHistoryAccess';
import { Calendar, Users, FileText, Key, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function PatientSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  async function search() {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`http://localhost:4000/doctor/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Search failed');
      }
      
      const data = await res.json();
      setResults(data.patients || []);
      
      if (data.patients && data.patients.length === 0) {
        setError('No patients found matching your search');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search patients. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Search className="w-5 h-5 mr-2 text-indigo-600" />
        Search Patients
      </h2>

      <div className="flex gap-3">
        <input 
          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          placeholder="Enter Patient ID, Name, Email, or Phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <button 
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <p className="text-sm text-yellow-800">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600 mb-2">Found {results.length} patient{results.length > 1 ? 's' : ''}</p>
          {results.map((p) => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-lg">{p.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">ID:</span> {p.id}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {p.email}
                  </p>
                  {p.phone && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Phone:</span> {p.phone}
                    </p>
                  )}
                  {p.blood_group && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Blood Group:</span> {p.blood_group}
                    </p>
                  )}
                </div>
                <button 
                  className="ml-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm font-medium"
                  onClick={() => {
                    // Navigate to patient history or open modal
                    window.location.href = `/doctor/patient/${p.id}`;
                  }}
                >
                  View History
                </button>
              </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  async function load() {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("http://localhost:4000/doctor/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to load dashboard');
      }
      
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    load(); 
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={load}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
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
        <div className="bg-white/70 backdrop-blur rounded-xl p-2 mb-8 flex space-x-2 overflow-x-auto shadow-sm">
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
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Today's Appointments</h2>
                  <Calendar className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-4xl font-bold text-indigo-600">
                  {data.todayAppointments?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {data.todayAppointments?.length === 0 ? 'No appointments today' : 'Scheduled for today'}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Total Patients</h2>
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-4xl font-bold text-emerald-600">
                  {data.totalPatients || 0}
                </p>
                <p className="text-sm text-gray-500 mt-2">Unique patients served</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-700">Recent Prescriptions</h2>
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-4xl font-bold text-purple-600">
                  {data.recentPrescriptions?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-2">Last 5 prescriptions</p>
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Today's Schedule</h2>
              {!data.todayAppointments || data.todayAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No appointments scheduled for today</p>
                  <p className="text-sm text-gray-500 mt-2">Enjoy your day off or check upcoming appointments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.todayAppointments.map((a) => (
                    <div key={a.id} className="border-l-4 border-indigo-500 bg-indigo-50 p-4 rounded-r-xl hover:bg-indigo-100 transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-lg">{a.patient_name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Time:</span> {a.appointment_time}
                          </p>
                          {a.reason && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Reason:</span> {a.reason}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          a.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {a.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Prescriptions */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Prescriptions</h3>
                {!data.recentPrescriptions || data.recentPrescriptions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent prescriptions</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentPrescriptions.map((p) => (
                      <div key={p.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                        <p className="font-medium text-gray-800">{p.patient_name}</p>
                        <p className="text-sm text-gray-600">{new Date(p.prescribed_date).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Records */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Medical Records</h3>
                {!data.recentRecords || data.recentRecords.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent records</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentRecords.map((r) => (
                      <div key={r.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                        <p className="font-medium text-gray-800">{r.patient_name}</p>
                        <p className="text-sm text-gray-600">{new Date(r.record_date).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
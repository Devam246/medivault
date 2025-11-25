import React, { useState } from 'react';
import { Key, Search, User, FileText, Heart, Pill, Calendar, AlertCircle, X } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

function DoctorPatientHistoryAccess() {
  const token = localStorage.getItem('mv_token');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState(null);

  const handleAccessHistory = async () => {
    if (!accessToken.trim()) {
      setError('Please enter an access token');
      return;
    }

    setLoading(true);
    setError(null);
    setPatientData(null);

    try {
      const response = await fetch(`${API_BASE}/appointments/patient-history/${accessToken}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to access patient history');
      }

      const data = await response.json();
      setPatientData(data);
    } catch (err) {
      console.error('Error accessing patient history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeHistory = () => {
    setPatientData(null);
    setAccessToken('');
    setError(null);
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Patient History</h2>
        <p className="text-gray-600">Enter the patient's access token to view their medical history</p>
      </div>

      {!patientData ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Patient Access Token
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter access token..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={handleAccessHistory}
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center space-x-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Access</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Access Denied</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-start">
              <Key className="w-5 h-5 text-indigo-600 mr-3 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-900 mb-1">How it works</p>
                <ul className="text-sm text-indigo-800 space-y-1">
                  <li>• Patients receive an access token when booking an appointment</li>
                  <li>• They can share this token with you to grant access to their medical history</li>
                  <li>• Tokens are secure and expire after 6 months</li>
                  <li>• Access is logged for security and compliance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with Close Button */}
          <div className="flex justify-between items-center pb-4 border-b">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {patientData.profile.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{patientData.profile.name}</h3>
                <p className="text-gray-600">{patientData.profile.email}</p>
              </div>
            </div>
            <button
              onClick={closeHistory}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Patient Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Date of Birth</p>
              <p className="font-semibold text-gray-800">{patientData.profile.date_of_birth || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Blood Group</p>
              <p className="font-semibold text-gray-800">{patientData.profile.blood_group || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Phone</p>
              <p className="font-semibold text-gray-800">{patientData.profile.phone || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Emergency Contact</p>
              <p className="font-semibold text-gray-800">{patientData.profile.emergency_contact || 'N/A'}</p>
            </div>
          </div>

          {/* Latest Vitals */}
          {patientData.vitals.length > 0 && (
            <div>
              <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-rose-500" />
                Latest Vital Signs
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {patientData.vitals[0].blood_pressure && (
                  <div className="bg-sky-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Blood Pressure</p>
                    <p className="text-lg font-bold text-gray-800">{patientData.vitals[0].blood_pressure}</p>
                  </div>
                )}
                {patientData.vitals[0].heart_rate && (
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Heart Rate</p>
                    <p className="text-lg font-bold text-gray-800">{patientData.vitals[0].heart_rate} bpm</p>
                  </div>
                )}
                {patientData.vitals[0].temperature && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Temperature</p>
                    <p className="text-lg font-bold text-gray-800">{patientData.vitals[0].temperature}°F</p>
                  </div>
                )}
                {patientData.vitals[0].weight && (
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Weight</p>
                    <p className="text-lg font-bold text-gray-800">{patientData.vitals[0].weight} kg</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Records */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-cyan-500" />
              Medical Records ({patientData.records.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {patientData.records.length > 0 ? (
                patientData.records.map(record => (
                  <div key={record.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800">{record.title}</p>
                      <p className="text-sm text-gray-600">{record.type} • {record.record_date}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No medical records</p>
              )}
            </div>
          </div>

          {/* Prescriptions */}
          <div>
            <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              <Pill className="w-5 h-5 mr-2 text-emerald-500" />
              Prescription History ({patientData.prescriptions.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {patientData.prescriptions.length > 0 ? (
                patientData.prescriptions.map(rx => (
                  <div key={rx.id} className="bg-emerald-50 rounded-lg p-3">
                    <p className="font-semibold text-gray-800">{rx.medicine_name}</p>
                    <p className="text-sm text-gray-600">{rx.dosage} • Prescribed by {rx.doctor_name}</p>
                    <p className="text-xs text-gray-500">{rx.prescribed_date}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No prescriptions</p>
              )}
            </div>
          </div>

          {/* Token Info */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Token accessed:</strong> Appointment ID #{patientData.tokenInfo.appointmentId} • 
              Created: {new Date(patientData.tokenInfo.createdAt).toLocaleDateString()} •
              {patientData.tokenInfo.expiresAt && ` Expires: ${new Date(patientData.tokenInfo.expiresAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorPatientHistoryAccess;
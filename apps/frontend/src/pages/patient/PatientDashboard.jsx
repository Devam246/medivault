import React, { useState, useEffect } from 'react';
import { Activity, User, Calendar, FileText, Pill, Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePatientProfile } from '../../hooks/usePatientData';

import OverviewSection from '../../components/patient/OverviewSection';
import PatientProfileSection from '../../components/patient/PatientProfileSection';
import MedicalRecordsSection from '../../components/patient/MedicalRecordsSection';
import AppointmentsSection from '../../components/patient/AppointmentsSection';
import PrescriptionsSection from '../../components/patient/PrescriptionsSection';
import VitalSignsSection from '../../components/patient/VitalSignsSection';
import HealthChatSection from '../../components/patient/HealthChatSection';
import PatientAppointmentBooking from './PatientAppointmentBooking';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'book', label: 'Book Appointment', icon: Calendar },
  { id: 'appointments', label: 'My Appointments', icon: Calendar },
  { id: 'records', label: 'Medical Records', icon: FileText },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'vitals', label: 'Vital Signs', icon: Heart },
  { id: 'health-chat', label: 'Health Assistant', icon: MessageCircle },
];

export default function PatientDashboard() {
  const { token, logout } = useAuth();
  const { patientData, loading } = usePatientProfile();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!token) window.location.href = '/login';
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e0f2ff] via-[#f8fcff] to-[#e6f8ff] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!patientData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e0f2ff] via-[#f8fcff] to-[#e6f8ff]">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-500 to-cyan-500 text-transparent bg-clip-text">MediVault</h1>
            <p className="text-xs text-slate-600">Patient Portal</p>
          </div>
          <button onClick={() => { logout(); window.location.href = '/login'; }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium">
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-sky-500 to-cyan-500 rounded-2xl p-8 mb-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {patientData.name}!</h2>
          <p className="text-sky-100">Your health dashboard is up to date</p>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-xl p-2 mb-8 flex space-x-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && <OverviewSection />}
        {activeTab === 'profile' && <PatientProfileSection />}
        {activeTab === 'book' && <PatientAppointmentBooking />}
        {activeTab === 'appointments' && <AppointmentsSection />}
        {activeTab === 'records' && <MedicalRecordsSection />}
        {activeTab === 'prescriptions' && <PrescriptionsSection />}
        {activeTab === 'vitals' && <VitalSignsSection />}
        {activeTab === 'health-chat' && <HealthChatSection />}
      </div>
    </div>
  );
}

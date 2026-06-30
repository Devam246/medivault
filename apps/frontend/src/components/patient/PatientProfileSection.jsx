import React, { useState, useEffect } from 'react';
import { Edit2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePatientProfile } from '../../hooks/usePatientData';
import api from '../../api/patientApi';

export default function PatientProfileSection() {
  const { token } = useAuth();
  const { patientData, setPatientData, loading, error } = usePatientProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});

  useEffect(() => {
    if (patientData) setEditedProfile(patientData);
  }, [patientData]);

  const handleSave = async () => {
    try {
      await api.put('/patient/profile', {
        name: editedProfile.name,
        dateOfBirth: editedProfile.date_of_birth,
        bloodGroup: editedProfile.blood_group,
        phone: editedProfile.phone,
        address: editedProfile.address,
        emergencyContact: editedProfile.emergency_contact
      }, token);
      setPatientData(editedProfile);
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Failed to update profile');
    }
    setIsEditing(false);
  };

  if (loading) return <p className="text-slate-500">Loading profile…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!patientData) return null;

  const fields = [
    { key: 'name', label: 'Full Name' },
    { key: 'email', label: 'Email', disabled: true },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
    { key: 'blood_group', label: 'Blood Group' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'emergency_contact', label: 'Emergency Contact' }
  ];

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-slate-800">Personal Information</h3>
        <button
          onClick={isEditing ? handleSave : () => { setEditedProfile(patientData); setIsEditing(true); }}
          className="flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
        >
          {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          <span>{isEditing ? 'Save' : 'Edit'}</span>
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{field.label}</label>
            {isEditing && !field.disabled ? (
              <input type={field.type || 'text'} name={field.key} value={editedProfile[field.key] || ''}
                onChange={e => setEditedProfile({ ...editedProfile, [e.target.name]: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none" />
            ) : (
              <p className="p-3 bg-slate-50 rounded-xl text-slate-800">{patientData[field.key] || 'Not provided'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

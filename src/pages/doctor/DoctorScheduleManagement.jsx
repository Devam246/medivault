import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Settings, CheckCircle, XCircle, AlertCircle, Key } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

function DoctorScheduleManagement() {
  const token = localStorage.getItem('mv_token');
  
  // Tabs
  const [activeTab, setActiveTab] = useState('schedule');
  
  // Schedule States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  
  // Pending Requests
  const [pendingAppointments, setPendingAppointments] = useState([]);
  
  // Availability Settings - will be loaded from database
  const [availability, setAvailability] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '13:00' },
    sunday: { enabled: false, start: '09:00', end: '13:00' },
  });
  
  const [loading, setLoading] = useState(false);

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  };

  useEffect(() => {
    loadDoctorData();
    loadAvailability(); // Load availability on mount
  }, [selectedDate]);

  const loadDoctorData = async () => {
    setLoading(true);
    try {
      // Load all appointments
      let aptsResponse = await fetch(`${API_BASE}/appointments/doctor`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!aptsResponse.ok) {
        const fallbackResponse = await fetch(`${API_BASE}/doctor/appointments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (fallbackResponse.ok) {
          aptsResponse = fallbackResponse;
        }
      }

      if (!aptsResponse.ok) {
        const data = await aptsResponse.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to load doctor appointments');
      }

      const aptsData = await aptsResponse.json();
      const allApts = aptsData.appointments || [];
      
      setAllAppointments(allApts);
      
      // Filter today's confirmed appointments
      const today = selectedDate;
      const todayApts = allApts.filter(apt => 
        apt.appointment_date === today && apt.status === 'confirmed'
      );
      setTodayAppointments(todayApts);
      
      // Filter pending appointments
      const pending = allApts.filter(apt => apt.status === 'pending');
      setPendingAppointments(pending);
      
    } catch (error) {
      console.error('Error loading doctor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    try {
      const response = await fetch(`${API_BASE}/appointments/doctor/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const fallbackResponse = await fetch(`${API_BASE}/doctor/availability`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!fallbackResponse.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error('Error loading availability:', errorData.message);
          } else {
            console.error('Error loading availability: Route not found or server error');
          }
          return;
        }

        response = fallbackResponse;
      }
      
      const data = await response.json();
      if (data.availability) {
        setAvailability(data.availability);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const handleRespondToAppointment = async (appointmentId, action) => {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        alert(`Appointment ${action === 'approve' ? 'approved' : 'declined'} successfully!`);
        loadDoctorData();
      } else {
        const data = await response.json();
        alert(data.message || `Failed to ${action} appointment`);
      }
    } catch (error) {
      console.error('Error responding to appointment:', error);
      alert('Error processing request');
    }
  };

  const handleSaveAvailability = async () => {
    setLoading(true);
    try {
      let response = await fetch(`${API_BASE}/appointments/doctor/availability`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(availability)
      });

      if (!response.ok) {
        const fallbackResponse = await fetch(`${API_BASE}/doctor/availability`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(availability)
        });

        if (fallbackResponse.ok) {
          response = fallbackResponse;
        }
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          alert(errorData.message || 'Failed to save availability settings');
        } else {
          alert('Server error: Route not found. Please check your API configuration.');
        }
        return;
      }

      const data = await response.json();
      alert('Availability settings saved successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityChange = (day, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const groupAppointmentsByTime = (appointments) => {
    const timeSlots = getTimeSlots();
    const grouped = {};
    
    timeSlots.forEach(slot => {
      grouped[slot] = appointments.filter(apt => apt.appointment_time === slot + ':00');
    });
    
    return grouped;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Doctor Schedule</h1>
          <p className="text-gray-600">Manage your appointments and availability</p>
        </div>

        {/* Tabs */}
        <div className="bg-white/70 backdrop-blur rounded-xl p-2 mb-8 flex space-x-2 shadow-lg">
          {[
            { id: 'schedule', label: 'My Schedule', icon: Calendar },
            { id: 'pending', label: `Pending Requests (${pendingAppointments.length})`, icon: AlertCircle },
            { id: 'availability', label: 'Availability Settings', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Date Selector */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Appointments for</h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-indigo-600" />
                Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">No appointments scheduled</h4>
                  <p className="text-gray-600">Your schedule is clear for this day</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupAppointmentsByTime(todayAppointments)).map(([time, apts]) => (
                    apts.length > 0 && (
                      <div key={time} className="border-l-4 border-indigo-500 bg-indigo-50 p-5 rounded-r-xl">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Clock className="w-5 h-5 text-indigo-600" />
                              <span className="text-lg font-bold text-gray-800">{formatTime(time)}</span>
                            </div>
                            {apts.map(apt => (
                              <div key={apt.id} className="ml-8 mt-3">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                    {apt.patient_name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-800">{apt.patient_name}</p>
                                    {apt.reason && (
                                      <p className="text-sm text-gray-600 mt-1">
                                        <strong>Reason:</strong> {apt.reason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
                <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No pending requests</h3>
                <p className="text-gray-600">All appointment requests have been handled</p>
              </div>
            ) : (
              pendingAppointments.map(apt => {
                // Check if there's already a confirmed appointment at this time
                const hasConflict = allAppointments.some(existing => 
                  existing.appointment_date === apt.appointment_date &&
                  existing.appointment_time === apt.appointment_time &&
                  existing.status === 'confirmed' &&
                  existing.id !== apt.id
                );

                return (
                <div key={apt.id} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {apt.patient_name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{apt.patient_name}</h3>
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                            Pending Approval
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                        <div className="flex items-center space-x-2 text-gray-700">
                          <Calendar className="w-5 h-5 text-indigo-600" />
                          <span>{new Date(apt.appointment_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-700">
                          <Clock className="w-5 h-5 text-indigo-600" />
                          <span>{formatTime(apt.appointment_time)}</span>
                        </div>
                      </div>

                      {apt.reason && (
                        <div className="bg-gray-50 rounded-lg p-3 mt-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Reason for visit:</p>
                          <p className="text-gray-600">{apt.reason}</p>
                        </div>
                      )}
                      
                      {hasConflict && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                          <p className="text-sm font-semibold text-red-700 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Time Slot Conflict
                          </p>
                          <p className="text-sm text-red-600">Another appointment is already confirmed for this time.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-6">
                      <button
                        onClick={() => handleRespondToAppointment(apt.id, 'approve')}
                        disabled={hasConflict}
                        className={`px-6 py-3 rounded-xl transition flex items-center space-x-2 font-semibold ${
                          hasConflict 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRespondToAppointment(apt.id, 'decline')}
                        className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition flex items-center space-x-2 font-semibold"
                      >
                        <XCircle className="w-5 h-5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {/* Availability Settings Tab */}
        {activeTab === 'availability' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Set Your Availability</h2>
              <p className="text-gray-600">Configure your working hours for each day of the week</p>
            </div>

            <div className="space-y-4">
              {days.map(day => (
                <div key={day} className="border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={availability[day].enabled}
                          onChange={(e) => handleAvailabilityChange(day, 'enabled', e.target.checked)}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-gray-800 w-28">{dayLabels[day]}</span>
                      </label>

                      {availability[day].enabled && (
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <input
                              type="time"
                              value={availability[day].start}
                              onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={availability[day].end}
                            onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {!availability[day].enabled && (
                        <span className="text-gray-400 italic">Not available</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveAvailability}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    <span>Save Availability Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DoctorScheduleManagement;
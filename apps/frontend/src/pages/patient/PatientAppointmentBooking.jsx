import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Search, User, MapPin, Star, X, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:4000';

function PatientAppointmentBooking() {
  const { token } = useAuth();
  
  // Search & Doctor Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Booking Form
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');

  // My Appointments
  const [myAppointments, setMyAppointments] = useState([]);
  const [showMyAppointments, setShowMyAppointments] = useState(false);

  useEffect(() => {
    loadMyAppointments();
    searchDoctors(); // Load all doctors initially
  }, []);

  // Search doctors
  // In PatientAppointmentBooking.jsx
// In PatientAppointmentBooking.jsx
const searchDoctors = async () => {
  setLoading(true);
  try {
    const query = searchQuery.trim() || 'all';
    const response = await fetch(`${API_BASE}/doctors/search?query=${query}`, { // ✅ Changed to /doctors/search
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search doctors: ${response.status}`);
    }
    
    const data = await response.json();
    setDoctors(data.doctors || []);
  } catch (error) {
    console.error('Error searching doctors:', error);
    alert('Failed to load doctors');
  } finally {
    setLoading(false);
  }
};

  // Get available slots when date is selected
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/appointments/doctor/${selectedDoctor.id}/slots?date=${selectedDate}`,
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      const data = await response.json();
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Book appointment
  const bookAppointment = async () => {
    if (!selectedSlot || !selectedDate) {
      alert('Please select date and time');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          appointment_date: selectedDate,
          appointment_time: selectedSlot,
          reason: reason
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setBookingStatus('success');
        setTimeout(() => {
          resetBooking();
          loadMyAppointments();
        }, 2000);
      } else {
        throw new Error(data.message || 'Booking failed');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert(error.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const loadMyAppointments = async () => {
    try {
      const response = await fetch(`${API_BASE}/appointments/patient`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMyAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Appointment cancelled successfully');
        loadMyAppointments();
      } else {
        alert('Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    }
  };

  const resetBooking = () => {
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setReason('');
    setAvailableSlots([]);
    setBookingStatus('');
  };

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];
  const getMaxDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split('T')[0];
  };

  // My Appointments View
  if (showMyAppointments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">My Appointments</h1>
              <p className="text-slate-600 mt-1">View and manage your appointments</p>
            </div>
            <button
              onClick={() => setShowMyAppointments(false)}
              className="px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition flex items-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>Find Doctors</span>
            </button>
          </div>

          <div className="space-y-4">
            {myAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No appointments yet</h3>
                <p className="text-slate-600 mb-6">Book your first appointment with a doctor</p>
                <button
                  onClick={() => setShowMyAppointments(false)}
                  className="px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition"
                >
                  Browse Doctors
                </button>
              </div>
            ) : (
              myAppointments.map((apt) => (
                <div key={apt.id} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">{apt.doctor_name}</h3>
                          <p className="text-slate-600">{apt.specialty}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Calendar className="w-5 h-5 text-sky-600" />
                          <span>{new Date(apt.appointment_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Clock className="w-5 h-5 text-sky-600" />
                          <span>{formatTime(apt.appointment_time)}</span>
                        </div>
                      </div>

                      {apt.reason && (
                        <div className="mt-3 text-slate-600">
                          <strong>Reason:</strong> {apt.reason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-3">
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        apt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                      </span>

                      {apt.status === 'pending' && (
                        <button
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Booking View
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-800">Book an Appointment</h1>
            <p className="text-slate-600 mt-2">Find and book appointments with doctors</p>
          </div>
          <button
            onClick={() => setShowMyAppointments(true)}
            className="px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition flex items-center space-x-2"
          >
            <Calendar className="w-5 h-5" />
            <span>My Appointments ({myAppointments.length})</span>
          </button>
        </div>

        {bookingStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center">
            <Check className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <p className="font-semibold text-green-800">Appointment Requested!</p>
              <p className="text-sm text-green-700">Your appointment is pending doctor approval.</p>
            </div>
          </div>
        )}

        {!selectedDoctor && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <Search className="w-5 h-5 mr-2 text-sky-500" />
              Search Doctors
            </h2>
            
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchDoctors()}
                placeholder="Search by name, specialty, or location..."
                className="flex-1 p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={searchDoctors}
                disabled={loading}
                className="px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div className="space-y-4">
  {doctors.map(doctor => (
    <div key={doctor.id} className="border border-slate-200 rounded-xl p-4 hover:border-sky-500 transition">
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
            <User className="w-8 h-8 text-sky-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{doctor.name}</h3>
            <p className="text-sky-600 font-medium">{doctor.specialty}</p>
            
            <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600">
              {doctor.experience_years && (
                <span className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  {doctor.experience_years} years exp
                </span>
              )}
              {doctor.consultation_fee && (
                <span className="flex items-center">
                  <span className="font-semibold">₹{doctor.consultation_fee}</span>
                </span>
              )}
              {doctor.phone && (
                <span className="flex items-center">
                  <span>{doctor.phone}</span>
                </span>
              )}
            </div>
            
            {doctor.qualifications && (
              <p className="text-sm text-slate-500 mt-1">{doctor.qualifications}</p>
            )}
            
            {doctor.bio && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{doctor.bio}</p>
            )}
            
            {doctor.available_days && (
              <div className="mt-2 text-xs text-slate-500">
                <span className="font-semibold">Available:</span> {doctor.available_days}
                {doctor.available_time_start && doctor.available_time_end && (
                  <span> ({doctor.available_time_start.slice(0,5)} - {doctor.available_time_end.slice(0,5)})</span>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setSelectedDoctor(doctor)}
          className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition font-medium"
        >
          Select
        </button>
      </div>
    </div>
  ))}
              
              {doctors.length === 0 && !loading && (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>No doctors found. Try a different search term.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedDoctor && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="border-b border-slate-200 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center">
                    <User className="w-7 h-7 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedDoctor.name}</h3>
                    <p className="text-sky-600">{selectedDoctor.specialty}</p>
                  </div>
                </div>
                <button onClick={resetBooking} className="text-slate-500 hover:text-slate-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-sky-500" />
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-500"
              />
            </div>

            {selectedDate && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-sky-500" />
                  Available Time Slots
                </label>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedSlot(slot.time)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg font-medium transition ${
                          selectedSlot === slot.time
                            ? 'bg-sky-500 text-white'
                            : slot.available
                            ? 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {formatTime(slot.time)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p>No available slots for this date</p>
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Reason for Visit (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe your symptoms or reason for visit..."
                    rows={3}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  onClick={bookAppointment}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-xl font-bold text-lg hover:from-sky-600 hover:to-cyan-600 transition disabled:opacity-50"
                >
                  {loading ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientAppointmentBooking;
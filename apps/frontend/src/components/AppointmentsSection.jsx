import { useState } from "react";
import { Plus } from "lucide-react";
import axios from "axios";

const API_BASE = "http://localhost:5000"; // change to your server URL

export default function AppointmentsSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: "",
    date: "",
    time: "",
    reason: "",
  });

  const handleChange = (e) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.post(`${API_BASE}/appointments`, formData);
      alert("Appointment booked successfully!");
      setIsOpen(false);
      setFormData({ patient_name: "", date: "", time: "", reason: "" });
    } catch (err) {
      console.error(err);
      alert("Error booking appointment");
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-slate-800">Appointments</h3>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Book Appointment</h2>

            <input
              type="text"
              name="patient_name"
              value={formData.patient_name}
              onChange={handleChange}
              placeholder="Patient Name"
              className="w-full p-2 border rounded mb-3"
            />

            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />

            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              className="w-full p-2 border rounded mb-3"
            />

            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Reason for appointment"
              className="w-full p-2 border rounded mb-3"
            ></textarea>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

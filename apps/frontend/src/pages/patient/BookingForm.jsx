// import React, { useState, useEffect } from "react";

// export default function BookingForm({ onBooked }) {
//   const token = localStorage.getItem("mv_token");
//   const [doctorId, setDoctorId] = useState("");
//   const [date, setDate] = useState("");
//   const [slots, setSlots] = useState([]);
//   const [time, setTime] = useState("");
//   const [reason, setReason] = useState("");
//   const [message, setMessage] = useState("");

//   async function fetchSlots() {
//     if (!doctorId || !date) return;
//     const res = await fetch(`http://localhost:4000/appointments/doctor/${doctorId}/slots?date=${date}`, {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     const data = await res.json();
//     setSlots(data.slots || []);
//   }

//   useEffect(() => { fetchSlots(); }, [doctorId, date]);

//   async function handleBook(e) {
//     e.preventDefault();
//     if (!doctorId || !date || !time) { setMessage("Select all fields"); return; }

//     const res = await fetch(`http://localhost:4000/appointments`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({ doctor_id: doctorId, appointment_date: date, appointment_time: time, reason })
//     });

//     const data = await res.json();
//     if (!res.ok) setMessage(data.message || "Error");
//     else {
//       setMessage("Requested successfully");
//       onBooked && onBooked(data);
//     }
//   }

//   return (
//     <div className="p-4 bg-white rounded shadow">
//       <h2 className="text-lg font-bold">Book Appointment</h2>

//       <form onSubmit={handleBook} className="space-y-3 mt-3">
//         <div>
//           <label>Doctor ID</label>
//           <input value={doctorId} onChange={(e)=>setDoctorId(e.target.value)} className="border p-2 w-full"/>
//         </div>

//         <div>
//           <label>Date</label>
//           <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border p-2 w-full"/>
//         </div>

//         <div>
//           <label>Slot</label>
//           <select value={time} onChange={(e)=>setTime(e.target.value)} className="border p-2 w-full">
//             <option value="">Select slot</option>
//             {slots.map(s => (
//               <option key={s.time} value={s.time} disabled={!s.available}>
//                 {s.time} {s.available ? "" : "(booked)"}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div>
//           <label>Reason (optional)</label>
//           <input value={reason} onChange={(e)=>setReason(e.target.value)} className="border p-2 w-full"/>
//         </div>

//         <button className="bg-sky-600 text-white px-4 py-2 rounded">Request</button>
//       </form>

//       {message && <p className="mt-2 text-sm">{message}</p>}
//     </div>
//   );
// }

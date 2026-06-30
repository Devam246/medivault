// import React, { useState } from 'react';
// import { Calendar, Clock, Copy, Check, Key, AlertCircle } from 'lucide-react';

// const API_BASE = 'http://localhost:4000';

// function PatientAppointmentsWithToken({ appointments, onRefresh }) {
//   const [copiedToken, setCopiedToken] = useState(null);

//   const copyToken = (token) => {
//     navigator.clipboard.writeText(token);
//     setCopiedToken(token);
//     setTimeout(() => setCopiedToken(null), 2000);
//   };

//   const getStatusColor = (status) => {
//     switch(status) {
//       case 'confirmed': return 'bg-green-100 text-green-700';
//       case 'pending': return 'bg-yellow-100 text-yellow-700';
//       case 'cancelled': return 'bg-red-100 text-red-700';
//       default: return 'bg-gray-100 text-gray-700';
//     }
//   };

//   const formatDate = (dateString) => {
//     return new Date(dateString).toLocaleDateString('en-US', { 
//       year: 'numeric', 
//       month: 'long', 
//       day: 'numeric' 
//     });
//   };

//   const formatTime = (timeString) => {
//     const [hours, minutes] = timeString.split(':');
//     const hour = parseInt(hours);
//     const ampm = hour >= 12 ? 'PM' : 'AM';
//     const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
//     return `${displayHour}:${minutes} ${ampm}`;
//   };

//   return (
//     <div className="space-y-4">
//       {appointments.length === 0 ? (
//         <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
//           <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//           <h4 className="text-lg font-semibold text-gray-800 mb-2">No appointments yet</h4>
//           <p className="text-gray-600">Book your first appointment to get started</p>
//         </div>
//       ) : (
//         appointments.map(apt => (
//           <div key={apt.id} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition">
//             <div className="flex justify-between items-start mb-4">
//               <div className="flex-1">
//                 <div className="flex items-center space-x-3 mb-2">
//                   <h3 className="text-xl font-bold text-gray-800">{apt.doctor_name}</h3>
//                   <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(apt.status)}`}>
//                     {apt.status.toUpperCase()}
//                   </span>
//                 </div>
//                 <p className="text-gray-600">{apt.specialty || 'General Practice'}</p>
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4 mb-4">
//               <div className="flex items-center space-x-2 text-gray-700">
//                 <Calendar className="w-5 h-5 text-indigo-600" />
//                 <span>{formatDate(apt.appointment_date)}</span>
//               </div>
//               <div className="flex items-center space-x-2 text-gray-700">
//                 <Clock className="w-5 h-5 text-indigo-600" />
//                 <span>{formatTime(apt.appointment_time)}</span>
//               </div>
//             </div>

//             {apt.reason && (
//               <div className="bg-gray-50 rounded-lg p-3 mb-4">
//                 <p className="text-sm font-semibold text-gray-700 mb-1">Reason:</p>
//                 <p className="text-gray-600">{apt.reason}</p>
//               </div>
//             )}

//             {/* Access Token Section */}
//             {apt.access_token && apt.status === 'confirmed' && (
//               <div className="border-t pt-4 mt-4">
//                 <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
//                   <div className="flex items-center space-x-2 mb-2">
//                     <Key className="w-5 h-5 text-indigo-600" />
//                     <span className="font-semibold text-gray-800">Medical History Access Token</span>
//                   </div>
                  
//                   <p className="text-sm text-gray-600 mb-3">
//                     Share this token with your doctor to grant access to your medical history
//                   </p>

//                   <div className="flex items-center space-x-2">
//                     <div className="flex-1 bg-white rounded-lg p-3 font-mono text-sm text-gray-800 overflow-x-auto">
//                       {apt.access_token}
//                     </div>
//                     <button
//                       onClick={() => copyToken(apt.access_token)}
//                       className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center space-x-2"
//                     >
//                       {copiedToken === apt.access_token ? (
//                         <>
//                           <Check className="w-4 h-4" />
//                           <span>Copied!</span>
//                         </>
//                       ) : (
//                         <>
//                           <Copy className="w-4 h-4" />
//                           <span>Copy</span>
//                         </>
//                       )}
//                     </button>
//                   </div>

//                   {apt.token_expiry && (
//                     <p className="text-xs text-gray-500 mt-2">
//                       Expires: {formatDate(apt.token_expiry)}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             )}

//             {apt.status === 'pending' && (
//               <div className="border-t pt-4 mt-4">
//                 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
//                   <p className="text-sm text-yellow-800 flex items-center">
//                     <AlertCircle className="w-4 h-4 mr-2" />
//                     Waiting for doctor confirmation. Access token will be generated once approved.
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>
//         ))
//       )}
//     </div>
//   );
// }

// export default PatientAppointmentsWithToken;
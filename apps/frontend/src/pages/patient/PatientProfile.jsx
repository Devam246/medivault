// import React, { useState, useEffect } from 'react'
// import { useParams } from 'react-router-dom'
// import api from '../../api/axiosClient'

// export default function PatientProfile(){
//   const { id } = useParams()
//   const [patient, setPatient] = useState(null)
//   useEffect(()=>{ api.get(`/patient/${id}`).then(r=>setPatient(r.data)).catch(()=>{}) }, [id])
//   if(!patient) return <div className="container mx-auto px-6 py-8">Loading...</div>
//   return (
//     <div className="container mx-auto px-6 py-8">
//       <h1 className="text-2xl font-semibold">{patient.firstName} {patient.lastName}</h1>
//       <div className="mt-4 grid md:grid-cols-3 gap-4">
//         <div className="bg-white p-4 rounded shadow">Blood Group: {patient.bloodGroup}</div>
//         <div className="bg-white p-4 rounded shadow">Allergies: {patient.allergies?.join(', ')}</div>
//         <div className="bg-white p-4 rounded shadow">Chronic: {patient.chronic?.join(', ')}</div>
//       </div>
//     </div>
//   )
// }

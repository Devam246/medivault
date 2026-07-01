import React, { useEffect, useState } from 'react'
import api from '../../api/axiosClient'

export default function AdminDashboard(){
  const [pending, setPending] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(()=>{
    api.get('/admin/doctors?status=pending').then(r=>setPending(r.data.doctors || [])).catch(()=>{})
    api.get('/admin/stats').then(r=>setStats(r.data)).catch(()=>{})
  }, [])

  async function approve(id){ await api.post(`/admin/doctors/${id}/approve`); setPending(p=>p.filter(x=>x.id!==id)) }
  async function reject(id){ await api.post(`/admin/doctors/${id}/reject`); setPending(p=>p.filter(x=>x.id!==id)) }

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      {stats && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-slate-600">Total Users</p>
            <p className="text-2xl font-semibold text-slate-900">{stats.users}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-slate-600">Medical Records</p>
            <p className="text-2xl font-semibold text-slate-900">{stats.records}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-sm text-slate-600">Appointments</p>
            <p className="text-2xl font-semibold text-slate-900">{stats.appointments}</p>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white p-4 rounded shadow">
        <h3 className="font-semibold">Pending Doctor Verifications</h3>
        <div className="mt-4 space-y-3">
          {pending.map(d => (
            <div key={d.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-semibold">{d.name} - {d.degree}</div>
                <div className="text-sm text-slate-600">Reg#: {d.regNumber}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>approve(d.id)} className="px-3 py-1 bg-green-100 text-green-700 rounded">Approve</button>
                <button onClick={()=>reject(d.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded">Reject</button>
              </div>
            </div>
          ))}
          {pending.length===0 && <div className="text-sm text-slate-600">No pending doctors.</div>}
        </div>
      </div>
    </div>
  )
}

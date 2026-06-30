import React, { useState } from 'react';
import { FileText, Upload, Download, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMedicalRecords } from '../../hooks/usePatientData';
import api, { API_BASE, MEDICAL_UPLOAD_PATH } from '../../api/patientApi';

export default function MedicalRecordsSection() {
  const { token } = useAuth();
  const { records, refetch, loading, error } = useMedicalRecords();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', type: '', notes: '', file: null });
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async () => {
    if (!form.title || !form.type || !form.file) {
      alert('Please fill title, type, and choose a file');
      return;
    }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('type', form.type);
      formData.append('file', form.file);
      formData.append('recordDate', new Date().toISOString().split('T')[0]);
      if (form.notes?.trim()) formData.append('notes', form.notes.trim());

      const result = await api.uploadFile(MEDICAL_UPLOAD_PATH, formData, token);
      await refetch();
      setShowModal(false);
      setForm({ title: '', type: '', notes: '', file: null });
      alert(result?.message || `Upload OK. Tx: ${result?.transactionHash ? result.transactionHash.slice(0, 18) + '…' : 'n/a'}`);
    } catch (err) {
      alert('Failed to upload record: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadRecord = (record) => {
    if (!record.file_path) { alert('No file attached to this record'); return; }
    const url = record.file_path.startsWith('http')
      ? record.file_path
      : `${API_BASE}${record.file_path.startsWith('/') ? '' : '/'}${record.file_path}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = record.file_name || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <p className="text-slate-500">Loading records…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-slate-800">Medical Records</h3>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Record</span>
          </button>
        </div>
        <div className="space-y-4">
          {records.map(record => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-sky-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{record.title}</p>
                  <p className="text-sm text-slate-600">{record.type} • {record.doctor_name || 'Self Upload'}</p>
                  <p className="text-xs text-slate-500">{record.record_date}</p>
                </div>
              </div>
              <Download
                className="w-5 h-5 text-slate-400 cursor-pointer hover:text-sky-500"
                onClick={() => downloadRecord(record)}
              />
            </div>
          ))}
          {!records.length && <p className="text-center text-slate-500 py-8">No medical records found</p>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Upload Medical Record</h3>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Title</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none"
                  placeholder="e.g., Blood Test Report" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none">
                  <option value="">Select type</option>
                  <option>Lab Report</option><option>Imaging</option>
                  <option>Consultation</option><option>Prescription</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">File</label>
                <input type="file" onChange={e => setForm({ ...form, file: e.target.files[0] })}
                  className="w-full p-3 rounded-xl border border-slate-300"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none"
                  rows={3} placeholder="Any extra context for this record" />
              </div>
              <button type="button" disabled={submitting} onClick={handleUpload}
                className="w-full py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

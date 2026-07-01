/**
 * api/patientApi.js — Shared fetch wrapper used by all patient section components.
 * Centralizes base URL and auth header injection in one place.
 */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const MEDICAL_UPLOAD_PATH = '/files/upload';

const api = {
  get: async (endpoint, token) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText} ${txt}`);
    }
    return response.json();
  },

  post: async (endpoint, data, token) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText} ${txt}`);
    }
    return response.json();
  },

  put: async (endpoint, data, token) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText} ${txt}`);
    }
    return response.json();
  },

  delete: async (endpoint, token) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText} ${txt}`);
    }
    return response.json();
  },

  uploadFile: async (endpoint, formData, token) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.message || data.error || `${response.status} ${response.statusText}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(data));
    }
    return data;
  }
};

export default api;

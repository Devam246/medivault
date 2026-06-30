import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/patientApi';

export function usePatientProfile() {
  const { token } = useAuth();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const profile = await api.get('/patient/profile', token);
      setPatientData(profile?.patient ?? null);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { patientData, setPatientData, loading, error, refetch };
}

export function useMedicalRecords() {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/patient/medical-records', token);
      setRecords(data?.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { records, setRecords, loading, error, refetch };
}

export function useAppointments() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/patient/appointments', token);
      setAppointments(data?.appointments ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { appointments, loading, error, refetch };
}

export function usePrescriptions() {
  const { token } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/patient/prescriptions', token);
      setPrescriptions(data?.prescriptions ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { prescriptions, loading, error, refetch };
}

export function useVitalSigns() {
  const { token } = useAuth();
  const [vitalSigns, setVitalSigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/patient/vital-signs', token);
      setVitalSigns(data?.vitals ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load vitals');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { vitalSigns, setVitalSigns, loading, error, refetch };
}

export function useDashboardOverview() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/patient/dashboard', token);
      setOverview(data ?? null);
    } catch (err) {
      setError(err.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { overview, loading, error, refetch };
}

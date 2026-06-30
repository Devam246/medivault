import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children, role }) {
  const { token, role: userRole, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && userRole !== role) {
    if (userRole === 'patient') {
      return <Navigate to="/patient-dashboard" replace />;
    } else if (userRole === 'doctor') {
      return <Navigate to="/doctor" replace />;
    } else if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}
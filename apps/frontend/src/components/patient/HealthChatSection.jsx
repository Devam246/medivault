import React from 'react';
import { useAuth } from '../../context/AuthContext';
import PatientHealthChat from './PatientHealthChat';

export default function HealthChatSection() {
  const { token } = useAuth();
  return <PatientHealthChat token={token} />;
}

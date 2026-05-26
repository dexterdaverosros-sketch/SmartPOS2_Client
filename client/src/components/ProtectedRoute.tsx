import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Redirect } from 'wouter';

interface Props {
  component: React.ComponentType<any>;
  role?: 'admin' | 'staff' | 'any';
}

export default function ProtectedRoute({ component: Component, role = 'any' }: Props) {
  const { isAdmin, isStaff, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    // If not authenticated, redirect to role selection or login
    return <Redirect to="/role-selection" />;
  }

  if (role === 'admin' && !isAdmin) {
    // If admin role required but user is not admin
    return <Redirect to="/role-selection" />;
  }

  if (role === 'staff' && !isStaff && !isAdmin) {
    // If staff role required but user is not staff (admin is allowed as well)
    return <Redirect to="/role-selection" />;
  }

  return <Component />;
}

import React, { useState } from 'react';
import { UserRole } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);

  const handleLogin = (role: UserRole) => {
    setCurrentUser(role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="h-full bg-slate-50">
      {!currentUser ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard userRole={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
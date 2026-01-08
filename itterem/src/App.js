import React, { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

function App() {
  const [currentForm, setCurrentForm] = useState('login');
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem('auth');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const toggleForm = () => {
    setCurrentForm(currentForm === 'login' ? 'register' : 'login');
  };

  const handleLoginSuccess = (loggedUser) => {
    localStorage.setItem('auth', JSON.stringify(loggedUser));
    setAuth(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setAuth(null);
    setCurrentForm('login');
  };

  return (
    <div className="App min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {auth?.token ? (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h2 className="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            You are signed in
          </h2>
          <div className="mt-6 text-sm text-gray-700 space-y-2">
            <div>
              <span className="font-semibold">Name:</span> {auth.teljesNev || '-'}
            </div>
            <div>
              <span className="font-semibold">Email:</span> {auth.email || '-'}
            </div>
            <div>
              <span className="font-semibold">Role:</span> {String(auth.jogosultsag ?? '-')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Logout
          </button>
        </div>
      ) : currentForm === 'login' ? (
        <Login onSwitch={toggleForm} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Register onSwitch={toggleForm} />
      )}
    </div>
  );
}

export default App;

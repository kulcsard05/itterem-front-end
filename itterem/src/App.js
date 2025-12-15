import React, { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

function App() {
  const [currentForm, setCurrentForm] = useState('login');

  const toggleForm = () => {
    setCurrentForm(currentForm === 'login' ? 'register' : 'login');
  };

  return (
    <div className="App min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {currentForm === 'login' ? (
        <Login onSwitch={toggleForm} />
      ) : (
        <Register onSwitch={toggleForm} />
      )}
    </div>
  );
}

export default App;

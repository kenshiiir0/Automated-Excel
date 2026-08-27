import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation.jsx';
import Dashboard from './components/Dashboard.jsx';
import EmployeeList from '../EmployeeList.jsx';
import RecruitmentTracker from '../RecruitmentTracker.jsx';
import InternList from '../InternList.jsx';
import Login from '../Login.jsx';
import { AuthProvider, useAuth } from '../authContext.jsx';

function AuthedApp() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="App app-layout">
        <Navigation />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/recruitment" element={<RecruitmentTracker />} />
            <Route path="/interns" element={<InternList />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}

export default App;

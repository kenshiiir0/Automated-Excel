import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation.jsx';
import Dashboard from './components/Dashboard.jsx';
import Profile from './components/Profile.jsx';
import UserManagement from './components/UserManagement.jsx';
import EmployeeList from '../EmployeeList.jsx';
import RecruitmentTracker from '../RecruitmentTracker.jsx';
import InternList from '../InternList.jsx';
import Login from '../Login.jsx';
import NetworkStatusBanner from '../NetworkStatusBanner.jsx';
import { AuthProvider, useAuth } from '../authContext.jsx';

function AuthedApp() {
  const { user } = useAuth();

  if (!user) {
    return (
      <>
        <NetworkStatusBanner />
        <Login />
      </>
    );
  }

  return (
    <BrowserRouter>
      <NetworkStatusBanner />
      <div className="App app-layout">
        <Navigation />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/recruitment" element={<RecruitmentTracker />} />
            <Route path="/interns" element={<InternList />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/users" element={<UserManagement />} />
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

import React, { useState } from 'react';
import Dashboard from './Dashboard';
import EmployeeList from './EmployeeList';
import RecruitmentTracker from './RecruitmentTracker';
import './App.css';

export default function App() {
    const [currentPage, setCurrentPage] = useState('dashboard');

    return (
        <div className="app">
            <nav className="sidebar">
                <h1>GetMeds HR</h1>
                <ul>
                    <li>
                        <button
                            onClick={() => setCurrentPage('dashboard')}
                            className={currentPage === 'dashboard' ? 'active' : ''}
                        >
                            Dashboard
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('employees')}
                            className={currentPage === 'employees' ? 'active' : ''}
                        >
                            Employees
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setCurrentPage('recruitment')}
                            className={currentPage === 'recruitment' ? 'active' : ''}
                        >
                            Recruitment
                        </button>
                    </li>
                </ul>
            </nav>

            <main className="content">
                {currentPage === 'dashboard' && <Dashboard />}
                {currentPage === 'employees' && <EmployeeList />}
                {currentPage === 'recruitment' && <RecruitmentTracker />}
            </main>
        </div>
    );
}
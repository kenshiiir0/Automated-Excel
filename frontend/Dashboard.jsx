import React, { useState, useEffect } from 'react';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeCandidates: 0,
        onLeaveToday: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard">
            <h1>HR Dashboard</h1>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>Total Employees</h3>
                        <p className="stat-number">{stats.totalEmployees}</p>
                    </div>
                    <div className="stat-card">
                        <h3>Active Candidates</h3>
                        <p className="stat-number">{stats.activeCandidates}</p>
                    </div>
                    <div className="stat-card">
                        <h3>On Leave Today</h3>
                        <p className="stat-number">{stats.onLeaveToday}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
import React, { useState, useEffect } from 'react';

export default function RecruitmentTracker() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        candidate_name: '',
        position: '',
        department: '',
        status: 'Applied',
        email: '',
        phone: '',
        previous_company: '',
        resume_url: ''
    });

    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        try {
            const response = await fetch('/api/recruitment/candidates');
            const data = await response.json();
            setCandidates(data);
        } catch (err) {
            console.error('Error fetching candidates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCandidate = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/recruitment/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newCandidate = await response.json();
            setCandidates([newCandidate, ...candidates]);
            setFormData({
                candidate_name: '',
                position: '',
                department: '',
                status: 'Applied',
                email: '',
                phone: '',
                previous_company: '',
                resume_url: ''
            });
            setShowForm(false);
        } catch (err) {
            console.error('Error adding candidate:', err);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            await fetch(`/api/recruitment/candidates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            setCandidates(candidates.map(c => c.id === id ? { ...c, status: newStatus } : c));
        } catch (err) {
            console.error('Error updating candidate:', err);
        }
    };

    return (
        <div className="recruitment-tracker">
            <h1>Recruitment Pipeline</h1>
            <button onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : 'Add Candidate'}
            </button>

            {showForm && (
                <form onSubmit={handleAddCandidate} className="candidate-form">
                    <input
                        type="text"
                        placeholder="Candidate Name"
                        value={formData.candidate_name}
                        onChange={(e) => setFormData({ ...formData, candidate_name: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <input
                        type="tel"
                        placeholder="Phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Previous Company"
                        value={formData.previous_company}
                        onChange={(e) => setFormData({ ...formData, previous_company: e.target.value })}
                    />
                    <button type="submit">Add Candidate</button>
                </form>
            )}

            {loading ? (
                <p>Loading...</p>
            ) : (
                <table className="candidates-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {candidates.map(c => (
                            <tr key={c.id}>
                                <td>{c.candidate_name}</td>
                                <td>{c.position}</td>
                                <td>{c.department}</td>
                                <td>
                                    <select value={c.status} onChange={(e) => handleUpdateStatus(c.id, e.target.value)}>
                                        <option>Applied</option>
                                        <option>Screening</option>
                                        <option>Interview</option>
                                        <option>Offer</option>
                                        <option>Hired</option>
                                        <option>Rejected</option>
                                    </select>
                                </td>
                                <td>{c.email}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
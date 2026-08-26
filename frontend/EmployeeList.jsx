import React, { useState, useEffect } from 'react';

export default function EmployeeList() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        emp_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        position: '',
        employment_status: 'Active',
        hire_date: '',
        salary: ''
    });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await fetch('/api/employees');
            const data = await response.json();
            setEmployees(data);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newEmployee = await response.json();
            setEmployees([newEmployee, ...employees]);
            setFormData({
                emp_id: '',
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                department: '',
                position: '',
                employment_status: 'Active',
                hire_date: '',
                salary: ''
            });
            setShowForm(false);
        } catch (err) {
            console.error('Error adding employee:', err);
        }
    };

    const handleDeleteEmployee = async (id) => {
        try {
            await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            setEmployees(employees.filter(emp => emp.id !== id));
        } catch (err) {
            console.error('Error deleting employee:', err);
        }
    };

    return (
        <div className="employee-list">
            <h1>Employees</h1>
            <button onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : 'Add Employee'}
            </button>

            {showForm && (
                <form onSubmit={handleAddEmployee} className="employee-form">
                    <input
                        type="text"
                        placeholder="Employee ID"
                        value={formData.emp_id}
                        onChange={(e) => setFormData({ ...formData, emp_id: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="First Name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Last Name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
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
                        placeholder="Department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    />
                    <input
                        type="date"
                        placeholder="Hire Date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Salary"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    />
                    <button type="submit">Add Employee</button>
                </form>
            )}

            {loading ? (
                <p>Loading...</p>
            ) : (
                <table className="employee-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Position</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td>{emp.emp_id}</td>
                                <td>{emp.first_name} {emp.last_name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.department}</td>
                                <td>{emp.position}</td>
                                <td>{emp.employment_status}</td>
                                <td>
                                    <button onClick={() => handleDeleteEmployee(emp.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
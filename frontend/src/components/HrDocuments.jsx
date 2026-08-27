import React from 'react';
import Icon from '../../Icon.jsx';

// Placeholder shell for the Zoho WorkDrive integration. This page becomes
// live once we have the WorkDrive OAuth client ID/secret (stored as Vercel
// env vars, not committed) and the target folder ID -- until then it just
// tells people the feature is on the way instead of 404ing or disappearing
// from the nav, so the menu item can ship ahead of the backend work.
export default function HrDocuments() {
    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">HR Documents</h1>
                    <p className="page-subtitle">
                        Company files synced from Zoho WorkDrive.
                    </p>
                </div>
            </div>

            <div className="table-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ color: '#cbd5e0', marginBottom: 12 }}>
                    <Icon name="folder" size={40} />
                </div>
                <p style={{ fontSize: 14.5, color: '#4a5568', margin: '0 0 4px' }}>
                    This section is being connected to Zoho WorkDrive.
                </p>
                <p style={{ fontSize: 13, color: '#a0aec0', margin: 0 }}>
                    Once set up, folders and files will appear here and stay in sync automatically.
                </p>
            </div>
        </div>
    );
}

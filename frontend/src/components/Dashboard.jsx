import { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import Icon from '../../Icon.jsx';
import { useAuth } from '../../authContext.jsx';

const API_URL = '/api';

// Helper to assign meaningful colors based on recruitment status
const getStatusColor = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('filled') || s.includes('hired')) return '#2E7D32'; // Green
  if (s.includes('open')) return '#ED7D31'; // Orange
  if (s.includes('ongoing') || s.includes('process') || s.includes('interview')) return '#1D9FDA'; // Teal
  if (s.includes('resign') || s.includes('decline') || s.includes('reject')) return '#C0504D'; // Crimson
  if (s.includes('endo') || s.includes('end')) return '#7F8C8D'; // Slate Gray
  return '#34495E';
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    regularCount: 0,
    probationaryCount: 0,
    hiresYTD: 0,
    separationsYTD: 0,
    attritionRate: 0,
    openRequisitions: 0,
    ongoingRequisitions: 0,
    topExitReason: 'None',
    topExitCount: 0,
    totalSeparations: 0,
    internCount: 0
  });

  const [activeByDept, setActiveByDept] = useState([]);
  const [activeStatus, setActiveStatus] = useState([]);
  const [genderDist, setGenderDist] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [sepReasons, setSepReasons] = useState([]);
  const [sepByDept, setSepByDept] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [mailData, setMailData] = useState({ summary: { zoho: 0, na: 0, total: 0 }, distribution: [] });
  const [upcomingActions, setUpcomingActions] = useState({ upForRegularization: [], upcomingAnniversaries: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const chartRefs = {
    deptRef: useRef(null),
    statusRef: useRef(null),
    genderRef: useRef(null),
    trendRef: useRef(null),
    sepReasonRef: useRef(null),
    sepDeptRef: useRef(null),
    pipelineRef: useRef(null),
    mailRef: useRef(null),
  };
  const chartInstances = useRef({});

  useEffect(() => {
    loadDashboard();
    return () => {
      Object.values(chartInstances.current).forEach(chart => chart?.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function safeFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return res.json();
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // On a true cold start, the backend (and its Supabase connection) can
  // still be finishing startup for a moment after the frontend dev server
  // is already serving the page -- the very first round of fetches loses
  // that race and fails, even though refreshing a second later works fine.
  // Retrying silently a couple of times before surfacing an error covers
  // that startup window without making the user manually refresh.
  async function loadDashboard(attempt = 1) {
    const MAX_ATTEMPTS = 3;
    try {
      setError(null);

      const [
        statsRes,
        deptRes,
        statusRes,
        genderRes,
        trendRes,
        reasonsRes,
        sepDeptRes,
        pipelineRes,
        mailRes,
        actionsRes
      ] = await Promise.all([
        safeFetch(`${API_URL}/dashboard/stats`),
        safeFetch(`${API_URL}/dashboard/active-by-dept`),
        safeFetch(`${API_URL}/dashboard/active-status`),
        safeFetch(`${API_URL}/dashboard/gender-distribution`),
        safeFetch(`${API_URL}/dashboard/monthly-trend`),
        safeFetch(`${API_URL}/dashboard/separation-reasons`),
        safeFetch(`${API_URL}/dashboard/separations-by-dept`),
        safeFetch(`${API_URL}/dashboard/recruitment-pipeline`),
        safeFetch(`${API_URL}/dashboard/email-providers`).catch(() => ({ summary: { zoho: 0, na: 0, total: 0 }, distribution: [] })),
        safeFetch(`${API_URL}/dashboard/upcoming-actions`).catch(() => ({ upForRegularization: [], upcomingAnniversaries: [] }))
      ]);

      setStats(statsRes || {});
      setActiveByDept(Array.isArray(deptRes) ? deptRes : []);
      setActiveStatus(Array.isArray(statusRes) ? statusRes : []);
      setGenderDist(Array.isArray(genderRes) ? genderRes : []);
      setMonthlyTrend(Array.isArray(trendRes) ? trendRes : []);
      setSepReasons(Array.isArray(reasonsRes) ? reasonsRes : []);
      setSepByDept(Array.isArray(sepDeptRes) ? sepDeptRes : []);
      setPipeline(Array.isArray(pipelineRes) ? pipelineRes : []);

      // Safe normalization for Mail Provider Data. GetMeds has standardized
      // on Zoho Mail company-wide, so this no longer tracks Gmail as its
      // own category -- any legacy Gmail rows still in email_directory
      // (from before the switch) fall into "Other / Unspecified" like any
      // other non-Zoho provider, rather than getting their own KPI card.
      let normalizedMail = { summary: { zoho: 0, na: 0, total: 0 }, distribution: [] };
      if (mailRes) {
        if (mailRes.summary && Array.isArray(mailRes.distribution)) {
          normalizedMail = mailRes;
        } else if (Array.isArray(mailRes)) {
          let zoho = 0, na = 0, other = 0;
          mailRes.forEach(item => {
            const p = (item.mail_provider || item.provider || '').toUpperCase();
            if (p.includes('ZOHO')) zoho += (item.count || 1);
            else if (p.includes('N/A') || !p) na += (item.count || 1);
            else other += (item.count || 1);
          });
          const total = zoho + na + other;
          normalizedMail = {
            summary: { zoho, na, other, total },
            distribution: [
              { provider: 'Zoho', count: zoho, color: '#1D9FDA' },
              { provider: 'N/A', count: na, color: '#5B7290' }
            ]
          };
          if (other > 0) normalizedMail.distribution.push({ provider: 'Other / Unspecified', count: other, color: '#9B59B6' });
        }
      }
      setMailData(normalizedMail);

      // Safe normalization for Actionable Trackers
      let normalizedActions = { upForRegularization: [], upcomingAnniversaries: [] };
      if (actionsRes) {
        if (Array.isArray(actionsRes.upForRegularization) || Array.isArray(actionsRes.upcomingAnniversaries)) {
          normalizedActions = {
            upForRegularization: Array.isArray(actionsRes.upForRegularization) ? actionsRes.upForRegularization : [],
            upcomingAnniversaries: Array.isArray(actionsRes.upcomingAnniversaries) ? actionsRes.upcomingAnniversaries : []
          };
        } else if (Array.isArray(actionsRes)) {
          normalizedActions.upcomingAnniversaries = actionsRes.map(e => ({
            name: `${e.last_name || ''}, ${e.first_name || ''}`,
            department: e.department || 'N/A',
            date_hired: e.hire_date || 'N/A',
            upcoming_anniversary: e.next_anniversary || 'Upcoming',
            years_of_service: e.years_of_service || 1,
            days_remaining: e.days_remaining ?? 10
          }));
        }
      }
      setUpcomingActions(normalizedActions);

      setLoading(false);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`Dashboard load attempt ${attempt} failed (${err.message}), retrying...`);
        await sleep(attempt * 800); // 800ms, then 1600ms
        return loadDashboard(attempt + 1);
      }
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data: ' + err.message);
      setLoading(false);
    }
  }

  function renderChart(ref, key, config) {
    if (!ref || !ref.current) return;
    if (chartInstances.current[key]) {
      chartInstances.current[key].destroy();
    }
    chartInstances.current[key] = new Chart(ref.current.getContext('2d'), config);
  }

  // Render / re-render charts when data is loaded and DOM canvas refs are attached
  useEffect(() => {
    if (loading) return;

    // 1. Active Headcount by Department (Horizontal Bar Chart)
    if (activeByDept && activeByDept.length > 0) {
      renderChart(chartRefs.deptRef, 'dept', {
        type: 'bar',
        data: {
          labels: activeByDept.map(d => d.department),
          datasets: [{
            label: 'Active Headcount',
            data: activeByDept.map(d => d.count),
            backgroundColor: '#1D9FDA',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // 2. Employment Status (Doughnut Ring Chart)
    if (activeStatus && activeStatus.some(s => s.count > 0)) {
      renderChart(chartRefs.statusRef, 'status', {
        type: 'doughnut',
        data: {
          labels: activeStatus.map(d => d.status),
          datasets: [{
            data: activeStatus.map(d => d.count),
            backgroundColor: ['#1D9FDA', '#ED7D31', '#7F7F7F', '#3498DB'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: { 
            legend: { 
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, padding: 12 }
            } 
          }
        }
      });
    }

    // 3. Gender Distribution (Doughnut Ring Chart)
    if (genderDist && genderDist.some(g => g.count > 0)) {
      renderChart(chartRefs.genderRef, 'gender', {
        type: 'doughnut',
        data: {
          labels: genderDist.map(d => d.gender),
          datasets: [{
            data: genderDist.map(d => d.count),
            backgroundColor: ['#ED7D31', '#0F5777', '#95A5A6'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: { 
            legend: { 
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, padding: 12 }
            } 
          }
        }
      });
    }

    // 4. Monthly Trend (Line / Bar chart)
    if (monthlyTrend && monthlyTrend.length > 0) {
      renderChart(chartRefs.trendRef, 'trend', {
        type: 'bar',
        data: {
          labels: monthlyTrend.map(d => d.month),
          datasets: [
            {
              label: 'Hires',
              data: monthlyTrend.map(d => d.hires),
              backgroundColor: '#1D9FDA',
              borderRadius: 4
            },
            {
              label: 'Separations',
              data: monthlyTrend.map(d => d.separations),
              backgroundColor: '#C0504D',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 10, padding: 10 } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    // 5. Separation Reasons (Doughnut chart)
    if (sepReasons && sepReasons.some(r => r.count > 0)) {
      renderChart(chartRefs.sepReasonRef, 'sepReason', {
        type: 'doughnut',
        data: {
          labels: sepReasons.map(d => d.reason),
          datasets: [{
            data: sepReasons.map(d => d.count),
            backgroundColor: ['#C0504D', '#ED7D31', '#5B7290', '#0F5777', '#9B59B6'], 
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: { 
            legend: { 
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, padding: 10 }
            } 
          }
        }
      });
    }

    // 6. Separations by Department (Horizontal Bar Chart)
    if (sepByDept && sepByDept.length > 0) {
      const totalDeptSeparations = sepByDept.reduce((acc, curr) => acc + curr.count, 0);
      const backgroundColors = sepByDept.map((_, idx) => {
        if (idx === 0) return '#A93226';
        if (idx === 1) return '#C0392B';
        if (idx === 2) return '#D98880';
        return '#BDC3C7';
      });

      renderChart(chartRefs.sepDeptRef, 'sepDept', {
        type: 'bar',
        data: {
          labels: sepByDept.map(d => d.department),
          datasets: [{
            label: 'Separations',
            data: sepByDept.map(d => d.count),
            backgroundColor: backgroundColors,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const count = ctx.parsed.x;
                  const pct = totalDeptSeparations > 0 ? ((count / totalDeptSeparations) * 100).toFixed(1) : 0;
                  return ` ${count} exits (${pct}% of all separations)`;
                }
              }
            }
          },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // 7. Recruitment Pipeline (Bar Chart)
    if (pipeline && pipeline.length > 0) {
      const totalCandidates = pipeline.reduce((acc, curr) => acc + curr.count, 0);
      const statusColors = pipeline.map(p => getStatusColor(p.status));

      renderChart(chartRefs.pipelineRef, 'pipeline', {
        type: 'bar',
        data: {
          labels: pipeline.map(d => d.status),
          datasets: [{
            label: 'Candidates',
            data: pipeline.map(d => d.count),
            backgroundColor: statusColors,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const count = ctx.parsed.y;
                  const pct = totalCandidates > 0 ? ((count / totalCandidates) * 100).toFixed(1) : 0;
                  return ` ${count} candidates (${pct}% of pipeline)`;
                }
              }
            }
          },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // 8. Company Mail Provider (Pie Chart)
    if (mailData && mailData.distribution && mailData.distribution.length > 0) {
      const mailLabels = mailData.distribution.map(d => d.provider);
      const mailCounts = mailData.distribution.map(d => d.count);
      const mailColors = mailData.distribution.map(d => d.color || '#1D9FDA');

      renderChart(chartRefs.mailRef, 'mail', {
        type: 'pie',
        data: {
          labels: mailLabels,
          datasets: [{
            data: mailCounts,
            backgroundColor: mailColors,
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { usePointStyle: true, boxWidth: 10, padding: 14 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const count = ctx.parsed;
                  const total = mailCounts.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${count} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }, [loading, activeByDept, activeStatus, genderDist, monthlyTrend, sepReasons, sepByDept, pipeline, mailData]);

  const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Simple time-of-day greeting -- Manila is the org's home timezone, so
  // the greeting is based on local Philippine time regardless of where
  // the viewer's browser/device clock happens to be set.
  const greetingWord = (() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }).format(new Date()));
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const greetingName = user?.full_name || user?.username || '';
  const hasStatusData = activeStatus && activeStatus.some(s => s.count > 0);
  const hasGenderData = genderDist && genderDist.some(g => g.count > 0);
  const hasDeptData = activeByDept && activeByDept.length > 0;
  const hasReasonsData = sepReasons && sepReasons.some(r => r.count > 0);
  const hasSepDeptData = sepByDept && sepByDept.length > 0;
  const hasPipelineData = pipeline && pipeline.length > 0;
  const hasMailData = mailData && mailData.distribution && mailData.distribution.length > 0;

  // Pipeline summary totals
  const totalPipelineCandidates = pipeline.reduce((sum, p) => sum + p.count, 0);
  const filledCandidates = pipeline.filter(p => (p.status || '').toLowerCase().includes('closed') || (p.status || '').toLowerCase().includes('filled')).reduce((sum, p) => sum + p.count, 0);

  // Due-Now notification banner: pulls anything from the two Actionable
  // HR Trackers tables (below) that's due TODAY (days_remaining === 0)
  // into one combined, impossible-to-miss strip at the very top of the
  // dashboard, instead of requiring a scroll all the way down to
  // Section 7 to notice it. The backend (dashboardController.js) only
  // ever returns days_remaining >= 0 for both trackers -- a record that
  // falls out of the "within 30 days" window entirely just stops being
  // returned rather than going negative -- so 0 is the actual floor, not
  // just the common case; the <= 0 filter and `overdue` flag below are
  // kept anyway as a harmless safeguard in case that ever changes.
  // A regularization due today is often the more time-sensitive of the
  // two (a compliance deadline), so it's listed first when both types
  // are due on the same refresh.
  const dueNowItems = [
    ...((upcomingActions?.upForRegularization || [])
      .filter(item => item.days_remaining <= 0)
      .map(item => ({
        key: `reg-${item.name}-${item.regularization_date}`,
        name: item.name,
        reason: item.days_remaining < 0 ? 'Regularization overdue' : 'Regularization due today',
        overdue: item.days_remaining < 0,
      }))),
    ...((upcomingActions?.upcomingAnniversaries || [])
      .filter(item => item.days_remaining <= 0)
      .map(item => ({
        key: `anniv-${item.name}-${item.upcoming_anniversary}`,
        name: item.name,
        reason: item.days_remaining < 0
          ? 'Work anniversary passed'
          : `${item.years_of_service} ${item.years_of_service === 1 ? 'yr' : 'yrs'} anniversary today`,
        overdue: item.days_remaining < 0,
      }))),
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>HR Employee Tracker</h1>
          {greetingName && <p className="dashboard-greeting">{greetingWord}, {greetingName}!</p>}
          <p>Source: Active Employees / Resigned Inactive / Recruitment Update | Generated {currentDateStr}</p>
        </div>
        <button
          className="btn-ghost"
          onClick={() => { setLoading(true); loadDashboard(); }}
          style={{ padding: '7px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Reload latest data from database"
        >
          <Icon name="refresh" size={14} /> Refresh Data
        </button>
      </header>

      {dueNowItems.length > 0 && (
        <div className="due-now-banner" role="status">
          <span className="due-now-icon-badge">
            <Icon name="alertTriangle" size={18} />
          </span>
          <div className="due-now-body">
            <div className="due-now-header-row">
              <p className="due-now-title">Action needed today</p>
              <span className="due-now-count-pill">
                {dueNowItems.length} {dueNowItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="due-now-chip-row">
              {dueNowItems.map(item => (
                <div className="due-now-chip" key={item.key}>
                  <span className={`due-now-chip-dot ${item.overdue ? 'overdue' : 'today'}`}></span>
                  <span className="due-now-chip-name">{item.name}</span>
                  <span className="due-now-chip-reason">— {item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="dashboard-skeleton">
          {/* Skeleton Section Header */}
          <div className="skeleton skeleton-title" style={{ width: '220px', height: '24px', margin: '20px 0 14px' }}></div>
          
          {/* Skeleton KPI Grid (9 cards) */}
          <div className="kpi-grid">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="kpi-card skeleton-card">
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '12px' }}></div>
                <div className="skeleton skeleton-val" style={{ width: '45%', height: '36px', margin: '8px 0' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '75%', height: '11px' }}></div>
              </div>
            ))}
          </div>

          {/* Skeleton Section 2 */}
          <div className="skeleton skeleton-title" style={{ width: '260px', height: '24px', margin: '32px 0 16px' }}></div>
          <div className="charts-row">
            <div className="chart-box flex-2 skeleton-box">
              <div className="skeleton skeleton-text" style={{ width: '40%', height: '18px', marginBottom: '20px' }}></div>
              <div className="skeleton-chart-bars">
                {[85, 60, 45, 90, 30, 50].map((w, idx) => (
                  <div key={idx} className="skeleton-bar-row">
                    <div className="skeleton skeleton-text" style={{ width: '25%', height: '12px' }}></div>
                    <div className="skeleton skeleton-bar" style={{ width: `${w}%`, height: '20px' }}></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-box flex-1 skeleton-box">
              <div className="skeleton skeleton-text" style={{ width: '50%', height: '18px', marginBottom: '20px' }}></div>
              <div className="skeleton-donut-wrap">
                <div className="skeleton skeleton-donut"></div>
              </div>
            </div>
          </div>

          {/* Skeleton Section 3 */}
          <div className="skeleton skeleton-title" style={{ width: '280px', height: '24px', margin: '32px 0 16px' }}></div>
          <div className="charts-row">
            <div className="chart-box flex-2 skeleton-box">
              <div className="skeleton skeleton-text" style={{ width: '35%', height: '18px', marginBottom: '20px' }}></div>
              <div className="skeleton skeleton-chart-area" style={{ height: '240px' }}></div>
            </div>
            <div className="chart-box flex-1 skeleton-box">
              <div className="skeleton skeleton-text" style={{ width: '50%', height: '18px', marginBottom: '20px' }}></div>
              <div className="skeleton-donut-wrap">
                <div className="skeleton skeleton-donut"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-content">
          
          {/* SECTION 1: KPI CARDS */}
          <div className="kpi-grid">
            <div className="kpi-card bg-navy">
              <div className="kpi-title">ACTIVE HEADCOUNT</div>
              <div className="kpi-value">{stats.totalEmployees}</div>
              <div className="kpi-subtitle">as of {currentDateStr}</div>
            </div>
            
            <div className="kpi-card bg-teal">
              <div className="kpi-title">REGULAR EMPLOYEES</div>
              <div className="kpi-value">{stats.regularCount}</div>
              <div className="kpi-subtitle">
                {stats.totalEmployees > 0 ? ((stats.regularCount / stats.totalEmployees) * 100).toFixed(1) : 0}% of headcount
              </div>
            </div>

            <div className="kpi-card bg-orange">
              <div className="kpi-title">PROBATIONARY EMPLOYEES</div>
              <div className="kpi-value">{stats.probationaryCount}</div>
              <div className="kpi-subtitle">
                {stats.totalEmployees > 0 ? ((stats.probationaryCount / stats.totalEmployees) * 100).toFixed(1) : 0}% of headcount
              </div>
            </div>

            <div className="kpi-card bg-green">
              <div className="kpi-title">HIRES YTD</div>
              <div className="kpi-value">{stats.hiresYTD}</div>
              <div className="kpi-subtitle">joined this year</div>
            </div>

            <div className="kpi-card bg-red">
              <div className="kpi-title">SEPARATIONS YTD</div>
              <div className="kpi-value">{stats.separationsYTD}</div>
              <div className="kpi-subtitle">exits this year</div>
            </div>

            <div className="kpi-card bg-navy">
              <div className="kpi-title">ATTRITION RATE YTD</div>
              <div className="kpi-value">{stats.attritionRate}%</div>
              <div className="kpi-subtitle">Separations / Active</div>
            </div>

            <div className="kpi-card bg-teal">
              <div className="kpi-title">OPEN REQUISITIONS</div>
              <div className="kpi-value">{stats.openRequisitions}</div>
              <div className="kpi-subtitle">{stats.ongoingRequisitions} ongoing</div>
            </div>

            <div className="kpi-card bg-orange">
              <div className="kpi-title">TOP EXIT REASON</div>
              <div className="kpi-value" style={{ fontSize: stats.topExitReason?.length > 12 ? '22px' : '28px' }}>
                {stats.topExitReason}
              </div>
              <div className="kpi-subtitle">{stats.topExitCount} employees ({stats.totalSeparations} all-time)</div>
            </div>

            <div className="kpi-card bg-green">
              <div className="kpi-title">INTERNS</div>
              <div className="kpi-value">{stats.internCount}</div>
              <div className="kpi-subtitle">on file</div>
            </div>
          </div>

          {/* SECTION 2: WORKFORCE COMPOSITION */}
          <div className="section-title">WORKFORCE COMPOSITION</div>
          <div className="charts-row">
            <div className="chart-box flex-2">
              <div className="chart-box-header">
                <h3>Active Headcount by Department</h3>
                {hasDeptData && (
                  <span className="chart-pill-badge neutral">{activeByDept.length} Departments</span>
                )}
              </div>
              {hasDeptData ? (
                <div className="chart-container" style={{ height: `${Math.max(320, activeByDept.length * 28)}px` }}>
                  <canvas ref={chartRefs.deptRef}></canvas>
                </div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-badge">0 Departments</div>
                  <p>Department distribution data will display once active employees are added.</p>
                </div>
              )}
            </div>

            <div className="chart-box flex-1">
              <div className="chart-box-header">
                <h3>Active Headcount by Employment Status</h3>
              </div>
              {hasStatusData ? (
                <div className="chart-container"><canvas ref={chartRefs.statusRef}></canvas></div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-donut-placeholder status-donut">
                    <span className="donut-center-val">{stats.totalEmployees}</span>
                    <span className="donut-center-lbl">Active Total</span>
                  </div>
                  <div className="empty-legend">
                    <span><i className="dot dot-teal"></i> Regular ({stats.regularCount})</span>
                    <span><i className="dot dot-orange"></i> Probationary ({stats.probationaryCount})</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: HEADCOUNT TREND & GENDER DIVERSITY */}
          <div className="section-title">HEADCOUNT & ATTRITION TREND</div>
          <div className="charts-row">
            <div className="chart-box flex-2">
              <div className="chart-box-header">
                <h3>Monthly Trend — Hires vs. Separations ({new Date().getFullYear()})</h3>
                <div className="chart-pill-group">
                  <span className="chart-pill-badge success">+{stats.hiresYTD} Hires</span>
                  <span className="chart-pill-badge alert">-{stats.separationsYTD} Exits</span>
                </div>
              </div>
              <div className="chart-container tall"><canvas ref={chartRefs.trendRef}></canvas></div>
            </div>

            <div className="chart-box flex-1">
              <div className="chart-box-header">
                <h3>Active Headcount by Gender</h3>
              </div>
              {hasGenderData ? (
                <div className="chart-container"><canvas ref={chartRefs.genderRef}></canvas></div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-donut-placeholder gender-donut">
                    <span className="donut-center-val">{stats.totalEmployees}</span>
                    <span className="donut-center-lbl">Active Total</span>
                  </div>
                  <div className="empty-legend">
                    <span><i className="dot dot-orange"></i> Female</span>
                    <span><i className="dot dot-navy"></i> Male</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: ATTRITION DETAIL */}
          <div className="section-title">ATTRITION DETAIL</div>
          <div className="charts-row">
            <div className="chart-box flex-1">
              <div className="chart-box-header">
                <h3>Separation Reasons — Year-to-Date</h3>
                {hasReasonsData && (
                  <span className="chart-pill-badge alert">{stats.separationsYTD} Exits YTD</span>
                )}
              </div>
              {hasReasonsData ? (
                <div className="chart-container"><canvas ref={chartRefs.sepReasonRef}></canvas></div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-donut-placeholder sep-donut">
                    <span className="donut-center-val">{stats.separationsYTD}</span>
                    <span className="donut-center-lbl">Separations</span>
                  </div>
                  <p className="empty-subtext">No separation records logged for current year ({stats.separationsYTD} YTD exits).</p>
                </div>
              )}
            </div>

            <div className="chart-box flex-2">
              <div className="chart-box-header">
                <h3>Separations by Department (All-time)</h3>
                {hasSepDeptData && (
                  <span className="chart-pill-badge alert">
                    Top Attrition: {sepByDept[0]?.department || 'N/A'}
                  </span>
                )}
              </div>
              {hasSepDeptData ? (
                <div className="chart-container" style={{ height: `${Math.max(280, sepByDept.length * 28)}px` }}>
                  <canvas ref={chartRefs.sepDeptRef}></canvas>
                </div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-badge">0 Separations Recorded</div>
                  <p>All-time separation records by department will show here.</p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5: RECRUITMENT PIPELINE */}
          <div className="section-title">RECRUITMENT PIPELINE</div>
          <div className="charts-row" style={{ marginBottom: '28px' }}>
            <div className="chart-box flex-1">
              <div className="chart-box-header">
                <h3>Candidates by Status</h3>
                {hasPipelineData && (
                  <span className="chart-pill-badge neutral">{totalPipelineCandidates} Candidates</span>
                )}
              </div>
              {hasPipelineData ? (
                <div className="chart-container"><canvas ref={chartRefs.pipelineRef}></canvas></div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-badge">0 Candidates</div>
                  <p>Recruitment pipeline data will display once candidates are added.</p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: COMPANY MAIL PROVIDER */}
          <div className="section-title">COMPANY MAIL PROVIDER</div>
          <div className="kpi-grid" style={{ marginBottom: '16px' }}>
            <div className="kpi-card bg-teal">
              <div className="kpi-title">EMPLOYEES ON ZOHO</div>
              <div className="kpi-value">{mailData?.summary?.zoho ?? 0}</div>
              <div className="kpi-subtitle">company mail directory</div>
            </div>

            <div className="kpi-card" style={{ background: '#5B7290' }}>
              <div className="kpi-title">EMPLOYEES N/A</div>
              <div className="kpi-value">{mailData?.summary?.na ?? 0}</div>
              <div className="kpi-subtitle">no company mail on file</div>
            </div>

            <div className="kpi-card bg-navy">
              <div className="kpi-title">TOTAL IN MAIL DIRECTORY</div>
              <div className="kpi-value">{mailData?.summary?.total ?? 0}</div>
              <div className="kpi-subtitle">Zoho + N/A + other</div>
            </div>
          </div>

          <div className="charts-row" style={{ marginBottom: '28px' }}>
            <div className="chart-box flex-1">
              <div className="chart-box-header">
                <h3>Employees by Company Mail Provider</h3>
                <span className="chart-pill-badge neutral">{mailData?.summary?.total ?? 0} Accounts</span>
              </div>
              {hasMailData ? (
                <div className="chart-container" style={{ height: '260px' }}>
                  <canvas ref={chartRefs.mailRef}></canvas>
                </div>
              ) : (
                <div className="chart-empty-state">
                  <div className="empty-badge">0 Email Accounts</div>
                  <p>Mail provider distribution data will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 7: ACTIONABLE HR TRACKERS (WITHIN 30 DAYS) */}
          <div className="section-title">ACTIONABLE HR TRACKERS (WITHIN 30 DAYS)</div>
          <div className="action-tables-grid">
            
            {/* Table 1: Up For Regularization */}
            <div className="action-card">
              <div className="action-card-header">
                <div className="action-card-title-group">
                  <span className="action-card-icon"><Icon name="clipboard" size={16} /></span>
                  <h3>UP FOR REGULARIZATION (WITHIN 30 DAYS)</h3>
                </div>
                <span className="chart-pill-badge alert">
                  {(upcomingActions?.upForRegularization || []).length} Pending
                </span>
              </div>

              <div className="action-table-wrap">
                <table className="action-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Date Hired</th>
                      <th>Regularization Date</th>
                      <th>Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(upcomingActions?.upForRegularization || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">
                          No employees up for regularization within the next 30 days.
                        </td>
                      </tr>
                    ) : (
                      (upcomingActions?.upForRegularization || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="action-emp-name">{item.name}</td>
                          <td>{item.department}</td>
                          <td>{item.date_hired}</td>
                          <td>{item.regularization_date}</td>
                          <td>
                            <span className={`days-countdown-badge ${item.days_remaining <= 10 ? 'urgent' : item.days_remaining <= 20 ? 'warn' : 'info'}`}>
                              {item.days_remaining} {item.days_remaining === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Upcoming Work Anniversaries */}
            <div className="action-card">
              <div className="action-card-header">
                <div className="action-card-title-group">
                  <span className="action-card-icon"><Icon name="cake" size={16} /></span>
                  <h3>UPCOMING WORK ANNIVERSARIES (WITHIN 30 DAYS)</h3>
                </div>
                <span className="chart-pill-badge success">
                  {(upcomingActions?.upcomingAnniversaries || []).length} Anniversaries
                </span>
              </div>

              <div className="action-table-wrap">
                <table className="action-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Date Hired</th>
                      <th>Upcoming Anniversary</th>
                      <th>Years of Service</th>
                      <th>Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(upcomingActions?.upcomingAnniversaries || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          No work anniversaries in the next 30 days.
                        </td>
                      </tr>
                    ) : (
                      (upcomingActions?.upcomingAnniversaries || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="action-emp-name">{item.name}</td>
                          <td>{item.department}</td>
                          <td>{item.date_hired}</td>
                          <td>{item.upcoming_anniversary}</td>
                          <td>
                            <span className="years-service-badge">{item.years_of_service} {item.years_of_service === 1 ? 'yr' : 'yrs'}</span>
                          </td>
                          <td>
                            <span className={`days-countdown-badge ${item.days_remaining <= 7 ? 'urgent' : 'info'}`}>
                              {item.days_remaining} {item.days_remaining === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

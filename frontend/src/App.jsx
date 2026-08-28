import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation.jsx';
import Dashboard from './components/Dashboard.jsx';
import Profile from './components/Profile.jsx';
import UserManagement from './components/UserManagement.jsx';
import History from './components/History.jsx';
import HrDocuments from './components/HrDocuments.jsx';
import DisciplinaryMemos from './components/DisciplinaryMemos.jsx';
import SendFiles from './components/SendFiles.jsx';
import EmployeeList from '../EmployeeList.jsx';
import RecruitmentTracker from '../RecruitmentTracker.jsx';
import InternList from '../InternList.jsx';
import Login from '../Login.jsx';
import NetworkStatusBanner from '../NetworkStatusBanner.jsx';
import { AuthProvider, useAuth } from '../authContext.jsx';

// Every page the nav can go to, in one place. `keepAlive: true` marks a
// page where navigating away mid-task would otherwise lose real,
// in-progress work: a multi-field form being filled in, or a
// generate/send action underway (Disciplinary Memos' draft + AI-draft +
// generate/send flow, the Add Employee/Intern/Candidate forms, Profile's
// settings forms, Manage Users' Create Account modal). Those pages are
// mounted once (the first time they're visited) and never unmounted for
// the rest of the session -- switching away and back is a pure CSS
// show/hide, not a fresh mount, so typed text/selections/open modals
// survive the trip.
//
// Dashboard, HR Documents, and History are deliberately plain routes
// (mount fresh on every visit, exactly like before this change): they're
// read/browse views with nothing sustained to type or leave mid-way
// through, so there's no state worth preserving, and letting them
// unmount normally means they never run invisibly in the background.
const PAGES = [
  { path: '/', Component: Dashboard, keepAlive: false },
  { path: '/employees', Component: EmployeeList, keepAlive: true },
  { path: '/recruitment', Component: RecruitmentTracker, keepAlive: true },
  { path: '/interns', Component: InternList, keepAlive: true },
  { path: '/hr-documents', Component: HrDocuments, keepAlive: false },
  { path: '/disciplinary-memos', Component: DisciplinaryMemos, keepAlive: true },
  { path: '/send-files', Component: SendFiles, keepAlive: true },
  { path: '/profile', Component: Profile, keepAlive: true },
  { path: '/users', Component: UserManagement, keepAlive: true },
  { path: '/history', Component: History, keepAlive: false },
];

const KEEP_ALIVE_PAGES = PAGES.filter(p => p.keepAlive);

function PageRouter() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Tracks which keep-alive pages have been visited at least once this
  // session -- a page is only added to the permanently-mounted set the
  // first time its URL is actually hit, so an account that never opens
  // e.g. Manage Users never pays the cost of mounting it.
  const [visited, setVisited] = React.useState(() => new Set());

  React.useEffect(() => {
    if (KEEP_ALIVE_PAGES.some(p => p.path === currentPath) && !visited.has(currentPath)) {
      setVisited(prev => new Set(prev).add(currentPath));
    }
  }, [currentPath, visited]);

  const nonKeepAlivePage = PAGES.find(p => !p.keepAlive && p.path === currentPath);

  return (
    <>
      {/* Keep-alive pages: every one visited so far stays mounted;
          only the one matching the current URL is actually visible.
          Each gets a `visible` prop so it can quietly re-fetch its list
          data on returning to it (without losing any in-progress form
          state, which lives in the component and isn't touched by this). */}
      {KEEP_ALIVE_PAGES.filter(p => visited.has(p.path)).map(({ path, Component }) => (
        <div key={path} style={{ display: currentPath === path ? 'contents' : 'none' }}>
          <Component visible={currentPath === path} />
        </div>
      ))}

      {/* Plain pages: mount fresh on every visit, exactly like a normal
          router -- only one of these is ever mounted at a time. */}
      {nonKeepAlivePage && <nonKeepAlivePage.Component />}
    </>
  );
}

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
          <PageRouter />
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

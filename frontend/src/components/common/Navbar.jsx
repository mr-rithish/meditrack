import { NavLink, useNavigate } from 'react-router-dom';

const navItems = {
  manufacturer: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/dashboard/products', icon: '💊', label: 'Products' },
    { to: '/dashboard/generate', icon: '🔢', label: 'Generate Serials' },
  ],
  middleman: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/dashboard/receive', icon: '📥', label: 'Receive Box' },
    { to: '/dashboard/send', icon: '📤', label: 'Send Box' },
    { to: '/dashboard/report', icon: '🚨', label: 'Report Fake' },
  ],
  pharmacy: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/dashboard/scan', icon: '📷', label: 'Scan & Verify' },
    { to: '/dashboard/inventory', icon: '📦', label: 'Inventory' },
  ],
  regulator: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/dashboard/actors', icon: '🏢', label: 'Manage Actors' },
    { to: '/dashboard/alerts', icon: '🚨', label: 'Alerts' },
    { to: '/dashboard/recalls', icon: '⚠️', label: 'Recalls' },
  ],
  admin: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/dashboard/actors', icon: '🏢', label: 'Manage Actors' },
    { to: '/dashboard/alerts', icon: '🚨', label: 'Alerts' },
    { to: '/dashboard/recalls', icon: '⚠️', label: 'Recalls' },
  ]
};

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const items = navItems[user.role] || [];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="logo">M</div>
        <h1>MediTrack</h1>
      </div>

      <ul className="nav-links">
        {items.map(item => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.to === '/dashboard'}
              className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
        <li style={{ marginTop: 'auto' }}>
          <a href="/verify" target="_blank">
            <span className="nav-icon">🔍</span>
            Patient Verify
          </a>
        </li>
        <li>
          <button onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </li>
      </ul>

      <div className="nav-user">
        <div className="nav-user-avatar">
          {user.fullName?.[0] || user.username?.[0]?.toUpperCase()}
        </div>
        <div className="nav-user-info">
          <div className="name">{user.fullName || user.username}</div>
          <div className="role">{user.role}</div>
        </div>
      </div>
    </nav>
  );
}

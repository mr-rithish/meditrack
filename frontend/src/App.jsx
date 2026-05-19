import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import MiddlemanDashboard from './pages/MiddlemanDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import PatientVerify from './pages/PatientVerify';
import RegulatoryDashboard from './pages/RegulatoryDashboard';
import Navbar from './components/common/Navbar';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('meditrack_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('meditrack_user', JSON.stringify(userData));
    localStorage.setItem('meditrack_token', userData.token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('meditrack_user');
    localStorage.removeItem('meditrack_token');
  };

  const getDashboard = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case 'manufacturer': return <ManufacturerDashboard user={user} />;
      case 'middleman': return <MiddlemanDashboard user={user} />;
      case 'pharmacy': return <PharmacyDashboard user={user} />;
      case 'regulator': return <RegulatoryDashboard user={user} />;
      case 'admin': return <RegulatoryDashboard user={user} />;
      default: return <Navigate to="/login" />;
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} />
        } />
        <Route path="/verify" element={<PatientVerify />} />
        <Route path="/dashboard/*" element={
          <div className="app-container">
            {user && <Navbar user={user} onLogout={handleLogout} />}
            <div className="main-content">
              {getDashboard()}
            </div>
          </div>
        } />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/verify"} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

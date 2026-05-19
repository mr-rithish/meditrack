import { useState } from 'react';
import { authAPI } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.login({ email, password });
      onLogin(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { email: 'admin@pfizer.com', role: 'Manufacturer', icon: '🏭' },
    { email: 'amit@medsupply.in', role: 'Middleman (Wholesaler)', icon: '🚛' },
    { email: 'rajesh@apollopharmacy.in', role: 'Pharmacy', icon: '💊' },
    { email: 'admin@cdsco.gov.in', role: 'Regulator', icon: '🏛️' },
  ];

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <h1>💊 MediTrack</h1>
          <p>Medicine Anti-Counterfeit Tracking System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="form-control" placeholder="Enter your email"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" placeholder="Enter password"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <p className="text-danger mb-2" style={{ fontSize: '0.85rem' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}
            disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-3">
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Demo accounts (password: <strong>password123</strong>)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {demoAccounts.map(acc => (
              <button key={acc.email} className="btn btn-outline btn-sm"
                onClick={() => { setEmail(acc.email); setPassword('password123'); }}
                style={{ justifyContent: 'flex-start' }}>
                {acc.icon} {acc.role} — {acc.email}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 text-center">
          <a href="/verify" style={{ fontSize: '0.85rem' }}>
            🔍 Scan & verify a medicine without login →
          </a>
        </div>
      </div>
    </div>
  );
}

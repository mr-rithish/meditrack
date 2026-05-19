import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { regulatorAPI, analyticsAPI } from '../services/api';

// ================================
// DASHBOARD OVERVIEW
// ================================
function DashOverview() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [notifications, setNotifications] = useState({ unreadCount: 0, notifications: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      regulatorAPI.getDashboard(),
      analyticsAPI.getVerificationTrend(7),
      regulatorAPI.getNotifications()
    ]).then(([s, t, n]) => {
      setStats(s.data.data);
      setTrend(t.data.data || []);
      setNotifications(n.data.data || { unreadCount: 0, notifications: [] });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const maxVal = Math.max(...trend.map(d => d.total), 1);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Regulatory Dashboard</h1>
          <p>Central authority — system-wide monitoring & actor management</p>
        </div>
        {notifications.unreadCount > 0 && (
          <a href="/dashboard/alerts" className="notification-bell">
            🔔 <span className="notification-badge">{notifications.unreadCount}</span>
          </a>
        )}
      </div>

      <div className="stats-grid">
        {[
          { icon: '💊', label: 'Medicines Tracked', value: stats?.totalMedicinesTracked, color: 'blue' },
          { icon: '✅', label: 'Verifications Today', value: stats?.verificationsToday, color: 'green' },
          { icon: '📊', label: 'Success Rate', value: stats?.successRate, color: 'purple' },
          { icon: '🚨', label: 'Active Alerts', value: stats?.activeAlerts, color: 'red' },
          { icon: '🏥', label: 'Active Pharmacies', value: stats?.activePharmacies, color: 'blue' },
          { icon: '⚠️', label: 'Active Recalls', value: stats?.activeRecalls, color: 'orange' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.value || 0}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Verification Trend Chart */}
      <div className="card mt-2">
        <div className="card-header"><h2>📈 Verifications This Week</h2></div>
        <div className="chart-bars">
          {trend.map((d, i) => (
            <div className="chart-bar-group" key={i}>
              <div className="chart-bar-container">
                <div className="chart-bar genuine" style={{ height: `${(d.genuine / maxVal) * 100}%` }} title={`Genuine: ${d.genuine}`}></div>
                <div className="chart-bar flagged" style={{ height: `${(d.flagged / maxVal) * 100}%` }} title={`Flagged: ${d.flagged}`}></div>
              </div>
              <div className="chart-bar-label">{d.label}</div>
              <div className="chart-bar-value">{d.total}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
          <span>🟢 Genuine</span>
          <span>🔴 Flagged</span>
        </div>
      </div>

      {/* Recent Notifications */}
      {notifications.notifications?.length > 0 && (
        <div className="card mt-2">
          <div className="card-header"><h2>🔔 Recent Complaints & Alerts</h2></div>
          <div className="activity-feed">
            {notifications.notifications.slice(0, 5).map((n, i) => (
              <div className="activity-item" key={i}>
                <div className="activity-dot" style={{ background: n.status === 'new' ? 'var(--accent-red)' : 'var(--accent-blue)' }}></div>
                <div className="activity-content">
                  <div className="activity-title">
                    <span className={`badge badge-${n.severity === 'critical' ? 'danger' : n.severity === 'high' ? 'warning' : 'info'}`}>
                      {n.severity?.toUpperCase()}
                    </span>
                    <span style={{ marginLeft: '0.5rem' }}>{n.alert_type?.replace(/_/g, ' ')}</span>
                    {n.status === 'new' && <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>NEW</span>}
                  </div>
                  <div className="activity-meta">{n.description}</div>
                  {n.actor && <div className="activity-meta">Reported by: {n.actor.company_name} ({n.actor.city})</div>}
                  <div className="activity-time">{new Date(n.alert_timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================
// MANAGE ACTORS
// ================================
function ManageActors() {
  const [tab, setTab] = useState('manufacturer');
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    actorType: 'manufacturer', companyName: '', licenseNumber: '', address: '',
    city: '', state: '', country: 'India', contactPerson: '', contactEmail: '', contactPhone: '', password: 'password123'
  });
  const [msg, setMsg] = useState('');

  const loadActors = (type) => {
    setLoading(true);
    regulatorAPI.getActors(type)
      .then(res => setActors(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadActors(tab); }, [tab]);

  const handleRegister = async () => {
    setMsg('');
    try {
      const res = await regulatorAPI.registerActor({ ...form, actorType: tab });
      setMsg(res.data.message);
      setShowForm(false);
      setForm(f => ({ ...f, companyName: '', licenseNumber: '', address: '', city: '', state: '', contactPerson: '', contactEmail: '', contactPhone: '' }));
      loadActors(tab);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Registration failed.');
    }
  };

  const handleStatusChange = async (actorId, status) => {
    try {
      await regulatorAPI.updateActorStatus(actorId, { status });
      loadActors(tab);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed.');
    }
  };

  const tabs = [
    { key: 'manufacturer', label: '🏭 Manufacturers' },
    { key: 'middleman', label: '🚛 Middlemen' },
    { key: 'pharmacy', label: '💊 Pharmacies' }
  ];

  return (
    <div>
      <div className="page-header">
        <h1>🏢 Manage Actors</h1>
        <p>Register and manage manufacturers, middlemen, and pharmacies</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setTab(t.key); setShowForm(false); }}>
            {t.label}
          </button>
        ))}
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)} style={{ marginLeft: 'auto' }}>
          + Register New
        </button>
      </div>

      {msg && <div className="alert" style={{ padding: '0.75rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', marginBottom: '1rem' }}>{msg}</div>}

      {/* Registration Form */}
      {showForm && (
        <div className="card mb-2" style={{ animation: 'fadeIn 0.3s' }}>
          <div className="card-header"><h2>Register New {tab.charAt(0).toUpperCase() + tab.slice(1)}</h2></div>
          <div className="grid-2">
            <div className="form-group">
              <label>Company Name *</label>
              <input className="form-control" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>License Number *</label>
              <input className="form-control" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input className="form-control" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input className="form-control" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input className="form-control" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Contact Email *</label>
              <input className="form-control" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Contact Phone</label>
              <input className="form-control" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary mt-1" onClick={handleRegister}>Register & Create Account</button>
        </div>
      )}

      {/* Actor Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>{tab === 'manufacturer' ? 'City' : 'Type'}</th>
                <th>{tab === 'manufacturer' ? 'License' : 'City'}</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
              ) : actors.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No {tab}s registered yet.</td></tr>
              ) : actors.map((a, i) => (
                <tr key={i}>
                  <td><code>{a.manufacturer_id || a.actor_id}</code></td>
                  <td><strong>{a.company_name}</strong></td>
                  <td>{tab === 'manufacturer' ? a.city : a.actor_type}</td>
                  <td>{tab === 'manufacturer' ? a.license_number : a.city}</td>
                  <td>
                    <span className={`badge badge-${a.status === 'active' ? 'success' : 'danger'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.status === 'active' ? (
                      <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(a.manufacturer_id || a.actor_id, 'suspended')}>
                        ⛔ Suspend
                      </button>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(a.manufacturer_id || a.actor_id, 'active')}>
                        ✅ Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================================
// ALERTS
// ================================
function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    regulatorAPI.getAlerts(filter ? { status: filter } : {})
      .then(res => setAlerts(res.data.data?.alerts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const handleUpdate = async (alertId, status) => {
    try {
      await regulatorAPI.updateAlert(alertId, { status });
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, status } : a));
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <div className="page-header"><h1>🚨 Alerts</h1><p>Complaints from middlemen and system-detected anomalies</p></div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['', 'new', 'investigating', 'resolved'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setFilter(f); setLoading(true); }}>
            {f || 'All'}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="loading"><div className="spinner"></div></div> : (
          <div className="activity-feed">
            {alerts.map((a, i) => (
              <div className="activity-item" key={i} style={{ borderLeft: `3px solid ${a.severity === 'critical' ? 'var(--accent-red)' : a.severity === 'high' ? '#f59e0b' : 'var(--accent-blue)'}` }}>
                <div className="activity-content" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span className={`badge badge-${a.severity === 'critical' ? 'danger' : a.severity === 'high' ? 'warning' : 'info'}`}>
                        {a.severity?.toUpperCase()}
                      </span>
                      <span className={`badge badge-${a.status === 'new' ? 'danger' : a.status === 'investigating' ? 'warning' : 'success'}`} style={{ marginLeft: '0.25rem' }}>
                        {a.status}
                      </span>
                      <strong style={{ marginLeft: '0.5rem' }}>{a.alert_type?.replace(/_/g, ' ')}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {a.status === 'new' && <button className="btn btn-outline btn-sm" onClick={() => handleUpdate(a.alert_id, 'investigating')}>Investigate</button>}
                      {a.status !== 'resolved' && <button className="btn btn-outline btn-sm" onClick={() => handleUpdate(a.alert_id, 'resolved')}>Resolve</button>}
                    </div>
                  </div>
                  <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', lineHeight: 1.5 }}>{a.description}</p>
                  {a.actor && <div className="activity-meta">Reported by: <strong>{a.actor.company_name}</strong> ({a.actor.city})</div>}
                  {a.serial_number && <div className="activity-meta">Serial: <code>{a.serial_number}</code></div>}
                  <div className="activity-time">{new Date(a.alert_timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>No alerts found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ================================
// RECALLS
// ================================
function RecallsPage() {
  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ productId: '', batchNumber: '', reason: '' });
  const [blockMsg, setBlockMsg] = useState('');

  useEffect(() => {
    regulatorAPI.getRecalls()
      .then(res => setRecalls(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleBlock = async () => {
    setBlockMsg('');
    try {
      const res = await regulatorAPI.blockBatch(blockForm);
      setBlockMsg(res.data.message);
      setBlockForm({ productId: '', batchNumber: '', reason: '' });
    } catch (err) {
      setBlockMsg(err.response?.data?.message || 'Failed.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>⚠️ Recalls & Batch Blocking</h1>
        <p>Manage product recalls and block suspicious batches</p>
      </div>

      {/* Block Batch */}
      <div className="card mb-2">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>🚫 Block / Quarantine Batch</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setShowBlock(!showBlock)}>
            {showBlock ? 'Hide' : 'Block a Batch'}
          </button>
        </div>
        {showBlock && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div className="grid-2" style={{ marginTop: '0.5rem' }}>
              <div className="form-group">
                <label>Product ID</label>
                <input className="form-control" value={blockForm.productId}
                  onChange={e => setBlockForm(f => ({ ...f, productId: e.target.value }))} placeholder="e.g. PROD-ASP-500" />
              </div>
              <div className="form-group">
                <label>Batch Number</label>
                <input className="form-control" value={blockForm.batchNumber}
                  onChange={e => setBlockForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. BATCH-2026-001" />
              </div>
            </div>
            <div className="form-group">
              <label>Reason for Blocking</label>
              <textarea className="form-control" rows="2" value={blockForm.reason}
                onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Suspected contamination, counterfeit reports from multiple middlemen" />
            </div>
            <button className="btn btn-danger" onClick={handleBlock}
              disabled={!blockForm.productId || !blockForm.batchNumber || !blockForm.reason}>
              🚫 Block Entire Batch
            </button>
            {blockMsg && <p style={{ marginTop: '0.5rem', color: 'var(--accent-green)' }}>{blockMsg}</p>}
          </div>
        )}
      </div>

      {/* Recalls List */}
      <div className="card">
        <div className="card-header"><h2>📋 Active Recalls</h2></div>
        {loading ? <div className="loading"><div className="spinner"></div></div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Recall ID</th><th>Product</th><th>Batch</th><th>Reason</th><th>Severity</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recalls.map((r, i) => (
                  <tr key={i}>
                    <td><code>{r.recall_id}</code></td>
                    <td>{r.product?.product_name || r.product_id}</td>
                    <td>{Array.isArray(r.batch_numbers) ? r.batch_numbers.join(', ') : r.batch_numbers}</td>
                    <td style={{ maxWidth: 200, fontSize: '0.8rem' }}>{r.recall_reason}</td>
                    <td><span className={`badge badge-${r.severity === 'class_1' ? 'danger' : 'warning'}`}>{r.severity}</span></td>
                    <td><span className={`badge badge-${r.status === 'active' ? 'danger' : 'success'}`}>{r.status}</span></td>
                    <td>{new Date(r.recall_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {recalls.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No recalls.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================
// MAIN
// ================================
export default function RegulatoryDashboard({ user }) {
  return (
    <Routes>
      <Route index element={<DashOverview />} />
      <Route path="actors" element={<ManageActors />} />
      <Route path="alerts" element={<AlertsPage />} />
      <Route path="recalls" element={<RecallsPage />} />
    </Routes>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { middlemanAPI } from '../services/api';

// ================================
// OVERVIEW
// ================================
function Overview({ user }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      middlemanAPI.getInventory(),
      middlemanAPI.getHistory()
    ]).then(([inv, hist]) => {
      setData(inv.data.data);
      setHistory(hist.data.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Middleman Dashboard</h1>
        <p>Supply chain checkpoint — receive and verify medicine boxes</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📦</div>
          <div className="stat-info">
            <div className="stat-value">{data?.totalBoxes || 0}</div>
            <div className="stat-label">Boxes in Custody</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">💊</div>
          <div className="stat-info">
            <div className="stat-value">{data?.totalMedicines || 0}</div>
            <div className="stat-label">Total Medicines</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📥</div>
          <div className="stat-info">
            <div className="stat-value">{history.filter(t => t.transaction_type === 'receive').length}</div>
            <div className="stat-label">Boxes Received</div>
          </div>
        </div>
      </div>

      {/* Current Inventory */}
      {data?.boxes?.length > 0 && (
        <div className="card mt-2">
          <div className="card-header"><h2>📦 Boxes in Custody</h2></div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Box ID</th><th>Product</th><th>Manufacturer</th><th>Batch</th><th>Qty</th><th>Expiry</th></tr>
              </thead>
              <tbody>
                {data.boxes.map((b, i) => (
                  <tr key={i}>
                    <td><code>{b.boxId}</code></td>
                    <td><strong>{b.productName}</strong></td>
                    <td>{b.manufacturer}</td>
                    <td>{b.batchNumber}</td>
                    <td><span className="badge badge-info">{b.count}</span></td>
                    <td>{b.expiryDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card mt-2">
        <div className="card-header"><h2>📋 Recent Activity</h2></div>
        <div className="activity-feed">
          {history.slice(0, 10).map((t, i) => (
            <div className="activity-item" key={i}>
              <div className="activity-dot" style={{ background: t.transaction_type === 'receive' ? 'var(--accent-green)' : t.transaction_type === 'ship' ? 'var(--accent-blue)' : 'var(--accent-red)' }}></div>
              <div className="activity-content">
                <div className="activity-title">
                  {t.transaction_type === 'receive' ? '📥 Received' : t.transaction_type === 'ship' ? '📤 Shipped' : '🔍 ' + t.transaction_type}
                  {t.box_id && <code style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>{t.box_id}</code>}
                </div>
                <div className="activity-meta">
                  {t.from_actor_id && `From: ${t.from_actor_id}`} {t.to_actor_id && `→ ${t.to_actor_id}`}
                </div>
                <div className="activity-time">{new Date(t.transaction_date || t.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-muted" style={{ padding: '1rem' }}>No activity yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ================================
// RECEIVE BOX (with QR Scanner)
// ================================
function ReceiveBox({ user }) {
  const [boxInput, setBoxInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);

  const handleReceive = async (boxId) => {
    const id = boxId || boxInput;
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await middlemanAPI.receiveBox({ boxQRCode: id });
      setResult({ success: true, ...res.data });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to receive box.' });
    } finally {
      setLoading(false);
    }
  };

  // Camera QR scanner
  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('middleman-scanner-viewport');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Parse scanned data — could be JSON box QR or plain box ID
          let boxId = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.type === 'BOX' && parsed.boxId) {
              boxId = parsed.boxId;
            }
          } catch {}

          setBoxInput(boxId);
          handleReceive(boxId);
          scanner.stop().catch(console.error);
          setScannerActive(false);
        },
        () => {} // ignore scan failures
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(console.error);
      setScannerActive(false);
    }
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>📥 Receive Box</h1>
        <p>Scan a box QR code to receive it at your checkpoint</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>📷 Scan Box QR Code</h2>
            {scannerActive ? (
              <button className="btn btn-danger btn-sm" onClick={stopScanner}>⏹ Stop Camera</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={startScanner}>📷 Start Camera</button>
            )}
          </div>

          {/* Camera View */}
          <div className="scanner-container">
            <div id="middleman-scanner-viewport" className="scanner-viewport"
              style={{ display: scannerActive ? 'block' : 'none' }}></div>
            {!scannerActive && (
              <div className="scanner-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 200 }}
                onClick={startScanner}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem' }}>📷</div>
                  <p className="text-muted mt-1">Click to start camera scanner</p>
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>Point at the box QR code</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual input */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Or enter box ID manually
            </label>
            <div className="manual-input">
              <input className="form-control" value={boxInput}
                onChange={e => setBoxInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReceive()}
                placeholder="e.g. BOX-2026-0001" />
              <button className="btn btn-primary" onClick={() => handleReceive()} disabled={loading}>
                {loading ? '...' : '📥 Receive'}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div>
          {loading && <div className="loading"><div className="spinner"></div></div>}
          {result && !loading && (
            <div className={`verification-result ${result.success ? 'genuine' : 'fake'}`}>
              <div className="icon">{result.success ? '✅' : '❌'}</div>
              <h2>{result.success ? 'BOX RECEIVED' : 'ERROR'}</h2>
              <p>{result.message}</p>
              {result.data && (
                <div className="details">
                  <div className="detail-row"><span className="detail-label">Box ID</span><span className="detail-value">{result.data.boxId}</span></div>
                  <div className="detail-row"><span className="detail-label">Medicines</span><span className="detail-value">{result.data.medicineCount}</span></div>
                  <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{result.data.location}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================
// REPORT FAKE
// ================================
function ReportFake({ user }) {
  const [form, setForm] = useState({ boxId: '', serialNumber: '', description: '', severity: 'high' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    if (!form.description) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await middlemanAPI.reportFake(form);
      setResult({ success: true, ...res.data });
      setForm({ boxId: '', serialNumber: '', description: '', severity: 'high' });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Report failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🚨 Report Suspicious Medicine</h1>
        <p>Report a suspected counterfeit to the regulatory authority</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="form-group">
          <label>Box ID (optional)</label>
          <input className="form-control" value={form.boxId}
            onChange={e => setForm(f => ({ ...f, boxId: e.target.value }))}
            placeholder="e.g. BOX-2026-0001" />
        </div>
        <div className="form-group">
          <label>Serial Number (optional)</label>
          <input className="form-control" value={form.serialNumber}
            onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
            placeholder="e.g. 2026-PFZ-ASP-0000001" />
        </div>
        <div className="form-group">
          <label>Severity</label>
          <select className="form-control" value={form.severity}
            onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            <option value="low">Low — Minor packaging issue</option>
            <option value="medium">Medium — Suspicious irregularity</option>
            <option value="high">High — Likely counterfeit</option>
            <option value="critical">Critical — Confirmed counterfeit</option>
          </select>
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea className="form-control" rows="4" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe what looks suspicious — tampered seal, mismatched labels, unusual packaging, etc." />
        </div>

        <button className="btn btn-danger" onClick={handleReport} disabled={!form.description || loading}>
          🚨 Submit Report to Regulator
        </button>

        {result && (
          <div className={`verification-result ${result.success ? 'genuine' : 'fake'}`} style={{ marginTop: '1rem' }}>
            <div className="icon">{result.success ? '✅' : '❌'}</div>
            <h2>{result.success ? 'REPORT SUBMITTED' : 'ERROR'}</h2>
            <p>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================
// SEND BOX (scan to mark as shipped)
// ================================
function SendBox({ user }) {
  const [boxInput, setBoxInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);

  const handleSend = async (boxId) => {
    const id = boxId || boxInput;
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await middlemanAPI.shipBox({ boxId: id });
      setResult({ success: true, ...res.data });
      setBoxInput('');
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to ship box.' });
    } finally {
      setLoading(false);
    }
  };

  // Camera QR scanner
  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('send-scanner-viewport');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let boxId = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.type === 'BOX' && parsed.boxId) boxId = parsed.boxId;
          } catch {}
          setBoxInput(boxId);
          handleSend(boxId);
          scanner.stop().catch(console.error);
          setScannerActive(false);
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(console.error);
      setScannerActive(false);
    }
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>📤 Send Box</h1>
        <p>Scan a box QR code to mark it as shipped out from your checkpoint</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>📷 Scan Box QR Code</h2>
            {scannerActive ? (
              <button className="btn btn-danger btn-sm" onClick={stopScanner}>⏹ Stop Camera</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={startScanner}>📷 Start Camera</button>
            )}
          </div>

          {/* Camera View */}
          <div className="scanner-container">
            <div id="send-scanner-viewport" className="scanner-viewport"
              style={{ display: scannerActive ? 'block' : 'none' }}></div>
            {!scannerActive && (
              <div className="scanner-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 200 }}
                onClick={startScanner}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem' }}>📷</div>
                  <p className="text-muted mt-1">Click to start camera scanner</p>
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>Scan box QR to mark as shipped</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual input */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Or enter box ID manually
            </label>
            <div className="manual-input">
              <input className="form-control" value={boxInput}
                onChange={e => setBoxInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="e.g. BOX-2026-0001" />
              <button className="btn btn-primary" onClick={() => handleSend()} disabled={loading}>
                {loading ? '...' : '📤 Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div>
          {loading && <div className="loading"><div className="spinner"></div></div>}
          {result && !loading && (
            <div className={`verification-result ${result.success ? 'genuine' : 'fake'}`}>
              <div className="icon">{result.success ? '📤' : '❌'}</div>
              <h2>{result.success ? 'BOX SHIPPED' : 'ERROR'}</h2>
              <p>{result.message}</p>
              {result.data && (
                <div className="details">
                  <div className="detail-row"><span className="detail-label">Box ID</span><span className="detail-value">{result.data.boxId}</span></div>
                  <div className="detail-row"><span className="detail-label">Shipped From</span><span className="detail-value">{result.data.from}</span></div>
                  <div className="detail-row"><span className="detail-label">Medicines</span><span className="detail-value">{result.data.medicineCount}</span></div>
                  <div className="detail-row"><span className="detail-label">Hold Duration</span><span className="detail-value">{result.data.holdDuration}</span></div>
                  <div className="detail-row"><span className="detail-label">Shipped At</span><span className="detail-value">{new Date(result.data.shippedAt).toLocaleString()}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================
// MAIN DASHBOARD
// ================================
export default function MiddlemanDashboard({ user }) {
  return (
    <Routes>
      <Route index element={<Overview user={user} />} />
      <Route path="receive" element={<ReceiveBox user={user} />} />
      <Route path="send" element={<SendBox user={user} />} />
      <Route path="report" element={<ReportFake user={user} />} />
    </Routes>
  );
}

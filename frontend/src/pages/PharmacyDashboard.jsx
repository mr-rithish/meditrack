import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { pharmacyAPI, scannerAPI } from '../services/api';

function ScanAndVerify({ user }) {
  const [mode, setMode] = useState('verify'); // verify, dispense, receive
  const [serialInput, setSerialInput] = useState('');
  const [boxInput, setBoxInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [iotActive, setIotActive] = useState(false);
  const [iotScans, setIotScans] = useState([]);
  const pollingRef = useRef(null);
  const lastScanIdRef = useRef(0);

  const handleVerify = async (serial) => {
    const sn = serial || serialInput;
    if (!sn) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await pharmacyAPI.verifyMedicine({ scannedData: sn });
      setResult(res.data.data);
    } catch (err) {
      setResult({ valid: false, message: err.response?.data?.message || 'Verification failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async () => {
    if (!serialInput) return;
    setLoading(true);
    try {
      const res = await pharmacyAPI.dispenseMedicine({ scannedData: serialInput });
      setResult(res.data.data || res.data);
    } catch (err) {
      setResult({ valid: false, message: err.response?.data?.data?.message || err.response?.data?.message || 'Dispensing failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveBox = async (boxId) => {
    const id = boxId || boxInput;
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await pharmacyAPI.receiveBox({ boxQRCode: id });
      setResult({ valid: true, message: res.data.message, medicine: res.data.data });
    } catch (err) {
      setResult({ valid: false, message: err.response?.data?.message || 'Box receipt failed.' });
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // IoT SCANNER — WiFi-based polling
  // ESP32-CAM scans QR → sends to backend → we poll for results
  // =============================================
  const startIoTPolling = () => {
    setIotActive(true);
    lastScanIdRef.current = Date.now();

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scanner/recent?since=${lastScanIdRef.current}`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const newScans = data.data;
          setIotScans(prev => [...newScans, ...prev].slice(0, 20));
          // Show the latest scan result
          const latest = newScans[0];
          lastScanIdRef.current = new Date(latest.timestamp).getTime();
          if (latest.type === 'MEDICINE') {
            setSerialInput(latest.serialNumber || '');
            setResult({
              valid: latest.valid,
              message: latest.message,
              medicine: latest.medicine
            });
          }
        }
      } catch {}
    }, 2000);
  };

  const stopIoTPolling = () => {
    setIotActive(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => { stopIoTPolling(); };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Scan & Verify</h1>
        <p>Use the IoT scanner or enter serial numbers to verify medicines</p>
      </div>

      {/* IoT Scanner — WiFi Live Feed */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2>📡 IoT Scanner (ESP32-CAM)</h2>
          {!iotActive ? (
            <button className="btn btn-primary btn-sm" onClick={startIoTPolling}>
              📡 Start Live Feed
            </button>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={stopIoTPolling}>
              ⏹ Stop Feed
            </button>
          )}
        </div>
        <div style={{ padding: '1rem' }}>
          {!iotActive ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📡</div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>IoT Scanner feed is off</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Your ESP32-CAM scanner works over WiFi. Click "Start Live Feed" to see scan results here in real-time.
                <br />The scanner verifies medicines and controls Green/Red LEDs automatically.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }}></div>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem' }}>
                  Listening for scans...
                </span>
                <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
                  Polling every 2s
                </span>
              </div>
              {iotScans.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>
                  No scans yet. Point the ESP32-CAM at a medicine QR code.
                </p>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {iotScans.slice(0, 5).map((scan, i) => (
                    <div key={scan.id || i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{scan.valid ? '✅' : '❌'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{scan.serialNumber || scan.boxId || 'Unknown'}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{scan.message}</div>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {new Date(scan.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'verify', label: '🔍 Verify' },
          { key: 'dispense', label: '💊 Dispense' },
          { key: 'receive', label: '📦 Receive Box' }
        ].map(tab => (
          <button key={tab.key} className={`btn ${mode === tab.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setMode(tab.key); setResult(null); }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid-2">
        {/* Manual Input Section */}
        <div className="card">
          {mode === 'receive' ? (
            <div>
              <div className="card-header"><h2>📦 Receive Box</h2></div>
              <div className="form-group">
                <label>Enter Box ID</label>
                <div className="manual-input">
                  <input className="form-control" value={boxInput}
                    onChange={e => setBoxInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReceiveBox()}
                    placeholder="e.g. BOX-2026-0001" />
                  <button className="btn btn-primary" onClick={() => handleReceiveBox()} disabled={loading}>
                    {loading ? '...' : 'Receive'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="card-header"><h2>{mode === 'verify' ? '🔍 Verify Medicine' : '💊 Dispense Medicine'}</h2></div>
              <div className="form-group">
                <label>Enter serial number or scan with IoT scanner</label>
                <div className="manual-input">
                  <input className="form-control" value={serialInput}
                    onChange={e => setSerialInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (mode === 'verify' ? handleVerify() : handleDispense())}
                    placeholder="e.g. 2026-PFZ-ASP-0000001" />
                  <button className="btn btn-primary" onClick={() => mode === 'verify' ? handleVerify() : handleDispense()} disabled={loading}>
                    {loading ? '...' : mode === 'verify' ? 'Verify' : 'Dispense'}
                  </button>
                </div>
              </div>
              {iotActive && (
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  💡 IoT scanner is listening — scanned codes will auto-verify
                </p>
              )}
            </div>
          )}
        </div>

        {/* Result Section */}
        <div>
          {loading && <div className="loading"><div className="spinner"></div></div>}
          {result && !loading && (
            <div className={`verification-result ${result.valid ? 'genuine' : 'fake'}`}>
              <div className="icon">{result.valid ? '✅' : '❌'}</div>
              <h2>{result.valid ? 'GENUINE MEDICINE' : 'WARNING'}</h2>
              <p>{result.message}</p>

              {result.medicine && (
                <div className="details">
                  {Object.entries(result.medicine).filter(([k]) => k !== 'status').map(([key, value]) => (
                    value && (
                      <div className="detail-row" key={key}>
                        <span className="detail-label">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                        <span className="detail-value">{String(value)}</span>
                      </div>
                    )
                  ))}
                </div>
              )}

              {result.journey && result.journey.length > 0 && (
                <div className="mt-2">
                  <h3 style={{ marginBottom: '0.5rem' }}>📍 Journey Timeline</h3>
                  <div className="timeline">
                    {result.journey.map((step, i) => (
                      <div className="timeline-item" key={i}>
                        <div className="timeline-dot">{i + 1}</div>
                        <div className="timeline-content">
                          <div className="title">{step.type.toUpperCase()}</div>
                          <div className="subtitle">{step.from} → {step.to}</div>
                          <div className="date">{new Date(step.date).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispense button for verified medicines */}
              {result.valid && mode === 'verify' && (
                <button className="btn btn-success mt-2" onClick={() => { setMode('dispense'); handleDispense(); }}>
                  💊 Dispense This Medicine
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Inventory({ user }) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pharmacyAPI.getInventory()
      .then(res => setInventory(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header"><h1>📦 Inventory</h1><p>Current medicines in stock</p></div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">💊</div>
          <div className="stat-info">
            <div className="stat-value">{inventory?.totalMedicines || 0}</div>
            <div className="stat-label">Total In Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📋</div>
          <div className="stat-info">
            <div className="stat-value">{inventory?.inventory?.length || 0}</div>
            <div className="stat-label">Product Types</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Product</th><th>Manufacturer</th><th>Strength</th><th>Qty</th><th>Nearest Expiry</th><th>Batches</th></tr>
            </thead>
            <tbody>
              {inventory?.inventory?.map((item, i) => (
                <tr key={i}>
                  <td><strong>{item.productName}</strong></td>
                  <td>{item.manufacturer}</td>
                  <td>{item.strength}</td>
                  <td><span className="badge badge-info">{item.count}</span></td>
                  <td>{item.nearestExpiry}</td>
                  <td>{item.batchNumbers?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PharmacyDashboard({ user }) {
  return (
    <Routes>
      <Route index element={<PharmacyOverview user={user} />} />
      <Route path="scan" element={<ScanAndVerify user={user} />} />
      <Route path="inventory" element={<Inventory user={user} />} />
    </Routes>
  );
}

function PharmacyOverview({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalInStock: 0, productTypes: 0 });
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pharmacyAPI.getInventory()
      .then(res => {
        const inv = res.data.data;
        setInventory(inv);
        setStats({
          totalInStock: inv?.totalMedicines || 0,
          productTypes: inv?.inventory?.length || 0,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Pharmacy Dashboard</h1>
        <p>Overview of your pharmacy operations</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">💊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalInStock}</div>
            <div className="stat-label">Medicines in Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📋</div>
          <div className="stat-info">
            <div className="stat-value">{stats.productTypes}</div>
            <div className="stat-label">Product Types</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📷</div>
          <div className="stat-info">
            <div className="stat-value"><a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/scan'); }} style={{ color: 'inherit' }}>Open Scanner →</a></div>
            <div className="stat-label">Scan & Verify</div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {inventory?.inventory?.length > 0 && (
        <div className="card mt-2">
          <div className="card-header"><h2>📦 Current Stock</h2></div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Product</th><th>Manufacturer</th><th>Strength</th><th>Qty</th><th>Nearest Expiry</th><th>Batches</th></tr>
              </thead>
              <tbody>
                {inventory.inventory.map((item, i) => (
                  <tr key={i}>
                    <td><strong>{item.productName}</strong></td>
                    <td>{item.manufacturer}</td>
                    <td>{item.strength}</td>
                    <td><span className="badge badge-info">{item.count}</span></td>
                    <td>{item.nearestExpiry}</td>
                    <td>{item.batchNumbers?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

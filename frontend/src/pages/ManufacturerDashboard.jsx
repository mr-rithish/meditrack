import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { manufacturerAPI } from '../services/api';

// ================================
// OVERVIEW with expandable product details
// ================================
function Overview({ user }) {
  const [products, setProducts] = useState([]);
  const [boxCount, setBoxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    manufacturerAPI.getProducts()
      .then(res => {
        const prods = res.data.data || [];
        setProducts(prods);
        return Promise.all(prods.map(p => manufacturerAPI.getBatches(p.product_id).catch(() => ({ data: { data: [] } }))));
      })
      .then(batchResults => {
        const totalBoxes = batchResults.reduce((sum, r) => sum + (r.data.data?.length || 0), 0);
        setBoxCount(totalBoxes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSerials = products.reduce((sum, p) => sum + (p.totalSerials || 0), 0);

  const toggleProduct = async (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setBatches([]);
      return;
    }
    setExpandedProduct(productId);
    setBatchLoading(true);
    try {
      const res = await manufacturerAPI.getBatches(productId);
      setBatches(res.data.data || []);
    } catch {
      setBatches([]);
    } finally {
      setBatchLoading(false);
    }
  };

  const downloadPDF = async (batchNumber) => {
    try {
      const token = localStorage.getItem('meditrack_token');
      const response = await fetch(`/api/manufacturer/qrcodes/${batchNumber}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('PDF download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MediTrack-QR-${batchNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF download failed: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Manufacturer Dashboard</h1>
        <p>Welcome back, {user.fullName || user.username}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">💊</div>
          <div className="stat-info">
            <div className="stat-value">{products.length}</div>
            <div className="stat-label">Products Registered</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🔢</div>
          <div className="stat-info">
            <div className="stat-value">{totalSerials.toLocaleString()}</div>
            <div className="stat-label">Total Serial Numbers</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📦</div>
          <div className="stat-info">
            <div className="stat-value">{boxCount}</div>
            <div className="stat-label">Boxes Created</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <div className="card">
          <div className="card-header"><h2>💊 Your Products</h2></div>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 1rem' }}>Click on a product to view batches, boxes, and download QR code sheets</p>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th></th><th>Product ID</th><th>Name</th><th>Strength</th><th>Dosage</th><th>GTIN</th><th>Serials</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <>
                    <tr key={p.product_id} onClick={() => toggleProduct(p.product_id)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ width: 30 }}>{expandedProduct === p.product_id ? '▼' : '▶'}</td>
                      <td><code>{p.product_id}</code></td>
                      <td>
                        <strong>{p.product_name}</strong>
                        <br/><span className="text-muted" style={{ fontSize: '0.8rem' }}>{p.generic_name}</span>
                      </td>
                      <td>{p.strength}</td>
                      <td>{p.dosage_form}</td>
                      <td><code>{p.gtin}</code></td>
                      <td><span className="badge badge-info">{p.totalSerials}</span></td>
                    </tr>
                    {expandedProduct === p.product_id && (
                      <tr key={p.product_id + '-details'}>
                        <td colSpan="7" style={{ padding: 0, background: 'var(--bg-secondary)' }}>
                          <div style={{ padding: '1rem 1.5rem' }}>
                            {/* Product Metadata */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                              {[
                                ['Registration', p.registration_number || '—'],
                                ['Approved By', p.approved_by || '—'],
                                ['Packaging', p.packaging || '—'],
                                ['Created', p.created_at ? new Date(p.created_at).toLocaleDateString() : '—']
                              ].map(([label, value]) => (
                                <div key={label} style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                                  <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>{value}</div>
                                </div>
                              ))}
                            </div>

                            {/* Batches/Boxes Table */}
                            <h3 style={{ marginBottom: '0.75rem' }}>📦 Batches & Boxes</h3>
                            {batchLoading ? (
                              <div className="loading" style={{ minHeight: 60 }}><div className="spinner"></div></div>
                            ) : batches.length === 0 ? (
                              <p className="text-muted">No batches generated for this product yet.</p>
                            ) : (
                              <table>
                                <thead>
                                  <tr>
                                    <th>Box ID</th><th>Batch</th><th>Medicines</th><th>Status</th>
                                    <th>Mfg Date</th><th>Expiry</th><th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batches.map((b, i) => (
                                    <tr key={i}>
                                      <td><code style={{ fontSize: '0.75rem' }}>{b.box_id}</code></td>
                                      <td><code style={{ fontSize: '0.75rem' }}>{b.batch_number}</code></td>
                                      <td><span className="badge badge-info">{b.total_medicines}</span></td>
                                      <td>
                                        <span className={`badge badge-${b.status === 'manufactured' ? 'info' : b.status === 'flagged' ? 'danger' : 'success'}`}>
                                          {b.status}
                                        </span>
                                      </td>
                                      <td>{b.manufacturing_date}</td>
                                      <td>{b.expiry_date}</td>
                                      <td>
                                        <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); downloadPDF(b.batch_number); }}>
                                          📄 Download QR PDF
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================
// PRODUCT REGISTRATION
// ================================
function ProductRegistration() {
  const [form, setForm] = useState({
    productName: '', genericName: '', gtin: '', strength: '',
    dosageForm: 'Tablet', packaging: '', registrationNumber: '', approvedBy: 'CDSCO'
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await manufacturerAPI.registerProduct(form);
      setMessage({ type: 'success', text: `Product "${res.data.data.product_name}" registered!` });
      setForm({ productName: '', genericName: '', gtin: '', strength: '', dosageForm: 'Tablet', packaging: '', registrationNumber: '', approvedBy: 'CDSCO' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Registration failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Register Product</h1><p>Add a new medicine to the system</p></div>
      <div className="card" style={{ maxWidth: 700 }}>
        {message && <div className={`toast toast-${message.type === 'error' ? 'error' : 'success'}`} style={{ position: 'relative', marginBottom: '1rem' }}>{message.text}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Product Name *</label>
              <input className="form-control" required value={form.productName}
                onChange={e => setForm({...form, productName: e.target.value})} placeholder="e.g. Aspirin" />
            </div>
            <div className="form-group">
              <label>Generic Name</label>
              <input className="form-control" value={form.genericName}
                onChange={e => setForm({...form, genericName: e.target.value})} placeholder="e.g. Acetylsalicylic Acid" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>GTIN (14 digits) *</label>
              <input className="form-control" required maxLength={14} value={form.gtin}
                onChange={e => setForm({...form, gtin: e.target.value})} placeholder="05412345678900" />
            </div>
            <div className="form-group">
              <label>Strength</label>
              <input className="form-control" value={form.strength}
                onChange={e => setForm({...form, strength: e.target.value})} placeholder="e.g. 500mg" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Dosage Form</label>
              <select className="form-control" value={form.dosageForm}
                onChange={e => setForm({...form, dosageForm: e.target.value})}>
                <option>Tablet</option><option>Capsule</option><option>Syrup</option>
                <option>Injection</option><option>Cream</option><option>Drops</option>
              </select>
            </div>
            <div className="form-group">
              <label>Packaging</label>
              <input className="form-control" value={form.packaging}
                onChange={e => setForm({...form, packaging: e.target.value})} placeholder="e.g. 10 tablets per strip" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Registration Number</label>
              <input className="form-control" value={form.registrationNumber}
                onChange={e => setForm({...form, registrationNumber: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Approved By</label>
              <input className="form-control" value={form.approvedBy}
                onChange={e => setForm({...form, approvedBy: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : '💊 Register Product'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ================================
// SERIAL GENERATOR with PDF download
// ================================
function SerialGenerator() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    productId: '', batchNumber: '', quantity: 100, manufacturingDate: '', expiryDate: '', boxSize: 100
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    manufacturerAPI.getProducts()
      .then(res => setProducts(res.data.data || []))
      .catch(console.error);
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await manufacturerAPI.generateSerials(form);
      setResult(res.data);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Generation failed.' });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (batchNumber) => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('meditrack_token');
      const response = await fetch(`/api/manufacturer/qrcodes/${batchNumber}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('PDF download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MediTrack-QR-${batchNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF download failed: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Generate Serial Numbers</h1><p>Create unique serials with QR codes</p></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h2>Configuration</h2></div>
          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label>Product *</label>
              <select className="form-control" required value={form.productId}
                onChange={e => setForm({...form, productId: e.target.value})}>
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.strength})</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Batch Number *</label>
                <input className="form-control" required value={form.batchNumber}
                  onChange={e => setForm({...form, batchNumber: e.target.value})} placeholder="BATCH-2026-001" />
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input type="number" className="form-control" required min={1} max={10000}
                  value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value)})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Manufacturing Date *</label>
                <input type="date" className="form-control" required value={form.manufacturingDate}
                  onChange={e => setForm({...form, manufacturingDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Expiry Date *</label>
                <input type="date" className="form-control" required value={form.expiryDate}
                  onChange={e => setForm({...form, expiryDate: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Medicines per Box</label>
              <input type="number" className="form-control" min={1} max={500}
                value={form.boxSize} onChange={e => setForm({...form, boxSize: parseInt(e.target.value) || 100})} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : '🔢 Generate Serials'}
            </button>
          </form>
        </div>
        <div className="card">
          <div className="card-header"><h2>Result</h2></div>
          {result ? (
            result.success ? (
              <div>
                <p className="text-success" style={{ fontWeight: 600, marginBottom: '1rem' }}>✅ {result.message}</p>
                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat-card"><div className="stat-icon blue">🔢</div><div className="stat-info"><div className="stat-value">{result.data.totalSerials}</div><div className="stat-label">Serials</div></div></div>
                  <div className="stat-card"><div className="stat-icon green">📦</div><div className="stat-info"><div className="stat-value">{result.data.totalBoxes}</div><div className="stat-label">Boxes</div></div></div>
                </div>

                {/* Download PDF Button */}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}
                  onClick={() => downloadPDF(result.data.batchNumber)} disabled={pdfLoading}>
                  {pdfLoading ? '⏳ Generating PDF...' : '📄 Download All QR Codes as PDF'}
                </button>

                {/* Box QR Codes */}
                <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>📦 Box QR Codes</h3>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Print these and attach to each physical box</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {result.data.boxes?.map((box, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                      {box.boxQRImage && <img src={box.boxQRImage} alt={box.boxId} style={{ width: 150, height: 150, borderRadius: 4 }} />}
                      <div style={{ marginTop: '0.5rem' }}>
                        <code style={{ fontSize: '0.75rem' }}>{box.boxId}</code>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{box.totalMedicines} medicines</div>
                    </div>
                  ))}
                </div>

                {/* Sample Individual Serial QR Codes */}
                <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>🔢 Sample Medicine QR Codes</h3>
                {result.data.sampleSerials?.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    {s.qrCodeUrl && <img src={s.qrCodeUrl} alt="QR" style={{ width: 50, height: 50, borderRadius: 4 }} />}
                    <div>
                      <code style={{ fontSize: '0.8rem' }}>{s.serialNumber}</code>
                    </div>
                  </div>
                ))}
                {result.data.totalSerials > 5 && <p className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>...and {result.data.totalSerials - 5} more (download PDF for all)</p>}
              </div>
            ) : (
              <p className="text-danger">{result.message}</p>
            )
          ) : (
            <p className="text-muted">Configure and generate to see results here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================
// MAIN DASHBOARD
// ================================
export default function ManufacturerDashboard({ user }) {
  return (
    <Routes>
      <Route index element={<Overview user={user} />} />
      <Route path="products" element={<ProductRegistration />} />
      <Route path="generate" element={<SerialGenerator />} />
    </Routes>
  );
}

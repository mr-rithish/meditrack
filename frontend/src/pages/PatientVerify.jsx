import { useState, useRef, useEffect } from 'react';
import { patientAPI } from '../services/api';

export default function PatientVerify() {
  const [serialInput, setSerialInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const resultRef = useRef(null);

  // Load scan history from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('meditrack_scan_history') || '[]');
      setScanHistory(saved);
    } catch {}
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const saveScanHistory = (serial, isValid, productName) => {
    const entry = { serial, valid: isValid, product: productName, date: new Date().toISOString() };
    const updated = [entry, ...scanHistory].slice(0, 10);
    setScanHistory(updated);
    localStorage.setItem('meditrack_scan_history', JSON.stringify(updated));
  };

  // ==========================================
  // WEBCAM QR SCANNER
  // ==========================================
  const startScanner = async () => {
    setScannerError('');
    setScannerActive(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // Successfully scanned!
          handleScannedCode(decodedText);
          stopScanner();
        },
        () => {} // ignore scan failures (frames without QR)
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setScannerError(
        err.toString().includes('NotAllowedError')
          ? 'Camera access denied. Please allow camera permission.'
          : err.toString().includes('NotFoundError')
          ? 'No camera found. Use manual entry below.'
          : `Scanner error: ${err.message || err}`
      );
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
  };

  const handleScannedCode = (code) => {
    // The QR code might contain a full GS1 string or just the serial number
    // Try to extract serial from common formats
    let serial = code;

    // If it's a URL like meditrack.com/verify?serial=XXX
    if (code.includes('serial=')) {
      const match = code.match(/serial=([^&]+)/);
      if (match) serial = match[1];
    }

    // If it's GS1 format: (01)GTIN(21)SERIAL...
    if (code.includes('(21)')) {
      const match = code.match(/\(21\)([^(]+)/);
      if (match) serial = match[1];
    }

    setSerialInput(serial);
    handleVerify(serial);
  };

  // ==========================================
  // VERIFY
  // ==========================================
  const handleVerify = async (overrideSerial) => {
    const serial = overrideSerial || serialInput.trim();
    if (!serial) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await patientAPI.verifyMedicine({ serialNumber: serial });
      setResult(res.data.data);
      saveScanHistory(serial, res.data.data?.valid, res.data.data?.medicine?.product_name);
    } catch (err) {
      setResult({
        valid: false,
        reason: 'error',
        message: err.response?.data?.message || 'Verification failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  return (
    <div className="patient-page">
      <div className="patient-header">
        <h1>💊 MediTrack</h1>
        <p>Verify your medicine is genuine — scan QR code or enter serial number</p>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Scanner Card */}
        <div className="card">
          <div className="card-header">
            <h2>📷 Scan Medicine QR Code</h2>
            {scannerActive ? (
              <button className="btn btn-danger btn-sm" onClick={stopScanner}>⏹ Stop Camera</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={startScanner}>📷 Start Camera</button>
            )}
          </div>

          {/* Camera View */}
          <div className="scanner-container">
            <div
              id="qr-reader"
              ref={scannerRef}
              style={{
                width: '100%',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                display: scannerActive ? 'block' : 'none'
              }}
            ></div>

            {!scannerActive && !scannerError && (
              <div className="scanner-placeholder" onClick={startScanner}>
                <div className="scanner-placeholder-icon">📷</div>
                <p>Tap to open camera</p>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Point at the QR code on your medicine package
                </p>
              </div>
            )}

            {scannerError && (
              <div className="scanner-error">
                <div className="icon">⚠️</div>
                <p>{scannerError}</p>
                <button className="btn btn-outline btn-sm" onClick={startScanner} style={{ marginTop: '0.5rem' }}>
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Manual Entry */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Or enter serial number manually
            </label>
            <div className="manual-input">
              <input
                className="form-control"
                value={serialInput}
                onChange={e => setSerialInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="e.g. 2026-PFZ-ASP-0000001"
              />
              <button className="btn btn-primary" onClick={() => handleVerify()} disabled={loading || !serialInput.trim()}>
                {loading ? '⏳' : '🔍 Verify'}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div ref={resultRef} style={{ marginTop: '1.5rem', animation: 'fadeIn 0.4s ease' }}>
            <div className={`verification-result ${result.valid ? 'genuine' : 'fake'}`}>
              <div className="icon">{result.valid ? '✅' : '❌'}</div>
              <h2>{result.valid ? 'GENUINE MEDICINE' : 'WARNING'}</h2>
              <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>{result.message}</p>

              {/* Medicine Details */}
              {result.medicine && (
                <div className="details" style={{ marginTop: '1.5rem' }}>
                  {[
                    ['Product', result.medicine.product_name],
                    ['Generic Name', result.medicine.generic_name],
                    ['Manufacturer', result.medicine.manufacturer],
                    ['Strength', result.medicine.strength],
                    ['Batch', result.medicine.batch_number],
                    ['Manufactured', result.medicine.manufacturing_date],
                    ['Expiry', result.medicine.expiry_date],
                  ].map(([label, value]) => value && (
                    <div className="detail-row" key={label}>
                      <span className="detail-label">{label}</span>
                      <span className="detail-value">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supply Chain Journey Timeline */}
            {result.journey && result.journey.length > 0 && (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-header"><h2>🗺️ Supply Chain Journey</h2></div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  This medicine has passed through {result.journey.length} verified checkpoints
                </p>
                <div className="journey-timeline">
                  {result.journey.map((step, i) => (
                    <div
                      className="journey-step"
                      key={i}
                      style={{ animationDelay: `${i * 0.2}s` }}
                    >
                      <div className="journey-connector">
                        <div className={`journey-dot ${step.actorType}`}>{step.icon}</div>
                        {i < result.journey.length - 1 && <div className="journey-line"></div>}
                      </div>
                      <div className="journey-info">
                        <div className="journey-step-name">{step.step}</div>
                        <div className="journey-actor">{step.actor}</div>
                        {step.city && <div className="journey-city">📍 {step.city}</div>}
                        {step.date && (
                          <div className="journey-date">
                            {new Date(step.date).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </div>
                        )}
                        <div className="journey-verified">✓ Verified</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scan History */}
        {scanHistory.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h2>📋 Your Scan History</h2>
              <button className="btn btn-outline btn-sm" onClick={() => {
                setScanHistory([]);
                localStorage.removeItem('meditrack_scan_history');
              }}>Clear</button>
            </div>
            <div className="activity-feed">
              {scanHistory.map((h, i) => (
                <div className="activity-item" key={i} style={{ cursor: 'pointer' }}
                  onClick={() => { setSerialInput(h.serial); }}>
                  <div className="activity-dot" style={{ background: h.valid ? 'var(--accent-green)' : 'var(--accent-red)' }}></div>
                  <div className="activity-content">
                    <div className="activity-title">
                      <span className={`badge badge-${h.valid ? 'success' : 'danger'}`}>
                        {h.valid ? 'Genuine' : 'Flagged'}
                      </span>
                      <code style={{ marginLeft: '0.5rem' }}>{h.serial}</code>
                    </div>
                    {h.product && <div className="activity-meta">{h.product}</div>}
                    <div className="activity-time">{new Date(h.date).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2rem', paddingBottom: '1rem' }}>
          MediTrack Anti-Counterfeit Medicine Tracking System
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";

const SESSION = {
  requestId: "req_b3ebd9e9-abf5-4959-b249-a4563dfa5117",
  paymentUrl: "https://shop.credpay.xyz/session/sess_967e957a-3c6e-4975-a48c-ac4e5fb0cecb",
  maxAmount: "$66.22",
  currency: "USDC",
  expiresAt: "2026-03-10T06:34:36.208Z",
  product: { brand: "Zara", name: "Fashionably London EDP 100ml", price: "$59.90" },
};

function useCountdown(expiresAt) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      setSecs(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secs;
}

function fmtTime(s) {
  if (s === null) return "--:--";
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function Spinner({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: "cpspin 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.2" />
      <path d="M4 12a8 8 0 018-8" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function CredpayCheckout() {
  const [step, setStep] = useState("pay");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef(null);
  const secsLeft = useCountdown(SESSION.expiresAt);

  const pollStatus = async () => {
    try {
      const res = await fetch(
        `https://checkout-agent.credpay.xyz/v1/checkout/${SESSION.requestId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setError(null);
      setPollCount((c) => c + 1);
      if (["completed", "paid", "failed", "expired", "authorization_required"].includes(data.status)) {
        clearInterval(intervalRef.current);
      }
    } catch (err) {
      setError(err.message);
      setPollCount((c) => c + 1);
    }
  };

  const startTracking = () => {
    setStep("tracking");
    pollStatus();
    intervalRef.current = setInterval(pollStatus, 10000);
  };

  const resumeAfterAuth = () => {
    setStep("tracking");
    setStatus(null);
    setError(null);
    pollStatus();
    intervalRef.current = setInterval(pollStatus, 10000);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const isTerminal = status && ["completed", "paid", "failed", "expired"].includes(status.status);
  const isSuccess = status && ["completed", "paid"].includes(status.status);
  const isAuthRequired = status && status.status === "authorization_required";

  const phaseLabel = {
    completed: "Order placed!", paid: "Payment received!",
    pending: "Awaiting payment…", processing: "Processing order…",
    authorization_required: "Authorization needed",
    failed: "Payment failed", expired: "Session expired",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f7f7f7",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "'Figtree', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
        @keyframes cpspin { to { transform: rotate(360deg); } }
        @keyframes cpfade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 420,
        background: "#fff", borderRadius: 16,
        border: "1px solid #e8e8e8", overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid #f0f0f0",
        }}>
          <svg width="32" height="32" viewBox="0 0 2851 2851" fill="none" style={{ borderRadius: 6 }}>
            <rect width="2851" height="2851" fill="#FEFFFE"/>
            <path d="M2143 1100.41L2143 1771.33L1867.86 2052.87L1569.79 2052.87L1569.79 1751.46L1856.4 1751.46L1856.4 1100.41L2143 1100.41Z" fill="#0BD751"/>
            <path d="M710 1100.41L710 1771.33L985.14 2052.87L1283.21 2052.87L1283.21 1751.46L996.604 1751.46L996.604 1100.41L710 1100.41Z" fill="#0BD751"/>
            <path d="M1856.4 799.001L1856.4 1100.41L1283.2 1100.41L1283.2 799L1856.4 799.001Z" fill="#0BD751"/>
            <path d="M1283.2 799L1283.2 1100.41L996.604 1100.41L996.596 799.001L1283.2 799Z" fill="#0BD751"/>
          </svg>
          {step === "pay" && secsLeft !== null && secsLeft > 0 && (
            <span style={{
              fontSize: 13, fontFamily: "monospace", fontWeight: 500,
              color: secsLeft < 120 ? "#ef4444" : "rgba(10,39,64,0.4)",
            }}>
              ⏱ {fmtTime(secsLeft)} left
            </span>
          )}
          {secsLeft === 0 && step === "pay" && (
            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>Expired</span>
          )}
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Items */}
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "rgba(10,39,64,0.35)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
            }}>Items</p>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#0A2740" }}>
              <span style={{ color: "rgba(10,39,64,0.25)", marginTop: 1 }}>•</span>
              <div>
                <span style={{ fontWeight: 600 }}>{SESSION.product.name}</span>
                <span style={{ color: "rgba(10,39,64,0.4)", marginLeft: 6 }}>({SESSION.product.brand})</span>
              </div>
            </div>
          </div>

          {/* Max charge */}
          <div style={{
            borderRadius: 12, padding: "14px 16px",
            border: "1px solid rgba(11,215,81,0.35)", background: "rgba(11,215,81,0.04)",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0A2740", margin: 0 }}>
              Max charge: <span style={{ fontSize: 18 }}>{SESSION.maxAmount} {SESSION.currency}</span>
            </p>
            <p style={{ fontSize: 12, color: "rgba(10,39,64,0.5)", margin: "4px 0 0" }}>
              You won't be charged more than this amount.
            </p>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", alignItems: "center", fontSize: 11, fontWeight: 600 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                background: step === "pay" ? "#0A2740" : "#0BD751",
                color: step === "pay" ? "#fff" : "#0A2740", transition: "all 0.3s",
              }}>{step === "tracking" ? "✓" : "1"}</div>
              <span style={{ color: step === "pay" ? "#0A2740" : "rgba(10,39,64,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pay</span>
            </div>
            <div style={{ flex: 1, height: 1, margin: "0 12px", background: step === "tracking" ? "linear-gradient(90deg, #0BD751, #0A2740)" : "#e8e8e8", transition: "all 0.5s" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                background: step === "tracking" ? "#0A2740" : "#f0f0f0",
                color: step === "tracking" ? "#fff" : "#ccc", transition: "all 0.3s",
              }}>2</div>
              <span style={{ color: step === "tracking" ? "#0A2740" : "rgba(10,39,64,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Confirm</span>
            </div>
          </div>

          {/* Pay step */}
          {step === "pay" && (
            <div style={{ animation: "cpfade 0.3s ease-out" }}>
              <a href={SESSION.paymentUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, width: "100%", padding: "13px 20px",
                  background: "#0A2740", color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none",
                  transition: "all 0.15s", boxSizing: "border-box",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#0d3358"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#0A2740"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Pay on Credpay
              </a>
              <p style={{ textAlign: "center", fontSize: 11, color: "rgba(10,39,64,0.3)", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(10,39,64,0.3)" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Redirects to shop.credpay.xyz
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                <span style={{ fontSize: 11, color: "rgba(10,39,64,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>then</span>
                <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
              </div>
              <button onClick={startTracking}
                style={{
                  width: "100%", padding: "13px 20px", background: "#0BD751", color: "#0A2740",
                  border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.target.style.background = "#09c248"; }}
                onMouseLeave={(e) => { e.target.style.background = "#0BD751"; }}
              >
                I've Paid — Track Order
              </button>
            </div>
          )}

          {/* Tracking step */}
          {step === "tracking" && (
            <div style={{ animation: "cpfade 0.3s ease-out" }}>

              {/* Authorization required */}
              {isAuthRequired && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ borderRadius: 12, padding: "16px", border: "1px solid #fed7aa", background: "#fff7ed" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9a3412", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Payment breakdown</p>
                    {status.actualGoodsTotal && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#7c2d12", marginBottom: 6 }}>
                        <span>Goods</span><span>{status.actualGoodsTotal}</span>
                      </div>
                    )}
                    {status.actualShipping && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#7c2d12", marginBottom: 6 }}>
                        <span>Shipping</span><span>{status.actualShipping}</span>
                      </div>
                    )}
                    {status.actualCartTotal && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#7c2d12", borderTop: "1px solid #fed7aa", paddingTop: 8, marginTop: 4 }}>
                        <span>Order total</span><span>{status.actualCartTotal}</span>
                      </div>
                    )}
                    {status.extraOwed && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: "#9a3412", borderTop: "1px solid #fed7aa", paddingTop: 8, marginTop: 8 }}>
                        <span>Still owed</span><span>{status.extraOwed}</span>
                      </div>
                    )}
                  </div>
                  <a href={SESSION.paymentUrl} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, width: "100%", padding: "13px 20px", marginTop: 12,
                      background: "#0A2740", color: "#fff", border: "none", borderRadius: 12,
                      fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none",
                      transition: "all 0.15s", boxSizing: "border-box",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#0d3358"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#0A2740"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Authorize {status.extraOwed || "Additional Payment"} on Credpay
                  </a>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                    <span style={{ fontSize: 11, color: "rgba(10,39,64,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>then</span>
                    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                  </div>
                  <button onClick={resumeAfterAuth}
                    style={{ width: "100%", padding: "13px 20px", background: "#0BD751", color: "#0A2740", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.target.style.background = "#09c248"; }}
                    onMouseLeave={(e) => { e.target.style.background = "#0BD751"; }}
                  >
                    I've Authorized — Check Status
                  </button>
                </div>
              )}

              {/* Normal polling */}
              {!isAuthRequired && (
                <div style={{
                  borderRadius: 12, padding: "18px",
                  border: `1px solid ${isTerminal ? (isSuccess ? "rgba(11,215,81,0.4)" : "#fecaca") : "#f0f0f0"}`,
                  background: isTerminal ? (isSuccess ? "rgba(11,215,81,0.04)" : "#fef2f2") : "#fafafa",
                  transition: "all 0.4s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {!isTerminal && <Spinner size={18} color="#0A2740" />}
                      {isTerminal && isSuccess && (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0BD751", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0A2740", fontWeight: 800 }}>✓</div>
                      )}
                      {isTerminal && !isSuccess && (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 800 }}>✕</div>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0A2740" }}>
                        {status ? (phaseLabel[status.status] || status.status) : "Checking…"}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(10,39,64,0.25)", fontFamily: "monospace" }}>#{pollCount}</span>
                  </div>
                  {error && (
                    <div style={{ fontSize: 12, color: "#ef4444", background: "#fef2f2", borderRadius: 8, padding: "10px 12px", border: "1px solid #fecaca", marginBottom: 12 }}>{error}</div>
                  )}
                  {status && (
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #f0f0f0", overflow: "hidden" }}>
                      <div style={{ padding: "7px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 10, color: "rgba(10,39,64,0.3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" }}>Response</div>
                      <pre style={{ margin: 0, padding: "12px", fontSize: 11, color: "rgba(10,39,64,0.5)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 150, overflow: "auto", lineHeight: 1.7 }}>
                        {JSON.stringify(status, null, 2)}
                      </pre>
                    </div>
                  )}
                  {!isTerminal && (
                    <p style={{ marginTop: 12, fontSize: 12, color: "rgba(10,39,64,0.4)", textAlign: "center" }}>
                      Keep this page open — polling every 10s.
                    </p>
                  )}
                </div>
              )}

              {isTerminal && !isSuccess && (
                <button onClick={() => { setStep("pay"); setStatus(null); setError(null); setPollCount(0); }}
                  style={{ width: "100%", marginTop: 12, padding: "12px", background: "transparent", border: "1px solid #e8e8e8", borderRadius: 12, color: "rgba(10,39,64,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >← Try Again</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

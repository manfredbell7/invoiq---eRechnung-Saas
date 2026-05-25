import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════
   invoiq — White & Dark Blue Design System
   Palette: #FFFFFF · #08122A · #0E1E42 · #1A3A7C · #F4F6FA · #E8ECF5
   Fonts: Fraunces (serif display) + Plus Jakarta Sans (UI)
   Aesthetic: European precision banking meets modern SaaS
   ═══════════════════════════════════════════════════════════════════ */

const C = {
  // Core
  white:      "#FFFFFF",
  navy:       "#08122A",
  navyMid:    "#0E1E42",
  navyLight:  "#1A3A7C",
  navyPale:   "#2B4FA0",

  // Surface
  bg:         "#FFFFFF",
  bgAlt:      "#F4F6FA",
  bgDeep:     "#EBEEf5",
  surface:    "#FFFFFF",
  surfaceAlt: "#F8F9FC",

  // Text
  text:       "#08122A",
  textMid:    "#2C3E6B",
  textMuted:  "#6B7FA8",
  textLight:  "#9AAAC8",

  // Borders
  border:     "#DDE3F0",
  borderMid:  "#C8D0E8",
  borderNav:  "#EBEEf5",

  // Accent (navy-based)
  accent:     "#1A3A7C",
  accentHover:"#0E2860",
  accentLight:"#EBF0FB",
  accentPale: "#F0F4FF",

  // Semantic
  green:      "#0A6640",
  greenBg:    "#EDFAF3",
  red:        "#B91C1C",
  redBg:      "#FEF2F2",
  amber:      "#92400E",
  amberBg:    "#FFFBEB",
  blue:       "#1D4ED8",
  blueBg:     "#EFF6FF",
};

// ── TYPOGRAPHY ─────────────────────────────────────────────────
const F = {
  display: "'Fraunces', Georgia, serif",
  ui:      "'Plus Jakarta Sans', system-ui, sans-serif",
};

/* ── WORDMARK ──────────────────────────────────────────────────── */
function Wordmark({ size = 30, inverted = false }) {
  const text  = inverted ? C.white    : C.navy;
  const dot   = inverted ? "#93C5FD"  : C.navyLight;
  const bg    = inverted ? "rgba(255,255,255,0.15)" : C.accentLight;
  const bdr   = inverted ? "rgba(255,255,255,0.3)"  : C.borderMid;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
      {/* Icon: navy square with "iq" */}
      <div style={{
        width: size,
        height: size,
        background: inverted ? "rgba(255,255,255,0.18)" : C.navy,
        border: `1.5px solid ${inverted ? "rgba(255,255,255,0.35)" : C.navy}`,
        borderRadius: Math.round(size * 0.25),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 20 20" fill="none">
          {/* i */}
          <rect x="2" y="8" width="3.5" height="10" rx="1.75" fill={inverted ? C.navy : C.white} />
          <rect x="2" y="2" width="3.5" height="4" rx="1.75" fill={inverted ? "#93C5FD" : "#93C5FD"} />
          {/* q */}
          <circle cx="13.5" cy="12" r="4.5" stroke={inverted ? C.navy : C.white} strokeWidth="2.2" fill="none" />
          <rect x="15.8" y="7" width="2.5" height="11" rx="1.25" fill={inverted ? C.navy : C.white} />
        </svg>
      </div>

      {/* Text */}
      <div style={{ lineHeight: 1, display: "flex", alignItems: "baseline", gap: 0 }}>
        <span style={{ fontFamily: F.display, fontSize: size * 0.9, fontWeight: 600, color: text, letterSpacing: "-0.03em" }}>inv</span>
        <span style={{ fontFamily: F.display, fontSize: size * 0.9, fontWeight: 600, color: inverted ? "#93C5FD" : C.navyLight, letterSpacing: "-0.03em" }}>o</span>
        <span style={{ fontFamily: F.display, fontSize: size * 0.9, fontWeight: 600, color: text, letterSpacing: "-0.03em" }}>iq</span>
      </div>
    </div>
  );
}

/* ── GLOBAL CSS ────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: ${F.ui}; background: ${C.bg}; color: ${C.text}; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: ${C.bgAlt}; }
::-webkit-scrollbar-thumb { background: ${C.borderMid}; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: ${C.textLight}; }

@keyframes fadeUp   { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes spin     { to { transform: rotate(360deg) } }
@keyframes slideRight { from { transform:translateX(-20px); opacity:0 } to { transform:translateX(0); opacity:1 } }
@keyframes scaleIn  { from { transform:scale(0.96); opacity:0 } to { transform:scale(1); opacity:1 } }
@keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }

.fu   { animation: fadeUp    0.55s cubic-bezier(.22,1,.36,1) both; }
.fu2  { animation: fadeUp    0.55s .1s  cubic-bezier(.22,1,.36,1) both; }
.fu3  { animation: fadeUp    0.55s .2s  cubic-bezier(.22,1,.36,1) both; }
.fu4  { animation: fadeUp    0.55s .3s  cubic-bezier(.22,1,.36,1) both; }
.fu5  { animation: fadeUp    0.55s .4s  cubic-bezier(.22,1,.36,1) both; }
.fi   { animation: fadeIn    0.4s ease both; }
.si   { animation: slideRight 0.4s cubic-bezier(.22,1,.36,1) both; }
.sci  { animation: scaleIn   0.35s cubic-bezier(.22,1,.36,1) both; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: ${F.ui}; font-weight: 600; cursor: pointer;
  border-radius: 10px; transition: all 0.18s cubic-bezier(.22,1,.36,1);
  white-space: nowrap; text-decoration: none; border: none;
}
.btn-navy {
  background: ${C.navy}; color: ${C.white};
  padding: 13px 28px; font-size: 15px;
  box-shadow: 0 1px 3px rgba(8,18,42,0.2), 0 4px 16px rgba(8,18,42,0.12);
}
.btn-navy:hover { background: ${C.navyMid}; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(8,18,42,0.25); }

.btn-white {
  background: ${C.white}; color: ${C.navy};
  padding: 13px 28px; font-size: 15px;
  box-shadow: 0 1px 3px rgba(8,18,42,0.08);
  border: 1.5px solid ${C.border};
}
.btn-white:hover { border-color: ${C.borderMid}; background: ${C.bgAlt}; transform: translateY(-1px); }

.btn-outline {
  background: transparent; color: ${C.navyLight};
  border: 1.5px solid ${C.border};
  padding: 8px 18px; font-size: 13px;
}
.btn-outline:hover { border-color: ${C.navyLight}; background: ${C.accentLight}; }

.btn-ghost {
  background: transparent; color: ${C.textMuted};
  border: 1.5px solid ${C.border};
  padding: 8px 16px; font-size: 13px;
}
.btn-ghost:hover { color: ${C.text}; border-color: ${C.borderMid}; background: ${C.bgAlt}; }

.btn-danger {
  background: ${C.redBg}; color: ${C.red};
  border: 1px solid rgba(185,28,28,0.2);
  padding: 8px 16px; font-size: 13px;
}
.btn-danger:hover { background: #fee2e2; }

/* ── FORMS ── */
.input {
  width: 100%;
  background: ${C.bg};
  border: 1.5px solid ${C.border};
  border-radius: 10px;
  padding: 11px 14px;
  font-family: ${F.ui}; font-size: 14px;
  color: ${C.text};
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus { border-color: ${C.navyLight}; box-shadow: 0 0 0 3px ${C.accentPale}; }
.input::placeholder { color: ${C.textLight}; }

.select {
  width: 100%;
  background: ${C.bg};
  border: 1.5px solid ${C.border};
  border-radius: 10px;
  padding: 11px 14px;
  font-family: ${F.ui}; font-size: 14px;
  color: ${C.text};
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.select:focus { border-color: ${C.navyLight}; }

.label { display: block; font-size: 11px; font-weight: 700; color: ${C.textMuted}; letter-spacing: 0.7px; text-transform: uppercase; margin-bottom: 7px; }

/* ── CARDS ── */
.card {
  background: ${C.white};
  border: 1px solid ${C.border};
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 1px 4px rgba(8,18,42,0.04);
}
.card-sm {
  background: ${C.white};
  border: 1px solid ${C.border};
  border-radius: 12px;
  padding: 20px;
}

/* ── NAV ── */
.nav-link {
  display: flex; align-items: center; gap: 11px;
  padding: 9px 20px;
  font-family: ${F.ui}; font-size: 14px; font-weight: 500;
  color: ${C.textMuted};
  border: none; background: transparent; cursor: pointer;
  width: 100%; text-align: left;
  border-left: 2.5px solid transparent;
  transition: all 0.14s;
}
.nav-link:hover { color: ${C.text}; background: ${C.bgAlt}; }
.nav-link.active { color: ${C.navy}; background: ${C.accentPale}; border-left-color: ${C.navy}; font-weight: 700; }

/* ── TABLE ── */
.tr-hover:hover { background: ${C.bgAlt} !important; }

/* ── MISC ── */
.divider { height: 1px; background: ${C.border}; margin: 20px 0; }

.chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: ${C.accentPale}; color: ${C.navyLight};
  border: 1px solid ${C.accentLight};
  border-radius: 20px;
  padding: 4px 12px; font-size: 12px; font-weight: 600;
}

.chip-green { background: ${C.greenBg}; color: ${C.green}; border-color: #BBF7D0; }
.chip-red   { background: ${C.redBg};   color: ${C.red};   border-color: #FECACA; }
.chip-amber { background: ${C.amberBg}; color: ${C.amber}; border-color: #FDE68A; }
`;

/* ── STATUS BADGE ──────────────────────────────────────────── */
const STATUS_MAP = {
  delivered: { cls: "chip-green",  label: "Zugestellt" },
  validated: { cls: "chip",        label: "Validiert"  },
  sent:      { cls: "chip",        label: "Versendet"  },
  draft:     { cls: "chip-amber",  label: "Entwurf"    },
  archived:  { cls: "chip",        label: "Archiviert" },
  error:     { cls: "chip-red",    label: "Fehler"     },
  pending:   { cls: "chip-amber",  label: "Ausstehend" },
};
function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

function Spinner({ size = 16, color = C.navy }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:`2px solid ${color}20`, borderTopColor:color, borderRadius:"50%", animation:"spin 0.6s linear infinite", flexShrink:0 }} />;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const styles = {
    success: { bg: C.greenBg, border: "#86EFAC", color: C.green, icon: "✓" },
    error:   { bg: C.redBg,   border: "#FECACA", color: C.red,   icon: "✗" },
    info:    { bg: C.blueBg,  border: "#BFDBFE", color: C.blue,  icon: "i" },
  };
  const s = styles[type] || styles.info;
  return (
    <div onClick={onClose} style={{ position:"fixed", bottom:28, right:28, zIndex:9999, background:s.bg, border:`1.5px solid ${s.border}`, color:s.color, borderRadius:14, padding:"14px 20px", fontSize:14, fontWeight:600, maxWidth:380, boxShadow:"0 8px 32px rgba(8,18,42,0.15)", cursor:"pointer", display:"flex", alignItems:"center", gap:10, fontFamily:F.ui }}>
      <span style={{ width:22, height:22, borderRadius:"50%", background:s.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{s.icon}</span>
      {msg}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */
function Landing({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);

  const features = [
    { icon: "⚡", title: "XRechnung & ZUGFeRD", desc: "Automatische EN 16931-konforme Generierung — ohne manuellen Aufwand." },
    { icon: "🔗", title: "Jedes ERP-System", desc: "SAP, DATEV, Lexware, Dynamics oder REST API. In Minuten verbunden." },
    { icon: "🔒", title: "GoBD-Archivierung", desc: "SHA-256, unveränderlich, 10 Jahre. AWS Frankfurt. Audit-Trail für alles." },
    { icon: "🌍", title: "Peppol & EU", desc: "Europäisches Peppol-Netzwerk. Bereit für ViDA und internationale Mandate." },
    { icon: "🏷", title: "White-Label", desc: "SAP-Beratungshäuser deployen invoiq unter eigenem Brand. Eigene Domain." },
    { icon: "📊", title: "Compliance Dashboard", desc: "EN 16931-Score, Fehler, Archivstatus — alles in Echtzeit überwacht." },
  ];

  const plans = [
    { name: "Starter", price: "49", docs: "100 Dok./Monat", features: ["XRechnung + ZUGFeRD", "E-Mail-Versand", "GoBD-Archiv", "1 Nutzer"], cta: "Kostenlos testen" },
    { name: "Business", price: "199", docs: "1.000 Dok./Monat", features: ["+ Peppol BIS 3.0", "+ Inbound-Empfang", "+ 5 ERP-Konnektoren", "5 Nutzer"], cta: "Jetzt starten", highlight: true },
    { name: "Pro", price: "599", docs: "10.000 Dok./Monat", features: ["+ Alle Konnektoren", "+ Public REST API", "+ Webhooks", "15 Nutzer"], cta: "Demo buchen" },
  ];

  return (
    <div style={{ background: C.white, minHeight: "100vh", overflowX: "hidden" }}>

      {/* NAV */}
      <header style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:64, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 48px", background: scrolled ? "rgba(255,255,255,0.95)" : C.white, borderBottom:`1px solid ${scrolled ? C.border : "transparent"}`, backdropFilter: scrolled ? "blur(12px)" : "none", transition:"all 0.3s" }}>
        <Wordmark size={26} />
        <nav style={{ display:"flex", gap:36, alignItems:"center" }}>
          {["Funktionen","Preise","Konnektoren"].map(l => (
            <button key={l} style={{ background:"none", border:"none", color:C.textMuted, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:F.ui }} onMouseEnter={e=>e.target.style.color=C.navy} onMouseLeave={e=>e.target.style.color=C.textMuted}>{l}</button>
          ))}
        </nav>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-white" style={{ padding:"9px 20px", fontSize:13 }} onClick={onEnter}>Anmelden</button>
          <button className="btn btn-navy" style={{ padding:"9px 22px", fontSize:13 }} onClick={onEnter}>Kostenlos starten →</button>
        </div>
      </header>

      {/* HERO */}
      <section style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"120px 48px 80px", position:"relative", overflow:"hidden" }}>
        {/* Navy accent block top-right */}
        <div style={{ position:"absolute", top:0, right:0, width:"40%", height:"70%", background:`linear-gradient(225deg, ${C.navyMid} 0%, ${C.navy} 100%)`, borderRadius:"0 0 0 120px", opacity:0.07, pointerEvents:"none" }} />
        {/* Dot pattern */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.025, pointerEvents:"none" }}>
          <defs><pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.5" fill={C.navy} /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        <div style={{ maxWidth:860, width:"100%", textAlign:"center", position:"relative" }}>
          {/* Badge */}
          <div className="fu chip" style={{ marginBottom:32, fontSize:12 }}>
            🇩🇪 E-Rechnungspflicht 2027 · EN 16931 · GoBD · Peppol
          </div>

          {/* H1 */}
          <h1 className="fu2" style={{ fontFamily:F.display, fontSize:"clamp(44px,6.5vw,82px)", fontWeight:400, color:C.navy, lineHeight:1.06, letterSpacing:"-0.03em", marginBottom:28 }}>
            E-Rechnung für<br />
            <span style={{ fontStyle:"italic", color:C.navyLight }}>jedes</span> System.
          </h1>

          <p className="fu3" style={{ fontSize:"clamp(16px,1.8vw,19px)", color:C.textMuted, maxWidth:520, margin:"0 auto 48px", lineHeight:1.75, fontWeight:400 }}>
            XRechnung · ZUGFeRD · Peppol — in 48 Stunden live.<br />
            SAP, DATEV, Lexware oder jedes andere ERP-System.
          </p>

          <div className="fu4" style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:72 }}>
            <button className="btn btn-navy" style={{ fontSize:16, padding:"15px 40px" }} onClick={onEnter}>Kostenlos starten →</button>
            <button className="btn btn-white" style={{ fontSize:16, padding:"15px 32px" }} onClick={onEnter}>Demo ansehen</button>
          </div>

          {/* Stats */}
          <div className="fu5" style={{ display:"flex", gap:0, justifyContent:"center", flexWrap:"wrap", border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden", background:C.white, boxShadow:"0 2px 12px rgba(8,18,42,0.06)" }}>
            {[["48h","bis Go-Live"],["100%","EN 16931 konform"],["GoBD","Archivierung"],["10+","ERP-Systeme"]].map(([v,l], i, arr) => (
              <div key={v} style={{ padding:"24px 40px", textAlign:"center", borderRight: i < arr.length-1 ? `1px solid ${C.border}` : "none", flex:1, minWidth:120 }}>
                <div style={{ fontFamily:F.display, fontSize:28, fontWeight:600, color:C.navy, lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:12, color:C.textMuted, marginTop:5, fontWeight:500, letterSpacing:0.3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding:"96px 48px", background:C.bgAlt }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <div className="chip" style={{ marginBottom:18, fontSize:11, letterSpacing:0.8, textTransform:"uppercase" }}>Funktionen</div>
            <h2 style={{ fontFamily:F.display, fontSize:"clamp(32px,4vw,52px)", color:C.navy, fontWeight:400, letterSpacing:"-0.025em", lineHeight:1.15 }}>
              Alles was Sie brauchen.<br />
              <span style={{ fontStyle:"italic" }}>Nichts was Sie nicht brauchen.</span>
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:16 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ transition:"border-color 0.18s, transform 0.18s, box-shadow 0.18s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.navyLight; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(8,18,42,0.1)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 1px 4px rgba(8,18,42,0.04)"; }}>
                <div style={{ width:44, height:44, borderRadius:12, background:C.accentPale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:16 }}>{f.icon}</div>
                <div style={{ fontWeight:700, color:C.navy, fontSize:16, marginBottom:8, fontFamily:F.ui }}>{f.title}</div>
                <div style={{ fontSize:14, color:C.textMuted, lineHeight:1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding:"96px 48px" }}>
        <div style={{ maxWidth:1040, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <div className="chip" style={{ marginBottom:18, fontSize:11, letterSpacing:0.8, textTransform:"uppercase" }}>Preise</div>
            <h2 style={{ fontFamily:F.display, fontSize:"clamp(32px,4vw,52px)", color:C.navy, fontWeight:400, letterSpacing:"-0.025em" }}>
              Transparent.<br /><span style={{ fontStyle:"italic" }}>Kein usage-based Billing.</span>
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
            {plans.map((p, i) => (
              <div key={i} style={{ background: p.highlight ? C.navy : C.white, border:`1.5px solid ${p.highlight ? C.navy : C.border}`, borderRadius:20, padding:"32px 28px", position:"relative", transition:"transform 0.2s, box-shadow 0.2s", boxShadow: p.highlight ? "0 12px 40px rgba(8,18,42,0.2)" : "0 1px 4px rgba(8,18,42,0.04)" }}
                onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow = p.highlight ? "0 20px 56px rgba(8,18,42,0.3)" : "0 8px 28px rgba(8,18,42,0.1)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow = p.highlight ? "0 12px 40px rgba(8,18,42,0.2)" : "0 1px 4px rgba(8,18,42,0.04)"; }}>
                {p.highlight && <div style={{ position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)", background:C.navyLight, color:C.white, fontSize:11, fontWeight:800, padding:"4px 16px", borderRadius:20, letterSpacing:0.5, whiteSpace:"nowrap" }}>EMPFOHLEN</div>}
                <div style={{ fontWeight:700, fontSize:15, color: p.highlight ? "rgba(255,255,255,0.7)" : C.textMuted, marginBottom:16 }}>{p.name}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:6 }}>
                  <span style={{ fontFamily:F.display, fontSize:54, color: p.highlight ? C.white : C.navy, lineHeight:1, fontWeight:500 }}>{p.price}</span>
                  <span style={{ color: p.highlight ? "rgba(255,255,255,0.5)" : C.textLight, fontSize:15 }}>€/Monat</span>
                </div>
                <div style={{ fontSize:13, color: p.highlight ? "rgba(255,255,255,0.5)" : C.textMuted, marginBottom:24 }}>{p.docs}</div>
                <div style={{ height:1, background: p.highlight ? "rgba(255,255,255,0.12)" : C.border, margin:"0 0 24px" }} />
                {p.features.map((f,j) => (
                  <div key={j} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10, fontSize:14, color: j===0 ? (p.highlight ? C.white : C.navy) : (p.highlight ? "rgba(255,255,255,0.65)" : C.textMuted) }}>
                    <span style={{ color: p.highlight ? "rgba(255,255,255,0.5)" : C.navyLight, flexShrink:0, marginTop:1, fontSize:13 }}>✓</span>{f}
                  </div>
                ))}
                <button className={`btn ${p.highlight ? "btn-white" : "btn-navy"}`} style={{ width:"100%", justifyContent:"center", marginTop:28 }} onClick={onEnter}>{p.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NAVY CTA BAND */}
      <section style={{ background:C.navy, padding:"72px 48px", textAlign:"center" }}>
        <div className="chip" style={{ background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", borderColor:"rgba(255,255,255,0.15)", marginBottom:20 }}>E-Rechnungspflicht 2027</div>
        <h2 style={{ fontFamily:F.display, fontSize:"clamp(28px,4vw,48px)", color:C.white, fontWeight:400, letterSpacing:"-0.025em", marginBottom:14 }}>
          Bereit vor dem Stichtag.
        </h2>
        <p style={{ fontSize:17, color:"rgba(255,255,255,0.55)", marginBottom:36 }}>In 48 Stunden gesetzeskonform — für jedes ERP-System.</p>
        <button className="btn btn-white" style={{ fontSize:16, padding:"15px 40px" }} onClick={onEnter}>Kostenlos starten →</button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:"36px 48px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16, background:C.white }}>
        <Wordmark size={22} />
        <div style={{ fontSize:13, color:C.textLight }}>© 2025 invoiq · invoiq.io · EN 16931 · GoBD · DSGVO</div>
        <div style={{ display:"flex", gap:24 }}>
          {["Impressum","Datenschutz","AGB"].map(l => (
            <button key={l} style={{ background:"none", border:"none", color:C.textLight, fontSize:13, cursor:"pointer", fontFamily:F.ui }}>{l}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUTH SCREEN
   ═══════════════════════════════════════════════════════════════ */
function Auth({ mode, onSwitch, onSuccess, loading }) {
  const [form, setForm] = useState({ email:"demo@invoiq.io", password:"demo123", full_name:"", org_name:"", vat_id:"" });
  const upd = (k,v) => setForm(p => ({ ...p, [k]:v }));

  return (
    <div style={{ minHeight:"100vh", background:C.bgAlt, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <Wordmark size={30} />
        </div>

        <div className="card sci" style={{ boxShadow:"0 4px 24px rgba(8,18,42,0.08)" }}>
          <h2 style={{ fontFamily:F.display, fontSize:26, fontWeight:400, color:C.navy, marginBottom:6, letterSpacing:"-0.02em" }}>
            {mode === "login" ? "Willkommen zurück." : "Konto erstellen."}
          </h2>
          <p style={{ fontSize:14, color:C.textMuted, marginBottom:28 }}>
            {mode === "login" ? "E-Rechnung für jedes System." : "Kostenlos starten — in 2 Minuten."}
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mode === "register" && (
              <>
                <div><label className="label">Vollständiger Name</label><input className="input" value={form.full_name} onChange={e=>upd("full_name",e.target.value)} placeholder="Max Mustermann" /></div>
                <div><label className="label">Unternehmensname</label><input className="input" value={form.org_name} onChange={e=>upd("org_name",e.target.value)} placeholder="Mustermann GmbH" /></div>
                <div><label className="label">USt-IdNr. (optional)</label><input className="input" value={form.vat_id} onChange={e=>upd("vat_id",e.target.value)} placeholder="DE123456789" /></div>
              </>
            )}
            <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)} /></div>
            <div><label className="label">Passwort</label><input className="input" type="password" value={form.password} onChange={e=>upd("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)} /></div>

            <button className="btn btn-navy" style={{ width:"100%", justifyContent:"center", marginTop:6 }} onClick={()=>onSuccess(form)} disabled={loading}>
              {loading ? <><Spinner color={C.white} /> Bitte warten...</> : mode === "login" ? "Anmelden →" : "Konto erstellen →"}
            </button>

            <button onClick={onSwitch} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", fontSize:13, fontFamily:F.ui }}>
              {mode === "login" ? "Noch kein Konto? Jetzt registrieren →" : "Bereits registriert? Anmelden →"}
            </button>

            {mode === "login" && (
              <div style={{ background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:C.textMuted, textAlign:"center" }}>
                Demo: <strong style={{ color:C.navy }}>demo@invoiq.io</strong> / <strong style={{ color:C.navy }}>demo123</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP SIDEBAR + SHELL
   ═══════════════════════════════════════════════════════════════ */
function Shell({ user, org, nav, setNav, onLogout, children }) {
  const items = [
    { key:"dashboard", icon:"▦",  label:"Dashboard"     },
    { key:"invoices",  icon:"≡",  label:"Rechnungen"    },
    { key:"archive",   icon:"⊡",  label:"Archiv"        },
    { key:"connect",   icon:"⊞",  label:"Anbindung"     },
    { key:"webhooks",  icon:"⊛",  label:"Webhooks"      },
    { key:"settings",  icon:"⊙",  label:"Einstellungen" },
  ];

  const used   = org?.plan_doc_used  || 0;
  const limit  = org?.plan_doc_limit || 100;
  const pct    = Math.min(100, (used / limit) * 100);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.bgAlt }}>

      {/* SIDEBAR */}
      <aside style={{ width:232, background:C.white, borderRight:`1px solid ${C.borderNav}`, display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh", boxShadow:"1px 0 0 0 " + C.border }}>

        {/* Logo */}
        <div style={{ padding:"22px 20px 18px", borderBottom:`1px solid ${C.borderNav}` }}>
          <Wordmark size={24} />
          {org && <div style={{ fontSize:11, color:C.textLight, marginTop:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{org.name}</div>}
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, padding:"10px 0" }}>
          {items.map(({ key, icon, label }) => (
            <button key={key} className={`nav-link ${nav===key?"active":""}`} onClick={()=>setNav(key)}>
              <span style={{ fontSize:14, width:18, textAlign:"center", flexShrink:0 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* Plan widget */}
        <div style={{ padding:"16px 20px", borderTop:`1px solid ${C.borderNav}` }}>
          <div style={{ background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:"capitalize" }}>{org?.plan || "Starter"}</span>
              <span className="chip" style={{ fontSize:10, padding:"2px 8px" }}>{used}/{limit}</span>
            </div>
            <div style={{ height:4, background:C.bgDeep, borderRadius:2 }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg, ${C.navyLight}, ${C.navy})`, borderRadius:2, width:`${pct}%`, transition:"width 0.4s" }} />
            </div>
            <div style={{ fontSize:11, color:C.textLight, marginTop:6 }}>Dokumente diesen Monat</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-ghost" style={{ flex:1, justifyContent:"center", fontSize:11, padding:"7px 0" }}>DE/EN</button>
            <button className="btn btn-danger" style={{ flex:1, justifyContent:"center", fontSize:11, padding:"7px 0" }} onClick={onLogout}>Logout</button>
          </div>
        </div>
      </aside>

      {/* CONTENT */}
      <main style={{ flex:1, overflowY:"auto", padding:"40px 44px" }}>
        {children}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function Dashboard({ user, org, notify, onNav }) {
  const fmtEUR = n => new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR" }).format(n);
  const fmtAgo = d => { const s = Date.now()-new Date(d); if(s<3600000) return `vor ${Math.floor(s/60000)} Min.`; if(s<86400000) return `vor ${Math.floor(s/3600000)} Std.`; return "gestern"; };

  const stats  = [
    { label:"Ausgehend",   value:"41",  sub:"Rechnungen",          color:C.navy },
    { label:"Eingehend",   value:"28",  sub:"Empfangen",            color:C.navy },
    { label:"Fehler",      value:"1",   sub:"Offen",                color:C.red  },
    { label:"Compliance",  value:"98%", sub:"EN 16931 ✓",           color:C.green},
  ];

  const rows = [
    { id:"1", invoice_number:"INV-2025-041", buyer_name:"Müller GmbH",           amount_gross:4284,   format:"xrechnung", status:"delivered", created_at: new Date(Date.now()-720000).toISOString() },
    { id:"2", invoice_number:"INV-2025-040", buyer_name:"TechVision AG",          amount_gross:12900,  format:"zugferd",   status:"validated", created_at: new Date(Date.now()-3600000).toISOString() },
    { id:"3", invoice_number:"INV-2025-039", buyer_name:"Bauer & Partner",        amount_gross:780.5,  format:"peppol",    status:"pending",   created_at: new Date(Date.now()-10800000).toISOString() },
    { id:"4", invoice_number:"INV-2025-038", buyer_name:"Stadtwerke Nord GmbH",   amount_gross:22410,  format:"xrechnung", status:"delivered", created_at: new Date(Date.now()-86400000).toISOString() },
    { id:"5", invoice_number:"INV-2025-037", buyer_name:"Logistik Express GmbH",  amount_gross:1550,   format:"zugferd",   status:"error",     created_at: new Date(Date.now()-90000000).toISOString() },
  ];

  return (
    <div className="fi">
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
        <div>
          <h1 style={{ fontFamily:F.display, fontSize:30, fontWeight:400, color:C.navy, letterSpacing:"-0.025em" }}>
            Guten Morgen{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:5 }}>
            {new Date().toLocaleDateString("de-DE",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </p>
        </div>
        <button className="btn btn-navy" onClick={()=>onNav("invoices")}>+ Neue Rechnung</button>
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        {stats.map((s,i) => (
          <div key={i} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", boxShadow:"0 1px 4px rgba(8,18,42,0.04)" }}>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, letterSpacing:0.7, textTransform:"uppercase", marginBottom:12 }}>{s.label}</div>
            <div style={{ fontFamily:F.display, fontSize:40, color:s.color, lineHeight:1, marginBottom:6, fontWeight:500 }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.textLight }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:C.navy }}>Letzte Aktivität</h2>
          <button className="btn btn-outline" onClick={()=>onNav("invoices")}>Alle anzeigen →</button>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1.5px solid ${C.border}` }}>
              {["Nummer","Empfänger","Betrag","Format","Status","Zeitpunkt"].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"8px 14px", fontSize:11, color:C.textLight, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="tr-hover" style={{ borderBottom:`1px solid ${C.borderNav}`, cursor:"pointer", transition:"background 0.1s" }}>
                <td style={{ padding:"13px 14px", fontSize:13, color:C.navyLight, fontWeight:700, fontFamily:F.ui }}>{r.invoice_number}</td>
                <td style={{ padding:"13px 14px", fontSize:14, color:C.text }}>{r.buyer_name}</td>
                <td style={{ padding:"13px 14px", fontSize:14, fontWeight:600, color:C.navy }}>{fmtEUR(r.amount_gross)}</td>
                <td style={{ padding:"13px 14px" }}>
                  <span style={{ background:C.accentPale, color:C.navyLight, borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700, border:`1px solid ${C.borderMid}` }}>{r.format.toUpperCase()}</span>
                </td>
                <td style={{ padding:"13px 14px" }}><Badge status={r.status} /></td>
                <td style={{ padding:"13px 14px", fontSize:12, color:C.textLight }}>{fmtAgo(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INVOICES SCREEN
   ═══════════════════════════════════════════════════════════════ */
function Invoices({ notify }) {
  const [view, setView]   = useState("list");
  const [gen,  setGen]    = useState(false);
  const [xml,  setXml]    = useState(null);
  const [form, setForm]   = useState({
    invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now()+30*86400000).toISOString().split("T")[0],
    format:"xrechnung", delivery_method:"email",
    seller_name:"Demo GmbH", seller_vat_id:"DE123456789", seller_address:"Musterstraße 1", seller_city:"Berlin",
    buyer_name:"", buyer_address:"", buyer_city:"", buyer_email:"",
    line_items:[{ description:"", quantity:1, unit_price:0, vat_rate:19 }],
  });

  const upd     = (k,v) => setForm(p=>({...p,[k]:v}));
  const updItem = (i,k,v) => { const a=[...form.line_items]; a[i]={...a[i],[k]:k==="description"?v:parseFloat(v)||0}; upd("line_items",a); };
  const addItem = () => upd("line_items",[...form.line_items,{ description:"", quantity:1, unit_price:0, vat_rate:19 }]);
  const delItem = i  => upd("line_items",form.line_items.filter((_,j)=>j!==i));

  const net   = form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
  const vat   = form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price*(i.vat_rate/100),0);
  const gross = net+vat;
  const fmtE  = n => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n);

  const generate = () => {
    if(!form.buyer_name){ notify("Empfänger fehlt.","error"); return; }
    setGen(true);
    setTimeout(()=>{
      setXml(`<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <!-- invoiq · XRechnung 3.0 / EN 16931 / UBL 2.1 -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>${form.invoice_number}</cbc:ID>
  <cbc:IssueDate>${form.invoice_date}</cbc:IssueDate>
  <cbc:DueDate>${form.due_date}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${form.seller_name}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme><cbc:CompanyID>${form.seller_vat_id}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${form.buyer_name}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${gross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${gross.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${form.line_items.map((item,idx)=>`  <cac:InvoiceLine>
    <cbc:ID>${idx+1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${(item.quantity*item.unit_price).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${item.description}</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${item.unit_price.toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`).join("\n")}
</ubl:Invoice>`);
      setGen(false);
      notify("E-Rechnung generiert · EN 16931 ✓","success");
    },800);
  };

  const download = () => {
    const b = new Blob([xml],{type:"application/xml"});
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href=u; a.download=`${form.invoice_number}.xml`; a.click();
    URL.revokeObjectURL(u);
  };

  if(view==="create") return (
    <div className="fi">
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
        <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={()=>{ setView("list"); setXml(null); }}>← Zurück</button>
        <h1 style={{ fontFamily:F.display, fontSize:26, fontWeight:400, color:C.navy }}>Neue Rechnung</h1>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginBottom:18 }}>
        <div className="card">
          <div className="label" style={{ marginBottom:18 }}>Rechnungsdetails</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
            <div><label className="label">Nummer</label><input className="input" value={form.invoice_number} onChange={e=>upd("invoice_number",e.target.value)} /></div>
            <div><label className="label">Format</label>
              <select className="select" value={form.format} onChange={e=>upd("format",e.target.value)}>
                {["xrechnung","zugferd","peppol","facturx"].map(f=><option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className="label">Rechnungsdatum</label><input className="input" type="date" value={form.invoice_date} onChange={e=>upd("invoice_date",e.target.value)} /></div>
            <div><label className="label">Fälligkeitsdatum</label><input className="input" type="date" value={form.due_date} onChange={e=>upd("due_date",e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom:18 }}>Empfänger</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[["buyer_name","Firmenname"],["buyer_address","Straße"],["buyer_city","Stadt"],["buyer_email","E-Mail"]].map(([k,l])=>(
              <div key={k}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e=>upd(k,e.target.value)} placeholder={l} /></div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:18 }}>
        <div className="label" style={{ marginBottom:18 }}>Positionen</div>
        <div style={{ display:"grid", gridTemplateColumns:"3fr 70px 130px 80px 36px", gap:10, marginBottom:10 }}>
          {["Beschreibung","Menge","Einzelpreis","MwSt %",""].map((h,i)=><div key={i} style={{ fontSize:10, color:C.textLight, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>{h}</div>)}
        </div>
        {form.line_items.map((item,idx)=>(
          <div key={idx} style={{ display:"grid", gridTemplateColumns:"3fr 70px 130px 80px 36px", gap:10, marginBottom:8 }}>
            <input className="input" value={item.description} onChange={e=>updItem(idx,"description",e.target.value)} placeholder="Leistungsbeschreibung..." />
            <input className="input" type="number" min="0" value={item.quantity} onChange={e=>updItem(idx,"quantity",e.target.value)} />
            <input className="input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updItem(idx,"unit_price",e.target.value)} />
            <select className="select" value={item.vat_rate} onChange={e=>updItem(idx,"vat_rate",e.target.value)}>
              <option value={19}>19 %</option><option value={7}>7 %</option><option value={0}>0 %</option>
            </select>
            <button onClick={()=>delItem(idx)} className="btn btn-danger" style={{ padding:"8px", fontSize:16, justifyContent:"center" }}>×</button>
          </div>
        ))}
        <button onClick={addItem} style={{ width:"100%", padding:"10px", border:`1.5px dashed ${C.border}`, background:"transparent", color:C.navyLight, cursor:"pointer", borderRadius:10, marginTop:10, fontSize:13, fontFamily:F.ui, fontWeight:600, transition:"border-color 0.15s" }} onMouseEnter={e=>e.target.style.borderColor=C.navyLight} onMouseLeave={e=>e.target.style.borderColor=C.border}>
          + Position hinzufügen
        </button>

        {/* Totals */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}>
          <div style={{ background:C.bgAlt, borderRadius:12, padding:"16px 22px", minWidth:248, border:`1px solid ${C.border}` }}>
            {[["Netto",fmtE(net)],["MwSt-Betrag",fmtE(vat)]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:40, marginBottom:9, fontSize:13, color:C.textMuted }}><span>{l}</span><span>{v}</span></div>
            ))}
            <div className="divider" />
            <div style={{ display:"flex", justifyContent:"space-between", gap:40, fontFamily:F.display, fontSize:20, color:C.navy, fontWeight:500 }}>
              <span>Brutto</span><span>{fmtE(gross)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginBottom:24 }}>
        <button className="btn btn-navy" style={{ fontSize:15, padding:"13px 36px" }} onClick={generate} disabled={gen}>
          {gen ? <><Spinner color={C.white} /> Generiere...</> : "⚡ E-Rechnung generieren"}
        </button>
      </div>

      {xml && (
        <div className="card fi">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="chip chip-green">✓ EN 16931 validiert</span>
              <span className="chip chip-green">GoBD ✓</span>
              <span style={{ fontSize:13, color:C.textMuted }}>{form.invoice_number}</span>
            </div>
            <button className="btn btn-navy" style={{ fontSize:13, padding:"9px 20px" }} onClick={download}>↓ XML herunterladen</button>
          </div>
          <pre style={{ background:C.bgAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:18, fontSize:11.5, color:C.navyMid, overflow:"auto", maxHeight:360, lineHeight:1.6, fontFamily:"'Courier New',monospace" }}>{xml}</pre>
        </div>
      )}
    </div>
  );

  // List
  const list = [
    { id:"1", invoice_number:"INV-2025-041", buyer_name:"Müller GmbH",          amount_gross:4284,  format:"xrechnung", status:"delivered", has_xml:true  },
    { id:"2", invoice_number:"INV-2025-040", buyer_name:"TechVision AG",         amount_gross:12900, format:"zugferd",   status:"validated", has_xml:true  },
    { id:"3", invoice_number:"INV-2025-039", buyer_name:"Bauer & Partner",       amount_gross:780.5, format:"peppol",    status:"sent",      has_xml:false },
    { id:"4", invoice_number:"INV-2025-038", buyer_name:"Stadtwerke Nord GmbH",  amount_gross:22410, format:"xrechnung", status:"archived",  has_xml:true  },
    { id:"5", invoice_number:"INV-2025-037", buyer_name:"Logistik Express GmbH", amount_gross:1550,  format:"zugferd",   status:"error",     has_xml:false },
  ];
  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <h1 style={{ fontFamily:F.display, fontSize:28, fontWeight:400, color:C.navy }}>Rechnungen</h1>
        <button className="btn btn-navy" onClick={()=>setView("create")}>+ Neue Rechnung</button>
      </div>
      <div className="card">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1.5px solid ${C.border}` }}>
              {["Nummer","Empfänger","Betrag","Format","Status","Aktionen"].map(h=>(
                <th key={h} style={{ textAlign:"left", padding:"8px 14px", fontSize:11, color:C.textLight, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(r=>(
              <tr key={r.id} className="tr-hover" style={{ borderBottom:`1px solid ${C.borderNav}`, cursor:"pointer" }}>
                <td style={{ padding:"13px 14px", fontSize:13, color:C.navyLight, fontWeight:700 }}>{r.invoice_number}</td>
                <td style={{ padding:"13px 14px", fontSize:14, color:C.text }}>{r.buyer_name}</td>
                <td style={{ padding:"13px 14px", fontSize:14, fontWeight:600, color:C.navy }}>{fmtE(r.amount_gross)}</td>
                <td style={{ padding:"13px 14px" }}><span style={{ background:C.accentPale, color:C.navyLight, borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700, border:`1px solid ${C.borderMid}` }}>{r.format.toUpperCase()}</span></td>
                <td style={{ padding:"13px 14px" }}><Badge status={r.status} /></td>
                <td style={{ padding:"13px 14px" }}>
                  <div style={{ display:"flex", gap:8 }}>
                    {r.status==="validated"&&<button className="btn btn-outline" style={{ fontSize:11,padding:"5px 10px" }}>→ Senden</button>}
                    {r.has_xml&&<button className="btn btn-outline" style={{ fontSize:11,padding:"5px 10px" }}>XML</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Connect Screen ──────────────────────────────────────── */
function Connect({ notify }) {
  const conns = [
    { type:"sap_s4",   name:"SAP S/4HANA",          method:"RFC / IDoc / REST API", icon:"⚙️", ok:true  },
    { type:"sap_ecc",  name:"SAP ECC",               method:"RFC / IDoc Classic",    icon:"⚙️", ok:true  },
    { type:"datev",    name:"DATEV",                 method:"Connect Online API",    icon:"📊", ok:true  },
    { type:"lexware",  name:"Lexware",               method:"XML-Export / SFTP",     icon:"📋", ok:true  },
    { type:"dynamics", name:"Microsoft Dynamics 365",method:"Dataverse REST API",    icon:"🔷", ok:true  },
    { type:"sage",     name:"Sage",                  method:"Sage API v2",           icon:"📘", ok:false },
    { type:"rest",     name:"REST API",              method:"Generische Integration",icon:"🔌", ok:true  },
    { type:"sftp",     name:"SFTP / E-Mail",         method:"Dateibasiert",          icon:"📁", ok:true  },
  ];
  return (
    <div className="fi">
      <h1 style={{ fontFamily:F.display, fontSize:28, fontWeight:400, color:C.navy, marginBottom:6 }}>ERP-Anbindung</h1>
      <p style={{ color:C.textMuted, fontSize:14, marginBottom:28 }}>Verbinden Sie Ihr ERP-System in wenigen Minuten.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
        {conns.map(c=>(
          <div key={c.type} className="card" style={{ position:"relative", cursor:c.ok?"pointer":"default", transition:"border-color 0.18s, transform 0.18s, box-shadow 0.18s" }}
            onMouseEnter={e=>{ if(c.ok){ e.currentTarget.style.borderColor=C.navyLight; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(8,18,42,0.1)"; }}}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 1px 4px rgba(8,18,42,0.04)"; }}>
            {!c.ok&&<div style={{ position:"absolute", top:12, right:12, background:C.bgAlt, color:C.textMuted, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, border:`1px solid ${C.border}` }}>DEMNÄCHST</div>}
            <div style={{ width:44, height:44, borderRadius:12, background:C.accentPale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:14 }}>{c.icon}</div>
            <div style={{ fontWeight:700, color:C.navy, fontSize:15, marginBottom:4 }}>{c.name}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:16 }}>{c.method}</div>
            {c.ok&&<button className="btn btn-outline" style={{ fontSize:12 }} onClick={()=>notify(`${c.name} verbunden ✓`,"success")}>Verbinden →</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, sub }) {
  return (
    <div className="fi">
      <h1 style={{ fontFamily:F.display, fontSize:28, fontWeight:400, color:C.navy, marginBottom:6 }}>{title}</h1>
      <p style={{ color:C.textMuted, fontSize:14, marginBottom:28 }}>{sub}</p>
      <div className="card" style={{ textAlign:"center", padding:60, color:C.textLight }}>
        Wird in Release 1.0 verfügbar sein.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [mode,   setMode]   = useState("login");
  const [nav,    setNav]    = useState("dashboard");
  const [loading,setLoading]= useState(false);
  const [toast,  setToast]  = useState(null);
  const [user]   = useState({ full_name:"Manfred Bell", email:"demo@invoiq.io" });
  const [org]    = useState({ name:"invoiq Demo", plan:"business", plan_doc_limit:1000, plan_doc_used:41 });

  const notify = (msg, type="info") => setToast({ msg, type });

  const handleAuth = async form => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    setScreen("app"); setNav("dashboard");
    notify(`Willkommen${form.full_name ? `, ${form.full_name.split(" ")[0]}` : ""}!`, "success");
    setLoading(false);
  };

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}

      {screen==="landing" && <Landing onEnter={()=>{ setMode("login"); setScreen("auth"); }} />}

      {screen==="auth" && (
        <Auth
          mode={mode}
          onSwitch={()=>setMode(m=>m==="login"?"register":"login")}
          onSuccess={handleAuth}
          loading={loading}
        />
      )}

      {screen==="app" && (
        <Shell user={user} org={org} nav={nav} setNav={setNav} onLogout={()=>setScreen("landing")}>
          {nav==="dashboard" && <Dashboard user={user} org={org} notify={notify} onNav={setNav} />}
          {nav==="invoices"  && <Invoices  notify={notify} />}
          {nav==="connect"   && <Connect   notify={notify} />}
          {nav==="archive"   && <Placeholder title="GoBD-Archiv"     sub="SHA-256 · §147 AO · 10 Jahre Aufbewahrung" />}
          {nav==="webhooks"  && <Placeholder title="Webhooks"        sub="Events: invoice.created · invoice.sent · invoice.delivered" />}
          {nav==="settings"  && <Placeholder title="Einstellungen"   sub="Konto · Plan · API-Keys · White-Label" />}
        </Shell>
      )}
    </>
  );
}

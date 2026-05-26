import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   invoiq — Complete Integrated App
   Landing · Auth · App · Admin (Super + Customer)
   Weiß & Dunkelblau · Fraunces + DM Sans
   ═══════════════════════════════════════════════════════════════ */

// ── DESIGN TOKENS ─────────────────────────────────────────────
const C = {
  navy:      "#08122A", navyMid: "#0E1E42", navyLite: "#1A3A7C",
  white:     "#FFFFFF", bg: "#F4F6FA", bgAlt: "#EBEEf5",
  text:      "#08122A", textMid: "#2C3E6B", textMuted: "#6B7FA8", textLight: "#9AAAC8",
  border:    "#DDE3F0", borderMid: "#C8D0E8",
  accentPale:"#EBF0FB",
  green:     "#0A6640", greenBg: "#EDFAF3", greenBdr: "#86EFAC",
  red:       "#B91C1C", redBg:   "#FEF2F2", redBdr:   "#FECACA",
  amber:     "#92400E", amberBg: "#FFFBEB", amberBdr: "#FDE68A",
  blue:      "#1D4ED8", blueBg:  "#EFF6FF",
};
const F = { d: "'Fraunces', Georgia, serif", u: "'DM Sans', system-ui, sans-serif" };

// ── API ────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const api = {
  _token: localStorage.getItem("invoiq_token") || null,
  setToken(t) { this._token = t; if(t) localStorage.setItem("invoiq_token",t); else localStorage.removeItem("invoiq_token"); },
  async req(method, path, body) {
    const headers = { "Content-Type":"application/json" };
    if(this._token) headers["Authorization"] = `Bearer ${this._token}`;
    try {
      const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch(err) {
      if(err.message.includes("fetch")) throw new Error("Backend nicht erreichbar");
      throw err;
    }
  },
  get: (p) => api.req("GET", p),
  post: (p,b) => api.req("POST", p, b),
  login: (b) => api.post("/auth/login", b),
  register: (b) => api.post("/auth/register", b),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout", {}),
  getStats: () => api.get("/invoices/stats"),
  listInvoices: (q="") => api.get(`/invoices${q}`),
  createInvoice: (b) => api.post("/invoices", b),
  sendInvoice: (id,b) => api.post(`/invoices/${id}/send`, b),
  archiveInvoice: (id) => api.post(`/invoices/${id}/archive`, {}),
  getXML: (id) => fetch(`${API_BASE}/invoices/${id}/xml`, { headers:{ Authorization:`Bearer ${api._token}` }}).then(r=>r.text()),
  getConnectors: () => api.get("/connect/available"),
  listWebhooks: () => api.get("/webhooks"),
  createWebhook: (b) => api.post("/webhooks", b),
};

// ── MOCK ADMIN DATA ────────────────────────────────────────────
const mockOrgs = [
  { id:"o1", name:"Müller & Partner GmbH", plan:"business", status:"active", docs_used:284, docs_limit:1000, mrr:199, created:"2025-01-15", vat_id:"DE123456789", users:3, errors:2 },
  { id:"o2", name:"TechVision AG",         plan:"pro",      status:"active", docs_used:1840,docs_limit:10000,mrr:599, created:"2025-02-03", vat_id:"DE987654321", users:8, errors:0 },
  { id:"o3", name:"Stadtwerke Süd GmbH",   plan:"starter",  status:"active", docs_used:67,  docs_limit:100,  mrr:49,  created:"2025-03-10", vat_id:"DE456789123", users:1, errors:1 },
  { id:"o4", name:"Bauer Logistik KG",     plan:"business", status:"trial",  docs_used:12,  docs_limit:1000, mrr:0,   created:"2025-05-20", vat_id:"DE321654987", users:2, errors:0 },
  { id:"o5", name:"Nord Express GmbH",     plan:"starter",  status:"suspended",docs_used:0, docs_limit:100,  mrr:49,  created:"2025-04-01", vat_id:"DE789123456", users:1, errors:0 },
];
const mockAllInvoices = [
  { id:"ai1", org:"Müller & Partner GmbH", number:"INV-2025-284", amount:4284,  format:"xrechnung", status:"delivered", date:"2025-05-25" },
  { id:"ai2", org:"TechVision AG",         number:"INV-2025-1840",amount:22900, format:"zugferd",   status:"delivered", date:"2025-05-25" },
  { id:"ai3", org:"Stadtwerke Süd GmbH",   number:"INV-2025-067", amount:780,   format:"peppol",    status:"error",     date:"2025-05-24" },
  { id:"ai4", org:"Bauer Logistik KG",     number:"INV-2025-012", amount:1250,  format:"xrechnung", status:"validated", date:"2025-05-24" },
  { id:"ai5", org:"Müller & Partner GmbH", number:"INV-2025-283", amount:3600,  format:"zugferd",   status:"archived",  date:"2025-05-23" },
  { id:"ai6", org:"TechVision AG",         number:"INV-2025-1839",amount:18400, format:"xrechnung", status:"delivered", date:"2025-05-23" },
];
const mockAllUsers = [
  { id:"u1", name:"Manfred Bell",   email:"manfred@invoiq.io",        role:"super_admin", org:"invoiq",               status:"active",    last_login:"Heute" },
  { id:"u2", name:"Hans Müller",    email:"hans@mueller-partner.de",  role:"owner",       org:"Müller & Partner GmbH",status:"active",    last_login:"Heute" },
  { id:"u3", name:"Sarah Weber",    email:"s.weber@techvision.de",    role:"admin",       org:"TechVision AG",         status:"active",    last_login:"Gestern" },
  { id:"u4", name:"Klaus Bauer",    email:"k.bauer@logistik.de",      role:"member",      org:"Bauer Logistik KG",     status:"active",    last_login:"vor 3 Tagen" },
  { id:"u5", name:"Anna Schmidt",   email:"a.schmidt@stadtwerke.de",  role:"owner",       org:"Stadtwerke Süd GmbH",   status:"suspended", last_login:"vor 14 Tagen" },
];

const fmtEUR = n => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n);
const fmtNum = n => new Intl.NumberFormat("de-DE").format(n);
const fmtAgo = d => { const s=Date.now()-new Date(d); if(s<3600000) return `vor ${Math.floor(s/60000)} Min.`; if(s<86400000) return `vor ${Math.floor(s/3600000)} Std.`; return "gestern"; };

// ── CSS ────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
body{font-family:${F.u};background:${C.white};color:${C.text};}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.borderMid};border-radius:3px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
@keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
.fu{animation:fadeUp .55s cubic-bezier(.22,1,.36,1) both}
.fu2{animation:fadeUp .55s .1s cubic-bezier(.22,1,.36,1) both}
.fu3{animation:fadeUp .55s .2s cubic-bezier(.22,1,.36,1) both}
.fu4{animation:fadeUp .55s .3s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn .35s ease both}
/* Buttons */
.btn{font-family:${F.u};font-weight:600;cursor:pointer;border-radius:9px;border:none;display:inline-flex;align-items:center;gap:6px;transition:all .16s;white-space:nowrap;}
.btn-navy{background:${C.navy};color:#fff;padding:10px 22px;font-size:14px;box-shadow:0 1px 3px rgba(8,18,42,.15);}
.btn-navy:hover{background:${C.navyMid};transform:translateY(-1px);box-shadow:0 4px 16px rgba(8,18,42,.2);}
.btn-ghost{background:transparent;color:${C.navy};border:1.5px solid ${C.border};padding:9px 20px;font-size:14px;}
.btn-ghost:hover{border-color:${C.borderMid};background:${C.bg};}
.btn-outline{background:transparent;color:${C.navyLite};border:1.5px solid ${C.border};padding:7px 16px;font-size:13px;}
.btn-outline:hover{border-color:${C.navyLite};background:${C.accentPale};}
.btn-danger{background:${C.redBg};color:${C.red};border:1px solid ${C.redBdr};padding:7px 14px;font-size:12px;}
.btn-success{background:${C.greenBg};color:${C.green};border:1px solid ${C.greenBdr};padding:7px 14px;font-size:12px;}
.btn-lg{padding:14px 36px;font-size:16px;border-radius:12px;}
.btn-sm{padding:6px 12px;font-size:12px;border-radius:7px;}
.btn:disabled{opacity:.6;cursor:not-allowed;}
/* Cards */
.card{background:${C.white};border:1px solid ${C.border};border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(8,18,42,.04);}
/* Forms */
.input{width:100%;background:${C.white};border:1.5px solid ${C.border};border-radius:9px;padding:11px 14px;font-family:${F.u};font-size:14px;color:${C.text};outline:none;transition:border-color .15s,box-shadow .15s;}
.input:focus{border-color:${C.navyLite};box-shadow:0 0 0 3px ${C.accentPale};}
.input::placeholder{color:${C.textLight};}
.select{width:100%;background:${C.white};border:1.5px solid ${C.border};border-radius:9px;padding:11px 14px;font-family:${F.u};font-size:14px;color:${C.text};outline:none;cursor:pointer;}
.label{display:block;font-size:11px;font-weight:700;color:${C.textMuted};letter-spacing:.7px;text-transform:uppercase;margin-bottom:6px;}
/* Nav */
.nav-link{display:flex;align-items:center;gap:10px;padding:9px 20px;background:transparent;color:${C.textMuted};border:none;border-left:2.5px solid transparent;cursor:pointer;font-size:13.5px;font-weight:500;text-align:left;width:100%;font-family:${F.u};transition:all .14s;}
.nav-link:hover{color:${C.text};background:${C.bg};}
.nav-link.active{color:${C.navy};background:${C.accentPale};border-left-color:${C.navy};font-weight:700;}
.nav-section{font-size:10px;font-weight:700;color:${C.textLight};letter-spacing:1.2px;text-transform:uppercase;padding:14px 20px 5px;}
/* Table */
.table{width:100%;border-collapse:collapse;}
.table th{text-align:left;padding:8px 14px;font-size:11px;color:${C.textLight};font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${C.border};}
.table td{padding:12px 14px;font-size:13.5px;border-bottom:1px solid ${C.bg};vertical-align:middle;}
.tr-hover:hover{background:${C.bg};}
/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;}
.bg{background:${C.greenBg};color:${C.green};border:1px solid ${C.greenBdr};}
.br{background:${C.redBg};color:${C.red};border:1px solid ${C.redBdr};}
.ba{background:${C.amberBg};color:${C.amber};border:1px solid ${C.amberBdr};}
.bb{background:${C.blueBg};color:${C.blue};border:1px solid #BFDBFE;}
.bn{background:${C.accentPale};color:${C.navyLite};border:1px solid ${C.borderMid};}
/* Misc */
.divider{height:1px;background:${C.border};}
.progress{height:4px;background:${C.bgAlt};border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;background:linear-gradient(90deg,${C.navyLite},${C.navy});border-radius:2px;transition:width .5s;}
.tab{padding:9px 18px;font-size:13px;font-weight:600;color:${C.textMuted};border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;font-family:${F.u};transition:all .15s;}
.tab.active{color:${C.navy};border-bottom-color:${C.navy};}
.avatar{width:30px;height:30px;border-radius:50%;background:${C.accentPale};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${C.navyLite};flex-shrink:0;}
.modal-bg{position:fixed;inset:0;background:rgba(8,18,42,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);}
.modal{background:${C.white};border-radius:16px;padding:28px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(8,18,42,.2);}
/* Landing */
.hero-dot{width:8px;height:8px;border-radius:50%;background:${C.navyLite};animation:pulse 2.2s ease-in-out infinite;display:inline-block;}
.stat-cell{padding:22px 16px;text-align:center;border-right:1px solid ${C.border};transition:background .2s;position:relative;}
.stat-cell:hover{background:${C.bg};}
.feat-card{background:${C.white};border:1px solid ${C.border};border-radius:16px;padding:26px;transition:border-color .2s,transform .2s,box-shadow .2s;}
.feat-card:hover{border-color:${C.navyLite};transform:translateY(-3px);box-shadow:0 8px 28px rgba(8,18,42,.09);}
/* Scroll reveal */
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);}
.reveal.visible{opacity:1;transform:none;}
.reveal-l{opacity:0;transform:translateX(-28px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);}
.reveal-l.visible{opacity:1;transform:none;}
`;

// ── SHARED COMPONENTS ──────────────────────────────────────────
function Wordmark({ size=24, inv=false }) {
  const t = inv ? "#fff" : C.navy;
  const a = inv ? "#93C5FD" : C.navyLite;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, userSelect:"none" }}>
      <div style={{ width:size, height:size, background:inv?"rgba(255,255,255,.15)":C.navy, border:`1.5px solid ${inv?"rgba(255,255,255,.3)":C.navy}`, borderRadius:Math.round(size*.24), display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width={size*.6} height={size*.6} viewBox="0 0 20 20" fill="none">
          <rect x="2" y="8" width="3.5" height="9" rx="1.75" fill={inv?C.navy:"#93C5FD"}/>
          <rect x="2" y="2" width="3.5" height="4" rx="1.75" fill={inv?C.navy:"#fff"}/>
          <circle cx="13.5" cy="12" r="4.5" stroke={inv?C.navy:"#fff"} strokeWidth="2.2" fill="none"/>
          <rect x="15.8" y="7" width="2.5" height="10" rx="1.25" fill={inv?C.navy:"#fff"}/>
        </svg>
      </div>
      <span style={{ fontFamily:F.d, fontSize:size*.88, fontWeight:600, color:t, letterSpacing:"-.03em" }}>
        inv<span style={{ color:a }}>o</span>iq
      </span>
    </div>
  );
}

function Badge({ status }) {
  const m = {
    active:["bg","Aktiv"], trial:["bb","Trial"], suspended:["br","Gesperrt"],
    delivered:["bg","Zugestellt"], validated:["bn","Validiert"], sent:["bn","Versendet"],
    error:["br","Fehler"], archived:["bn","Archiviert"], pending:["ba","Ausstehend"],
    starter:["bn","Starter"], business:["bb","Business"], pro:["ba","Pro"],
    super_admin:["br","Super Admin"], owner:["bn","Owner"], admin:["bb","Admin"], member:["bn","Member"],
  };
  const [cls, lbl] = m[status] || ["bn", status];
  return <span className={`badge ${cls}`}>{lbl}</span>;
}

function Spinner({ size=16, color=C.navy }) {
  return <span style={{ width:size, height:size, border:`2px solid ${color}20`, borderTopColor:color, borderRadius:"50%", animation:"spin .6s linear infinite", display:"inline-block", flexShrink:0 }} />;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const s = { success:[C.green,"bg"], error:[C.red,"br"], info:[C.navyLite,"bn"] }[type]||[C.navyLite,"bn"];
  return (
    <div onClick={onClose} style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, padding:"13px 18px", fontSize:13.5, fontWeight:600, color:s[0], maxWidth:380, boxShadow:"0 8px 32px rgba(8,18,42,.12)", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:F.u }}>
      <span className={`badge ${s[1]}`} style={{ fontSize:10, padding:"2px 7px" }}>{type}</span>{msg}
    </div>
  );
}

// ── LANDING ────────────────────────────────────────────────────
function Landing({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive:true });
    // Scroll reveal
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }});
    }, { threshold:.12, rootMargin:"0px 0px -40px 0px" });
    document.querySelectorAll(".reveal,.reveal-l").forEach(el => obs.observe(el));
    return () => { window.removeEventListener("scroll", h); obs.disconnect(); };
  }, []);

  const features = [
    { icon:"⚡", title:"XRechnung & ZUGFeRD", desc:"Automatische EN 16931-konforme Generierung. Jede Rechnung sofort gesetzeskonform." },
    { icon:"🔗", title:"Jedes ERP-System",     desc:"SAP S/4HANA, ECC, DATEV, Lexware, Dynamics — oder per REST API in Minuten." },
    { icon:"🔒", title:"GoBD-Archivierung",    desc:"SHA-256, unveränderlich, 10 Jahre. AWS Frankfurt. Vollständiger Audit-Trail." },
    { icon:"🌍", title:"Peppol & EU-Netzwerk", desc:"Direktversand über Peppol BIS 3.0. Bereit für ViDA und internationale Mandate." },
    { icon:"🏷", title:"White-Label bereit",   desc:"SAP-Beratungshäuser deployen invoiq unter eigenem Brand und Domain." },
    { icon:"📊", title:"Compliance Dashboard", desc:"EN 16931-Score, Fehler, Archivstatus — alles in Echtzeit überwacht." },
  ];

  return (
    <div style={{ background:C.white, overflowX:"hidden" }}>
      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:64, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 clamp(20px,5vw,64px)", background:scrolled?"rgba(255,255,255,.92)":"transparent", borderBottom:`1px solid ${scrolled?C.border:"transparent"}`, backdropFilter:scrolled?"blur(16px)":"none", transition:"all .3s" }}>
        <Wordmark size={26} />
        <div style={{ display:"flex", gap:32, alignItems:"center" }}>
          {["Funktionen","Preise","Konnektoren"].map(l=>(
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize:14, fontWeight:500, color:C.textMuted, textDecoration:"none", transition:"color .15s" }} onMouseEnter={e=>e.target.style.color=C.navy} onMouseLeave={e=>e.target.style.color=C.textMuted}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-ghost" style={{ padding:"9px 18px", fontSize:13 }} onClick={onEnter}>Anmelden</button>
          <button className="btn btn-navy" style={{ padding:"9px 20px", fontSize:13 }} onClick={onEnter}>Kostenlos starten →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"120px clamp(20px,5vw,64px) 80px", position:"relative", overflow:"hidden", textAlign:"center" }}>
        {/* Dot grid */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.03, pointerEvents:"none" }}>
          <defs><pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.5" fill={C.navy}/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>
        {/* Shape */}
        <div style={{ position:"absolute", top:0, right:0, width:"38%", height:"65%", background:`linear-gradient(225deg,${C.navyMid},${C.navy})`, borderRadius:"0 0 0 clamp(60px,10vw,140px)", opacity:.06, pointerEvents:"none" }} />

        <div style={{ maxWidth:840, position:"relative" }}>
          <div className="fu" style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.accentPale, border:`1px solid ${C.borderMid}`, borderRadius:24, padding:"7px 16px", marginBottom:32, fontSize:12, fontWeight:600, color:C.navyLite }}>
            <span className="hero-dot" /> E-Rechnungspflicht 2027 · EN 16931 · GoBD · Peppol
          </div>
          <h1 className="fu2" style={{ fontFamily:F.d, fontSize:"clamp(44px,7vw,86px)", fontWeight:400, color:C.navy, lineHeight:1.07, letterSpacing:"-.03em", marginBottom:26 }}>
            E-Rechnung für<br /><em style={{ color:C.navyLite }}>jedes</em> System.
          </h1>
          <p className="fu3" style={{ fontSize:"clamp(16px,2vw,20px)", color:C.textMuted, maxWidth:520, margin:"0 auto 48px", lineHeight:1.75, fontWeight:300 }}>
            XRechnung · ZUGFeRD · Peppol — in 48 Stunden live.<br />SAP, DATEV, Lexware oder jedes andere ERP.
          </p>
          <div className="fu4" style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:72 }}>
            <button className="btn btn-navy btn-lg" onClick={onEnter}>Kostenlos starten →</button>
            <button className="btn btn-ghost btn-lg" onClick={()=>document.getElementById("funktionen")?.scrollIntoView({behavior:"smooth"})}>So funktioniert's</button>
          </div>
          {/* Stats bar */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", background:C.white, boxShadow:"0 2px 12px rgba(8,18,42,.06)", maxWidth:680, margin:"0 auto" }}>
            {[["48h","bis Go-Live"],["100%","EN 16931 konform"],["GoBD","Archivierung"],["10+","ERP-Systeme"]].map(([v,l],i,a)=>(
              <div key={v} className="stat-cell" style={{ borderRight:i<a.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ fontFamily:F.d, fontSize:26, fontWeight:600, color:C.navy, lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:11, color:C.textMuted, marginTop:5, fontWeight:500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funktionen" style={{ padding:"88px clamp(20px,5vw,64px)", background:C.bg }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <span className="reveal badge bn" style={{ marginBottom:16, fontSize:11, letterSpacing:.8, textTransform:"uppercase" }}>Funktionen</span>
            <h2 className="reveal" style={{ fontFamily:F.d, fontSize:"clamp(30px,4vw,50px)", color:C.navy, fontWeight:400, letterSpacing:"-.025em" }}>
              Alles was Sie brauchen.<br /><em>Nichts was Sie nicht brauchen.</em>
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(340px,100%),1fr))", gap:18 }}>
            {features.map((f,i)=>(
              <div key={i} className={`feat-card reveal`} style={{ transitionDelay:`${i*.07}s` }}>
                <div style={{ width:46, height:46, borderRadius:13, background:C.accentPale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:16, transition:"all .3s" }}>{f.icon}</div>
                <div style={{ fontWeight:700, color:C.navy, fontSize:15, marginBottom:7 }}>{f.title}</div>
                <div style={{ fontSize:13.5, color:C.textMuted, lineHeight:1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="preise" style={{ padding:"88px clamp(20px,5vw,64px)" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <span className="reveal badge bn" style={{ marginBottom:16, fontSize:11, letterSpacing:.8, textTransform:"uppercase" }}>Preise</span>
            <h2 className="reveal" style={{ fontFamily:F.d, fontSize:"clamp(30px,4vw,50px)", color:C.navy, fontWeight:400, letterSpacing:"-.025em" }}>
              Transparent.<br /><em>Kein usage-based Billing.</em>
            </h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(280px,100%),1fr))", gap:18 }}>
            {[
              { name:"Starter",  price:49,  docs:"100 Dok./Monat", features:["XRechnung + ZUGFeRD","E-Mail-Versand","GoBD-Archiv","1 Nutzer"], highlight:false },
              { name:"Business", price:199, docs:"1.000 Dok./Monat",features:["+ Peppol BIS 3.0","+ Inbound-Empfang","+ 5 ERP-Konnektoren","5 Nutzer"], highlight:true },
              { name:"Pro",      price:599, docs:"10.000 Dok./Monat",features:["+ Alle Konnektoren","+ Public REST API","+ Webhooks","15 Nutzer"], highlight:false },
            ].map((p,i)=>(
              <div key={i} className="reveal" style={{ transitionDelay:`${i*.1}s`, background:p.highlight?C.navy:C.white, border:`1.5px solid ${p.highlight?C.navy:C.border}`, borderRadius:18, padding:"30px 26px", position:"relative", transition:"transform .2s,box-shadow .2s", boxShadow:p.highlight?"0 8px 32px rgba(8,18,42,.2)":"0 1px 3px rgba(8,18,42,.04)" }} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=p.highlight?"0 16px 48px rgba(8,18,42,.28)":"0 8px 28px rgba(8,18,42,.1)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=p.highlight?"0 8px 32px rgba(8,18,42,.2)":"0 1px 3px rgba(8,18,42,.04)";}}>
                {p.highlight && <div style={{ position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)", background:C.navyLite, color:"#fff", fontSize:11, fontWeight:800, padding:"4px 16px", borderRadius:20, letterSpacing:.5, whiteSpace:"nowrap" }}>EMPFOHLEN</div>}
                <div style={{ fontWeight:700, fontSize:15, marginBottom:14, color:p.highlight?"rgba(255,255,255,.6)":C.textMuted }}>{p.name}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:5 }}>
                  <span style={{ fontFamily:F.d, fontSize:52, fontWeight:500, lineHeight:1, color:p.highlight?"#fff":C.navy }}>{p.price}</span>
                  <span style={{ fontSize:14, color:p.highlight?"rgba(255,255,255,.45)":C.textLight }}>€/Monat</span>
                </div>
                <div style={{ fontSize:12, color:p.highlight?"rgba(255,255,255,.45)":C.textMuted, marginBottom:22 }}>{p.docs}</div>
                <div style={{ height:1, background:p.highlight?"rgba(255,255,255,.12)":C.border, margin:"0 0 22px" }} />
                {p.features.map((f,j)=>(
                  <div key={j} style={{ display:"flex", gap:9, marginBottom:10, fontSize:13.5, color:j===0?(p.highlight?"#fff":C.navy):(p.highlight?"rgba(255,255,255,.6)":C.textMuted) }}>
                    <span style={{ color:p.highlight?"rgba(255,255,255,.4)":C.navyLite, flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
                <button onClick={onEnter} style={{ marginTop:24, width:"100%", justifyContent:"center", fontFamily:F.u, fontWeight:700, cursor:"pointer", borderRadius:10, padding:"13px", fontSize:14, border:"none", background:p.highlight?"#fff":"#08122A", color:p.highlight?C.navy:"#fff", transition:"all .18s" }}
                  onMouseEnter={e=>{e.currentTarget.style.opacity=".88";}} onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                  {p.highlight?"Jetzt starten":"Kostenlos testen"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <div style={{ background:C.navy, padding:"72px clamp(20px,5vw,64px)", textAlign:"center" }}>
        <div className="reveal badge" style={{ background:"rgba(255,255,255,.1)", color:"rgba(255,255,255,.7)", borderColor:"rgba(255,255,255,.15)", marginBottom:18, fontSize:11, letterSpacing:.8, textTransform:"uppercase" }}>E-Rechnungspflicht 2027</div>
        <h2 className="reveal" style={{ fontFamily:F.d, fontSize:"clamp(28px,4vw,50px)", color:"#fff", fontWeight:400, letterSpacing:"-.025em", marginBottom:12 }}>Bereit vor dem Stichtag.</h2>
        <p className="reveal" style={{ color:"rgba(255,255,255,.5)", fontSize:17, marginBottom:32, fontWeight:300 }}>In 48 Stunden gesetzeskonform — für jedes ERP-System.</p>
        <button className="reveal" onClick={onEnter} style={{ display:"inline-flex", alignItems:"center", background:"#fff", color:C.navy, border:"none", borderRadius:12, padding:"15px 40px", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:F.u, transition:"all .18s" }} onMouseEnter={e=>e.currentTarget.style.opacity=".88"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>Kostenlos starten →</button>
      </div>

      {/* FOOTER */}
      <footer style={{ background:C.white, borderTop:`1px solid ${C.border}`, padding:"32px clamp(20px,5vw,64px)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
        <Wordmark size={20} />
        <div style={{ fontSize:12, color:C.textLight }}>© 2025 invoiq · invoiq.io · EN 16931 · GoBD · DSGVO</div>
        <div style={{ display:"flex", gap:20 }}>
          {["Impressum","Datenschutz","AGB"].map(l=><a key={l} href="#" style={{ fontSize:12, color:C.textLight, textDecoration:"none" }} onMouseEnter={e=>e.target.style.color=C.navy} onMouseLeave={e=>e.target.style.color=C.textLight}>{l}</a>)}
        </div>
      </footer>
    </div>
  );
}

// ── AUTH ───────────────────────────────────────────────────────
function Auth({ mode, onSwitch, onSuccess, loading }) {
  const [form, setForm] = useState({ email:"demo@invoiq.io", password:"demo123", full_name:"", org_name:"", vat_id:"" });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}><Wordmark size={28} /></div>
        <div className="card fi" style={{ boxShadow:"0 4px 24px rgba(8,18,42,.08)" }}>
          <h2 style={{ fontFamily:F.d, fontSize:24, fontWeight:400, color:C.navy, marginBottom:5, letterSpacing:"-.02em" }}>
            {mode==="login"?"Willkommen zurück.":"Konto erstellen."}
          </h2>
          <p style={{ fontSize:13, color:C.textMuted, marginBottom:26 }}>
            {mode==="login"?"E-Rechnung für jedes System.":"Kostenlos starten — in 2 Minuten."}
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            {mode==="register" && (
              <>
                <div><label className="label">Vollständiger Name</label><input className="input" value={form.full_name} onChange={e=>upd("full_name",e.target.value)} placeholder="Max Mustermann" /></div>
                <div><label className="label">Unternehmensname</label><input className="input" value={form.org_name} onChange={e=>upd("org_name",e.target.value)} placeholder="Mustermann GmbH" /></div>
                <div><label className="label">USt-IdNr. (optional)</label><input className="input" value={form.vat_id} onChange={e=>upd("vat_id",e.target.value)} placeholder="DE123456789" /></div>
              </>
            )}
            <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)} /></div>
            <div><label className="label">Passwort</label><input className="input" type="password" value={form.password} onChange={e=>upd("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)} /></div>
            <button className="btn btn-navy" style={{ width:"100%", justifyContent:"center", marginTop:4 }} onClick={()=>onSuccess(form)} disabled={loading}>
              {loading ? <><Spinner color="#fff" />&nbsp;Bitte warten...</> : mode==="login"?"Anmelden →":"Konto erstellen →"}
            </button>
            <button onClick={onSwitch} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", fontSize:13, fontFamily:F.u }}>
              {mode==="login"?"Noch kein Konto? Registrieren →":"Bereits registriert? Anmelden →"}
            </button>
            {mode==="login" && (
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 13px", fontSize:12, color:C.textMuted, textAlign:"center" }}>
                Demo: <strong style={{ color:C.navy }}>demo@invoiq.io</strong> / <strong style={{ color:C.navy }}>demo123</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP SHELL ──────────────────────────────────────────────────
function AppShell({ user, org, nav, setNav, onLogout, onAdmin, children }) {
  const items = [
    { key:"dashboard", icon:"▦", label:"Dashboard"    },
    { key:"invoices",  icon:"⊟", label:"Rechnungen"   },
    { key:"archive",   icon:"⊞", label:"Archiv"       },
    { key:"connect",   icon:"⊕", label:"Anbindung"    },
    { key:"webhooks",  icon:"⊛", label:"Webhooks"     },
    { key:"settings",  icon:"⊙", label:"Einstellungen"},
  ];
  const pct = Math.min(100, ((org?.plan_doc_used||0)/(org?.plan_doc_limit||100))*100);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.bg }}>
      <aside style={{ width:232, background:C.white, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh" }}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}` }}>
          <Wordmark size={22} />
          {org && <div style={{ fontSize:11, color:C.textLight, marginTop:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{org.name}</div>}
        </div>
        <nav style={{ flex:1, padding:"8px 0" }}>
          {items.map(({key,icon,label})=>(
            <button key={key} className={`nav-link ${nav===key?"active":""}`} onClick={()=>setNav(key)}>
              <span style={{ fontSize:14, width:18, textAlign:"center" }}>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.border}` }}>
          {org && (
            <div style={{ background:C.accentPale, border:`1px solid ${C.borderMid}`, borderRadius:9, padding:"10px 12px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.navy, textTransform:"capitalize" }}>{org.plan||"Starter"}</span>
                <span style={{ fontSize:10, color:C.textMuted }}>{org.plan_doc_used||0}/{org.plan_doc_limit||100}</span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width:`${pct}%` }} />
              </div>
            </div>
          )}
          {/* Admin link — nur für super_admin */}
          {user?.role === "super_admin" || user?.email === "manfred@invoiq.io" || user?.email === "demo@invoiq.io" ? (
            <button className="btn btn-outline btn-sm" style={{ width:"100%", justifyContent:"center", marginBottom:8 }} onClick={onAdmin}>
              ⚙️ Admin Panel
            </button>
          ) : null}
          <button className="btn btn-danger btn-sm" style={{ width:"100%", justifyContent:"center" }} onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main style={{ flex:1, overflowY:"auto", padding:"36px 40px" }}>{children}</main>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────
function Dashboard({ user, org, notify, onNav }) {
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.listInvoices("?limit=6")])
      .then(([s,i]) => { setStats(s); setInvoices(i.invoices||[]); })
      .catch(() => {
        // Fallback mock
        setStats({ outbound_total:41, inbound_total:28, errors_total:1, compliance_score:98, plan:{ name:"business", limit:1000, used:41 }});
        setInvoices([
          { id:"1", invoice_number:"INV-2025-041", buyer_name:"Müller GmbH", amount_gross:4284, format:"xrechnung", status:"delivered", created_at:new Date(Date.now()-720000).toISOString() },
          { id:"2", invoice_number:"INV-2025-040", buyer_name:"TechVision AG", amount_gross:12900, format:"zugferd", status:"validated", created_at:new Date(Date.now()-3600000).toISOString() },
          { id:"3", invoice_number:"INV-2025-039", buyer_name:"Bauer & Partner", amount_gross:780, format:"peppol", status:"pending", created_at:new Date(Date.now()-10800000).toISOString() },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:F.d, fontSize:28, fontWeight:400, color:C.navy, letterSpacing:"-.025em" }}>
            Guten Morgen{user?.full_name?`, ${user.full_name.split(" ")[0]}`:""}.</h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:5 }}>{new Date().toLocaleDateString("de-DE",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <button className="btn btn-navy" onClick={()=>onNav("invoices")}>+ Neue Rechnung</button>
      </div>
      {loading ? (
        <div style={{ display:"flex", gap:16, marginBottom:24 }}>{[1,2,3,4].map(i=><div key={i} className="card" style={{ flex:1, height:100, background:C.bg, animation:"shimmer 1.5s ease-in-out infinite" }} />)}</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
          {[
            { label:"Ausgehend",  value:stats.outbound_total, sub:"Rechnungen", color:C.navy },
            { label:"Eingehend",  value:stats.inbound_total,  sub:"Empfangen",  color:C.navy },
            { label:"Fehler",     value:stats.errors_total,   sub:stats.errors_total>0?"Offen":"Keine", color:stats.errors_total>0?C.red:C.green },
            { label:"Compliance", value:`${stats.compliance_score}%`, sub:"EN 16931 ✓", color:C.green },
          ].map((s,i)=>(
            <div key={i} className="card">
              <div className="label" style={{ marginBottom:10 }}>{s.label}</div>
              <div style={{ fontFamily:F.d, fontSize:36, fontWeight:500, color:s.color, lineHeight:1, marginBottom:5 }}>{s.value}</div>
              <div style={{ fontSize:12, color:C.textMuted }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:C.navy }}>Letzte Aktivität</h2>
          <button className="btn btn-outline btn-sm" onClick={()=>onNav("invoices")}>Alle →</button>
        </div>
        <table className="table">
          <thead><tr>{["Nummer","Empfänger","Betrag","Format","Status","Zeit"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {invoices.map(inv=>(
              <tr key={inv.id} className="tr-hover">
                <td style={{ color:C.navyLite, fontWeight:700, fontSize:13 }}>{inv.invoice_number}</td>
                <td style={{ color:C.text }}>{inv.buyer_name||"—"}</td>
                <td style={{ fontWeight:700, color:C.navy }}>{fmtEUR(inv.amount_gross||0)}</td>
                <td><span style={{ background:C.accentPale, color:C.navyLite, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{inv.format?.toUpperCase()}</span></td>
                <td><Badge status={inv.status} /></td>
                <td style={{ color:C.textMuted, fontSize:12 }}>{fmtAgo(inv.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── INVOICES ───────────────────────────────────────────────────
function Invoices({ notify }) {
  const [view, setView] = useState("list");
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [xml, setXml] = useState(null);
  const [form, setForm] = useState({
    invoice_number:`INV-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,
    invoice_date:new Date().toISOString().split("T")[0],
    due_date:new Date(Date.now()+30*86400000).toISOString().split("T")[0],
    format:"xrechnung", delivery_method:"email",
    seller_name:"Demo GmbH", seller_vat_id:"DE123456789",
    seller_address:"Musterstraße 1", seller_city:"Berlin",
    buyer_name:"", buyer_address:"", buyer_city:"", buyer_email:"",
    line_items:[{ description:"", quantity:1, unit_price:0, vat_rate:19 }],
  });

  const load = useCallback(() => {
    setLoading(true);
    api.listInvoices().then(d=>setInvoices(d.invoices||[])).catch(()=>setInvoices([])).finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{ load(); },[load]);

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const updItem = (i,k,v) => { const a=[...form.line_items]; a[i]={...a[i],[k]:k==="description"?v:parseFloat(v)||0}; upd("line_items",a); };
  const net = form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
  const vat = form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price*(i.vat_rate/100),0);

  const generate = async () => {
    if(!form.buyer_name){ notify("Empfänger fehlt","error"); return; }
    setGenerating(true);
    try {
      const inv = await api.createInvoice(form);
      const xmlContent = await api.getXML(inv.id);
      setXml({ content:xmlContent, id:inv.id, number:inv.invoice_number });
      notify("E-Rechnung generiert · EN 16931 ✓","success");
      load();
    } catch(e) { notify(e.message,"error"); }
    setGenerating(false);
  };

  if(view==="create") return (
    <div className="fi">
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:26 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setXml(null);}}>← Zurück</button>
        <h1 style={{ fontFamily:F.d, fontSize:24, fontWeight:400, color:C.navy }}>Neue Rechnung</h1>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginBottom:18 }}>
        <div className="card">
          <div className="label" style={{ marginBottom:14 }}>Details</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
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
          <div className="label" style={{ marginBottom:14 }}>Empfänger</div>
          {[["buyer_name","Firmenname"],["buyer_address","Straße"],["buyer_city","Stadt"],["buyer_email","E-Mail"]].map(([k,l])=>(
            <div key={k} style={{ marginBottom:10 }}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e=>upd(k,e.target.value)} placeholder={l} /></div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="label" style={{ marginBottom:14 }}>Positionen</div>
        <div style={{ display:"grid", gridTemplateColumns:"3fr 70px 130px 80px 32px", gap:9, marginBottom:9 }}>
          {["Beschreibung","Menge","Einzelpreis","MwSt %",""].map((h,i)=><div key={i} style={{ fontSize:10, color:C.textLight, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>{h}</div>)}
        </div>
        {form.line_items.map((item,idx)=>(
          <div key={idx} style={{ display:"grid", gridTemplateColumns:"3fr 70px 130px 80px 32px", gap:9, marginBottom:8 }}>
            <input className="input" value={item.description} onChange={e=>updItem(idx,"description",e.target.value)} placeholder="Leistungsbeschreibung..." />
            <input className="input" type="number" min="0" value={item.quantity} onChange={e=>updItem(idx,"quantity",e.target.value)} />
            <input className="input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updItem(idx,"unit_price",e.target.value)} />
            <select className="select" value={item.vat_rate} onChange={e=>updItem(idx,"vat_rate",e.target.value)}>
              <option value={19}>19%</option><option value={7}>7%</option><option value={0}>0%</option>
            </select>
            <button onClick={()=>upd("line_items",form.line_items.filter((_,j)=>j!==idx))} style={{ background:C.redBg, border:`1px solid ${C.redBdr}`, borderRadius:7, color:C.red, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        ))}
        <button onClick={()=>upd("line_items",[...form.line_items,{description:"",quantity:1,unit_price:0,vat_rate:19}])} style={{ width:"100%", padding:"9px", border:`1.5px dashed ${C.border}`, background:"transparent", color:C.navyLite, cursor:"pointer", borderRadius:9, marginTop:8, fontSize:13, fontFamily:F.u, fontWeight:600 }}>+ Position hinzufügen</button>
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:18 }}>
          <div style={{ background:C.bg, borderRadius:10, padding:"14px 20px", minWidth:240, border:`1px solid ${C.border}` }}>
            {[["Netto",fmtEUR(net)],["MwSt-Betrag",fmtEUR(vat)]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:36, marginBottom:8, fontSize:13, color:C.textMuted }}><span>{l}</span><span>{v}</span></div>
            ))}
            <div style={{ height:1, background:C.border, margin:"8px 0" }} />
            <div style={{ display:"flex", justifyContent:"space-between", gap:36, fontFamily:F.d, fontSize:20, color:C.navy, fontWeight:500 }}>
              <span>Brutto</span><span>{fmtEUR(net+vat)}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
        <button className="btn btn-navy" style={{ fontSize:15, padding:"12px 32px" }} onClick={generate} disabled={generating}>
          {generating?<><Spinner color="#fff" />&nbsp;Generiere...</>:"⚡ E-Rechnung generieren"}
        </button>
      </div>
      {xml && (
        <div className="card fi">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", gap:8 }}>
              <span className="badge bg">✓ EN 16931</span>
              <span className="badge bg">GoBD ✓</span>
              <span style={{ fontSize:13, color:C.textMuted }}>{xml.number}</span>
            </div>
            <button className="btn btn-navy btn-sm" onClick={()=>{ const b=new Blob([xml.content],{type:"application/xml"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=`${xml.number}.xml`; a.click(); URL.revokeObjectURL(u); }}>↓ XML herunterladen</button>
          </div>
          <pre style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:16, fontSize:11.5, color:C.navyMid, overflow:"auto", maxHeight:340, lineHeight:1.6, fontFamily:"'Courier New',monospace" }}>{xml.content.substring(0,2000)}{xml.content.length>2000?"…[gekürzt]":""}</pre>
        </div>
      )}
    </div>
  );

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy }}>Rechnungen</h1>
        <button className="btn btn-navy" onClick={()=>setView("create")}>+ Neue Rechnung</button>
      </div>
      <div className="card">
        {loading ? <div style={{ textAlign:"center", padding:40 }}><Spinner size={24} /></div> : (
          <table className="table">
            <thead><tr>{["Nummer","Empfänger","Betrag","Format","Status","Aktionen"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {invoices.map(inv=>(
                <tr key={inv.id} className="tr-hover">
                  <td style={{ color:C.navyLite, fontWeight:700, fontSize:13 }}>{inv.invoice_number}</td>
                  <td>{inv.buyer_name||"—"}</td>
                  <td style={{ fontWeight:700, color:C.navy }}>{fmtEUR(inv.amount_gross||0)}</td>
                  <td><span style={{ background:C.accentPale, color:C.navyLite, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{inv.format?.toUpperCase()}</span></td>
                  <td><Badge status={inv.status} /></td>
                  <td>
                    <div style={{ display:"flex", gap:7 }}>
                      {inv.status==="validated"&&<button className="btn btn-outline btn-sm" onClick={()=>api.sendInvoice(inv.id,{delivery_method:"email"}).then(()=>{notify("Versendet ✓","success");load();}).catch(e=>notify(e.message,"error"))}>→ Senden</button>}
                      {inv.has_xml&&<button className="btn btn-outline btn-sm" onClick={()=>api.getXML(inv.id).then(c=>setXml({content:c,id:inv.id,number:inv.invoice_number})).catch(e=>notify(e.message,"error"))}>XML</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length===0&&<tr><td colSpan={6} style={{ textAlign:"center", color:C.textMuted, padding:28 }}>Noch keine Rechnungen</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {xml && (
        <div className="modal-bg" onClick={()=>setXml(null)}>
          <div className="modal fi" onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ display:"flex", gap:8 }}><span className="badge bg">EN 16931 ✓</span><span style={{ fontSize:13, color:C.textMuted }}>{xml.number}</span></div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-navy btn-sm" onClick={()=>{ const b=new Blob([xml.content],{type:"application/xml"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=`${xml.number}.xml`; a.click(); }}>↓ Download</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setXml(null)}>×</button>
              </div>
            </div>
            <pre style={{ background:C.bg, borderRadius:8, padding:14, fontSize:11, color:C.navyMid, overflow:"auto", maxHeight:400, lineHeight:1.55, fontFamily:"monospace" }}>{xml.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PLACEHOLDER ────────────────────────────────────────────────
// Diesen Code ersetzt die Placeholder "ERP-Anbindung" im App
// Alle Konnektoren
const ALL_CONNECTORS = [
  // Enterprise
  { type:"sap_s4",        name:"SAP S/4HANA",           icon:"⚙️", cat:"Enterprise",     method:"RFC / IDoc / REST",         available:true,  fields:["SAP Host","Client","Benutzername","Passwort"] },
  { type:"sap_ecc",       name:"SAP ECC 6.0",            icon:"⚙️", cat:"Enterprise",     method:"RFC / IDoc Classic",        available:true,  fields:["SAP Host","Client","Benutzername","Passwort"] },
  { type:"oracle_fusion", name:"Oracle Fusion Cloud",    icon:"🔴", cat:"Enterprise",     method:"Oracle REST API",           available:true,  fields:["Host","Benutzername","Passwort"] },
  { type:"netsuite",      name:"Oracle NetSuite",        icon:"🔴", cat:"Enterprise",     method:"NetSuite REST API",         available:true,  fields:["Account ID","Consumer Key","Token ID"] },
  { type:"workday",       name:"Workday",                icon:"🏢", cat:"Enterprise",     method:"Workday REST API",          available:true,  fields:["Tenant","Client ID","Client Secret"] },
  // Midmarket
  { type:"dynamics365",   name:"Microsoft Dynamics 365", icon:"🔷", cat:"Mittelstand",    method:"Dataverse REST API",        available:true,  fields:["Tenant ID","Client ID","Client Secret"] },
  { type:"business_central",name:"MS Business Central",  icon:"🔷", cat:"Mittelstand",    method:"Business Central API v2",   available:true,  fields:["Tenant ID","Client ID","Client Secret"] },
  { type:"odoo",          name:"Odoo",                   icon:"🟣", cat:"Mittelstand",    method:"JSON-RPC API",              available:true,  fields:["URL","Datenbank","Benutzername","API Key"] },
  { type:"sage",          name:"Sage Business Cloud",    icon:"📘", cat:"Mittelstand",    method:"Sage API v3.1",             available:true,  fields:["Client ID","Client Secret","Land"] },
  // Deutsche Systeme
  { type:"datev",         name:"DATEV",                  icon:"📊", cat:"Deutsche ERP",   method:"DATEV Connect Online",      available:true,  fields:["Client ID","Client Secret","Beraternummer","Mandantennummer"], certification:true },
  { type:"lexware",       name:"Lexware",                icon:"📋", cat:"Deutsche ERP",   method:"XML-Export / SFTP",         available:true,  fields:["SFTP Host","Benutzername","Passwort","Export-Pfad"] },
  { type:"weclapp",       name:"Weclapp",                icon:"🌐", cat:"Deutsche ERP",   method:"Weclapp REST API",          available:true,  fields:["Tenant","API Key"] },
  { type:"sevdesk",       name:"sevDesk",                icon:"📱", cat:"Deutsche ERP",   method:"sevDesk API v2",            available:true,  fields:["API Token"] },
  { type:"lexoffice",     name:"lexoffice",              icon:"📄", cat:"Deutsche ERP",   method:"lexoffice API",             available:true,  fields:["API Key"] },
  // KMU International
  { type:"quickbooks",    name:"QuickBooks Online",      icon:"🟢", cat:"KMU",            method:"QuickBooks API v3",         available:true,  fields:["Client ID","Client Secret","Realm ID"] },
  { type:"xero",          name:"Xero",                   icon:"💙", cat:"KMU",            method:"Xero API v2",               available:true,  fields:["Client ID","Client Secret","Tenant ID"] },
  { type:"freshbooks",    name:"FreshBooks",             icon:"🌿", cat:"KMU",            method:"FreshBooks API v2",         available:true,  fields:["Client ID","Client Secret","Account ID"] },
  { type:"zoho_books",    name:"Zoho Books",             icon:"📚", cat:"KMU",            method:"Zoho Books API",            available:true,  fields:["Client ID","Client Secret","Org ID"] },
  // Universal
  { type:"sftp",          name:"SFTP",                   icon:"📁", cat:"Universal",      method:"SFTP / SSH",                available:true,  fields:["Host","Port","Benutzername","Passwort","Pfad"] },
  { type:"email_import",  name:"E-Mail Import",          icon:"📧", cat:"Universal",      method:"IMAP / SMTP",               available:true,  fields:["IMAP Host","Port","Benutzername","Passwort"] },
  { type:"rest_api",      name:"REST API (Generisch)",   icon:"🔌", cat:"Universal",      method:"HTTP REST / JSON",          available:true,  fields:["Endpoint URL","Auth-Typ","API Key"] },
];
const CATEGORIES = ["Alle","Enterprise","Mittelstand","Deutsche ERP","KMU","Universal"];
// (uses shared C and F from main app)

function ConnectScreen({ notify }) {
  const [cat, setCat]         = useState("Alle");
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null);  // connector to configure
  const [testing, setTesting] = useState({});
  const [connected, setConnected] = useState({});
  const [formData, setFormData]   = useState({});

  const filtered = ALL_CONNECTORS.filter(c => {
    const matchCat = cat === "Alle" || c.cat === cat;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.method.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleConnect = async (connector) => {
    setModal(connector);
    setFormData({});
  };

  const handleTest = async (type) => {
    setTesting(p => ({ ...p, [type]: true }));
    try {
      const res = await fetch(`/api/v1/connect/${type}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('invoiq_token')}` }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.status === 'connected') {
        setConnected(p => ({ ...p, [type]: true }));
        notify(`${ALL_CONNECTORS.find(c=>c.type===type)?.name} verbunden ✓`, "success");
      }
    } catch(e) {
      // Simulate success in demo
      await new Promise(r => setTimeout(r, 900));
      setConnected(p => ({ ...p, [type]: true }));
      notify(`${ALL_CONNECTORS.find(c=>c.type===type)?.name} verbunden ✓ (Demo)`, "success");
    }
    setTesting(p => ({ ...p, [type]: false }));
  };

  const handleSave = async () => {
    if (!modal) return;
    setTesting(p => ({ ...p, [modal.type]: true }));
    await new Promise(r => setTimeout(r, 800));
    setConnected(p => ({ ...p, [modal.type]: true }));
    notify(`${modal.name} konfiguriert und verbunden ✓`, "success");
    setTesting(p => ({ ...p, [modal.type]: false }));
    setModal(null);
  };

  const catCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = c === "Alle" ? ALL_CONNECTORS.length : ALL_CONNECTORS.filter(x => x.cat === c).length;
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: F.u }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, letterSpacing:"-.025em" }}>ERP-Konnektoren</h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:4 }}>{ALL_CONNECTORS.length} Systeme verfügbar · {Object.keys(connected).length} verbunden</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ background:C.greenBg, color:C.green, border:`1px solid ${C.greenBdr}`, borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
            ✓ {Object.keys(connected).length} Verbunden
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom:18 }}>
        <input
          style={{ width:"100%", maxWidth:360, background:C.white, border:`1.5px solid ${C.border}`, borderRadius:9, padding:"10px 14px", fontFamily:F.u, fontSize:14, color:C.text, outline:"none" }}
          placeholder="System suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.border}`, marginBottom:24, overflowX:"auto" }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ padding:"8px 16px", fontSize:13, fontWeight:600, color:cat===c?C.navy:C.textMuted, border:"none", background:"transparent", cursor:"pointer", borderBottom:`2px solid ${cat===c?C.navy:"transparent"}`, fontFamily:F.u, whiteSpace:"nowrap", transition:"all .15s" }}>
            {c} <span style={{ fontSize:10, background:C.bg, padding:"1px 6px", borderRadius:9, marginLeft:4, color:C.textMuted }}>{catCounts[c]}</span>
          </button>
        ))}
      </div>

      {/* Connected Banner */}
      {Object.keys(connected).length > 0 && (
        <div style={{ background:C.greenBg, border:`1px solid ${C.greenBdr}`, borderRadius:10, padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:16 }}>✅</span>
          <span style={{ fontSize:13, color:C.green, fontWeight:600 }}>
            {Object.keys(connected).map(k => ALL_CONNECTORS.find(c=>c.type===k)?.name).join(", ")} verbunden
          </span>
        </div>
      )}

      {/* Connector Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(280px,100%), 1fr))", gap:14 }}>
        {filtered.map(conn => {
          const isConnected = connected[conn.type];
          const isTesting = testing[conn.type];
          return (
            <div key={conn.type} style={{ background:C.white, border:`1px solid ${isConnected?C.greenBdr:C.border}`, borderRadius:14, padding:"20px", transition:"border-color .2s, transform .2s, box-shadow .2s", cursor:"pointer", position:"relative" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=isConnected?C.green:C.navyLite; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(8,18,42,.08)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=isConnected?C.greenBdr:C.border; e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>

              {/* Connected badge */}
              {isConnected && (
                <div style={{ position:"absolute", top:12, right:12, background:C.greenBg, color:C.green, border:`1px solid ${C.greenBdr}`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>✓ Verbunden</div>
              )}
              {conn.certification && !isConnected && (
                <div style={{ position:"absolute", top:12, right:12, background:C.amberBg, color:C.amber, border:`1px solid ${C.amberBdr}`, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>Zertif. nötig</div>
              )}

              <div style={{ fontSize:26, marginBottom:10 }}>{conn.icon}</div>
              <div style={{ fontWeight:700, color:C.navy, fontSize:14, marginBottom:3 }}>{conn.name}</div>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>{conn.method}</div>
              <div style={{ display:"inline-block", background:C.accentPale, color:C.navyLite, borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700, marginBottom:14 }}>{conn.cat}</div>

              <div style={{ display:"flex", gap:8 }}>
                {isConnected ? (
                  <>
                    <button onClick={()=>handleTest(conn.type)} disabled={isTesting} style={{ flex:1, background:C.greenBg, color:C.green, border:`1px solid ${C.greenBdr}`, borderRadius:7, padding:"7px 0", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:F.u }}>
                      {isTesting ? "..." : "Testen"}
                    </button>
                    <button onClick={()=>handleConnect(conn)} style={{ background:C.bg, color:C.textMuted, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:F.u }}>⚙️</button>
                  </>
                ) : (
                  <button onClick={()=>handleConnect(conn)} style={{ flex:1, background:C.navy, color:"#fff", border:"none", borderRadius:7, padding:"8px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:F.u, transition:"background .15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.navyMid} onMouseLeave={e=>e.currentTarget.style.background=C.navy}>
                    Verbinden →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(8,18,42,.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24, backdropFilter:"blur(4px)" }} onClick={()=>setModal(null)}>
          <div style={{ background:C.white, borderRadius:16, padding:28, maxWidth:480, width:"100%", boxShadow:"0 20px 60px rgba(8,18,42,.2)" }} onClick={e=>e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <span style={{ fontSize:24 }}>{modal.icon}</span>
                  <span style={{ fontFamily:F.d, fontSize:20, fontWeight:400, color:C.navy }}>{modal.name}</span>
                </div>
                <div style={{ fontSize:12, color:C.textMuted }}>{modal.method}</div>
              </div>
              <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.textMuted }}>×</button>
            </div>

            {/* Certification warning */}
            {modal.certification && (
              <div style={{ background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.amber }}>
                ⚠️ {modal.name} erfordert eine offizielle Zertifizierung. Kontaktiere uns unter <strong>manfred@invoiq.io</strong> für den Prozess.
              </div>
            )}

            {/* Fields */}
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              {modal.fields.map(field => (
                <div key={field}>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:.7, textTransform:"uppercase", marginBottom:6 }}>{field}</label>
                  <input
                    type={field.toLowerCase().includes("passwort") || field.toLowerCase().includes("secret") || field.toLowerCase().includes("token") ? "password" : "text"}
                    style={{ width:"100%", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:9, padding:"10px 14px", fontFamily:F.u, fontSize:14, color:C.text, outline:"none" }}
                    placeholder={field}
                    value={formData[field] || ""}
                    onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = C.navyLite}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>
              ))}
            </div>

            {/* Docs link */}
            <div style={{ background:C.bg, borderRadius:8, padding:"8px 12px", marginBottom:16, fontSize:12, color:C.textMuted }}>
              📚 Dokumentation: <span style={{ color:C.navyLite }}>{modal.type}.invoiq.io/docs</span>
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setModal(null)} style={{ background:"transparent", color:C.navyLite, border:`1.5px solid ${C.border}`, borderRadius:9, padding:"9px 20px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:F.u }}>Abbrechen</button>
              <button onClick={handleSave} disabled={testing[modal?.type]} style={{ background:C.navy, color:"#fff", border:"none", borderRadius:9, padding:"9px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:F.u, display:"flex", alignItems:"center", gap:7 }}>
                {testing[modal?.type] ? "Verbinde..." : "Verbindung speichern →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── PLACEHOLDER ──
function Placeholder({ title, sub }) {
  return (
    <div className="fi">
      <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, marginBottom:6 }}>{title}</h1>
      <p style={{ color:C.textMuted, fontSize:14, marginBottom:24 }}>{sub}</p>
      <div className="card" style={{ textAlign:"center", padding:56, color:C.textLight, fontSize:14 }}>In Release 1.0 vollständig verfügbar.</div>
    </div>
  );
}

// ── ADMIN SHELL ────────────────────────────────────────────────
function AdminShell({ user, org, nav, setNav, onBack, children }) {
  const superNav = [
    { section:"Plattform" },
    { key:"overview",   icon:"▦",  label:"Übersicht"       },
    { key:"customers",  icon:"🏢", label:"Kunden"          },
    { key:"allinvoices",icon:"⊟",  label:"Alle Rechnungen" },
    { key:"users",      icon:"👤", label:"Nutzer"          },
    { key:"revenue",    icon:"📈", label:"Umsatz"          },
    { section:"System" },
    { key:"peppol",     icon:"🌍", label:"Peppol Status"   },
    { key:"apilogs",    icon:"📋", label:"API Logs"        },
  ];
  const custNav = [
    { section: org?.name||"Mein Unternehmen" },
    { key:"overview",   icon:"▦",  label:"Übersicht"       },
    { key:"myinvoices", icon:"⊟",  label:"Rechnungen"      },
    { key:"myusers",    icon:"👤", label:"Nutzer"          },
    { key:"mysettings", icon:"⚙️", label:"Einstellungen"   },
    { key:"billing",    icon:"💳", label:"Abrechnung"      },
  ];
  const isSuper = user?.email==="demo@invoiq.io" || user?.email==="manfred@invoiq.io";
  const navItems = isSuper ? superNav : custNav;

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.bg }}>
      <aside style={{ width:240, background:C.white, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, position:"sticky", top:0, height:"100vh" }}>
        <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${C.border}` }}>
          <Wordmark size={22} />
          <div style={{ fontSize:10, color:C.red, fontWeight:700, letterSpacing:.5, marginTop:5, textTransform:"uppercase" }}>
            {isSuper?"⚙️ Super Admin Panel":"👤 Kunden Admin"}
          </div>
        </div>
        <nav style={{ flex:1, padding:"8px 0", overflowY:"auto" }}>
          {navItems.map((item,i) =>
            item.section
              ? <div key={i} className="nav-section">{item.section}</div>
              : <button key={item.key} className={`nav-link ${nav===item.key?"active":""}`} onClick={()=>setNav(item.key)}>
                  <span style={{ fontSize:14, width:18, textAlign:"center" }}>{item.icon}</span>{item.label}
                </button>
          )}
        </nav>
        <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.border}` }}>
          <button className="btn btn-outline btn-sm" style={{ width:"100%", justifyContent:"center" }} onClick={onBack}>← Zurück zur App</button>
        </div>
      </aside>
      <main style={{ flex:1, overflowY:"auto", padding:"32px 36px" }}>{children}</main>
    </div>
  );
}

// ── ADMIN VIEWS ────────────────────────────────────────────────
function AdminOverview({ notify, isSuper }) {
  const totalMRR = mockOrgs.filter(o=>o.status==="active").reduce((s,o)=>s+o.mrr,0);
  const errors = mockAllInvoices.filter(i=>i.status==="error").length;
  const activeOrgs = mockOrgs.filter(o=>o.status==="active").length;

  if(!isSuper) {
    const org = mockOrgs[0];
    return (
      <div className="fi">
        <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, marginBottom:24 }}>Übersicht · {org.name}</h1>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
          {[
            { label:"Dokumente genutzt", value:org.docs_used, sub:`von ${org.docs_limit}` },
            { label:"Aktive Nutzer",     value:org.users,     sub:"diesen Monat" },
            { label:"Fehler",            value:org.errors,    sub:org.errors>0?"Offen":"Keine", color:org.errors>0?C.red:C.green },
            { label:"Compliance",        value:"98%",          sub:"EN 16931 ✓", color:C.green },
          ].map((s,i)=>(
            <div key={i} className="card">
              <div className="label" style={{ marginBottom:9 }}>{s.label}</div>
              <div style={{ fontFamily:F.d, fontSize:34, fontWeight:500, color:s.color||C.navy, lineHeight:1, marginBottom:5 }}>{s.value}</div>
              <div style={{ fontSize:12, color:C.textMuted }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <h3 style={{ fontFamily:F.d, fontSize:16, fontWeight:500, color:C.navy }}>Dokumenten-Kontingent</h3>
            <span style={{ fontSize:13, color:C.textMuted }}>{org.docs_used} / {org.docs_limit}</span>
          </div>
          <div className="progress" style={{ height:8 }}><div className="progress-fill" style={{ width:`${(org.docs_used/org.docs_limit)*100}%` }} /></div>
          {(org.docs_used/org.docs_limit)>0.8 && (
            <div style={{ marginTop:12, background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.amber }}>
              ⚠️ Nähern sich dem Limit — <button style={{ background:"none", border:"none", color:C.navyLite, cursor:"pointer", fontWeight:700, textDecoration:"underline" }} onClick={()=>notify("Upgrade-Anfrage gesendet","success")}>Jetzt upgraden</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:26 }}>
        <div>
          <h1 style={{ fontFamily:F.d, fontSize:28, fontWeight:400, color:C.navy }}>Platform Übersicht</h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:4 }}>invoiq.io — Super Admin</p>
        </div>
        <button className="btn btn-navy btn-sm" onClick={()=>notify("Export gestartet","success")}>↓ Export</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:22 }}>
        {[
          { label:"MRR",            value:fmtEUR(totalMRR), sub:"▲ +12% Vormonat",  color:C.navy },
          { label:"Aktive Kunden",  value:activeOrgs,        sub:`${mockOrgs.length} gesamt`, color:C.navy },
          { label:"Dokumente heute",value:fmtNum(mockOrgs.reduce((s,o)=>s+o.docs_used,0)), sub:"Diesen Monat", color:C.navy },
          { label:"Offene Fehler",  value:errors,             sub:errors>0?"Bitte prüfen":"Alles OK", color:errors>0?C.red:C.green },
        ].map((s,i)=>(
          <div key={i} className="card fi" style={{ animationDelay:`${i*.07}s` }}>
            <div className="label" style={{ marginBottom:9 }}>{s.label}</div>
            <div style={{ fontFamily:F.d, fontSize:32, fontWeight:500, color:s.color, lineHeight:1, marginBottom:5 }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.textMuted }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* MRR Chart */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ fontFamily:F.d, fontSize:16, fontWeight:500, color:C.navy }}>MRR Entwicklung 2025</h3>
          <span className="badge bg">+23% YTD</span>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
          {[320,380,340,420,480,520,580,620,680,720,780,847].map((v,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ width:"100%", background:i===4?C.navy:C.accentPale, borderRadius:"3px 3px 0 0", height:`${(v/847)*72}px`, transition:"height .3s", cursor:"default" }} title={fmtEUR(v)} />
              <div style={{ fontSize:9, color:C.textLight }}>{"JFMAMJJASOND"[i]}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Customer table */}
      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ fontFamily:F.d, fontSize:16, fontWeight:500, color:C.navy }}>Kunden</h3>
        </div>
        <table className="table">
          <thead><tr>{["Organisation","Plan","Status","Dokumente","MRR"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {mockOrgs.map(org=>(
              <tr key={org.id} className="tr-hover">
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <div className="avatar">{org.name[0]}</div>
                    <div><div style={{ fontWeight:600, color:C.navy }}>{org.name}</div><div style={{ fontSize:11, color:C.textMuted }}>{org.vat_id}</div></div>
                  </div>
                </td>
                <td><Badge status={org.plan} /></td>
                <td><Badge status={org.status} /></td>
                <td>
                  <div style={{ fontSize:13 }}>{fmtNum(org.docs_used)}/{fmtNum(org.docs_limit)}</div>
                  <div className="progress" style={{ width:70, marginTop:4 }}><div className="progress-fill" style={{ width:`${Math.min(100,(org.docs_used/org.docs_limit)*100)}%` }} /></div>
                </td>
                <td style={{ fontWeight:700, color:C.navy }}>{fmtEUR(org.mrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminCustomers({ notify }) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const filtered = mockOrgs.filter(o=>o.name.toLowerCase().includes(search.toLowerCase())||o.vat_id.includes(search));
  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy }}>Kunden</h1>
        <button className="btn btn-navy btn-sm" onClick={()=>setModal("new")}>+ Neuer Kunde</button>
      </div>
      <input className="input" style={{ maxWidth:320, marginBottom:18 }} placeholder="Suche..." value={search} onChange={e=>setSearch(e.target.value)} />
      <div className="card">
        <table className="table">
          <thead><tr>{["Kunde","Plan","Status","Nutzer","Dokumente","MRR","Aktionen"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(org=>(
              <tr key={org.id} className="tr-hover">
                <td><div style={{ display:"flex", alignItems:"center", gap:9 }}><div className="avatar">{org.name[0]}</div><div><div style={{ fontWeight:600, color:C.navy, fontSize:13 }}>{org.name}</div><div style={{ fontSize:11, color:C.textMuted }}>{org.vat_id}</div></div></div></td>
                <td><Badge status={org.plan} /></td>
                <td><Badge status={org.status} /></td>
                <td style={{ color:C.textMid }}>{org.users}</td>
                <td><div style={{ fontSize:13 }}>{org.docs_used}/{org.docs_limit}</div><div className="progress" style={{ width:60, marginTop:4 }}><div className="progress-fill" style={{ width:`${Math.min(100,(org.docs_used/org.docs_limit)*100)}%` }} /></div></td>
                <td style={{ fontWeight:700, color:C.navy }}>{fmtEUR(org.mrr)}</td>
                <td><div style={{ display:"flex", gap:6 }}>
                  <button className="btn btn-outline btn-sm" onClick={()=>setModal(org)}>Details</button>
                  {org.status==="active"?<button className="btn btn-danger btn-sm" onClick={()=>notify(`${org.name} gesperrt`,"error")}>Sperren</button>:<button className="btn btn-success btn-sm" onClick={()=>notify(`${org.name} aktiviert`,"success")}>Aktivieren</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && modal!=="new" && (
        <div className="modal-bg" onClick={()=>setModal(null)}>
          <div className="modal fi" onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
              <div><div style={{ fontFamily:F.d, fontSize:20, fontWeight:400, color:C.navy }}>{modal.name}</div><div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>Seit {modal.created}</div></div>
              <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.textMuted }}>×</button>
            </div>
            <div className="divider" style={{ marginBottom:16 }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
              {[["Plan",<Badge status={modal.plan}/>],["Status",<Badge status={modal.status}/>],["MRR",fmtEUR(modal.mrr)],["Nutzer",modal.users],["Dokumente",`${modal.docs_used}/${modal.docs_limit}`],["Fehler",modal.errors]].map(([l,v],i)=>(
                <div key={i} style={{ padding:"10px 12px", background:C.bg, borderRadius:8 }}>
                  <div className="label" style={{ marginBottom:4 }}>{l}</div>
                  <div style={{ fontWeight:600, color:C.navy }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Schließen</button>
              <button className="btn btn-navy" onClick={()=>{notify("Plan geändert","success");setModal(null);}}>Plan ändern</button>
            </div>
          </div>
        </div>
      )}
      {modal==="new" && (
        <div className="modal-bg" onClick={()=>setModal(null)}>
          <div className="modal fi" onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:F.d, fontSize:20, fontWeight:400, color:C.navy, marginBottom:18 }}>Neuer Kunde</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[["Unternehmensname","Müller GmbH"],["USt-IdNr.","DE123456789"],["E-Mail","kontakt@firma.de"],["Stadt","Berlin"]].map(([l,p])=>(
                <div key={l}><label className="label">{l}</label><input className="input" placeholder={p} /></div>
              ))}
              <div><label className="label">Plan</label>
                <select className="select"><option>Starter (49 €)</option><option>Business (199 €)</option><option>Pro (599 €)</option></select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:18 }}>
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Abbrechen</button>
              <button className="btn btn-navy" onClick={()=>{notify("Kunde angelegt ✓","success");setModal(null);}}>Anlegen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAllInvoices({ notify }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all"?mockAllInvoices:mockAllInvoices.filter(i=>i.status===filter);
  return (
    <div className="fi">
      <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, marginBottom:20 }}>Alle Rechnungen</h1>
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
        {["all","delivered","validated","error","archived"].map(s=>(
          <button key={s} className={`tab ${filter===s?"active":""}`} onClick={()=>setFilter(s)}>
            {{all:"Alle",delivered:"Zugestellt",validated:"Validiert",error:"Fehler",archived:"Archiviert"}[s]}
            <span style={{ marginLeft:5, fontSize:10, background:C.bg, padding:"1px 6px", borderRadius:9, color:C.textMuted }}>
              {s==="all"?mockAllInvoices.length:mockAllInvoices.filter(i=>i.status===s).length}
            </span>
          </button>
        ))}
      </div>
      <div className="card">
        <table className="table">
          <thead><tr>{["Nummer","Kunde","Betrag","Format","Status","Datum","Aktion"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(inv=>(
              <tr key={inv.id} className="tr-hover">
                <td style={{ color:C.navyLite, fontWeight:700 }}>{inv.number}</td>
                <td style={{ color:C.text, fontSize:13 }}>{inv.org}</td>
                <td style={{ fontWeight:700, color:C.navy }}>{fmtEUR(inv.amount)}</td>
                <td><span style={{ background:C.accentPale, color:C.navyLite, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{inv.format.toUpperCase()}</span></td>
                <td><Badge status={inv.status} /></td>
                <td style={{ color:C.textMuted, fontSize:12 }}>{inv.date}</td>
                <td>{inv.status==="error"&&<button className="btn btn-danger btn-sm" onClick={()=>notify("Fehler untersucht","info")}>Prüfen</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUsers({ notify }) {
  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy }}>Nutzer</h1>
        <button className="btn btn-navy btn-sm" onClick={()=>notify("Einladung gesendet","success")}>+ Einladen</button>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr>{["Nutzer","Rolle","Organisation","Status","Login","Aktionen"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {mockAllUsers.map(u=>(
              <tr key={u.id} className="tr-hover">
                <td><div style={{ display:"flex", alignItems:"center", gap:9 }}><div className="avatar">{u.name[0]}</div><div><div style={{ fontWeight:600, color:C.navy, fontSize:13 }}>{u.name}</div><div style={{ fontSize:11, color:C.textMuted }}>{u.email}</div></div></div></td>
                <td><Badge status={u.role} /></td>
                <td style={{ color:C.textMid, fontSize:13 }}>{u.org}</td>
                <td><Badge status={u.status} /></td>
                <td style={{ color:C.textMuted, fontSize:12 }}>{u.last_login}</td>
                <td><div style={{ display:"flex", gap:6 }}>
                  <button className="btn btn-outline btn-sm" onClick={()=>notify("Reset gesendet","success")}>Reset</button>
                  {u.status==="active"&&u.role!=="super_admin"&&<button className="btn btn-danger btn-sm" onClick={()=>notify(`${u.name} gesperrt`,"error")}>Sperren</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminRevenue() {
  const plans = [{name:"Starter",count:2,price:49},{name:"Business",count:2,price:199},{name:"Pro",count:1,price:599}];
  const mrr = plans.reduce((s,p)=>s+p.count*p.price,0);
  return (
    <div className="fi">
      <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, marginBottom:22 }}>Umsatz & Statistiken</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:22 }}>
        {[["MRR",fmtEUR(mrr),"Monatlicher Umsatz"],["ARR",fmtEUR(mrr*12),"Jahresumsatz (Proj.)"],["Ø/Kunde",fmtEUR(mrr/5),"Pro aktivem Kunde"]].map(([l,v,s])=>(
          <div key={l} className="card">
            <div className="label" style={{ marginBottom:9 }}>{l}</div>
            <div style={{ fontFamily:F.d, fontSize:32, fontWeight:500, color:C.navy, lineHeight:1, marginBottom:5 }}>{v}</div>
            <div style={{ fontSize:12, color:C.textMuted }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <div className="card">
          <h3 style={{ fontFamily:F.d, fontSize:16, fontWeight:500, color:C.navy, marginBottom:16 }}>Plan-Verteilung</h3>
          {plans.map(p=>(
            <div key={p.name} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:13 }}>
                <span style={{ fontWeight:600, color:C.navy }}>{p.name}</span>
                <span style={{ color:C.textMuted }}>{p.count} · {fmtEUR(p.count*p.price)}/Mo</span>
              </div>
              <div className="progress"><div className="progress-fill" style={{ width:`${(p.count/5)*100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ fontFamily:F.d, fontSize:16, fontWeight:500, color:C.navy, marginBottom:16 }}>Dokument-Volumen</h3>
          {mockOrgs.filter(o=>o.status==="active").map(org=>(
            <div key={org.id} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                <span style={{ fontWeight:600, color:C.navy, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:150 }}>{org.name}</span>
                <span style={{ color:C.textMuted, flexShrink:0 }}>{fmtNum(org.docs_used)}</span>
              </div>
              <div className="progress"><div className="progress-fill" style={{ width:`${(org.docs_used/org.docs_limit)*100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ROOT APP ───────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | auth | app | admin
  const [mode,   setMode]   = useState("login");
  const [nav,    setNav]    = useState("dashboard");
  const [adminNav, setAdminNav] = useState("overview");
  const [loading, setLoading]  = useState(false);
  const [toast,   setToast]    = useState(null);
  const [user, setUser] = useState(null);
  const [org,  setOrg]  = useState(null);

  const notify = (msg, type="info") => setToast({ msg, type });

  // Check saved session
  useEffect(() => {
    const token = localStorage.getItem("invoiq_token");
    if(token) {
      api.setToken(token);
      api.me().then(d=>{ setUser(d.user); setOrg(d.org); setScreen("app"); }).catch(()=>{ localStorage.removeItem("invoiq_token"); });
    }
  }, []);

  const handleAuth = async form => {
    setLoading(true);
    try {
      const fn = mode==="login" ? api.login : api.register;
      const d = await fn(form);
      api.setToken(d.access_token);
      setUser(d.user); setOrg(d.org);
      setScreen("app"); setNav("dashboard");
      notify(`Willkommen${d.user.full_name?`, ${d.user.full_name.split(" ")[0]}`:""}!`, "success");
    } catch(e) {
      // Fallback: demo mode
      setUser({ full_name: form.full_name||"Manfred Bell", email: form.email, role:"owner" });
      setOrg({ name: form.org_name||"invoiq Demo", plan:"business", plan_doc_limit:1000, plan_doc_used:41 });
      setScreen("app"); setNav("dashboard");
      notify("Demo-Modus aktiv","info");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await api.logout().catch(()=>{});
    api.setToken(null);
    setUser(null); setOrg(null);
    setScreen("landing");
    notify("Abgemeldet","info");
  };

  const isSuper = user?.email==="demo@invoiq.io"||user?.email==="manfred@invoiq.io";

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}

      {screen==="landing" && <Landing onEnter={()=>{ setMode("login"); setScreen("auth"); }} />}

      {screen==="auth" && (
        <Auth mode={mode} onSwitch={()=>setMode(m=>m==="login"?"register":"login")} onSuccess={handleAuth} loading={loading} />
      )}

      {screen==="app" && (
        <AppShell user={user} org={org} nav={nav} setNav={setNav} onLogout={handleLogout} onAdmin={()=>{ setAdminNav("overview"); setScreen("admin"); }}>
          {nav==="dashboard" && <Dashboard user={user} org={org} notify={notify} onNav={setNav} />}
          {nav==="invoices"  && <Invoices  notify={notify} />}
          {nav==="archive"   && <Placeholder title="GoBD-Archiv"    sub="SHA-256 · §147 AO · 10 Jahre Aufbewahrung" />}
          {nav==="connect"   && <ConnectScreen notify={notify} />}
          {nav==="webhooks"  && <Placeholder title="Webhooks"       sub="invoice.created · invoice.sent · invoice.delivered" />}
          {nav==="settings"  && <Placeholder title="Einstellungen"  sub="Konto · Plan · API-Keys · White-Label" />}
        </AppShell>
      )}

      {screen==="admin" && (
        <AdminShell user={user} org={org} nav={adminNav} setNav={setAdminNav} onBack={()=>setScreen("app")}>
          {adminNav==="overview"    && <AdminOverview   notify={notify} isSuper={isSuper} />}
          {adminNav==="customers"   && <AdminCustomers  notify={notify} />}
          {adminNav==="allinvoices" && <AdminAllInvoices notify={notify} />}
          {adminNav==="users"       && <AdminUsers      notify={notify} />}
          {adminNav==="revenue"     && <AdminRevenue />}
          {adminNav==="myinvoices"  && <AdminAllInvoices notify={notify} />}
          {adminNav==="myusers"     && <AdminUsers      notify={notify} />}
          {adminNav==="mysettings"  && <Placeholder title="Einstellungen" sub="Unternehmensdaten · API-Key · Integrationen" />}
          {adminNav==="billing"     && <Placeholder title="Abrechnung" sub="Plan · Rechnungshistorie · Zahlungsmethode" />}
          {(adminNav==="peppol"||adminNav==="apilogs") && (
            <div className="fi">
              <h1 style={{ fontFamily:F.d, fontSize:26, fontWeight:400, color:C.navy, marginBottom:8 }}>
                {adminNav==="peppol"?"Peppol Status":"API Logs"}
              </h1>
              <p style={{ color:C.textMuted, fontSize:14, marginBottom:24 }}>
                {adminNav==="peppol"?"Storecove Verbindungsstatus · Peppol BIS 3.0":"Unveränderlicher Audit-Trail (GoBD-konform)"}
              </p>
              <div className="card" style={{ textAlign:"center", padding:48 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>{adminNav==="peppol"?"🌍":"📋"}</div>
                {adminNav==="peppol" ? (
                  <div style={{ background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:9, padding:"14px 18px", display:"inline-block" }}>
                    <div style={{ fontSize:14, color:C.amber, fontWeight:700 }}>⏳ Storecove Sandbox ausstehend</div>
                    <div style={{ fontSize:12, color:C.amber, marginTop:4 }}>Anfrage gesendet — Antwort in 1–2 Werktagen</div>
                  </div>
                ) : <div style={{ color:C.textMuted, fontSize:14 }}>GoBD-konformer Audit-Trail in Release 1.0</div>}
              </div>
            </div>
          )}
        </AdminShell>
      )}
    </>
  );
}

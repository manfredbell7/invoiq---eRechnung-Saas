import { useState, useEffect, useCallback, useRef } from "react";
import OnboardingWizard from "./OnboardingWizard.jsx";

/* ═══════════════════════════════════════════════════════════════
   invoiq — Complete App · Design System v2
   Inspired by: Linear, Stripe, Notion, Lattice
   Palette: Deep Navy · Pure White · Slate grays · Electric Blue
   Fonts: Instrument Serif + Inter
   ═══════════════════════════════════════════════════════════════ */

const T = {
  brand:"#0F172A",brandMid:"#1E293B",brandLite:"#334155",
  accent:"#2563EB",accentHover:"#1D4ED8",accentLight:"#EFF6FF",accentPale:"#DBEAFE",
  bg:"#FFFFFF",bgSubtle:"#F8FAFC",bgMuted:"#F1F5F9",bgBorder:"#E2E8F0",
  textPrimary:"#0F172A",textSecondary:"#475569",textMuted:"#94A3B8",textInverse:"#FFFFFF",
  green:"#059669",greenBg:"#ECFDF5",greenBdr:"#A7F3D0",
  red:"#DC2626",redBg:"#FEF2F2",redBdr:"#FECACA",
  amber:"#D97706",amberBg:"#FFFBEB",amberBdr:"#FDE68A",
  blue:"#2563EB",blueBg:"#EFF6FF",blueBdr:"#BFDBFE",
  purple:"#7C3AED",purpleBg:"#F5F3FF",purpleBdr:"#DDD6FE",
  shadow1:"0 1px 3px rgba(15,23,42,.06),0 1px 2px rgba(15,23,42,.04)",
  shadow2:"0 4px 6px rgba(15,23,42,.05),0 2px 4px rgba(15,23,42,.04)",
  shadow3:"0 10px 24px rgba(15,23,42,.08),0 4px 8px rgba(15,23,42,.04)",
  shadowXl:"0 20px 48px rgba(15,23,42,.12),0 8px 16px rgba(15,23,42,.06)",
};
const F={display:"'Instrument Serif','Georgia',serif",ui:"'Inter','DM Sans',system-ui,sans-serif",mono:"'JetBrains Mono','Fira Code',monospace"};

const API_BASE=(typeof import!=='undefined'&&import.meta?.env?.VITE_API_URL)||"http://localhost:3000/api/v1";
const api={
  _token:(typeof localStorage!=='undefined'&&localStorage.getItem("invoiq_token"))||null,
  setToken(t){this._token=t;if(typeof localStorage!=='undefined'){if(t)localStorage.setItem("invoiq_token",t);else localStorage.removeItem("invoiq_token");}},
  async req(method,path,body){
    const headers={"Content-Type":"application/json"};
    if(this._token)headers["Authorization"]=`Bearer ${this._token}`;
    try{const res=await fetch(`${API_BASE}${path}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data;}
    catch(err){if(err.message.includes("fetch"))throw new Error("Backend nicht erreichbar");throw err;}
  },
  get:(p)=>api.req("GET",p),post:(p,b)=>api.req("POST",p,b),
  login:(b)=>api.post("/auth/login",b),register:(b)=>api.post("/auth/register",b),
  me:()=>api.get("/auth/me"),logout:()=>api.post("/auth/logout",{}),
  getStats:()=>api.get("/invoices/stats"),listInvoices:(q="")=>api.get(`/invoices${q}`),
  createInvoice:(b)=>api.post("/invoices",b),sendInvoice:(id,b)=>api.post(`/invoices/${id}/send`,b),
  getXML:(id)=>fetch(`${API_BASE}/invoices/${id}/xml`,{headers:{Authorization:`Bearer ${api._token}`}}).then(r=>r.text()),
};

const MOCK_ORGS=[
  {id:"o1",name:"Müller & Partner GmbH",plan:"business",status:"active",docs_used:284,docs_limit:1000,mrr:199,vat_id:"DE123456789",users:3,errors:2},
  {id:"o2",name:"TechVision AG",plan:"pro",status:"active",docs_used:1840,docs_limit:10000,mrr:599,vat_id:"DE987654321",users:8,errors:0},
  {id:"o3",name:"Stadtwerke Süd GmbH",plan:"starter",status:"active",docs_used:67,docs_limit:100,mrr:49,vat_id:"DE456789123",users:1,errors:1},
  {id:"o4",name:"Bauer Logistik KG",plan:"business",status:"trial",docs_used:12,docs_limit:1000,mrr:0,vat_id:"DE321654987",users:2,errors:0},
];
const MOCK_INV=[
  {id:"i1",org:"Müller & Partner GmbH",number:"INV-2025-284",amount:4284,format:"xrechnung",status:"delivered",date:"2025-05-25"},
  {id:"i2",org:"TechVision AG",number:"INV-2025-1840",amount:22900,format:"zugferd",status:"delivered",date:"2025-05-25"},
  {id:"i3",org:"Stadtwerke Süd GmbH",number:"INV-2025-067",amount:780,format:"peppol",status:"error",date:"2025-05-24"},
  {id:"i4",org:"Bauer Logistik KG",number:"INV-2025-012",amount:1250,format:"xrechnung",status:"validated",date:"2025-05-24"},
];
const fmtEUR=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
const fmtNum=n=>new Intl.NumberFormat("de-DE").format(n||0);
const fmtAgo=d=>{const s=Date.now()-new Date(d);if(s<3600000)return`vor ${Math.floor(s/60000)} Min.`;if(s<86400000)return`vor ${Math.floor(s/3600000)} Std.`;return"gestern";};

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
body{font-family:${F.ui};background:${T.bg};color:${T.textPrimary};font-size:14px;line-height:1.6;}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:${T.bgSubtle};}::-webkit-scrollbar-thumb{background:${T.bgBorder};border-radius:3px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.fu{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
.fu2{animation:fadeUp .5s .08s cubic-bezier(.22,1,.36,1) both}
.fu3{animation:fadeUp .5s .16s cubic-bezier(.22,1,.36,1) both}
.fu4{animation:fadeUp .5s .24s cubic-bezier(.22,1,.36,1) both}
.fu5{animation:fadeUp .5s .32s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn .35s ease both}.sci{animation:scaleIn .3s cubic-bezier(.22,1,.36,1) both}
.skeleton{background:linear-gradient(90deg,${T.bgMuted} 25%,${T.bgSubtle} 50%,${T.bgMuted} 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:6px;}
.btn{font-family:${F.ui};font-weight:600;cursor:pointer;border-radius:8px;border:none;display:inline-flex;align-items:center;gap:6px;transition:all .16s cubic-bezier(.22,1,.36,1);white-space:nowrap;letter-spacing:-.01em;}
.btn:active{transform:scale(.98)!important;}.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;}
.btn-primary{background:${T.accent};color:#fff;padding:9px 18px;font-size:13.5px;box-shadow:0 1px 3px rgba(37,99,235,.25);}
.btn-primary:hover{background:${T.accentHover};transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.3);}
.btn-dark{background:${T.brand};color:#fff;padding:9px 18px;font-size:13.5px;box-shadow:${T.shadow1};}
.btn-dark:hover{background:${T.brandMid};transform:translateY(-1px);}
.btn-ghost{background:transparent;color:${T.textSecondary};border:1px solid ${T.bgBorder};padding:8px 16px;font-size:13.5px;}
.btn-ghost:hover{border-color:${T.textMuted};color:${T.textPrimary};background:${T.bgSubtle};}
.btn-outline{background:transparent;color:${T.accent};border:1px solid ${T.accentPale};padding:7px 14px;font-size:13px;}
.btn-outline:hover{background:${T.accentLight};}
.btn-danger{background:${T.redBg};color:${T.red};border:1px solid ${T.redBdr};padding:7px 14px;font-size:12.5px;}
.btn-success{background:${T.greenBg};color:${T.green};border:1px solid ${T.greenBdr};padding:7px 14px;font-size:12.5px;}
.btn-lg{padding:12px 28px;font-size:15px;border-radius:10px;}
.btn-sm{padding:5px 11px;font-size:12px;border-radius:6px;}
.btn-xl{padding:14px 36px;font-size:16px;border-radius:12px;letter-spacing:-.02em;}
.input{width:100%;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:8px;padding:9px 13px;font-family:${F.ui};font-size:14px;color:${T.textPrimary};outline:none;transition:border-color .15s,box-shadow .15s;}
.input:focus{border-color:${T.accent};box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.input::placeholder{color:${T.textMuted};}
.select{width:100%;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:8px;padding:9px 13px;font-family:${F.ui};font-size:14px;color:${T.textPrimary};outline:none;cursor:pointer;}
.select:focus{border-color:${T.accent};}
.label{display:block;font-size:11.5px;font-weight:600;color:${T.textSecondary};letter-spacing:.3px;margin-bottom:6px;}
.card{background:${T.bg};border:1px solid ${T.bgBorder};border-radius:12px;box-shadow:${T.shadow1};}
.card-hover{transition:all .18s;}.card-hover:hover{border-color:${T.textMuted};box-shadow:${T.shadow2};transform:translateY(-1px);}
.table{width:100%;border-collapse:collapse;}
.table th{text-align:left;padding:10px 14px;font-size:11.5px;color:${T.textMuted};font-weight:600;letter-spacing:.3px;text-transform:uppercase;border-bottom:1px solid ${T.bgBorder};}
.table td{padding:12px 14px;font-size:13.5px;border-bottom:1px solid ${T.bgSubtle};vertical-align:middle;}
.tr-hover:hover{background:${T.bgSubtle};}
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:5px;padding:2px 8px;font-size:11.5px;font-weight:600;}
.badge-green{background:${T.greenBg};color:${T.green};border:1px solid ${T.greenBdr};}
.badge-red{background:${T.redBg};color:${T.red};border:1px solid ${T.redBdr};}
.badge-amber{background:${T.amberBg};color:${T.amber};border:1px solid ${T.amberBdr};}
.badge-blue{background:${T.blueBg};color:${T.blue};border:1px solid ${T.blueBdr};}
.badge-purple{background:${T.purpleBg};color:${T.purple};border:1px solid ${T.purpleBdr};}
.badge-gray{background:${T.bgMuted};color:${T.textSecondary};border:1px solid ${T.bgBorder};}
.nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;background:transparent;color:${T.textMuted};border:none;border-radius:7px;cursor:pointer;font-size:13.5px;font-weight:500;text-align:left;width:100%;font-family:${F.ui};transition:all .12s;}
.nav-item:hover{color:${T.textPrimary};background:${T.bgSubtle};}
.nav-item.active{color:${T.textPrimary};background:${T.bgMuted};font-weight:600;}
.nav-section{font-size:10.5px;font-weight:700;color:${T.textMuted};letter-spacing:1px;text-transform:uppercase;padding:12px 10px 4px;}
.topbar{height:52px;border-bottom:1px solid ${T.bgBorder};display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:${T.bg};flex-shrink:0;}
.sidebar{width:220px;background:${T.bg};border-right:1px solid ${T.bgBorder};display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
.divider{height:1px;background:${T.bgBorder};}
.progress{height:3px;background:${T.bgMuted};border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;background:${T.accent};border-radius:2px;transition:width .4s;}
.stat-num{font-family:${F.display};font-size:32px;font-weight:400;color:${T.textPrimary};line-height:1.1;letter-spacing:-.02em;}
.tab{padding:8px 16px;font-size:13.5px;font-weight:500;color:${T.textMuted};border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;font-family:${F.ui};transition:all .14s;}
.tab.active{color:${T.textPrimary};border-bottom-color:${T.accent};font-weight:600;}
.tab:hover{color:${T.textSecondary};}
.avatar{width:28px;height:28px;border-radius:50%;background:${T.accentLight};display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:${T.accent};flex-shrink:0;}
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(6px);}
.modal{background:${T.bg};border-radius:14px;padding:28px;max-width:520px;width:100%;box-shadow:${T.shadowXl};}
.hero-pill{display:inline-flex;align-items:center;gap:7px;background:${T.bgSubtle};border:1px solid ${T.bgBorder};border-radius:20px;padding:5px 14px;font-size:12.5px;color:${T.textSecondary};font-weight:500;}
.feature-card{background:${T.bg};border:1px solid ${T.bgBorder};border-radius:12px;padding:24px;transition:all .2s;}
.feature-card:hover{border-color:${T.accent};box-shadow:${T.shadow2};transform:translateY(-2px);}
.pricing-card{background:${T.bg};border:1px solid ${T.bgBorder};border-radius:14px;padding:28px;transition:all .2s;}
.pricing-card:hover{box-shadow:${T.shadow3};transform:translateY(-3px);}
.pricing-card.featured{background:${T.brand};border-color:${T.brand};}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1);}
.reveal.visible{opacity:1;transform:none;}
.integration-logo{padding:7px 14px;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:7px;font-size:12px;font-weight:600;color:${T.textSecondary};white-space:nowrap;transition:all .18s;cursor:default;}
.integration-logo:hover{border-color:${T.textMuted};color:${T.textPrimary};}
.connector-card{background:${T.bg};border:1px solid ${T.bgBorder};border-radius:11px;padding:18px;transition:all .18s;cursor:pointer;}
.connector-card:hover{border-color:${T.accent};box-shadow:${T.shadow2};transform:translateY(-2px);}
.connector-card.connected{border-color:${T.greenBdr};background:${T.greenBg};}
`;

function Wordmark({size=22,inverted=false}){
  const c=inverted?"#fff":T.textPrimary,a=inverted?"#93C5FD":T.accent;
  return(<div style={{display:"flex",alignItems:"center",gap:8,userSelect:"none",flexShrink:0}}>
    <div style={{width:size,height:size,background:inverted?"rgba(255,255,255,.15)":T.brand,borderRadius:Math.round(size*.26),display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size*.58} height={size*.58} viewBox="0 0 20 20" fill="none">
        <rect x="2" y="8" width="3.5" height="9" rx="1.75" fill={inverted?T.brand:"#93C5FD"}/>
        <rect x="2" y="2" width="3.5" height="4" rx="1.75" fill={inverted?T.brand:"#fff"}/>
        <circle cx="13.5" cy="12" r="4.5" stroke={inverted?T.brand:"#fff"} strokeWidth="2.2" fill="none"/>
        <rect x="15.8" y="7" width="2.5" height="10" rx="1.25" fill={inverted?T.brand:"#fff"}/>
      </svg>
    </div>
    <span style={{fontFamily:F.display,fontSize:size*.9,fontWeight:400,color:c,letterSpacing:"-.02em"}}>inv<span style={{color:a}}>o</span>iq</span>
  </div>);
}

function StatusBadge({status}){
  const m={delivered:["badge-green","Delivered"],validated:["badge-blue","Validated"],sent:["badge-blue","Sent"],error:["badge-red","Error"],pending:["badge-amber","Pending"],archived:["badge-gray","Archived"],draft:["badge-gray","Draft"],active:["badge-green","Active"],trial:["badge-purple","Trial"],suspended:["badge-red","Suspended"],starter:["badge-gray","Starter"],business:["badge-blue","Business"],pro:["badge-amber","Pro"],super_admin:["badge-red","Super Admin"],owner:["badge-gray","Owner"],admin:["badge-blue","Admin"],member:["badge-gray","Member"]};
  const[cls,lbl]=m[status]||["badge-gray",status];
  return <span className={`badge ${cls}`}>{lbl}</span>;
}

function Spinner({size=16,color=T.accent}){return <span style={{width:size,height:size,border:`2px solid ${color}20`,borderTopColor:color,borderRadius:"50%",animation:"spin .6s linear infinite",display:"inline-block",flexShrink:0}}/>;}

function Toast({msg,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[]);
  const s={success:[T.green,T.greenBg,T.greenBdr,"✓"],error:[T.red,T.redBg,T.redBdr,"✗"],info:[T.accent,T.blueBg,T.blueBdr,"i"]}[type]||[T.accent,T.blueBg,T.blueBdr,"i"];
  return(<div onClick={onClose} style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:T.bg,border:`1px solid ${s[2]}`,borderRadius:10,padding:"12px 18px",fontSize:13.5,fontWeight:500,color:s[0],maxWidth:380,boxShadow:T.shadowXl,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:F.ui}}>
    <div style={{width:20,height:20,borderRadius:"50%",background:s[1],border:`1px solid ${s[2]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{s[3]}</div>{msg}
  </div>);
}

function MiniChart({data,color=T.accent,height=40}){
  const max=Math.max(...data,1);
  return(<div style={{display:"flex",alignItems:"flex-end",gap:2,height}}>
    {data.map((v,i)=><div key={i} style={{flex:1,background:i===data.length-1?color:`${color}35`,borderRadius:"2px 2px 0 0",height:`${(v/max)*100}%`,minHeight:2}}/>)}
  </div>);
}

// ── LANDING ───────────────────────────────────────────────────
function Landing({onEnter}){
  const[scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>40);window.addEventListener("scroll",h,{passive:true});
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");obs.unobserve(e.target);}}),{threshold:.1,rootMargin:"0px 0px -30px 0px"});
    document.querySelectorAll(".reveal").forEach(el=>obs.observe(el));
    return()=>{window.removeEventListener("scroll",h);obs.disconnect();};
  },[]);

  const integrations=["SAP S/4HANA","SAP ECC","DATEV","Lexware","MS Dynamics 365","Odoo","Xero","QuickBooks","NetSuite","sevDesk","lexoffice","Weclapp"];
  const benefits=[
    {icon:"⚡",title:"In 48 Stunden live",desc:"Keine monatelangen Projekte. Verbinden, konfigurieren, fertig."},
    {icon:"🛡",title:"Rechtssicher ab Tag 1",desc:"EN 16931, GoBD, §147 AO — alle gesetzlichen Anforderungen automatisch."},
    {icon:"🔗",title:"Jedes ERP-System",desc:"SAP, DATEV, Lexware oder REST API — ein Portal für alle Systeme."},
    {icon:"🌍",title:"EU-weit einsatzbereit",desc:"XRechnung, ZUGFeRD, Peppol BIS 3.0 — bereit für ViDA."},
  ];

  return(<div style={{background:T.bg,minHeight:"100vh",overflowX:"hidden"}}>
    {/* NAV */}
    <header style={{position:"fixed",top:0,left:0,right:0,zIndex:100,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 clamp(16px,4vw,56px)",background:scrolled?"rgba(255,255,255,.95)":T.bg,borderBottom:`1px solid ${scrolled?T.bgBorder:"transparent"}`,backdropFilter:scrolled?"blur(12px)":"none",transition:"all .3s"}}>
      <Wordmark size={22}/>
      <nav style={{display:"flex",gap:2}}>
        {["Funktionen","Preise","Sicherheit"].map(l=><a key={l} href={`#${l.toLowerCase()}`} style={{fontSize:13.5,fontWeight:500,color:T.textMuted,textDecoration:"none",padding:"6px 12px",borderRadius:7,transition:"all .15s"}} onMouseEnter={e=>{e.target.style.color=T.textPrimary;e.target.style.background=T.bgSubtle;}} onMouseLeave={e=>{e.target.style.color=T.textMuted;e.target.style.background="transparent";}}>{l}</a>)}
      </nav>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-ghost btn-sm" onClick={onEnter}>Anmelden</button>
        <button className="btn btn-primary btn-sm" onClick={onEnter}>Kostenlos starten →</button>
      </div>
    </header>

    {/* HERO */}
    <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"100px clamp(16px,4vw,56px) 80px",position:"relative",overflow:"hidden",textAlign:"center"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${T.bgBorder} 1px,transparent 1px),linear-gradient(90deg,${T.bgBorder} 1px,transparent 1px)`,backgroundSize:"48px 48px",opacity:.4,pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 80% 60% at 50% 50%,transparent 20%,${T.bg} 80%)`,pointerEvents:"none"}}/>
      <div style={{maxWidth:820,position:"relative"}}>
        <div className="fu" style={{marginBottom:24,display:"inline-block"}}>
          <span className="hero-pill"><span style={{width:7,height:7,borderRadius:"50%",background:T.green,animation:"pulse 2s ease-in-out infinite",display:"inline-block"}}/>E-Rechnungspflicht 2027 — Jetzt vorbereiten</span>
        </div>
        <h1 className="fu2" style={{fontFamily:F.display,fontSize:"clamp(40px,6.5vw,80px)",fontWeight:400,color:T.textPrimary,lineHeight:1.08,letterSpacing:"-.03em",marginBottom:24}}>
          E-Invoice Compliance.<br/><em style={{fontStyle:"italic",color:T.accent}}>Automatisch.</em>
        </h1>
        <p className="fu3" style={{fontSize:"clamp(15px,1.8vw,19px)",color:T.textSecondary,maxWidth:520,margin:"0 auto 40px",lineHeight:1.75,fontWeight:400}}>
          XRechnung · ZUGFeRD · Peppol — für SAP, DATEV, Lexware und jedes andere ERP-System.
        </p>
        <div className="fu4" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:60}}>
          <button className="btn btn-primary btn-xl" onClick={onEnter}>Kostenlos starten →</button>
          <button className="btn btn-ghost btn-xl" onClick={onEnter}>Demo ansehen</button>
        </div>
        {/* App preview mock */}
        <div className="fu5" style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:12,overflow:"hidden",boxShadow:T.shadow3,maxWidth:680,margin:"0 auto",textAlign:"left"}}>
          <div style={{height:36,background:T.bg,borderBottom:`1px solid ${T.bgBorder}`,display:"flex",alignItems:"center",padding:"0 14px",gap:7}}>
            {["#FF5F57","#FEBC2E","#28C840"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
            <div style={{flex:1,height:16,background:T.bgSubtle,borderRadius:4,marginLeft:8}}/>
          </div>
          <div style={{padding:16,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["41","Sent","▲ +8%",T.green],["28","Received","This week",T.accent],["1","Errors","Review",T.red],["98%","Compliance","EN 16931 ✓",T.green]].map(([v,l,s,c])=>(
              <div key={l} style={{background:T.bg,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.bgBorder}`}}>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>{l}</div>
                <div style={{fontFamily:F.display,fontSize:22,color:T.textPrimary,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:c,marginTop:4,fontWeight:600}}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{padding:"0 16px 14px",display:"flex",gap:6}}>
            {[["INV-2025-041","Müller GmbH","4.284 €","delivered"],["INV-2025-040","TechVision AG","12.900 €","validated"],["INV-2025-039","Stadtwerke","780 €","error"]].map(([nr,c,a,s])=>(
              <div key={nr} style={{flex:1,background:T.bgSubtle,borderRadius:6,padding:"7px 9px",fontSize:10,color:T.textSecondary}}>
                <div style={{fontWeight:700,color:T.textPrimary,marginBottom:2,fontFamily:F.mono}}>{nr}</div>
                <div style={{marginBottom:2}}>{c}</div>
                <div style={{fontWeight:600,color:T.textPrimary,marginBottom:4}}>{a}</div>
                <StatusBadge status={s}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* INTEGRATIONS */}
    <section style={{padding:"44px clamp(16px,4vw,56px)",borderTop:`1px solid ${T.bgBorder}`,borderBottom:`1px solid ${T.bgBorder}`,background:T.bgSubtle}}>
      <div style={{maxWidth:960,margin:"0 auto",textAlign:"center"}}>
        <p style={{fontSize:11.5,fontWeight:700,color:T.textMuted,letterSpacing:1,textTransform:"uppercase",marginBottom:18}}>Kompatibel mit führenden ERP-Systemen</p>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"center"}}>{integrations.map(n=><div key={n} className="integration-logo">{n}</div>)}</div>
      </div>
    </section>

    {/* BENEFITS */}
    <section id="funktionen" style={{padding:"88px clamp(16px,4vw,56px)"}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <span className="reveal badge badge-blue" style={{marginBottom:14}}>Kern-Benefits</span>
          <h2 className="reveal" style={{fontFamily:F.display,fontSize:"clamp(28px,4vw,48px)",fontWeight:400,color:T.textPrimary,letterSpacing:"-.025em",lineHeight:1.15}}>Weniger Aufwand.<br/><em>Mehr Compliance.</em></h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(250px,100%),1fr))",gap:14}}>
          {benefits.map((b,i)=><div key={i} className="feature-card reveal" style={{transitionDelay:`${i*.08}s`}}>
            <div style={{width:40,height:40,borderRadius:10,background:T.bgMuted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:16}}>{b.icon}</div>
            <h3 style={{fontWeight:600,fontSize:15,color:T.textPrimary,marginBottom:7}}>{b.title}</h3>
            <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65}}>{b.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* HOW IT WORKS */}
    <section style={{padding:"88px clamp(16px,4vw,56px)",background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`,borderBottom:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14}}>So funktioniert's</span>
          <h2 className="reveal" style={{fontFamily:F.display,fontSize:"clamp(28px,4vw,48px)",fontWeight:400,color:T.textPrimary,letterSpacing:"-.025em"}}>Von der Faktura<br/><em>zur EN 16931-Rechnung</em> — automatisch.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(220px,100%),1fr))",gap:0}}>
          {[{num:"01",title:"ERP verbinden",desc:"SAP, DATEV oder REST API — einmalige Konfiguration in unter 2 Stunden."},{num:"02",title:"Regeln festlegen",desc:"Format, Zustellweg, Empfänger — alles konfigurierbar ohne Code."},{num:"03",title:"Automatisch live",desc:"Jede Faktura wird sofort zu einer validen XRechnung und GoBD-archiviert."}].map((s,i)=>(
            <div key={i} className="reveal" style={{transitionDelay:`${i*.1}s`,padding:"28px 24px",borderRight:i<2?`1px solid ${T.bgBorder}`:"none",textAlign:"center"}}>
              <div style={{fontFamily:F.display,fontSize:40,color:T.accent,opacity:.25,marginBottom:10,lineHeight:1}}>{s.num}</div>
              <div style={{width:32,height:32,borderRadius:8,background:T.brand,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,margin:"0 auto 14px"}}>{i+1}</div>
              <h3 style={{fontWeight:600,fontSize:15.5,color:T.textPrimary,marginBottom:8}}>{s.title}</h3>
              <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* SECURITY */}
    <section id="sicherheit" style={{padding:"88px clamp(16px,4vw,56px)"}}>
      <div style={{maxWidth:920,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center"}}>
        <div>
          <span className="reveal badge badge-green" style={{marginBottom:16}}>Security & Compliance</span>
          <h2 className="reveal" style={{fontFamily:F.display,fontSize:"clamp(26px,3.5vw,42px)",fontWeight:400,color:T.textPrimary,letterSpacing:"-.025em",marginBottom:20}}>Revisionssicher.<br/><em>Gerichtsfest.</em></h2>
          <p className="reveal" style={{fontSize:14,color:T.textSecondary,lineHeight:1.75,marginBottom:22}}>SHA-256-gesichert, unveränderlich für 10 Jahre nach §147 AO archiviert. Vollständiger Audit-Trail.</p>
          <div className="reveal" style={{display:"flex",flexDirection:"column",gap:9}}>
            {["EN 16931 — Europäischer E-Rechnungsstandard","GoBD — Grundsätze ordnungsmäßiger Buchführung","§ 147 AO — 10 Jahre Aufbewahrungspflicht","DSGVO — Datenhaltung in AWS Frankfurt (EU)","SHA-256 — Kryptographische Integrität"].map(item=>(
              <div key={item} style={{display:"flex",gap:10,alignItems:"center",fontSize:13.5,color:T.textSecondary}}>
                <span style={{width:18,height:18,borderRadius:"50%",background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.green,flexShrink:0}}>✓</span>{item}
              </div>
            ))}
          </div>
        </div>
        <div className="reveal" style={{background:T.brand,borderRadius:14,padding:28,color:"#fff"}}>
          {[["Compliance Score","98%",T.green],["Archivierte Dok.","12.441","rgba(255,255,255,.8)"],["Ø Verarbeitungszeit","< 1.2s","rgba(255,255,255,.6)"],["Verfügbarkeit","99.98%","#86EFAC"]].map(([l,v,c])=>(
            <div key={l} style={{padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600,letterSpacing:.5,marginBottom:5,textTransform:"uppercase"}}>{l}</div>
              <div style={{fontFamily:F.display,fontSize:26,color:c,lineHeight:1}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* PRICING */}
    <section id="preise" style={{padding:"88px clamp(16px,4vw,56px)",background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:960,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14}}>Preise</span>
          <h2 className="reveal" style={{fontFamily:F.display,fontSize:"clamp(28px,4vw,48px)",fontWeight:400,color:T.textPrimary,letterSpacing:"-.025em"}}>Transparent.<br/><em>Kein usage-based Billing.</em></h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(250px,100%),1fr))",gap:14}}>
          {[{name:"Starter",price:49,docs:"100 Dok./Monat",features:["XRechnung + ZUGFeRD","E-Mail-Versand","GoBD-Archiv","1 Nutzer"],featured:false},{name:"Business",price:199,docs:"1.000 Dok./Monat",features:["+ Peppol BIS 3.0","+ Inbound-Empfang","+ 5 Konnektoren","5 Nutzer"],featured:true},{name:"Pro",price:599,docs:"10.000 Dok./Monat",features:["+ Alle Konnektoren","+ Public REST API","+ Webhooks","15 Nutzer"],featured:false}].map((p,i)=>(
            <div key={i} className="pricing-card reveal" style={{transitionDelay:`${i*.1}s`,position:"relative"}}>
              {p.featured&&<div style={{position:"absolute",top:-11,left:"50%",transform:"translateX(-50%)",background:T.accent,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 14px",borderRadius:20,letterSpacing:.5,whiteSpace:"nowrap"}}>EMPFOHLEN</div>}
              <div style={{fontWeight:600,fontSize:13.5,marginBottom:12,color:p.featured?"rgba(255,255,255,.55)":T.textMuted}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                <span style={{fontFamily:F.display,fontSize:48,fontWeight:400,lineHeight:1,color:p.featured?"#fff":T.textPrimary,letterSpacing:"-.03em"}}>{p.price}</span>
                <span style={{fontSize:14,color:p.featured?"rgba(255,255,255,.4)":T.textMuted}}>€/Mo</span>
              </div>
              <div style={{fontSize:12.5,color:p.featured?"rgba(255,255,255,.4)":T.textMuted,marginBottom:20}}>{p.docs}</div>
              <div style={{height:1,background:p.featured?"rgba(255,255,255,.1)":T.bgBorder,margin:"0 0 18px"}}/>
              {p.features.map((f,j)=><div key={j} style={{display:"flex",gap:8,marginBottom:9,fontSize:13.5,color:j===0?(p.featured?"#fff":T.textPrimary):(p.featured?"rgba(255,255,255,.6)":T.textSecondary),alignItems:"center"}}>
                <span style={{fontSize:11,color:p.featured?"rgba(255,255,255,.4)":T.accent,flexShrink:0}}>✓</span>{f}
              </div>)}
              <button onClick={onEnter} className="btn btn-sm" style={{marginTop:18,width:"100%",justifyContent:"center",background:p.featured?"#fff":"transparent",color:p.featured?T.brand:T.accent,border:p.featured?"none":`1px solid ${T.accentPale}`,padding:"10px",fontSize:13.5,borderRadius:8}}>{p.featured?"Jetzt starten":"Kostenlos testen"}</button>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{background:T.brand,padding:"72px clamp(16px,4vw,56px)",textAlign:"center"}}>
      <span className="reveal badge" style={{background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",borderColor:"rgba(255,255,255,.15)",marginBottom:16}}>E-Rechnungspflicht 2027</span>
      <h2 className="reveal" style={{fontFamily:F.display,fontSize:"clamp(26px,4vw,48px)",color:"#fff",fontWeight:400,letterSpacing:"-.025em",marginBottom:12}}>Bereit vor dem Stichtag.</h2>
      <p className="reveal" style={{color:"rgba(255,255,255,.5)",fontSize:16,marginBottom:28,fontWeight:300}}>In 48 Stunden gesetzeskonform — für jedes ERP-System.</p>
      <button className="reveal btn btn-xl" onClick={onEnter} style={{background:"#fff",color:T.brand,border:"none",boxShadow:T.shadow2}}>Kostenlos starten →</button>
    </section>

    {/* FOOTER */}
    <footer style={{background:T.bg,borderTop:`1px solid ${T.bgBorder}`,padding:"28px clamp(16px,4vw,56px)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <Wordmark size={19}/>
      <div style={{fontSize:12.5,color:T.textMuted}}>© 2025 invoiq · invoiq.io · EN 16931 · GoBD · DSGVO</div>
      <div style={{display:"flex",gap:18}}>{["Impressum","Datenschutz","AGB"].map(l=><a key={l} href="#" style={{fontSize:12.5,color:T.textMuted,textDecoration:"none"}} onMouseEnter={e=>e.target.style.color=T.textPrimary} onMouseLeave={e=>e.target.style.color=T.textMuted}>{l}</a>)}</div>
    </footer>
  </div>);
}

// ── AUTH ──────────────────────────────────────────────────────
function Auth({mode,onSwitch,onSuccess,loading}){
  const[form,setForm]=useState({email:"demo@invoiq.io",password:"demo123",full_name:"",org_name:""});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  return(<div style={{minHeight:"100vh",background:T.bgSubtle,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{width:"100%",maxWidth:400}}>
      <div style={{textAlign:"center",marginBottom:28}}><Wordmark size={24}/></div>
      <div className="card sci" style={{padding:30,boxShadow:T.shadow3}}>
        <h2 style={{fontFamily:F.display,fontSize:24,fontWeight:400,color:T.textPrimary,marginBottom:5,letterSpacing:"-.02em"}}>{mode==="login"?"Willkommen zurück.":"Konto erstellen."}</h2>
        <p style={{fontSize:13,color:T.textMuted,marginBottom:24}}>{mode==="login"?"E-Invoice Compliance — automatisch.":"Kostenlos starten — in 2 Minuten."}</p>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          {mode==="register"&&<>
            <div><label className="label">Name</label><input className="input" value={form.full_name} onChange={e=>upd("full_name",e.target.value)} placeholder="Max Mustermann"/></div>
            <div><label className="label">Unternehmen</label><input className="input" value={form.org_name} onChange={e=>upd("org_name",e.target.value)} placeholder="Mustermann GmbH"/></div>
          </>}
          <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)}/></div>
          <div><label className="label">Passwort</label><input className="input" type="password" value={form.password} onChange={e=>upd("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)}/></div>
          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:4,padding:"11px"}} onClick={()=>onSuccess(form)} disabled={loading}>{loading?<><Spinner color="#fff"/>&nbsp;Bitte warten...</>:mode==="login"?"Anmelden →":"Konto erstellen →"}</button>
          <button onClick={onSwitch} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13,fontFamily:F.ui}}>{mode==="login"?"Noch kein Konto? Registrieren →":"Bereits registriert? Anmelden →"}</button>
          {mode==="login"&&<div style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:T.textMuted,textAlign:"center"}}>Demo: <strong style={{color:T.textPrimary}}>demo@invoiq.io</strong> / <strong style={{color:T.textPrimary}}>demo123</strong></div>}
        </div>
      </div>
    </div>
  </div>);
}

// ── APP SHELL ─────────────────────────────────────────────────
function AppShell({user,org,nav,setNav,onLogout,onAdmin,children}){
  const items=[{key:"dashboard",icon:"▦",label:"Overview"},{key:"invoices",icon:"⊟",label:"Documents"},{key:"connect",icon:"⊕",label:"Connectors"},{key:"archive",icon:"⊞",label:"Archive"},{key:"webhooks",icon:"⊛",label:"Webhooks"},{key:"settings",icon:"⊙",label:"Settings"}];
  const pct=Math.min(100,((org?.plan_doc_used||0)/(org?.plan_doc_limit||100))*100);
  const isAdmin=user?.email==="demo@invoiq.io"||user?.email==="manfred@invoiq.io";
  return(<div style={{display:"flex",minHeight:"100vh",background:T.bgSubtle}}>
    <aside className="sidebar">
      <div style={{padding:"14px 14px 10px",borderBottom:`1px solid ${T.bgBorder}`}}>
        <Wordmark size={20}/>
        {org&&<div style={{fontSize:11,color:T.textMuted,marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{org.name}</div>}
      </div>
      <nav style={{flex:1,padding:"6px 8px 0"}}>
        <div className="nav-section">Workspace</div>
        {items.map(({key,icon,label})=><button key={key} className={`nav-item ${nav===key?"active":""}`} onClick={()=>setNav(key)}>
          <span style={{fontSize:13,width:15,textAlign:"center",flexShrink:0,color:nav===key?T.accent:"inherit"}}>{icon}</span>{label}
        </button>)}
        {isAdmin&&<><div className="nav-section" style={{marginTop:6}}>Admin</div>
          <button className="nav-item" onClick={onAdmin} style={{color:T.red}}><span style={{fontSize:13,width:15,textAlign:"center"}}>⚡</span>Admin Panel</button>
        </>}
      </nav>
      <div style={{padding:"10px 8px 14px",borderTop:`1px solid ${T.bgBorder}`}}>
        {org&&<div style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:"9px 11px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:12,fontWeight:600,color:T.textPrimary,textTransform:"capitalize"}}>{org.plan||"Starter"}</span>
            <span style={{fontSize:11,color:T.textMuted}}>{org.plan_doc_used||0}/{org.plan_doc_limit||100}</span>
          </div>
          <div className="progress"><div className="progress-fill" style={{width:`${pct}%`}}/></div>
        </div>}
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"6px 4px",marginBottom:6}}>
          <div className="avatar">{(user?.full_name||"M")[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:600,color:T.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.full_name||"User"}</div>
            <div style={{fontSize:11,color:T.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email||""}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{width:"100%",justifyContent:"center",fontSize:12}} onClick={onLogout}>Sign out</button>
      </div>
    </aside>
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <div className="topbar">
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>{{"dashboard":"Overview","invoices":"Documents","connect":"Connectors","archive":"Archive","webhooks":"Webhooks","settings":"Settings"}[nav]||nav}</div>
        <div style={{flex:1,maxWidth:300,margin:"0 20px"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:T.textMuted,fontSize:12}}>🔍</span>
            <input style={{width:"100%",background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:7,padding:"6px 12px 6px 28px",fontSize:13,color:T.textPrimary,outline:"none",fontFamily:F.ui}} placeholder="Search..."/>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={{width:28,height:28,borderRadius:7,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:T.textMuted}}>🔔</button>
          <div className="avatar" style={{cursor:"pointer"}}>{(user?.full_name||"M")[0]}</div>
        </div>
      </div>
      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>{children}</main>
    </div>
  </div>);
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({user,org,notify,onNav}){
  const[stats,setStats]=useState(null);const[invoices,setInvoices]=useState([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{
    Promise.all([api.getStats(),api.listInvoices("?limit=5")])
      .then(([s,i])=>{setStats(s);setInvoices(i.invoices||[]);})
      .catch(()=>{
        setStats({outbound_total:41,inbound_total:28,errors_total:1,compliance_score:98});
        setInvoices([{id:"1",invoice_number:"INV-2025-041",buyer_name:"Müller GmbH",amount_gross:4284,format:"xrechnung",status:"delivered",created_at:new Date(Date.now()-720000).toISOString()},{id:"2",invoice_number:"INV-2025-040",buyer_name:"TechVision AG",amount_gross:12900,format:"zugferd",status:"validated",created_at:new Date(Date.now()-3600000).toISOString()},{id:"3",invoice_number:"INV-2025-039",buyer_name:"Bauer & Partner",amount_gross:780,format:"peppol",status:"error",created_at:new Date(Date.now()-10800000).toISOString()}]);
      }).finally(()=>setLoading(false));
  },[]);
  const weekData=[28,35,31,42,38,45,41];
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
      <div>
        <h1 style={{fontFamily:F.display,fontSize:24,fontWeight:400,color:T.textPrimary,letterSpacing:"-.025em"}}>Good morning{user?.full_name?`, ${user.full_name.split(" ")[0]}`:""}.</h1>
        <p style={{color:T.textMuted,fontSize:12.5,marginTop:4}}>{new Date().toLocaleDateString("de-DE",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={()=>onNav("invoices")}>+ New Document</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {loading?[1,2,3,4].map(i=><div key={i} className="card" style={{padding:18,height:96}}><div className="skeleton" style={{height:"100%"}}/></div>)
      :[{label:"Sent",value:stats.outbound_total,delta:"+8%",color:T.textPrimary,chart:weekData},{label:"Received",value:stats.inbound_total,delta:"+3%",color:T.textPrimary,chart:[18,22,19,25,21,27,28]},{label:"Errors",value:stats.errors_total,delta:stats.errors_total>0?"⚠ Open":"✓ Clean",color:stats.errors_total>0?T.red:T.green},{label:"Compliance",value:`${stats.compliance_score}%`,delta:"EN 16931 ✓",color:T.green}].map((s,i)=>(
        <div key={i} className="card" style={{padding:18}}>
          <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:.4,marginBottom:10,textTransform:"uppercase"}}>{s.label}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
            <div><div className="stat-num" style={{color:s.color,fontSize:28}}>{s.value}</div><div style={{fontSize:11,color:s.color===T.green?T.green:s.color===T.red?T.red:T.textMuted,marginTop:4,fontWeight:600}}>{s.delta}</div></div>
            {s.chart&&<MiniChart data={s.chart} height={32} color={T.accent}/>}
          </div>
        </div>
      ))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:16}}>
      <div className="card" style={{padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Documents — last 7 days</div>
          <span className="badge badge-green" style={{fontSize:11}}>▲ +23% vs last week</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:5,height:64}}>
          {weekData.map((v,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{width:"100%",background:i===6?T.accent:`${T.accent}30`,borderRadius:"2px 2px 0 0",height:`${(v/Math.max(...weekData))*56}px`,transition:"height .3s"}}/>
            <div style={{fontSize:9.5,color:T.textMuted}}>{"MTWDFSSU".split("")[i]}</div>
          </div>)}
        </div>
      </div>
      <div className="card" style={{padding:18}}>
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Format Breakdown</div>
        {[["XRechnung","58%",T.accent],["ZUGFeRD","32%",T.purple],["Peppol","10%",T.green]].map(([f,p,c])=>(
          <div key={f} style={{marginBottom:11}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span style={{color:T.textSecondary}}>{f}</span><span style={{fontWeight:600,color:T.textPrimary}}>{p}</span></div>
            <div className="progress"><div className="progress-fill" style={{width:p,background:c}}/></div>
          </div>
        ))}
      </div>
    </div>
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${T.bgBorder}`}}>
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Recent Documents</div>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav("invoices")}>View all →</button>
      </div>
      <table className="table">
        <thead><tr>{["Number","Recipient","Amount","Format","Status","Time"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2,3].map(i=><tr key={i}><td colSpan={6}><div className="skeleton" style={{height:14,margin:"6px 0"}}/></td></tr>)
          :invoices.map(inv=><tr key={inv.id} className="tr-hover" style={{cursor:"pointer"}}>
            <td style={{fontWeight:600,color:T.textPrimary,fontFamily:F.mono,fontSize:12.5}}>{inv.invoice_number}</td>
            <td style={{color:T.textPrimary}}>{inv.buyer_name||"—"}</td>
            <td style={{fontWeight:600,color:T.textPrimary}}>{fmtEUR(inv.amount_gross)}</td>
            <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:"2px 7px",fontSize:11.5,fontWeight:600,fontFamily:F.mono}}>{inv.format?.toUpperCase()}</span></td>
            <td><StatusBadge status={inv.status}/></td>
            <td style={{color:T.textMuted,fontSize:12}}>{fmtAgo(inv.created_at)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>);
}

// ── DOCUMENTS ─────────────────────────────────────────────────
function Invoices({notify}){
  const[view,setView]=useState("list");const[filter,setFilter]=useState("all");
  const[invoices,setInvoices]=useState([]);const[loading,setLoading]=useState(true);
  const[generating,setGenerating]=useState(false);const[xml,setXml]=useState(null);
  const[form,setForm]=useState({invoice_number:`INV-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,invoice_date:new Date().toISOString().split("T")[0],due_date:new Date(Date.now()+30*86400000).toISOString().split("T")[0],format:"xrechnung",delivery_method:"email",seller_name:"Demo GmbH",seller_vat_id:"DE123456789",seller_address:"Musterstraße 1",seller_city:"Berlin",buyer_name:"",buyer_address:"",buyer_city:"",buyer_email:"",line_items:[{description:"",quantity:1,unit_price:0,vat_rate:19}]});
  const load=useCallback(()=>{setLoading(true);api.listInvoices().then(d=>setInvoices(d.invoices||[])).catch(()=>setInvoices([])).finally(()=>setLoading(false));},[]);
  useEffect(()=>load(),[load]);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const updItem=(i,k,v)=>{const a=[...form.line_items];a[i]={...a[i],[k]:k==="description"?v:parseFloat(v)||0};upd("line_items",a);};
  const net=form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
  const vat=form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price*(i.vat_rate/100),0);
  const generate=async()=>{if(!form.buyer_name){notify("Empfänger fehlt","error");return;}setGenerating(true);try{const inv=await api.createInvoice(form);const xmlContent=await api.getXML(inv.id);setXml({content:xmlContent,id:inv.id,number:inv.invoice_number});notify("XRechnung generiert · EN 16931 ✓","success");load();}catch(e){notify(e.message,"error");}setGenerating(false);};
  const filtered=filter==="all"?invoices:invoices.filter(i=>i.status===filter);

  if(view==="create") return(<div className="fi">
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setXml(null);}}>← Back</button>
      <div><h1 style={{fontFamily:F.display,fontSize:20,fontWeight:400,color:T.textPrimary}}>New Document</h1><p style={{fontSize:12,color:T.textMuted}}>Generate an EN 16931-compliant e-invoice</p></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>Invoice Details</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div><label className="label">Number</label><input className="input" value={form.invoice_number} onChange={e=>upd("invoice_number",e.target.value)}/></div>
          <div><label className="label">Format</label><select className="select" value={form.format} onChange={e=>upd("format",e.target.value)}>{["xrechnung","zugferd","peppol","facturx"].map(f=><option key={f} value={f}>{f.toUpperCase()}</option>)}</select></div>
          <div><label className="label">Issue Date</label><input className="input" type="date" value={form.invoice_date} onChange={e=>upd("invoice_date",e.target.value)}/></div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date} onChange={e=>upd("due_date",e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>Recipient</div>
        {[["buyer_name","Company"],["buyer_address","Street"],["buyer_city","City"],["buyer_email","Email"]].map(([k,l])=><div key={k} style={{marginBottom:9}}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e=>upd(k,e.target.value)} placeholder={l}/></div>)}
      </div>
    </div>
    <div className="card" style={{padding:20,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Line Items</div>
      <div style={{display:"grid",gridTemplateColumns:"3fr 70px 130px 80px 32px",gap:7,marginBottom:8}}>{["Description","Qty","Unit Price","VAT",""].map((h,i)=><div key={i} style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.3,textTransform:"uppercase"}}>{h}</div>)}</div>
      {form.line_items.map((item,idx)=><div key={idx} style={{display:"grid",gridTemplateColumns:"3fr 70px 130px 80px 32px",gap:7,marginBottom:6}}>
        <input className="input" value={item.description} onChange={e=>updItem(idx,"description",e.target.value)} placeholder="Service description..."/>
        <input className="input" type="number" min="0" value={item.quantity} onChange={e=>updItem(idx,"quantity",e.target.value)}/>
        <input className="input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updItem(idx,"unit_price",e.target.value)}/>
        <select className="select" value={item.vat_rate} onChange={e=>updItem(idx,"vat_rate",e.target.value)}><option value={19}>19%</option><option value={7}>7%</option><option value={0}>0%</option></select>
        <button onClick={()=>upd("line_items",form.line_items.filter((_,j)=>j!==idx))} style={{background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:7,color:T.red,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>)}
      <button onClick={()=>upd("line_items",[...form.line_items,{description:"",quantity:1,unit_price:0,vat_rate:19}])} style={{width:"100%",padding:"7px",border:`1.5px dashed ${T.bgBorder}`,background:"transparent",color:T.accent,cursor:"pointer",borderRadius:7,marginTop:7,fontSize:13,fontFamily:F.ui,fontWeight:500}}>+ Add line item</button>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
        <div style={{background:T.bgSubtle,borderRadius:9,padding:"12px 16px",minWidth:220,border:`1px solid ${T.bgBorder}`}}>
          {[["Net",fmtEUR(net)],["VAT",fmtEUR(vat)]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:32,marginBottom:7,fontSize:13,color:T.textMuted}}><span>{l}</span><span>{v}</span></div>)}
          <div style={{height:1,background:T.bgBorder,margin:"7px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:32,fontFamily:F.display,fontSize:18,color:T.textPrimary,fontWeight:400}}><span>Total</span><span>{fmtEUR(net+vat)}</span></div>
        </div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:16}}>
      <button className="btn btn-primary" style={{fontSize:13.5,padding:"10px 24px"}} onClick={generate} disabled={generating}>{generating?<><Spinner color="#fff" size={14}/>&nbsp;Generating...</>:"⚡ Generate XRechnung"}</button>
    </div>
    {xml&&<div className="card fi" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:7}}><span className="badge badge-green">✓ EN 16931</span><span className="badge badge-green">GoBD ✓</span><span style={{fontSize:12.5,color:T.textMuted,fontFamily:F.mono}}>{xml.number}</span></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([xml.content],{type:"application/xml"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`${xml.number}.xml`;a.click();}}>↓ Download</button>
      </div>
      <pre style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:14,fontSize:11,color:T.textSecondary,overflow:"auto",maxHeight:300,lineHeight:1.6,fontFamily:F.mono}}>{xml.content.substring(0,1500)}…</pre>
    </div>}
  </div>);

  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
      <div><h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary}}>Documents</h1><p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{invoices.length} documents total</p></div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-ghost btn-sm" onClick={()=>notify("Export started","success")}>↓ Export</button><button className="btn btn-primary btn-sm" onClick={()=>setView("create")}>+ New</button></div>
    </div>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:14}}>
      {["all","delivered","validated","sent","error","archived"].map(s=><button key={s} className={`tab ${filter===s?"active":""}`} onClick={()=>setFilter(s)}>
        {{all:"All",delivered:"Delivered",validated:"Validated",sent:"Sent",error:"Errors",archived:"Archived"}[s]}
        {s!=="all"&&<span style={{marginLeft:4,fontSize:10,background:T.bgMuted,padding:"1px 5px",borderRadius:7,color:T.textMuted}}>{invoices.filter(i=>i.status===s).length}</span>}
      </button>)}
    </div>
    <div className="card">
      <table className="table">
        <thead><tr>{["Number","Recipient","Amount","Format","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2,3].map(i=><tr key={i}><td colSpan={6}><div className="skeleton" style={{height:14}}/></td></tr>)
          :filtered.map(inv=><tr key={inv.id} className="tr-hover">
            <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12.5,color:T.textPrimary}}>{inv.invoice_number}</td>
            <td>{inv.buyer_name||"—"}</td>
            <td style={{fontWeight:600}}>{fmtEUR(inv.amount_gross)}</td>
            <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:F.mono}}>{inv.format?.toUpperCase()}</span></td>
            <td><StatusBadge status={inv.status}/></td>
            <td><div style={{display:"flex",gap:5}}>
              {inv.status==="validated"&&<button className="btn btn-outline btn-sm" onClick={()=>api.sendInvoice(inv.id,{delivery_method:"email"}).then(()=>{notify("Sent ✓","success");load();}).catch(e=>notify(e.message,"error"))}>Send</button>}
              {inv.has_xml&&<button className="btn btn-ghost btn-sm" onClick={()=>api.getXML(inv.id).then(c=>setXml({content:c,id:inv.id,number:inv.invoice_number})).catch(e=>notify(e.message,"error"))}>XML</button>}
            </div></td>
          </tr>)}
          {!loading&&filtered.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:T.textMuted,padding:28,fontSize:13}}>No documents found</td></tr>}
        </tbody>
      </table>
    </div>
    {xml&&<div className="modal-overlay" onClick={()=>setXml(null)}>
      <div className="modal fi" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",gap:7}}><span className="badge badge-green">EN 16931 ✓</span><span style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>{xml.number}</span></div>
          <div style={{display:"flex",gap:7}}><button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([xml.content],{type:"application/xml"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`${xml.number}.xml`;a.click();}}>↓ Download</button><button className="btn btn-ghost btn-sm" onClick={()=>setXml(null)}>×</button></div>
        </div>
        <pre style={{background:T.bgSubtle,borderRadius:8,padding:14,fontSize:10.5,color:T.textSecondary,overflow:"auto",maxHeight:420,lineHeight:1.55,fontFamily:F.mono}}>{xml.content}</pre>
      </div>
    </div>}
  </div>);
}

// ── CONNECTORS ────────────────────────────────────────────────
const CONN=[{type:"sap_s4",name:"SAP S/4HANA",icon:"⚙️",cat:"Enterprise",method:"RFC / IDoc / REST"},{type:"sap_ecc",name:"SAP ECC 6.0",icon:"⚙️",cat:"Enterprise",method:"IDoc Classic"},{type:"dynamics",name:"MS Dynamics 365",icon:"🔷",cat:"Enterprise",method:"Dataverse API"},{type:"oracle",name:"Oracle Fusion",icon:"🔴",cat:"Enterprise",method:"Oracle REST"},{type:"datev",name:"DATEV",icon:"📊",cat:"German ERP",method:"Connect Online",cert:true},{type:"lexware",name:"Lexware",icon:"📋",cat:"German ERP",method:"XML / SFTP"},{type:"weclapp",name:"Weclapp",icon:"🌐",cat:"German ERP",method:"REST API"},{type:"sevdesk",name:"sevDesk",icon:"📱",cat:"SME",method:"API v2"},{type:"lexoffice",name:"lexoffice",icon:"📄",cat:"SME",method:"REST API"},{type:"odoo",name:"Odoo",icon:"🟣",cat:"SME",method:"JSON-RPC"},{type:"xero",name:"Xero",icon:"💙",cat:"SME",method:"OAuth 2.0"},{type:"quickbooks",name:"QuickBooks",icon:"🟢",cat:"SME",method:"QBO API v3"},{type:"rest",name:"REST API",icon:"🔌",cat:"Universal",method:"HTTP / JSON"},{type:"sftp",name:"SFTP",icon:"📁",cat:"Universal",method:"SFTP / SSH"},{type:"email",name:"Email Import",icon:"📧",cat:"Universal",method:"IMAP"}];

function ConnectorsView({notify}){
  const[connected,setConnected]=useState({"rest":true,"sftp":true});
  const[modal,setModal]=useState(null);const[cat,setCat]=useState("All");
  const cats=["All","Enterprise","German ERP","SME","Universal"];
  const filtered=cat==="All"?CONN:CONN.filter(c=>c.cat===cat);
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
      <div><h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary}}>Connectors</h1><p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{CONN.length} systems · {Object.keys(connected).length} connected</p></div>
      <span className="badge badge-green">✓ {Object.keys(connected).length} Active</span>
    </div>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:18}}>
      {cats.map(c=><button key={c} className={`tab ${cat===c?"active":""}`} onClick={()=>setCat(c)}>{c}</button>)}
    </div>
    {Object.keys(connected).length>0&&<div style={{marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Connected</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(240px,100%),1fr))",gap:9}}>
        {CONN.filter(c=>connected[c.type]).map(conn=><div key={conn.type} className="connector-card connected">
          <div style={{display:"flex",alignItems:"center",gap:11}}><span style={{fontSize:22}}>{conn.icon}</span><div style={{flex:1}}><div style={{fontWeight:600,fontSize:13.5,color:T.textPrimary}}>{conn.name}</div><div style={{fontSize:11,color:T.textMuted}}>{conn.method}</div></div><span className="badge badge-green" style={{fontSize:11}}>Active</span></div>
          <div style={{marginTop:11,display:"flex",gap:7}}><button className="btn btn-ghost btn-sm" onClick={()=>notify(`${conn.name} test OK ✓`,"success")}>Test</button><button className="btn btn-ghost btn-sm" onClick={()=>setModal(conn)}>Configure</button></div>
        </div>)}
      </div>
    </div>}
    <div>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Available</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(220px,100%),1fr))",gap:9}}>
        {filtered.filter(c=>!connected[c.type]).map(conn=><div key={conn.type} className="connector-card card-hover" style={{position:"relative"}} onClick={()=>setModal(conn)}>
          {conn.cert&&<span className="badge badge-amber" style={{position:"absolute",top:11,right:11,fontSize:10}}>Cert. req.</span>}
          <div style={{fontSize:22,marginBottom:9}}>{conn.icon}</div>
          <div style={{fontWeight:600,fontSize:13.5,color:T.textPrimary,marginBottom:3}}>{conn.name}</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginBottom:9}}>{conn.method}</div>
          <span className="badge badge-gray" style={{fontSize:10.5}}>{conn.cat}</span>
          <button className="btn btn-primary btn-sm" style={{width:"100%",justifyContent:"center",marginTop:12}}>Connect →</button>
        </div>)}
      </div>
    </div>
    {modal&&<div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal sci" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:26}}>{modal.icon}</span><div><div style={{fontFamily:F.display,fontSize:19,fontWeight:400,color:T.textPrimary}}>{modal.name}</div><div style={{fontSize:12,color:T.textMuted}}>{modal.method}</div></div></div>
          <button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.textMuted}}>×</button>
        </div>
        {modal.cert&&<div style={{background:T.amberBg,border:`1px solid ${T.amberBdr}`,borderRadius:8,padding:"9px 13px",marginBottom:14,fontSize:13,color:T.amber}}>⚠️ Certification required. Contact <strong>manfred@invoiq.io</strong></div>}
        <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:18}}>
          {[["API Key","Your API Key","password"],["Endpoint URL","https://...","text"],["Organization ID","org_...","text"]].map(([l,p,t])=><div key={l}><label className="label">{l}</label><input className="input" type={t} placeholder={p}/></div>)}
        </div>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>{setConnected(p=>({...p,[modal.type]:true}));notify(`${modal.name} connected ✓`,"success");setModal(null);}}>Save & Connect</button>
        </div>
      </div>
    </div>}
  </div>);
}

function Placeholder({title,sub,icon="📋"}){return(<div className="fi"><h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:4}}>{title}</h1><p style={{color:T.textMuted,fontSize:13,marginBottom:22}}>{sub}</p><div className="card" style={{textAlign:"center",padding:52,color:T.textMuted}}><div style={{fontSize:28,marginBottom:10}}>{icon}</div><div style={{fontSize:13.5}}>Coming in Release 1.0</div></div></div>);}

// ── ADMIN SHELL ───────────────────────────────────────────────
function AdminShell({user,org,nav,setNav,onBack,children}){
  const isSuper=user?.email==="demo@invoiq.io"||user?.email==="manfred@invoiq.io";
  const items=isSuper?[{section:"Platform"},{key:"overview",icon:"▦",label:"Overview"},{key:"allinvoices",icon:"⊟",label:"All Documents"},{key:"users",icon:"👤",label:"Users"},{key:"revenue",icon:"📈",label:"Revenue"},{section:"System"},{key:"peppol",icon:"🌍",label:"Peppol"},{key:"apilogs",icon:"📋",label:"Audit Logs"}]:[{section:org?.name||"Company"},{key:"overview",icon:"▦",label:"Overview"},{key:"myinvoices",icon:"⊟",label:"Documents"},{key:"myusers",icon:"👤",label:"Team"},{key:"billing",icon:"💳",label:"Billing"}];
  return(<div style={{display:"flex",minHeight:"100vh",background:T.bgSubtle}}>
    <aside className="sidebar" style={{background:T.brand}}>
      <div style={{padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.1)"}}><Wordmark size={20} inverted/><div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:7,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{isSuper?"Super Admin":"Customer Admin"}</div></div>
      <nav style={{flex:1,padding:"6px 8px 0"}}>
        {items.map((item,i)=>item.section?<div key={i} style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",letterSpacing:1,textTransform:"uppercase",padding:"11px 10px 3px"}}>{item.section}</div>
        :<button key={item.key} className={`nav-item ${nav===item.key?"active":""}`} onClick={()=>setNav(item.key)} style={{color:nav===item.key?"#fff":"rgba(255,255,255,.5)",background:nav===item.key?"rgba(255,255,255,.1)":"transparent"}}>
          <span style={{fontSize:12,width:15,textAlign:"center"}}>{item.icon}</span>{item.label}
        </button>)}
      </nav>
      <div style={{padding:"10px 8px 14px",borderTop:"1px solid rgba(255,255,255,.1)"}}><button className="btn btn-sm" style={{width:"100%",justifyContent:"center",background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.6)",border:"none",fontSize:12}} onClick={onBack}>← Back to App</button></div>
    </aside>
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <div className="topbar"><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>{isSuper?"Platform Admin":"Customer Admin"} — {items.find(i=>i.key===nav)?.label||nav}</div><div/><div className="avatar">{(user?.full_name||"M")[0]}</div></div>
      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>{children}</main>
    </div>
  </div>);
}

function AdminOverview({notify,isSuper}){
  const mrr=MOCK_ORGS.filter(o=>o.status==="active").reduce((s,o)=>s+o.mrr,0);
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
      <div><h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary}}>{isSuper?"Platform Overview":"Overview"}</h1><p style={{fontSize:12,color:T.textMuted,marginTop:3}}>{isSuper?"invoiq.io · Super Admin":MOCK_ORGS[0].name}</p></div>
      {isSuper&&<button className="btn btn-ghost btn-sm" onClick={()=>notify("Export started","success")}>↓ Export</button>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {(isSuper?[["MRR",fmtEUR(mrr),"▲ +12%"],["Active Customers",MOCK_ORGS.filter(o=>o.status==="active").length,`${MOCK_ORGS.length} total`],["Documents",fmtNum(MOCK_ORGS.reduce((s,o)=>s+o.docs_used,0)),"This month"],["Open Errors",MOCK_INV.filter(i=>i.status==="error").length,"Review"]]:[["Docs Used",MOCK_ORGS[0].docs_used,"of "+MOCK_ORGS[0].docs_limit],["Users",MOCK_ORGS[0].users,"Active"],["Errors",MOCK_ORGS[0].errors,"Open"],["Compliance","98%","EN 16931 ✓"]]).map(([l,v,s])=>(
        <div key={l} className="card" style={{padding:18}}>
          <div style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:9}}>{l}</div>
          <div className="stat-num" style={{fontSize:28}}>{v}</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{s}</div>
        </div>
      ))}
    </div>
    <div className="card">
      <div style={{padding:"13px 18px",borderBottom:`1px solid ${T.bgBorder}`,fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Customers</div>
      <table className="table"><thead><tr>{["Customer","Plan","Status","Docs","MRR"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{MOCK_ORGS.map(org=><tr key={org.id} className="tr-hover">
          <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="avatar">{org.name[0]}</div><div><div style={{fontWeight:600,fontSize:13}}>{org.name}</div><div style={{fontSize:10.5,color:T.textMuted}}>{org.vat_id}</div></div></div></td>
          <td><StatusBadge status={org.plan}/></td>
          <td><StatusBadge status={org.status}/></td>
          <td><div style={{fontSize:12.5}}>{fmtNum(org.docs_used)}/{fmtNum(org.docs_limit)}</div><div className="progress" style={{width:60,marginTop:3}}><div className="progress-fill" style={{width:`${Math.min(100,(org.docs_used/org.docs_limit)*100)}%`}}/></div></td>
          <td style={{fontWeight:600}}>{fmtEUR(org.mrr)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>);
}

function AdminDocs({notify}){
  const[filter,setFilter]=useState("all");
  const filtered=filter==="all"?MOCK_INV:MOCK_INV.filter(i=>i.status===filter);
  return(<div className="fi">
    <h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:18}}>All Documents</h1>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:14}}>
      {["all","delivered","validated","error","archived"].map(s=><button key={s} className={`tab ${filter===s?"active":""}`} onClick={()=>setFilter(s)}>{{all:"All",delivered:"Delivered",validated:"Validated",error:"Errors",archived:"Archived"}[s]}<span style={{marginLeft:4,fontSize:10,background:T.bgMuted,padding:"1px 5px",borderRadius:7,color:T.textMuted}}>{s==="all"?MOCK_INV.length:MOCK_INV.filter(i=>i.status===s).length}</span></button>)}
    </div>
    <div className="card"><table className="table"><thead><tr>{["Number","Customer","Amount","Format","Status","Date","Action"].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{filtered.map(inv=><tr key={inv.id} className="tr-hover">
        <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12}}>{inv.number}</td>
        <td style={{fontSize:13}}>{inv.org}</td>
        <td style={{fontWeight:600}}>{fmtEUR(inv.amount)}</td>
        <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:F.mono}}>{inv.format.toUpperCase()}</span></td>
        <td><StatusBadge status={inv.status}/></td>
        <td style={{color:T.textMuted,fontSize:12}}>{inv.date}</td>
        <td>{inv.status==="error"&&<button className="btn btn-danger btn-sm" onClick={()=>notify("Reviewing","info")}>Review</button>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>);
}

function AdminUsers({notify}){
  const users=[{id:"u1",name:"Manfred Bell",email:"manfred@invoiq.io",role:"super_admin",org:"invoiq",status:"active",last:"Today"},{id:"u2",name:"Hans Müller",email:"hans@mueller.de",role:"owner",org:"Müller & Partner GmbH",status:"active",last:"Today"},{id:"u3",name:"Sarah Weber",email:"s.weber@techvision.de",role:"admin",org:"TechVision AG",status:"active",last:"Yesterday"},{id:"u4",name:"Klaus Bauer",email:"k.bauer@logistik.de",role:"member",org:"Bauer Logistik KG",status:"active",last:"3 days ago"}];
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary}}>Users</h1><button className="btn btn-primary btn-sm" onClick={()=>notify("Invitation sent","success")}>+ Invite</button></div>
    <div className="card"><table className="table"><thead><tr>{["User","Role","Organization","Status","Last Login","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{users.map(u=><tr key={u.id} className="tr-hover">
        <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="avatar">{u.name[0]}</div><div><div style={{fontWeight:600,fontSize:13}}>{u.name}</div><div style={{fontSize:10.5,color:T.textMuted}}>{u.email}</div></div></div></td>
        <td><StatusBadge status={u.role}/></td>
        <td style={{fontSize:13,color:T.textSecondary}}>{u.org}</td>
        <td><StatusBadge status={u.status}/></td>
        <td style={{fontSize:12,color:T.textMuted}}>{u.last}</td>
        <td><div style={{display:"flex",gap:5}}><button className="btn btn-ghost btn-sm" onClick={()=>notify("Reset sent","success")}>Reset</button>{u.role!=="super_admin"&&<button className="btn btn-danger btn-sm" onClick={()=>notify(`${u.name} suspended`,"error")}>Suspend</button>}</div></td>
      </tr>)}</tbody>
    </table></div>
  </div>);
}

function AdminRevenue(){
  const plans=[{name:"Starter",count:2,price:49},{name:"Business",count:2,price:199},{name:"Pro",count:1,price:599}];
  const mrr=plans.reduce((s,p)=>s+p.count*p.price,0);
  return(<div className="fi">
    <h1 style={{fontFamily:F.display,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:18}}>Revenue</h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
      {[["MRR",fmtEUR(mrr)],["ARR",fmtEUR(mrr*12)],["Avg/Customer",fmtEUR(mrr/5)]].map(([l,v])=><div key={l} className="card" style={{padding:18}}><div style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:9}}>{l}</div><div className="stat-num">{v}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div className="card" style={{padding:18}}><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Plan Distribution</div>
        {plans.map(p=><div key={p.name} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span style={{fontWeight:600}}>{p.name}</span><span style={{color:T.textMuted}}>{p.count} · {fmtEUR(p.count*p.price)}/mo</span></div><div className="progress"><div className="progress-fill" style={{width:`${(p.count/5)*100}%`}}/></div></div>)}
      </div>
      <div className="card" style={{padding:18}}><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Document Volume</div>
        {MOCK_ORGS.filter(o=>o.status==="active").map(org=><div key={org.id} style={{marginBottom:11}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140,fontWeight:500}}>{org.name}</span><span style={{color:T.textMuted,flexShrink:0}}>{fmtNum(org.docs_used)}</span></div><div className="progress"><div className="progress-fill" style={{width:`${(org.docs_used/org.docs_limit)*100}%`}}/></div></div>)}
      </div>
    </div>
  </div>);
}

// ── ROOT ──────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("landing");
  const[mode,setMode]=useState("login");
  const[nav,setNav]=useState("dashboard");
  const[adminNav,setAdminNav]=useState("overview");
  const[loading,setLoading]=useState(false);
  const[toast,setToast]=useState(null);
  const[user,setUser]=useState(null);
  const[org,setOrg]=useState(null);
  const notify=(msg,type="info")=>setToast({msg,type});

  useEffect(()=>{
    const token=typeof localStorage!=="undefined"&&localStorage.getItem("invoiq_token");
    if(token){api.setToken(token);api.me().then(d=>{setUser(d.user);setOrg(d.org);setScreen("app");}).catch(()=>{if(typeof localStorage!=="undefined")localStorage.removeItem("invoiq_token");});}
  },[]);

  const handleAuth=async form=>{
    setLoading(true);
    try{
      const fn=mode==="login"?api.login:api.register;const d=await fn(form);
      api.setToken(d.access_token);setUser(d.user);setOrg(d.org);
      const isNew=!d.org?.onboarding_completed&&typeof localStorage!=="undefined"&&!localStorage.getItem("invoiq_onboarding_done");
      if(isNew&&mode==="register"){setScreen("onboarding");}else{setScreen("app");setNav("dashboard");}
      notify(`Welcome${d.user.full_name?`, ${d.user.full_name.split(" ")[0]}`:""}!`,"success");
    }catch(e){
      setUser({full_name:form.full_name||"Manfred Bell",email:form.email,role:"owner"});
      setOrg({name:form.org_name||"invoiq Demo",plan:"business",plan_doc_limit:1000,plan_doc_used:41});
      if(mode==="register"){setScreen("onboarding");}else{setScreen("app");setNav("dashboard");}
      notify(mode==="register"?"Welcome to invoiq!":"Demo mode active","info");
    }
    setLoading(false);
  };

  const handleLogout=async()=>{await api.logout().catch(()=>{});api.setToken(null);setUser(null);setOrg(null);setScreen("landing");notify("Signed out","info");};
  const isSuper=user?.email==="demo@invoiq.io"||user?.email==="manfred@invoiq.io";

  return(<>
    <style>{CSS}</style>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {screen==="landing"&&<Landing onEnter={()=>{setMode("login");setScreen("auth");}}/>}
    {screen==="auth"&&<Auth mode={mode} onSwitch={()=>setMode(m=>m==="login"?"register":"login")} onSuccess={handleAuth} loading={loading}/>}
    {screen==="onboarding"&&<OnboardingWizard user={user} onComplete={data=>{if(typeof localStorage!=="undefined")localStorage.setItem("invoiq_onboarding_done","true");if(data.org_name&&org)setOrg(p=>({...p,name:data.org_name}));setScreen("app");setNav("dashboard");notify("Setup complete — welcome to invoiq! 🎉","success");}}/>}
    {screen==="app"&&<AppShell user={user} org={org} nav={nav} setNav={setNav} onLogout={handleLogout} onAdmin={()=>{setAdminNav("overview");setScreen("admin");}}>
      {nav==="dashboard"&&<Dashboard user={user} org={org} notify={notify} onNav={setNav}/>}
      {nav==="invoices"&&<Invoices notify={notify}/>}
      {nav==="connect"&&<ConnectorsView notify={notify}/>}
      {nav==="archive"&&<Placeholder title="Archive" sub="SHA-256 · GoBD · §147 AO · 10-year retention" icon="🔒"/>}
      {nav==="webhooks"&&<Placeholder title="Webhooks" sub="invoice.created · invoice.sent · invoice.delivered" icon="⚡"/>}
      {nav==="settings"&&<Placeholder title="Settings" sub="Account · Plan · API Keys · White-Label" icon="⚙️"/>}
    </AppShell>}
    {screen==="admin"&&<AdminShell user={user} org={org} nav={adminNav} setNav={setAdminNav} onBack={()=>setScreen("app")}>
      {adminNav==="overview"&&<AdminOverview notify={notify} isSuper={isSuper}/>}
      {adminNav==="allinvoices"&&<AdminDocs notify={notify}/>}
      {adminNav==="myinvoices"&&<AdminDocs notify={notify}/>}
      {adminNav==="users"&&<AdminUsers notify={notify}/>}
      {adminNav==="myusers"&&<AdminUsers notify={notify}/>}
      {adminNav==="revenue"&&<AdminRevenue/>}
      {["mysettings","billing","peppol","apilogs"].includes(adminNav)&&<Placeholder title={{mysettings:"Settings",billing:"Billing",peppol:"Peppol Status",apilogs:"Audit Logs"}[adminNav]} sub={{mysettings:"Company · API keys · Integrations",billing:"Plan · Payment history",peppol:"Storecove · Peppol BIS 3.0",apilogs:"GoBD-compliant audit trail"}[adminNav]}/>}
    </AdminShell>}
  </>);
}

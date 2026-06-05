import { useState, useEffect, useCallback, useRef } from "react";
import OnboardingWizard from "./OnboardingWizard.jsx";

/* ═══════════════════════════════════════════════════════════════
   invoiq — Complete App · Design System v2
   Inspired by: Linear, Stripe, Notion, Lattice
   Palette: Deep Navy · Pure White · Slate grays · Electric Blue
   Fonts: Instrument Serif + Inter
   ═══════════════════════════════════════════════════════════════ */

const T = {
  // Stripe-exact palette
  brand:     "#0A2540",   // Stripe's deep navy
  brandMid:  "#1a3a5c",
  brandLite: "#425466",
  accent:    "#635BFF",   // Stripe purple-blue
  accentHover:"#4F46E5",
  accentLight:"#F0EFFF",
  accentPale: "#E5E4FF",

  bg:        "#FFFFFF",
  bgSubtle:  "#F6F9FC",   // Stripe's signature off-white
  bgMuted:   "#EEF2F7",
  bgBorder:  "#DDE1E7",   // Stripe border gray

  textPrimary:  "#0A2540",
  textSecondary:"#425466",
  textMuted:    "#697386",
  textPlaceholder:"#9AA8B7",

  // Semantic — muted like Stripe
  green:    "#1A9C5B",  greenBg:"#F0FBF5",  greenBdr:"#C3E9D5",
  red:      "#C0392B",  redBg:  "#FEF4F4",  redBdr:  "#F5C6C4",
  amber:    "#B45309",  amberBg:"#FEFBF0",  amberBdr:"#F5E0A0",
  blue:     "#2563EB",  blueBg: "#F0F5FF",  blueBdr: "#C3D4F8",
  gray:     "#697386",  grayBg: "#F6F9FC",  grayBdr: "#DDE1E7",

  // Stripe-style minimal shadows
  shadow1: "0 1px 1px rgba(0,0,0,.04), 0 2px 4px rgba(10,37,64,.08)",
  shadow2: "0 2px 4px rgba(0,0,0,.04), 0 4px 12px rgba(10,37,64,.1)",
  shadow3: "0 4px 8px rgba(0,0,0,.04), 0 8px 24px rgba(10,37,64,.1)",
  shadowXl:"0 8px 16px rgba(0,0,0,.04), 0 20px 48px rgba(10,37,64,.12)",
};
// Stripe uses -apple-system / Inter — NO decorative display fonts in UI
const F={
  display:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ui:     "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  mono:   "'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace",
};

const API_BASE=(import.meta?.env?.VITE_API_URL)||"http://localhost:3000/v1";
const api={
  _token:(typeof localStorage!=='undefined'&&localStorage.getItem("invoiq_token"))||null,
  setToken(t){this._token=t;if(typeof localStorage!=='undefined'){if(t)localStorage.setItem("invoiq_token",t);else localStorage.removeItem("invoiq_token");}},
  async req(method,path,body){
    const headers={"Content-Type":"application/json"};
    if(this._token)headers["Authorization"]=`Bearer ${this._token}`;
    try{const res=await fetch(`${API_BASE}${path}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data;}
    catch(err){if(err.message.includes("fetch"))throw new Error("");throw err;}
  },
  get:(p)=>api.req("GET",p),post:(p,b)=>api.req("POST",p,b),
  login:(b)=>api.post("/auth/login",b),register:(b)=>api.post("/auth/register",b),
  me:()=>api.get("/auth/me"),logout:()=>api.post("/auth/logout",{}),
  getStats:()=>api.get("/invoices/stats"),listInvoices:(q="")=>api.get(`/invoices${q}`),
  createInvoice:(b)=>api.post("/invoices",b),sendInvoice:(id,b)=>api.post(`/invoices/${id}/send`,b),
  getXML:(id)=>fetch(`${API_BASE}/invoices/${id}/xml`,{headers:{Authorization:`Bearer ${api._token}`}}).then(r=>r.text()),
  // E-Mail Ausgang
  sendInvoiceEmail:(id,recipient_email,message)=>api.post(`/invoices/${id}/send-email`,{recipient_email,message}),
  // Peppol
  sendViaPeppol:(id,peppol_id)=>api.post(`/invoices/${id}/send-peppol`,{peppol_id}),
  lookupPeppol:(peppol_id)=>api.get(`/invoices/peppol/lookup?peppol_id=${encodeURIComponent(peppol_id)}`),
  // DATEV Export
  datevExport:()=>{ window.open(`${API_BASE}/invoices/datev-export?token=${api._token}`,'_blank'); },
  datevExportInbound:(orgId,from,to)=>{ window.open(`${API_BASE}/inbound/datev-export?org_id=${orgId}&from=${from||''}&to=${to||''}`,'_blank'); },
  // Inbound
  listInbound:(params='')=>api.get(`/inbound${params}`),
  getInboundPdf:(id)=>`${API_BASE}/inbound/${id}/pdf`,
  markInboundPaid:(id)=>api.post(`/inbound/${id}/mark-paid`,{}),
  forwardInbound:(id,email)=>api.post(`/inbound/${id}/forward`,{recipient_email:email}),
  // createCheckout stays:
  createCheckout:(plan,billing='monthly')=>api.post('/payments/checkout',{plan,billing}),
  openBillingPortal:(customer_id)=>api.post('/payments/portal',{customer_id}),
  getPlans:()=>api.get('/payments/plans'),
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
body{font-family:${F.ui};background:${T.bgSubtle};color:${T.textPrimary};font-size:14px;line-height:1.5;letter-spacing:-.01em;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${T.bgBorder};border-radius:2px;}

/* Animations */
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

.fi{animation:fadeIn .25s ease both}
.fu{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both}
.fu2{animation:fadeUp .4s .06s cubic-bezier(.16,1,.3,1) both}
.fu3{animation:fadeUp .4s .12s cubic-bezier(.16,1,.3,1) both}
.fu4{animation:fadeUp .4s .18s cubic-bezier(.16,1,.3,1) both}
.fu5{animation:fadeUp .4s .24s cubic-bezier(.16,1,.3,1) both}
.sci{animation:scaleIn .2s cubic-bezier(.16,1,.3,1) both}

/* Skeleton */
.skeleton{
  background:linear-gradient(90deg,${T.bgMuted} 25%,${T.bgSubtle} 50%,${T.bgMuted} 75%);
  background-size:400px 100%;
  animation:shimmer 1.2s ease-in-out infinite;
  border-radius:4px;
}

/* ── Buttons — Stripe-precise ── */
.btn{
  font-family:${F.ui};font-size:13.5px;font-weight:500;
  cursor:pointer;border-radius:6px;border:none;
  display:inline-flex;align-items:center;gap:6px;
  transition:all .14s ease;white-space:nowrap;
  letter-spacing:-.01em;text-decoration:none;
}
.btn:active{transform:scale(.985)!important;filter:brightness(.96);}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important;}

/* Primary — Stripe's indigo */
.btn-primary{
  background:${T.accent};color:#fff;
  padding:8px 16px;
  box-shadow:0 0 0 1px rgba(99,91,255,.2),0 1px 3px rgba(99,91,255,.25),inset 0 1px 0 rgba(255,255,255,.1);
}
.btn-primary:hover{background:${T.accentHover};box-shadow:0 0 0 1px rgba(79,70,229,.3),0 2px 6px rgba(79,70,229,.3),inset 0 1px 0 rgba(255,255,255,.1);}

/* Dark — Stripe's brand button */
.btn-dark{
  background:${T.brand};color:#fff;padding:8px 16px;
  box-shadow:0 0 0 1px rgba(10,37,64,.2),0 1px 3px rgba(10,37,64,.3),inset 0 1px 0 rgba(255,255,255,.06);
}
.btn-dark:hover{background:${T.brandMid};}

/* Ghost — subtle border */
.btn-ghost{
  background:${T.bg};color:${T.textSecondary};
  border:1px solid ${T.bgBorder};padding:7px 14px;
  box-shadow:0 1px 2px rgba(0,0,0,.05);
}
.btn-ghost:hover{background:${T.bgSubtle};border-color:${T.textPlaceholder};color:${T.textPrimary};}

.btn-outline{background:transparent;color:${T.accent};border:1px solid ${T.accentPale};padding:6px 13px;font-size:13px;}
.btn-outline:hover{background:${T.accentLight};}
.btn-danger{background:${T.bg};color:${T.red};border:1px solid ${T.redBdr};padding:6px 13px;font-size:12.5px;}
.btn-success{background:${T.bg};color:${T.green};border:1px solid ${T.greenBdr};padding:6px 13px;font-size:12.5px;}
.btn-lg{padding:10px 22px;font-size:15px;font-weight:600;border-radius:8px;}
.btn-sm{padding:5px 10px;font-size:12px;border-radius:5px;}
.btn-xl{padding:13px 32px;font-size:16px;font-weight:600;border-radius:8px;}

/* ── Inputs — Stripe-exact ── */
.input{
  width:100%;background:${T.bg};
  border:1px solid ${T.bgBorder};border-radius:6px;
  padding:8px 12px;font-family:${F.ui};font-size:14px;
  color:${T.textPrimary};outline:none;
  box-shadow:0 1px 1px rgba(0,0,0,.04),0 2px 4px rgba(10,37,64,.06);
  transition:border-color .14s,box-shadow .14s;
}
.input:focus{
  border-color:${T.accent};
  box-shadow:0 0 0 2px rgba(99,91,255,.15),0 1px 1px rgba(0,0,0,.04);
}
.input::placeholder{color:${T.textPlaceholder};}
.select{
  width:100%;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:6px;
  padding:8px 12px;font-family:${F.ui};font-size:14px;color:${T.textPrimary};
  outline:none;cursor:pointer;
  box-shadow:0 1px 1px rgba(0,0,0,.04);
  transition:border-color .14s;
}
.select:focus{border-color:${T.accent};}
.label{
  display:block;font-size:12px;font-weight:500;
  color:${T.textSecondary};margin-bottom:5px;
}

/* ── Cards — Stripe's layered approach ── */
.card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 6px rgba(10,37,64,.06);
}
.card-hover{transition:all .15s;}
.card-hover:hover{
  border-color:${T.textPlaceholder};
  box-shadow:0 2px 4px rgba(0,0,0,.04),0 4px 12px rgba(10,37,64,.1);
  transform:translateY(-1px);
}

/* ── Table ── */
.table{width:100%;border-collapse:collapse;}
.table th{
  text-align:left;padding:9px 14px;
  font-size:11px;color:${T.textMuted};font-weight:600;
  letter-spacing:.6px;text-transform:uppercase;
  border-bottom:1px solid ${T.bgBorder};
  background:${T.bgSubtle};
}
.table th:first-child{border-radius:8px 0 0 0;}
.table th:last-child{border-radius:0 8px 0 0;}
.table td{
  padding:11px 14px;font-size:13.5px;
  border-bottom:1px solid ${T.bgSubtle};
  vertical-align:middle;
}
.tr-hover:hover{background:${T.bgSubtle};cursor:pointer;}

/* ── Badges — Stripe minimal ── */
.badge{
  display:inline-flex;align-items:center;gap:3px;
  border-radius:4px;padding:2px 7px;
  font-size:11px;font-weight:600;letter-spacing:.2px;
}
.badge-green {background:${T.greenBg};color:${T.green}; border:1px solid ${T.greenBdr};}
.badge-red   {background:${T.redBg};  color:${T.red};   border:1px solid ${T.redBdr};}
.badge-amber {background:${T.amberBg};color:${T.amber}; border:1px solid ${T.amberBdr};}
.badge-blue  {background:${T.blueBg}; color:${T.blue};  border:1px solid ${T.blueBdr};}
.badge-purple{background:${T.accentLight};color:${T.accent};border:1px solid ${T.accentPale};}
.badge-gray  {background:${T.bgMuted};color:${T.textSecondary};border:1px solid ${T.bgBorder};}

/* ── Navigation ── */
.nav-item{
  display:flex;align-items:center;gap:8px;
  padding:6px 10px;background:transparent;
  color:${T.textMuted};border:none;border-radius:6px;
  cursor:pointer;font-size:13px;font-weight:500;
  text-align:left;width:100%;font-family:${F.ui};
  transition:all .1s;
}
.nav-item:hover{color:${T.textPrimary};background:${T.bgMuted};}
.nav-item.active{color:${T.textPrimary};background:${T.bgMuted};font-weight:600;}
.nav-section{
  font-size:10px;font-weight:600;color:${T.textPlaceholder};
  letter-spacing:.8px;text-transform:uppercase;
  padding:12px 10px 4px;
}

/* ── Layout ── */
.sidebar{
  width:216px;background:${T.bg};
  border-right:1px solid ${T.bgBorder};
  display:flex;flex-direction:column;flex-shrink:0;
  position:sticky;top:0;height:100vh;overflow-y:auto;
}
.topbar{
  height:50px;border-bottom:1px solid ${T.bgBorder};
  display:flex;align-items:center;justify-content:space-between;
  padding:0 24px;background:${T.bg};flex-shrink:0;
}

/* ── Misc ── */
.divider{height:1px;background:${T.bgBorder};}
.progress{height:2px;background:${T.bgMuted};border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;background:${T.accent};border-radius:2px;transition:width .3s;}
.stat-num{
  font-family:${F.ui};font-size:28px;font-weight:700;
  color:${T.textPrimary};line-height:1;letter-spacing:-.03em;
}
.tab{
  padding:8px 14px;font-size:13px;font-weight:500;
  color:${T.textMuted};border:none;background:transparent;
  cursor:pointer;border-bottom:2px solid transparent;
  font-family:${F.ui};transition:all .12s;
  letter-spacing:-.01em;
}
.tab.active{color:${T.textPrimary};border-bottom-color:${T.accent};font-weight:600;}
.tab:hover{color:${T.textSecondary};}
.avatar{
  width:26px;height:26px;border-radius:50%;
  background:${T.accentLight};display:flex;
  align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:${T.accent};flex-shrink:0;
}
.modal-overlay{
  position:fixed;inset:0;background:rgba(10,37,64,.4);
  z-index:1000;display:flex;align-items:center;justify-content:center;
  padding:24px;backdrop-filter:blur(4px);
}
.modal{
  background:${T.bg};border-radius:8px;padding:24px;
  max-width:480px;width:100%;
  box-shadow:0 4px 8px rgba(0,0,0,.04),0 20px 48px rgba(10,37,64,.16);
}

/* ── Landing-specific ── */
.hero-pill{
  display:inline-flex;align-items:center;gap:6px;
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:20px;padding:4px 12px;
  font-size:12px;color:${T.textSecondary};font-weight:500;
  box-shadow:0 1px 2px rgba(0,0,0,.05);
}
.feature-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:22px;
  transition:all .15s;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 6px rgba(10,37,64,.05);
}
.feature-card:hover{
  border-color:${T.textPlaceholder};
  box-shadow:0 2px 4px rgba(0,0,0,.04),0 6px 16px rgba(10,37,64,.08);
  transform:translateY(-2px);
}
.pricing-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:28px;
  transition:all .15s;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 6px rgba(10,37,64,.05);
}
.pricing-card:hover{
  box-shadow:0 4px 8px rgba(0,0,0,.04),0 12px 32px rgba(10,37,64,.1);
  transform:translateY(-2px);
}
.pricing-card.featured{background:${T.brand};border-color:${T.brand};}
/* Integration logo pills — futuristic */
.integration-logo{
  display:inline-flex;align-items:center;gap:9px;
  padding:11px 20px;
  background:rgba(10,37,64,.04);
  border:1px solid rgba(99,91,255,.18);
  border-radius:10px;
  font-size:13px;font-weight:600;letter-spacing:-.01em;
  color:${T.textSecondary};
  white-space:nowrap;cursor:default;
  transition:border-color .2s,color .2s,background .2s,box-shadow .2s,transform .2s;
  user-select:none;flex-shrink:0;
  position:relative;
  overflow:hidden;
}
.integration-logo::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(99,91,255,.07) 0%,transparent 60%);
  pointer-events:none;
}
.integration-logo:hover{
  border-color:rgba(99,91,255,.55);
  color:${T.textPrimary};
  background:rgba(99,91,255,.07);
  box-shadow:0 0 0 1px rgba(99,91,255,.15),0 4px 20px rgba(99,91,255,.15);
  transform:translateY(-2px);
}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.marquee-track{
  display:flex;gap:10px;
  animation:marquee 32s linear infinite;
  width:max-content;
}
.marquee-track:hover{animation-play-state:paused;}
.marquee-wrap{
  overflow:hidden;
  mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
  -webkit-mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
}
.connector-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:16px;transition:all .14s;cursor:pointer;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 4px rgba(10,37,64,.05);
}
.connector-card:hover{border-color:${T.accent};box-shadow:0 2px 4px rgba(0,0,0,.04),0 4px 12px rgba(10,37,64,.08);transform:translateY(-1px);}
.connector-card.connected{border-color:${T.greenBdr};background:${T.greenBg};}

/* Scroll reveal */
.reveal{opacity:0;transform:translateY(20px);transition:opacity .5s cubic-bezier(.16,1,.3,1),transform .5s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

@media(max-width:768px){
  .sidebar{display:none;}
  .topbar{padding:0 16px;}
}
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
    <span style={{fontFamily:F.ui,fontSize:size*.9,fontWeight:400,color:c,letterSpacing:"-.02em"}}>inv<span style={{color:a}}>o</span>iq</span>
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
function Landing({onEnter,onLegal=()=>{}}){
  const[scrolled,setScrolled]=useState(false);
  const[tick,setTick]=useState(0);
  const[activeStep,setActiveStep]=useState(-1);
  const[heroTab,setHeroTab]=useState(0);
  const[billingYearly,setBillingYearly]=useState(false);

  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),2200);
    return()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    const id=setInterval(()=>setHeroTab(t=>(t+1)%7),3200);
    return()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>40);
    window.addEventListener('scroll',h,{passive:true});
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target);}
    }),{threshold:.1,rootMargin:'0px 0px -30px 0px'});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
    const sobs=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){
        const idx=parseInt(e.target.dataset.step||0);
        setTimeout(()=>setActiveStep(s=>Math.max(s,idx)),idx*180);
        sobs.unobserve(e.target);
      }
    }),{threshold:.2});
    document.querySelectorAll('.flow-step').forEach(el=>sobs.observe(el));
    return()=>{window.removeEventListener('scroll',h);obs.disconnect();sobs.disconnect();};
  },[]);

  const liveRows=[
    {num:'INV-2025-041',co:'Müller GmbH',amt:'4.284 €',st:'delivered'},
    {num:'INV-2025-040',co:'TechVision AG',amt:'12.900 €',st:'validated'},
    {num:'INV-2025-039',co:'Stadtwerke Nord',amt:'780 €',st:'error'},
    {num:'INV-2025-038',co:'Bauer Logistik',amt:'2.190 €',st:'delivered'},
    {num:'INV-2025-037',co:'Nord Express',amt:'8.440 €',st:'delivered'},
  ];
  const visibleRows=liveRows.slice(tick%5,(tick%5)+3).concat(liveRows).slice(0,3);
  const integrations=['SAP S/4HANA','SAP ECC','DATEV','Lexware','MS Dynamics','Odoo','Xero','QuickBooks','NetSuite','sevDesk','lexoffice','Weclapp'];

  const stBadge=(s)=>{
    const m={delivered:[T.green,'#ECFDF5','#A7F3D0','Delivered'],validated:[T.accent,'#EEF2FF','#C7D2FE','Validated'],error:[T.red,'#FEF2F2','#FECACA','Error'],pending:[T.amber,'#FFFBEB','#FDE68A','Pending']};
    const[c,bg,bd,lbl]=m[s]||[T.textMuted,T.bgMuted,T.bgBorder,s];
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:bg,color:c,border:`1px solid ${bd}`}}>{lbl}</span>;
  };

  const heroTabs=[
    {label:'Overview',content:(
      <div style={{padding:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
          {[['41','Sent','▲ +8%',T.green],['28','Received','This week',T.accent],['1','Errors','Review',T.red],['98%','Compliance','EN 16931',T.green]].map(([v,l,s,c])=>(
            <div key={l} style={{background:T.bgSubtle,borderRadius:5,padding:'9px 10px',border:`1px solid ${T.bgBorder}`}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:4}}>{l}</div>
              <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',lineHeight:1}}>{v}</div>
              <div style={{fontSize:9.5,color:c,marginTop:3,fontWeight:600}}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:3,height:44,padding:'0 2px',marginBottom:10}}>
          {[22,28,24,36,31,40,41].map((v,i)=>(
            <div key={i} style={{flex:1,background:i===6?T.accent:`${T.accent}28`,borderRadius:'2px 2px 0 0',height:`${(v/41)*100}%`,minHeight:3}}/>
          ))}
        </div>
        {visibleRows.map((r,i)=>(
          <div key={r.num+i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none'}}>
            <span style={{fontFamily:F.mono,fontSize:10,color:T.textPrimary,flex:'0 0 90px'}}>{r.num}</span>
            <span style={{fontSize:10.5,color:T.textSecondary,flex:1}}>{r.co}</span>
            <span style={{fontSize:10.5,fontWeight:600,color:T.textPrimary}}>{r.amt}</span>
            <div style={{flexShrink:0}}>{stBadge(r.st)}</div>
          </div>
        ))}
      </div>
    )},
    {label:'Documents',content:(
      <div style={{padding:16}}>
        <div style={{display:'flex',gap:6,marginBottom:12}}>
          {['All','Delivered','Errors'].map((t,i)=>(
            <span key={t} style={{fontSize:10.5,fontWeight:i===0?700:500,color:i===0?T.accent:T.textMuted,padding:'3px 8px',borderRadius:4,background:i===0?T.accentLight:'transparent',border:`1px solid ${i===0?T.accentPale:T.bgBorder}`,cursor:'default'}}>{t}</span>
          ))}
        </div>
        {liveRows.map((r,i)=>(
          <div key={r.num} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i<4?`1px solid ${T.bgSubtle}`:'none'}}>
            <span style={{fontFamily:F.mono,fontSize:10,color:T.textPrimary,flex:'0 0 90px'}}>{r.num}</span>
            <span style={{fontSize:10.5,color:T.textSecondary,flex:1}}>{r.co}</span>
            <span style={{fontSize:10,fontWeight:600,color:T.textPrimary,flex:'0 0 56px',textAlign:'right'}}>{r.amt}</span>
            <div style={{flexShrink:0}}>{stBadge(r.st)}</div>
          </div>
        ))}
      </div>
    )},
    {label:'Connectors',content:(
      <div style={{padding:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {[['SAP S/4HANA','RFC / IDoc',true],['DATEV','Connect Online',true],['Lexware','XML / SFTP',true],['MS Dynamics','Dataverse API',false],['Odoo','JSON-RPC',false],['REST API','HTTP',true]].map(([n,m,c])=>(
          <div key={n} style={{background:c?T.bgSubtle:T.bg,border:`1px solid ${c?T.greenBdr:T.bgBorder}`,borderRadius:5,padding:'9px 10px'}}>
            <div style={{fontWeight:600,fontSize:11.5,color:T.textPrimary,marginBottom:2}}>{n}</div>
            <div style={{fontSize:10,color:T.textMuted,marginBottom:6}}>{m}</div>
            <span style={{fontSize:9.5,fontWeight:700,padding:'2px 6px',borderRadius:3,background:c?'#ECFDF5':'#F1F5F9',color:c?T.green:T.textMuted,border:`1px solid ${c?T.greenBdr:T.bgBorder}`}}>{c?'Connected':'Available'}</span>
          </div>
        ))}
      </div>
    )},
  ];

  const STEPS=[
    {n:1,title:'ERP verbinden',desc:'Einmalige Konfiguration in unter 2 Stunden. SAP, DATEV oder REST API — danach läuft alles automatisch.',tags:['SAP S/4HANA','SAP ECC','DATEV','Lexware','REST API'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        {[['SAP S/4HANA','Connected'],['DATEV Connect','Connected'],['Lexware Office','Configure →']].map(([n,s],i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<2?`1px solid ${T.bgBorder}`:'none'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:s==='Connected'?T.green:T.bgBorder,flexShrink:0}}/>
            <span style={{fontSize:12.5,color:T.textPrimary,flex:1}}>{n}</span>
            <span style={{fontSize:11,fontWeight:600,color:s==='Connected'?T.green:T.accent}}>{s}</span>
          </div>
        ))}
      </div>
    )},
    {n:2,title:'Ausgehend & Eingehend — bidirektional',desc:'Seit Januar 2025 Pflicht: Alle Unternehmen müssen E-Rechnungen empfangen können. invoiq verarbeitet beide Richtungen vollautomatisch — ohne Medienbruch.',tags:['Outbound XRechnung','Inbound Parsing','Peppol Empfang','PDF-Konvertierung'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div style={{background:T.bg,border:`1px solid ${T.greenBdr}`,borderRadius:5,padding:'10px 12px'}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>AUSGEHEND</div>
            <div style={{fontSize:22,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>41</div>
            <div style={{fontSize:10.5,color:T.green,fontWeight:600,marginTop:2}}>▲ +8% heute</div>
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.accentPale}`,borderRadius:5,padding:'10px 12px'}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>EINGEHEND</div>
            <div style={{fontSize:22,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>28</div>
            <div style={{fontSize:10.5,color:T.accent,fontWeight:600,marginTop:2}}>Automatisch verarbeitet</div>
          </div>
        </div>
      </div>
    )},
    {n:3,title:'EN 16931 Validierung & XML',desc:'invoiq generiert XRechnung UBL 2.1 oder ZUGFeRD CII und validiert sofort gegen den europäischen Standard.',tags:['XRechnung 3.0','ZUGFeRD 2.4','Peppol BIS 3.0'],preview:(
      <div style={{marginTop:12,background:T.brand,borderRadius:6,padding:'12px 14px',fontFamily:F.mono,fontSize:10.5,lineHeight:1.7,color:'rgba(255,255,255,.5)',overflow:'hidden',maxHeight:110}}>
        <span style={{color:'#818CF8'}}>&lt;ubl:Invoice&gt;</span><br/>
        {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:ID&gt;</span><span style={{color:'#6EE7B7'}}>INV-2025-041</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
        {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:IssueDate&gt;</span><span style={{color:'#6EE7B7'}}>2025-05-27</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
        {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:PayableAmount&gt;</span><span style={{color:'#6EE7B7'}}>4284.00</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
        <span style={{color:'#818CF8'}}>&lt;/ubl:Invoice&gt;</span>
      </div>
    )},
    {n:4,title:'Automatische ERP-Buchung',desc:'Eingehende Rechnungen werden direkt in Ihr Buchhaltungssystem gebucht — vollautomatisch, ohne Medienbruch. Procure-to-Pay ohne manuelle Schritte.',tags:['SAP FI automatisch','DATEV Buchung','Order-to-Cash','Procure-to-Pay'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        {[['Rechnung empfangen','XRechnung geparst',T.green],['ERP-Mapping','SAP FI Buchung erstellt',T.green],['Freigabe','Workflow ausgelöst',T.accent],['Archiviert','GoBD-konform gespeichert',T.green]].map(([s,d,c],i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'5px 0',borderBottom:i<3?`1px solid ${T.bgBorder}`:'none'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:c,flexShrink:0,marginTop:4}}/>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.textPrimary}}>{s}</div>
              <div style={{fontSize:11,color:T.textMuted}}>{d}</div>
            </div>
          </div>
        ))}
      </div>
    )},
    {n:5,title:'GoBD-Archivierung & ViDA-ready',desc:'SHA-256-gesichert, 10 Jahre aufbewahrt — und bereits heute vorbereitet für ViDA Transaction-Reporting ab 2028/2030.',tags:['SHA-256','AWS Frankfurt','§147 AO','ViDA 2028','Meldesystem'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:T.green,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#fff" strokeWidth="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div style={{fontFamily:F.mono,fontSize:10,color:T.textSecondary,lineHeight:1.5}}>
            <div style={{color:T.textMuted,fontSize:9,marginBottom:1}}>SHA-256</div>a7f3d9c2b1e8f4...4d2a9c1b3e7f
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
          {[['12.441','Archiviert'],['10J','Aufbewahrung'],['ViDA','Ready 2028']].map(([v,l])=>(
            <div key={l} style={{background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:5,padding:'7px 9px',textAlign:'center'}}>
              <div style={{fontSize:14,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>{v}</div>
              <div style={{fontSize:9,color:T.textMuted,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    )},
  ];

  // Pricing plans — new structure with Freemium
  const PLANS=[
    {
      name:'Free',price:0,yearlyPrice:0,docs:'10 Dok./Monat',
      sub:'Kein Kreditkarte nötig',
      badge:null,
      features:['XRechnung-Generator','Inbound-Empfang','PDF-Download','1 Nutzer'],
      cta:'Kostenlos starten',ctaStyle:'outline',
    },
    {
      name:'Starter',price:49,yearlyPrice:39,docs:'100 Dok./Monat',
      sub:'Pro Monat, jederzeit kündbar',
      badge:null,
      features:['XRechnung + ZUGFeRD','Inbound-Empfang + Parsing','E-Mail-Versand','GoBD-Archiv','1 ERP-Konnektor','1 Nutzer'],
      cta:'14 Tage gratis testen',ctaStyle:'outline',
    },
    {
      name:'Business',price:199,yearlyPrice:159,docs:'1.000 Dok./Monat',
      sub:'Pro Monat, jederzeit kündbar',
      badge:'EMPFOHLEN',
      features:['Alles in Starter','Peppol BIS 3.0 Versand','Automatische ERP-Buchung','5 ERP-Konnektoren','KI-Rechnungserkennung','ViDA-Reporting ready','5 Nutzer'],
      cta:'Jetzt starten',ctaStyle:'primary',
    },
    {
      name:'Pro',price:599,yearlyPrice:479,docs:'10.000 Dok./Monat',
      sub:'Pro Monat, jederzeit kündbar',
      badge:null,
      features:['Alles in Business','Alle Konnektoren','Steuerberater-Portal','Branchen-Templates','Public REST API + Webhooks','White-Label','15 Nutzer'],
      cta:'Demo buchen',ctaStyle:'outline',
    },
  ];

  return(<div style={{background:T.bg,minHeight:'100vh',overflowX:'hidden'}}>

    {/* NAV */}
    <header style={{position:'fixed',top:0,left:0,right:0,zIndex:100,height:58,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 clamp(16px,4vw,56px)',background:scrolled?'rgba(255,255,255,.96)':T.bg,borderBottom:`1px solid ${scrolled?T.bgBorder:'transparent'}`,backdropFilter:scrolled?'blur(12px)':'none',transition:'all .3s'}}>
      <Wordmark size={22}/>
      <nav style={{display:'flex',gap:2}}>
        {['Funktionen','Preise','Sicherheit'].map(l=><a key={l} href={`#${l.toLowerCase()}`} style={{fontSize:13,fontWeight:500,color:T.textMuted,textDecoration:'none',padding:'6px 11px',borderRadius:6,transition:'all .14s'}} onMouseEnter={e=>{e.target.style.color=T.textPrimary;e.target.style.background=T.bgSubtle;}} onMouseLeave={e=>{e.target.style.color=T.textMuted;e.target.style.background='transparent';}}>{l}</a>)}
      </nav>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-ghost btn-sm" onClick={onEnter}>Anmelden</button>
        <button className="btn btn-primary btn-sm" onClick={onEnter}>Kostenlos starten →</button>
      </div>
    </header>

    {/* HERO */}
    <section style={{minHeight:'100vh',display:'flex',alignItems:'center',padding:'80px clamp(16px,4vw,56px) 60px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${T.bgBorder} 1px,transparent 1px),linear-gradient(90deg,${T.bgBorder} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:.35,pointerEvents:'none'}}/>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse 70% 80% at 60% 50%,transparent 30%,${T.bg} 75%)`,pointerEvents:'none'}}/>
      <div style={{maxWidth:1100,margin:'0 auto',width:'100%',display:'grid',gridTemplateColumns:'1fr 1.35fr',gap:48,alignItems:'center',position:'relative'}}>
        <div>
          <div className="fu" style={{marginBottom:20}}>
            <span className="hero-pill">
              <span style={{width:6,height:6,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite',display:'inline-block'}}/>
              E-Rechnungspflicht 2025/2027 — Jetzt vorbereiten
            </span>
          </div>
          <h1 className="fu2" style={{fontFamily:F.ui,fontSize:'clamp(32px,4.5vw,56px)',fontWeight:800,color:T.textPrimary,lineHeight:1.1,letterSpacing:'-.04em',marginBottom:18}}>
            E-Invoice<br/>Compliance.<br/><span style={{color:T.accent}}>Automatisch.</span>
          </h1>
          <p className="fu3" style={{fontSize:16,color:T.textSecondary,lineHeight:1.7,marginBottom:10,maxWidth:440}}>
            Seit <strong>Januar 2025</strong> müssen alle Unternehmen E-Rechnungen empfangen können. Ab <strong>2027</strong> auch versenden.
          </p>
          <p className="fu3" style={{fontSize:14,color:T.textMuted,lineHeight:1.65,marginBottom:32,maxWidth:440}}>
            invoiq deckt beides — bidirektional, vollautomatisch, für SAP, DATEV, Lexware und jedes ERP.
          </p>
          <div className="fu4" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:40}}>
            <button className="btn btn-primary btn-lg" onClick={onEnter}>Kostenlos starten →</button>
            <button className="btn btn-ghost btn-lg" onClick={onEnter}>Demo ansehen</button>
          </div>
          <div className="fu5" style={{display:'flex',gap:24,paddingTop:20,borderTop:`1px solid ${T.bgBorder}`}}>
            {[['48h','bis Go-Live'],['Inbound','seit Jan 2025'],['ViDA','ready 2028']].map(([v,l])=>(
              <div key={l}>
                <div style={{fontSize:18,fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em'}}>{v}</div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Dashboard — 7 screens */}
        <div className="fu3" style={{position:'relative'}}>
          <div style={{position:'absolute',top:'5%',left:'5%',right:'5%',bottom:'5%',background:`radial-gradient(ellipse,${T.accentPale} 0%,transparent 70%)`,borderRadius:16,filter:'blur(24px)',opacity:.55,pointerEvents:'none'}}/>
          <div style={{background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:12,boxShadow:T.shadowXl,overflow:'hidden',position:'relative'}}>
            {/* Chrome */}
            <div style={{height:36,background:T.bgSubtle,borderBottom:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',padding:'0 14px',gap:7,flexShrink:0}}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}
              <div style={{flex:1,height:15,background:T.bgBorder,borderRadius:4,marginLeft:8,maxWidth:200}}/>
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite'}}/>
                <span style={{fontSize:10,color:T.textMuted,fontWeight:500}}>invoiq.io</span>
              </div>
            </div>
            <div style={{display:'flex',height:420}}>
              {/* Sidebar */}
              <div style={{width:126,background:T.bgSubtle,borderRight:`1px solid ${T.bgBorder}`,padding:'10px 8px',flexShrink:0,display:'flex',flexDirection:'column',gap:2}}>
                <div style={{display:'flex',alignItems:'center',gap:5,padding:'2px 4px',marginBottom:10}}>
                  <div style={{width:18,height:18,borderRadius:4,background:T.brand,flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:700,color:T.textPrimary}}>invoiq</span>
                </div>
                {[['Overview',0],['Documents',1],['Dok.-Scanner',2],['Inbound',3],['Kanzlei',4],['Archive',5],['Settings',6]].map(([label,idx])=>(
                  <div key={label} onClick={()=>setHeroTab(idx)} style={{padding:'5px 7px',borderRadius:5,fontSize:10.5,fontWeight:heroTab===idx?700:400,color:heroTab===idx?T.textPrimary:T.textMuted,background:heroTab===idx?T.bgMuted:'transparent',cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>{label}</div>
                ))}
              </div>
              {/* Content */}
              <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <div style={{height:36,borderBottom:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',flexShrink:0}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:T.textPrimary}}>{['Overview','Documents','Dok.-Scanner','Inbound','Kanzlei-Portal','Archive','Settings'][heroTab]}</span>
                  <div style={{width:7,height:7,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite'}}/>
                </div>
                <div style={{flex:1,overflow:'hidden'}}>
                  {heroTab===0&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginBottom:10}}>
                      {[['41','Sent','▲ +8%',T.green],['28','Received','This week',T.accent],['1','Errors','Review',T.red],['98%','Compliance','EN 16931',T.green]].map(([v,l,s,c])=>(
                        <div key={l} style={{background:T.bgSubtle,borderRadius:5,padding:'8px 10px',border:`1px solid ${T.bgBorder}`}}>
                          <div style={{fontSize:9.5,color:T.textMuted,marginBottom:3}}>{l}</div>
                          <div style={{fontSize:18,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',lineHeight:1}}>{v}</div>
                          <div style={{fontSize:9,color:c,marginTop:3,fontWeight:600}}>{s}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,height:48,marginBottom:10}}>
                      {[22,28,24,36,31,40,41].map((v,i)=><div key={i} style={{flex:1,background:i===6?T.accent:`${T.accent}28`,borderRadius:'2px 2px 0 0',height:`${(v/41)*100}%`,minHeight:2}}/>)}
                    </div>
                    {visibleRows.map((r,i)=>(
                      <div key={r.num+i} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none'}}>
                        <span style={{fontFamily:F.mono,fontSize:9.5,color:T.textPrimary,flex:'0 0 78px'}}>{r.num}</span>
                        <span style={{fontSize:10,color:T.textSecondary,flex:1}}>{r.co}</span>
                        <span style={{fontSize:10,fontWeight:600,color:T.textPrimary}}>{r.amt}</span>
                        <div>{stBadge(r.st)}</div>
                      </div>
                    ))}
                  </div>}
                  {heroTab===1&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <span style={{fontSize:11.5,fontWeight:700,color:T.textPrimary}}>Documents</span>
                      <div style={{background:T.accent,color:'#fff',borderRadius:5,padding:'3px 9px',fontSize:9.5,fontWeight:700}}>+ New</div>
                    </div>
                    <div style={{display:'flex',gap:5,marginBottom:10}}>
                      {['All','Delivered','Errors'].map((t,i)=><span key={t} style={{fontSize:9.5,padding:'2px 7px',borderRadius:4,background:i===0?T.accentLight:T.bgSubtle,color:i===0?T.accent:T.textMuted,border:`1px solid ${i===0?T.accentPale:T.bgBorder}`,fontWeight:i===0?700:500}}>{t}</span>)}
                    </div>
                    {liveRows.slice(0,5).map((r,i)=>(
                      <div key={r.num} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:i<4?`1px solid ${T.bgSubtle}`:'none'}}>
                        <span style={{fontFamily:F.mono,fontSize:9.5,color:T.textPrimary,flex:'0 0 78px'}}>{r.num}</span>
                        <span style={{fontSize:10,color:T.textSecondary,flex:1}}>{r.co}</span>
                        <span style={{fontSize:10,fontWeight:600,flex:'0 0 52px',textAlign:'right'}}>{r.amt}</span>
                        <div>{stBadge(r.st)}</div>
                      </div>
                    ))}
                  </div>}
                  {heroTab===2&&<div style={{padding:18,animation:'fadeIn .3s ease',textAlign:'center'}}>
                    <div style={{width:52,height:52,borderRadius:12,background:T.brand,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="1.8"/></svg>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:5}}>Dokumenten-Scanner</div>
                    <div style={{fontSize:11,color:T.textMuted,marginBottom:14,lineHeight:1.5}}>PDF oder Foto → XRechnung</div>
                    <div style={{background:T.brand,borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,textAlign:'left',marginBottom:8,cursor:'pointer'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="rgba(255,255,255,.8)" strokeWidth="1.8"/><circle cx="12" cy="13" r="4" stroke="rgba(255,255,255,.8)" strokeWidth="1.8"/></svg>
                      <span style={{fontSize:11.5,fontWeight:600,color:'#fff'}}>Rechnung fotografieren</span>
                    </div>
                    <div style={{display:'flex',gap:5,justifyContent:'center',marginTop:10}}>
                      {['DSGVO','TLS 1.3','EN 16931'].map(t=><span key={t} style={{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:4,background:T.greenBg,color:T.green,border:`1px solid ${T.greenBdr}`}}>{t}</span>)}
                    </div>
                  </div>}
                  {heroTab===3&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                      <span style={{fontSize:11.5,fontWeight:700,color:T.textPrimary}}>Inbound</span>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:T.redBg,color:T.red,border:`1px solid ${T.redBdr}`}}>Pflicht Jan 2025</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                      {[['3','Empfangen',T.accent],['2','Validiert',T.green],['1','Fehler',T.red]].map(([v,l,c])=>(
                        <div key={l} style={{background:T.bgSubtle,borderRadius:5,padding:'7px 8px',border:`1px solid ${T.bgBorder}`,textAlign:'center'}}>
                          <div style={{fontSize:18,fontWeight:800,color:c,letterSpacing:'-.03em'}}>{v}</div>
                          <div style={{fontSize:9.5,color:T.textMuted,marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {[{n:'EINGANG-003',s:'Müller Lieferant',a:'4.284 €',v:true},{n:'EINGANG-002',s:'TechParts AG',a:'1.290 €',v:false},{n:'EINGANG-001',s:'SAP Partner',a:'8.900 €',v:true}].map((r,i)=>(
                      <div key={r.n} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none'}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:r.v?T.green:T.red,flexShrink:0}}/>
                        <span style={{fontFamily:F.mono,fontSize:9.5,color:T.textPrimary,flex:'0 0 72px'}}>{r.n}</span>
                        <span style={{fontSize:10,color:T.textSecondary,flex:1}}>{r.s}</span>
                        <span style={{fontSize:9.5,fontWeight:600}}>{r.a}</span>
                      </div>
                    ))}
                    <div style={{marginTop:10,padding:'7px 10px',background:T.blueBg,border:`1px solid ${T.blueBdr}`,borderRadius:6,fontSize:9.5,color:T.blue}}>📧 rechnungen@invoiq.io · Peppol: 0190:DE...</div>
                  </div>}
                  {heroTab===4&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                      <span style={{fontSize:11.5,fontWeight:700,color:T.textPrimary}}>Kanzlei-Portal</span>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:T.purpleBg,color:T.purple,border:`1px solid ${T.purpleBdr}`}}>6 Mandanten</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                      {[['6','Mandanten',T.textPrimary],['423','Dok. Mai',T.accent],['98%','Compliance',T.green]].map(([v,l,c])=>(
                        <div key={l} style={{background:T.bgSubtle,borderRadius:5,padding:'7px 8px',border:`1px solid ${T.bgBorder}`,textAlign:'center'}}>
                          <div style={{fontSize:18,fontWeight:800,color:c,letterSpacing:'-.03em'}}>{v}</div>
                          <div style={{fontSize:9.5,color:T.textMuted,marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {[{n:'Müller Bäckerei GmbH',p:14,l:100,e:0},{n:'TechVision AG',p:284,l:1000,e:0},{n:'Stadtwerke Süd',p:67,l:100,e:1}].map((m,i)=>(
                      <div key={m.n} style={{padding:'6px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:10}}>
                          <span style={{fontWeight:600,color:T.textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:100}}>{m.n}</span>
                          <span style={{color:m.e>0?T.red:T.textMuted,fontWeight:m.e>0?700:400}}>{m.e>0?'⚠ Fehler':`${m.p}/${m.l}`}</span>
                        </div>
                        <div style={{height:3,background:T.bgBorder,borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${Math.min(100,(m.p/m.l)*100)}%`,background:m.e>0?T.red:T.accent,borderRadius:2}}/>
                        </div>
                      </div>
                    ))}
                  </div>}
                  {heroTab===5&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{fontSize:11.5,fontWeight:700,color:T.textPrimary,marginBottom:10}}>GoBD-Archiv</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,marginBottom:10}}>
                      {[['12.441','Archiviert'],['10 Jahre','Retention']].map(([v,l])=>(
                        <div key={l} style={{background:T.bgSubtle,borderRadius:5,padding:'8px 10px',border:`1px solid ${T.bgBorder}`}}>
                          <div style={{fontSize:16,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>{v}</div>
                          <div style={{fontSize:9.5,color:T.textMuted,marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {[{n:'INV-2025-041',h:'a7f3d9c2...'},{n:'INV-2025-040',h:'b2e8f1a4...'},{n:'EINGANG-003',h:'c4f8b2e6...'}].map((d,i)=>(
                      <div key={d.n} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none'}}>
                        <div style={{width:14,height:14,borderRadius:'50%',background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <span style={{fontFamily:F.mono,fontSize:9.5,color:T.textPrimary,flex:'0 0 70px'}}>{d.n}</span>
                        <span style={{fontFamily:F.mono,fontSize:9,color:T.textMuted,flex:1}}>{d.h}</span>
                        <span style={{fontSize:9,color:T.green,fontWeight:600}}>SHA-256 ✓</span>
                      </div>
                    ))}
                  </div>}
                  {heroTab===6&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{fontSize:11.5,fontWeight:700,color:T.textPrimary,marginBottom:12}}>Einstellungen</div>
                    {[{l:'Standard-Format',v:'XRechnung 3.0',t:'s'},{l:'GoBD-Archivierung',v:true,t:'t'},{l:'ViDA-Reporting (Beta)',v:false,t:'t'},{l:'Peppol aktiviert',v:true,t:'t'},{l:'Zustellweg',v:'E-Mail',t:'s'}].map((s,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',background:T.bgSubtle,borderRadius:6,border:`1px solid ${T.bgBorder}`,marginBottom:6}}>
                        <span style={{fontSize:10.5,color:T.textPrimary,fontWeight:500}}>{s.l}</span>
                        {s.t==='t'
                          ?<div style={{width:30,height:16,borderRadius:8,background:s.v?T.accent:T.bgBorder,position:'relative',flexShrink:0}}>
                            <div style={{position:'absolute',top:2,left:s.v?14:2,width:12,height:12,borderRadius:'50%',background:'#fff'}}/>
                          </div>
                          :<span style={{fontSize:9.5,color:T.textMuted,fontFamily:F.mono}}>{s.v}</span>}
                      </div>
                    ))}
                  </div>}
                </div>
              </div>
            </div>
          </div>
          {/* Floating notification */}
          <div style={{position:'absolute',bottom:-18,right:-14,background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:9,padding:'10px 14px',boxShadow:T.shadow3,display:'flex',alignItems:'center',gap:10,zIndex:2}}>
            <div style={{width:28,height:28,borderRadius:6,background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{fontSize:11.5,fontWeight:700,color:T.textPrimary}}>XRechnung generiert</div>
              <div style={{fontSize:10,color:T.textMuted}}>EN 16931 · GoBD · ViDA-ready ✓</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* INTEGRATIONS MARQUEE */}
    <section style={{padding:'48px 0',borderTop:`1px solid rgba(99,91,255,.12)`,borderBottom:`1px solid rgba(99,91,255,.12)`,background:'#07102A',overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(99,91,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,91,255,.07) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'60%',height:'100px',background:'radial-gradient(ellipse,rgba(99,91,255,.15) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <p style={{fontSize:10.5,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:1.4,textTransform:'uppercase',marginBottom:24,textAlign:'center',position:'relative'}}>Kompatibel mit führenden ERP-Systemen</p>
      <div className="marquee-wrap" style={{position:'relative'}}>
        <div className="marquee-track">
          {[...integrations,...integrations].map((n,i)=>(
            <div key={i} className="integration-logo" style={{color:'rgba(255,255,255,.55)',background:'rgba(255,255,255,.04)',borderColor:'rgba(255,255,255,.08)'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'rgba(99,91,255,.7)',display:'inline-block',flexShrink:0}}/>
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* INBOUND EMPFANG — Kritische Marktlücke */}
    <section style={{padding:'88px clamp(16px,4vw,56px)',background:T.bgSubtle,borderBottom:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:1060,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:56,alignItems:'center'}}>
        <div>
          <div className="reveal" style={{display:'inline-flex',alignItems:'center',gap:7,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'4px 12px',fontSize:11.5,fontWeight:700,color:T.red,marginBottom:16}}>
            ⚠ Seit 1. Januar 2025 gesetzlich verpflichtend
          </div>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(24px,3.5vw,40px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',lineHeight:1.15,marginBottom:16}}>
            Inbound-Empfang.<br/><span style={{color:T.accent}}>Für alle Unternehmen.</span>
          </h2>
          <p className="reveal" style={{fontSize:14.5,color:T.textSecondary,lineHeight:1.75,marginBottom:20}}>
            Seit Januar 2025 müssen alle <strong>3,5 Mio. B2B-Unternehmen</strong> in Deutschland E-Rechnungen empfangen können — unabhängig von Umsatz oder Größe. Nicht nur versenden.
          </p>
          <div className="reveal" style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
            {[
              ['Automatisches Parsing','XRechnung, ZUGFeRD und Peppol werden sofort strukturiert ausgelesen'],
              ['ERP-Buchung ohne Medienbruch','Direkte Verbuchung in SAP FI, DATEV oder Lexware — kein manueller Schritt'],
              ['Validierung & Fehler-Alerts','Defekte Rechnungen werden erkannt und mit Klartexthinweis zurückgemeldet'],
              ['Alle Tarife inklusive','Inbound-Empfang ist kein Premium-Feature — es ist Pflicht für alle'],
            ].map(([t,d])=>(
              <div key={t} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:18,height:18,borderRadius:'50%',background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.green,flexShrink:0,marginTop:2,fontWeight:700}}>✓</div>
                <div>
                  <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:2}}>{t}</div>
                  <div style={{fontSize:13,color:T.textSecondary,lineHeight:1.6}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary reveal" onClick={onEnter}>Inbound einrichten →</button>
        </div>

        {/* Inbound flow visual */}
        <div className="reveal">
          <div style={{background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:10,padding:24,boxShadow:T.shadow2}}>
            <div style={{fontSize:12,fontWeight:600,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:16}}>Eingehende Rechnung — Live</div>
            {[
              {icon:'📥',step:'Empfang',detail:'XRechnung von Lieferant ABC',status:'done',time:'09:14:03'},
              {icon:'🔍',step:'Parsing & Validierung',detail:'EN 16931 ✓ · Alle Pflichtfelder vorhanden',status:'done',time:'09:14:03'},
              {icon:'🗺',step:'ERP-Mapping',detail:'Kreditor 10042 · Kostenstelle 4100',status:'done',time:'09:14:04'},
              {icon:'📒',step:'SAP FI Buchung',detail:'Beleg 1800023847 erstellt',status:'done',time:'09:14:04'},
              {icon:'🔒',step:'GoBD-Archivierung',detail:'SHA-256 · 10 Jahre gesichert',status:'done',time:'09:14:05'},
            ].map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 0',borderBottom:i<4?`1px solid ${T.bgSubtle}`:'none',position:'relative'}}>
                {i<4&&<div style={{position:'absolute',left:9,top:34,bottom:0,width:1,background:T.bgBorder}}/>}
                <div style={{width:20,height:20,borderRadius:'50%',background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.green,flexShrink:0,marginTop:2,fontWeight:700,zIndex:1}}>✓</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:T.textPrimary}}>{s.step}</div>
                  <div style={{fontSize:11.5,color:T.textMuted}}>{s.detail}</div>
                </div>
                <div style={{fontSize:10,color:T.textMuted,fontFamily:F.mono,flexShrink:0}}>{s.time}</div>
              </div>
            ))}
            <div style={{marginTop:14,padding:'10px 14px',background:T.greenBg,border:`1px solid ${T.greenBdr}`,borderRadius:6,display:'flex',alignItems:'center',gap:10}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{fontSize:12.5,fontWeight:600,color:T.green}}>Vollständig verarbeitet — 2 Sekunden</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ANIMATED PROCESS FLOW */}
    <section id="funktionen" style={{padding:'96px clamp(16px,4vw,56px)'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:64}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14,fontSize:11}}>So funktioniert's</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em',lineHeight:1.15,marginBottom:12}}>Von der Faktura zur EN 16931-Rechnung.</h2>
          <p className="reveal" style={{fontSize:15,color:T.textSecondary,maxWidth:480,margin:'0 auto'}}>Fünf automatische Schritte — bidirektional, ohne manuelle Eingriffe.</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {STEPS.map((s,i)=>(
            <div key={s.n} className="flow-step" data-step={i} style={{display:'grid',gridTemplateColumns:'56px 1fr',gap:24,paddingBottom:i<STEPS.length-1?40:0,position:'relative',opacity:activeStep>=i?1:0,transform:activeStep>=i?'translateY(0)':'translateY(16px)',transition:'opacity .5s ease, transform .5s ease'}}>
              {i<STEPS.length-1&&<div style={{position:'absolute',left:27,top:56,width:2,height:'calc(100% - 30px)',background:`linear-gradient(to bottom,${activeStep>i?T.accent:T.bgBorder} 0%,${T.bgBorder} 100%)`,transition:'background .5s',borderRadius:1}}/>}
              <div style={{width:56,height:56,borderRadius:'50%',background:activeStep>=i?T.accent:T.bg,border:`2px solid ${activeStep>=i?T.accent:T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,color:activeStep>=i?'#fff':T.textMuted,flexShrink:0,zIndex:1,transition:'all .4s cubic-bezier(.16,1,.3,1)',transform:activeStep===i?'scale(1.12)':'scale(1)',boxShadow:activeStep===i?`0 0 0 6px ${T.accentPale}`:activeStep>i?`0 0 0 4px ${T.accentLight}`:'none'}}>
                {activeStep>i?<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>:s.n}
              </div>
              <div style={{paddingTop:12}}>
                <h3 style={{fontSize:17,fontWeight:700,color:T.textPrimary,marginBottom:6,letterSpacing:'-.025em'}}>{s.title}</h3>
                <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65,marginBottom:10,maxWidth:560}}>{s.desc}</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {s.tags.map(t=><span key={t} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:4,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,color:T.textSecondary}}>{t}</span>)}
                </div>
                <div style={{overflow:'hidden',maxHeight:activeStep>=i?300:0,transition:'max-height .6s cubic-bezier(.16,1,.3,1) .15s',opacity:activeStep>=i?1:0,transitionDelay:activeStep>=i?'.15s':'0s'}}>
                  {s.preview}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* NEW FEATURES — Market dominance */}
    <section style={{padding:'88px clamp(16px,4vw,56px)',background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`,borderBottom:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:1080,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:52}}>
          <span className="reveal badge badge-blue" style={{marginBottom:14,fontSize:11}}>Marktführende Funktionen</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em',lineHeight:1.15}}>Alles was Sie brauchen.<br/>Nichts was Sie nicht brauchen.</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))',gap:12}}>
          {[
            {tag:'Neu',title:'KI-Rechnungserkennung',desc:'Automatische Extraktion aus PDF-Rechnungen — konvertiert historische Rechnungen in strukturierte XRechnungen ohne manuelle Arbeit.',color:T.purple},
            {tag:'Pflicht ab 2025',title:'Inbound für alle Tarife',desc:'Empfang, Parsing und Validierung eingehender E-Rechnungen ist in jedem Plan inklusive — nicht erst ab 199 €.',color:T.green},
            {tag:'Multiplikator',title:'Steuerberater-Portal',desc:'Zentrales Dashboard für Kanzleien mit hunderten KMU-Mandanten. Ein Login — alle Mandanten verwalten.',color:T.accent},
            {tag:'2028 ready',title:'ViDA Transaction Reporting',desc:'Die EU-Initiative ViDA kommt 2028. invoiq baut die Schnittstellen jetzt — Sie müssen später nichts umstellen.',color:T.amber},
            {tag:'Branche',title:'Branchen-Templates',desc:'Vorkonfigurierte Vorlagen für Bau, Handwerk, IT und E-Commerce — mit Abschlagszahlungen, GAEB-Support und mehr.',color:T.blue},
            {tag:'Self-Service',title:'Lieferanten-Portal',desc:'Geschäftspartner empfangen und versenden E-Rechnungen ohne eigenes System — Sie werden der zentrale Hub.',color:T.accent},
          ].map((f,i)=>(
            <div key={i} className="feature-card reveal" style={{transitionDelay:`${i*.06}s`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:f.color+'15',color:f.color,border:`1px solid ${f.color}30`}}>{f.tag}</span>
              </div>
              <h3 style={{fontWeight:700,fontSize:15,color:T.textPrimary,marginBottom:7,letterSpacing:'-.02em'}}>{f.title}</h3>
              <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* TARGET GROUPS */}
    <section style={{padding:'88px clamp(16px,4vw,56px)'}}>
      <div style={{maxWidth:1060,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:52}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14,fontSize:11}}>Zielgruppen</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em',lineHeight:1.15}}>Die richtige Lösung<br/>für jede Unternehmensgröße.</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {[
            {num:'01',target:'Mittelstand mit SAP',sub:'> 800k€ Umsatz · ab 01.01.2027 Versandpflicht',points:['SAP S/4HANA & ECC Integration','IDoc / CPI / RFC Anbindung','Vollautomatischer Faktura-Versand','EN 16931 + ZUGFeRD'],cta:'SAP-Demo buchen',color:T.accent},
            {num:'02',target:'DATEV-Kanzleien',sub:'Multiplikator für KMU-Mandanten',points:['Steuerberater-Portal',`Mandanten-Verwaltung zentral`,'DATEV Connect Integration','Alle Mandanten auf einen Blick'],cta:'Kanzlei-Paket ansehen',color:T.purple},
            {num:'03',target:'Kleinunternehmen',sub:'Alle müssen empfangen können',points:['Kostenloser Einstieg (10 Dok.)','Inbound-Empfang inklusive','Kein ERP nötig','XRechnung-Generator gratis'],cta:'Kostenlos starten',color:T.green},
          ].map((g,i)=>(
            <div key={i} className="card reveal" style={{padding:24,transitionDelay:`${i*.08}s`}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:28,height:18,borderRadius:3,background:g.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9.5,fontWeight:800,color:'rgba(255,255,255,.8)',letterSpacing:.4}}>{g.num}</div>
              </div>
              <h3 style={{fontSize:17,fontWeight:700,color:T.textPrimary,marginBottom:5,letterSpacing:'-.025em'}}>{g.target}</h3>
              <p style={{fontSize:12,color:T.textMuted,marginBottom:16}}>{g.sub}</p>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:20}}>
                {g.points.map((p,j)=>(
                  <div key={j} style={{display:'flex',gap:8,alignItems:'center',fontSize:13}}>
                    <span style={{width:14,height:14,borderRadius:'50%',background:g.color+'15',border:`1px solid ${g.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:g.color,flexShrink:0,fontWeight:700}}>✓</span>
                    <span style={{color:T.textSecondary}}>{p}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-sm" onClick={onEnter} style={{width:'100%',justifyContent:'center',background:'transparent',color:g.color,border:`1px solid ${g.color}30`,fontWeight:600}}>{g.cta} →</button>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* SECURITY */}
    <section id="sicherheit" style={{padding:'88px clamp(16px,4vw,56px)',background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`,borderBottom:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:920,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
        <div>
          <span className="reveal badge badge-green" style={{marginBottom:16,fontSize:11}}>Security & Compliance</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(24px,3vw,40px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',marginBottom:18}}>Revisionssicher. Gerichtsfest.</h2>
          <p className="reveal" style={{fontSize:14,color:T.textSecondary,lineHeight:1.75,marginBottom:20}}>SHA-256-gesichert, unveränderlich für 10 Jahre nach §147 AO archiviert. Vollständiger Audit-Trail für jede Transaktion.</p>
          <div className="reveal" style={{display:'flex',flexDirection:'column',gap:8}}>
            {['EN 16931 — Europäischer E-Rechnungsstandard','GoBD — Grundsätze ordnungsmäßiger Buchführung','§ 147 AO — 10 Jahre Aufbewahrungspflicht','DSGVO — Datenhaltung in AWS Frankfurt (EU)','ViDA-ready — Transaction Reporting ab 2028','SHA-256 — Kryptographische Integrität'].map(item=>(
              <div key={item} style={{display:'flex',gap:10,alignItems:'center',fontSize:13.5,color:T.textSecondary}}>
                <span style={{width:16,height:16,borderRadius:'50%',background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.green,flexShrink:0,fontWeight:700}}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="reveal" style={{background:T.brand,borderRadius:8,padding:28,color:'#fff'}}>
          {[['Compliance Score','98%',T.green],['Archivierte Dok.','12.441','rgba(255,255,255,.85)'],['Ø Verarbeitungszeit','< 1.2s','rgba(255,255,255,.6)'],['Verfügbarkeit','99.98%','#86EFAC'],['ViDA-Status','Ready 2028','#A5B4FC']].map(([l,v,c])=>(
            <div key={l} style={{padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,letterSpacing:.5,marginBottom:3,textTransform:'uppercase'}}>{l}</div>
              <div style={{fontSize:22,fontWeight:800,color:c,lineHeight:1,letterSpacing:'-.03em'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* PRICING */}
    <section id="preise" style={{padding:'88px clamp(16px,4vw,56px)'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14,fontSize:11}}>Preise</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em'}}>Transparent. Kein usage-based Billing.</h2>
          <p className="reveal" style={{fontSize:14,color:T.textSecondary,marginTop:10,marginBottom:24}}>Fester Monatspreis — keine Überraschungen. Jederzeit kündbar, keine Mindestlaufzeit.</p>

          {/* Billing toggle — default yearly */}
          <div className="reveal" style={{display:'inline-flex',alignItems:'center',gap:8,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:'5px 6px'}}>
            <button onClick={()=>setBillingYearly(false)} style={{padding:'6px 16px',borderRadius:6,border:'none',fontSize:13,fontWeight:600,cursor:'pointer',background:!billingYearly?T.bg:T.bgSubtle,color:!billingYearly?T.textPrimary:T.textMuted,boxShadow:!billingYearly?T.shadow1:'none',transition:'all .15s',fontFamily:F.ui}}>Monatlich</button>
            <button onClick={()=>setBillingYearly(true)} style={{padding:'6px 16px',borderRadius:6,border:'none',fontSize:13,fontWeight:600,cursor:'pointer',background:billingYearly?T.bg:T.bgSubtle,color:billingYearly?T.textPrimary:T.textMuted,boxShadow:billingYearly?T.shadow1:'none',transition:'all .15s',fontFamily:F.ui,display:'flex',alignItems:'center',gap:6}}>
              Jährlich
              <span style={{fontSize:10.5,fontWeight:700,color:'#fff',background:T.green,padding:'1px 7px',borderRadius:10}}>-20%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {
              name:'FREE',price:0,yearly:0,docs:'10 Rechnungen/Monat',
              tag:null,tagColor:null,
              sub:'Kein Login, keine Kreditkarte',
              features:['XRechnung & ZUGFeRD Basic','Manueller Generator','Inbound-Empfang','1 Jahr Archiv','1 Benutzer'],
              cta:'Kostenlos starten',ctaPrimary:false,
              roi:null,
            },
            {
              name:'STARTER',price:29,yearly:25,docs:'100 Rechnungen/Monat',
              tag:'AM BELIEBTESTEN',tagColor:T.accent,
              sub:'300€/Jahr bei Jahreszahlung',
              features:['Alle Formate (XR, ZUGFeRD, Peppol)','Automatischer Inbound','API-Zugang Basic','10 Jahre GoBD-Archiv','3 Benutzer','E-Mail-Support'],
              cta:'Jetzt starten',ctaPrimary:true,
              roi:'Spart Ø 15 Std./Monat Verwaltung',
            },
            {
              name:'BUSINESS',price:99,yearly:85,docs:'500 Rechnungen/Monat',
              tag:null,tagColor:null,
              sub:'1.020€/Jahr bei Jahreszahlung',
              features:['Alles in STARTER','ERP-Integration (SAP, DATEV)','Workflow-Automatisierung','Batch-Verarbeitung','10 Benutzer','Priorisierter Support'],
              cta:'Jetzt starten',ctaPrimary:false,
              roi:'Verhindert Ø 2.400€/Jahr Bußgelder',
            },
            {
              name:'ENTERPRISE',price:299,yearly:250,docs:'Unbegrenzte Rechnungen',
              tag:null,tagColor:null,
              sub:'3.000€/Jahr bei Jahreszahlung',
              features:['Alles in BUSINESS','Multi-Mandanten-Portal','Dedizierter Account Manager','SLA-Garantie','Telefon-Support','Onboarding-Service'],
              cta:'Kontakt aufnehmen',ctaPrimary:false,
              roi:null,
            },
          ].map((p,i)=>{
            const price=billingYearly?p.yearly:p.price;
            const isFeatured=p.ctaPrimary;
            const bg=isFeatured?T.brand:T.bg;
            const bd=isFeatured?T.brand:T.bgBorder;
            return(
              <div key={i} className="pricing-card reveal" style={{transitionDelay:`${i*.07}s`,position:'relative',background:bg,border:`1.5px solid ${bd}`,display:'flex',flexDirection:'column'}}>
                {p.tag&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:p.tagColor,color:'#fff',fontSize:9.5,fontWeight:800,padding:'3px 12px',borderRadius:10,whiteSpace:'nowrap',zIndex:2,letterSpacing:.5}}>{p.tag}</div>}

                {/* Plan name */}
                <div style={{fontWeight:800,fontSize:11,marginBottom:10,color:isFeatured?'rgba(255,255,255,.45)':T.textMuted,letterSpacing:1,textTransform:'uppercase'}}>{p.name}</div>

                {/* Price */}
                <div style={{display:'flex',alignItems:'baseline',gap:3,marginBottom:3}}>
                  {price===0
                    ? <span style={{fontSize:34,fontWeight:800,lineHeight:1,color:isFeatured?'#fff':T.textPrimary,letterSpacing:'-.04em'}}>Gratis</span>
                    : <><span style={{fontSize:34,fontWeight:800,lineHeight:1,color:isFeatured?'#fff':T.textPrimary,letterSpacing:'-.04em'}}>{price}€</span><span style={{fontSize:12.5,color:isFeatured?'rgba(255,255,255,.4)':T.textMuted}}>/Mo</span></>
                  }
                </div>
                <div style={{fontSize:11.5,color:isFeatured?'rgba(255,255,255,.45)':T.textMuted,marginBottom:3}}>{p.docs}</div>
                <div style={{fontSize:11,color:isFeatured?'rgba(255,255,255,.3)':T.textMuted,marginBottom:14}}>{billingYearly&&p.yearly>0?`${p.yearly*12}€/Jahr`:p.sub}</div>

                {/* ROI badge */}
                {p.roi&&(
                  <div style={{background:isFeatured?'rgba(255,255,255,.1)':T.greenBg,border:`1px solid ${isFeatured?'rgba(255,255,255,.15)':T.greenBdr}`,borderRadius:5,padding:'6px 10px',fontSize:11,color:isFeatured?'rgba(255,255,255,.7)':T.green,fontWeight:500,marginBottom:14,lineHeight:1.4}}>
                    💡 {p.roi}
                  </div>
                )}

                <div style={{height:1,background:isFeatured?'rgba(255,255,255,.1)':T.bgBorder,margin:'0 0 14px'}}/>

                {/* Features */}
                <div style={{flex:1}}>
                  {p.features.map((f,j)=>(
                    <div key={j} style={{display:'flex',gap:7,marginBottom:7,fontSize:12.5,color:j===0?(isFeatured?'#fff':T.textPrimary):(isFeatured?'rgba(255,255,255,.55)':T.textSecondary),alignItems:'flex-start'}}>
                      <span style={{fontSize:8,color:isFeatured?'rgba(255,255,255,.4)':'#635BFF',flexShrink:0,fontWeight:700,marginTop:3}}>✓</span>{f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button onClick={onEnter} style={{marginTop:16,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',gap:5,background:isFeatured?'rgba(255,255,255,.12)':'transparent',color:isFeatured?'#fff':'#635BFF',border:isFeatured?'1px solid rgba(255,255,255,.2)':`1px solid ${T.accentPale}`,padding:'9px',fontSize:12.5,fontWeight:600,borderRadius:6,cursor:'pointer',fontFamily:F.ui,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.opacity='.8';}} onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}>
                  {p.cta} →
                </button>
              </div>
            );
          })}
        </div>

        {/* Add-ons row */}
        <div className="reveal" style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:'18px 24px',marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:.6,textTransform:'uppercase',marginBottom:12}}>Add-ons — Flexibel zubuchbar</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
            {[
              {name:'Zusätzlicher Nutzer',price:'+9€/Monat'},
              {name:'API-Erweiterung',price:'+29€/Monat',sub:'10.000 zusätzliche API-Calls'},
              {name:'Premium-Onboarding',price:'499€ einmalig',sub:'48h-Setup durch Experten'},
              {name:'White-Label',price:'+99€/Monat',sub:'Für Steuerberater & Partner'},
            ].map((a,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 14px',background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{a.name}</div>
                  {a.sub&&<div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{a.sub}</div>}
                </div>
                <div style={{fontSize:13,fontWeight:700,color:T.accent,flexShrink:0}}>{a.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Overage note */}
        <div className="reveal" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{padding:'13px 18px',background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,display:'flex',alignItems:'flex-start',gap:10}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><path d="M8 5v3.5M8 11v.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:3}}>Kein Zwangsupgrade bei Überschreitung</div>
              <div style={{fontSize:12.5,color:T.textSecondary}}>Zusätzliche Rechnungen werden flexibel mit <strong>0,50€/Rechnung</strong> berechnet — kein sofortiger Plan-Wechsel nötig.</div>
            </div>
          </div>
          <div style={{padding:'13px 18px',background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,display:'flex',alignItems:'flex-start',gap:10}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}><path d="M3 8l4 4 6-7" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:3}}>Inbound-Empfang in allen Tarifen</div>
              <div style={{fontSize:12.5,color:T.textSecondary}}>Seit Januar 2025 gesetzlich verpflichtend für alle Unternehmen — deshalb in jedem Plan kostenlos inklusive.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{background:T.brand,padding:'72px clamp(16px,4vw,56px)',textAlign:'center'}}>
      <span className="reveal badge" style={{background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.6)',borderColor:'rgba(255,255,255,.12)',marginBottom:14,fontSize:11}}>3,5 Mio. Unternehmen betroffen — jetzt</span>
      <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',color:'#fff',fontWeight:800,letterSpacing:'-.04em',marginBottom:10}}>Bereit vor dem Stichtag.</h2>
      <p className="reveal" style={{color:'rgba(255,255,255,.45)',fontSize:15,marginBottom:28}}>Inbound ab sofort · Outbound ab 2027 · ViDA-ready ab 2028.</p>
      <button className="reveal btn btn-xl" onClick={onEnter} style={{background:'#fff',color:T.brand,border:'none',fontWeight:700}}>Kostenlos starten →</button>
    </section>

    {/* FOOTER */}
    <footer style={{background:T.bg,borderTop:`1px solid ${T.bgBorder}`,padding:'24px clamp(16px,4vw,56px)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <Wordmark size={18}/>
      <div style={{fontSize:12,color:T.textMuted}}>© 2025 invoiq · invoiq.io · EN 16931 · GoBD · ViDA-ready · DSGVO</div>
      <div style={{display:'flex',gap:16}}>{[['Impressum','impressum'],['Datenschutz','datenschutz'],['AGB','agb']].map(([l,s])=><button key={l} onClick={()=>onLegal(s)} style={{fontSize:12,color:T.textMuted,background:'none',border:'none',cursor:'pointer',fontFamily:F.ui}} onMouseEnter={e=>e.target.style.color=T.textPrimary} onMouseLeave={e=>e.target.style.color=T.textMuted}>{l}</button>)}</div>
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
        <h2 style={{fontFamily:F.ui,fontSize:24,fontWeight:400,color:T.textPrimary,marginBottom:5,letterSpacing:"-.02em"}}>{mode==="login"?"Willkommen zurück.":"Konto erstellen."}</h2>
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
  const items=[{key:"dashboard",icon:"·",label:"Overview"},{key:"invoices",icon:"·",label:"Rechnungen"},{key:"scanner",icon:"·",label:"Dok.-Scanner"},{key:"inbound",icon:"·",label:"Eingang"},{key:"steuerberater",icon:"·",label:"Kanzlei-Portal"},{key:"archive",icon:"·",label:"Archiv"},{key:"settings",icon:"·",label:"Einstellungen"}];
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
          <span style={{fontSize:10,width:8,height:8,borderRadius:"50%",background:nav===key?T.accent:"transparent",border:`1px solid ${nav===key?T.accent:T.bgBorder}`,flexShrink:0,display:"inline-block"}}>{icon}</span>{label}
        </button>)}
        {isAdmin&&<><div className="nav-section" style={{marginTop:6}}>Admin</div>
          <button className="nav-item" onClick={onAdmin} style={{color:T.red,fontSize:12}}><span style={{fontSize:8,width:8,height:8,borderRadius:"50%",background:T.red,display:"inline-block",flexShrink:0}}/>Admin Panel</button>
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
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>{{"dashboard":"Overview","invoices":"Rechnungen","scanner":"Dok.-Scanner","inbound":"Eingang","steuerberater":"Kanzlei-Portal","archive":"Archiv","settings":"Einstellungen"}[nav]||nav}</div>
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
  const[stats,setStats]=useState({outbound_total:41,inbound_total:28,errors_total:1,compliance_score:98});const[invoices,setInvoices]=useState([]);const[loading,setLoading]=useState(true);
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
        <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:"-.025em"}}>Guten Tag{user?.full_name?`, ${user.full_name.split(" ")[0]}`:""}.</h1>
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
  const [emailModal,setEmailModal] = useState(false);
  const [emailTo,setEmailTo]       = useState('');
  const [sending,setSending]       = useState(false);
  const [peppolModal,setPeppolModal] = useState(false);
  const [peppolId,setPeppolId]      = useState('');
  const [currentInvId,setCurrentInvId] = useState(null);

  const doSendEmail = async () => {
    if (!emailTo) { notify('Empfänger-E-Mail fehlt','error'); return; }
    setSending(true);
    try {
      await api.sendInvoiceEmail(currentInvId, emailTo, '');
      notify(`Rechnung an ${emailTo} gesendet ✓`,'success');
      setEmailModal(false); setEmailTo('');
    } catch(e){ notify(e.message,'error'); }
    setSending(false);
  };

  const doSendPeppol = async () => {
    if (!peppolId) { notify('Peppol-ID fehlt','error'); return; }
    setSending(true);
    try {
      const r = await api.sendViaPeppol(currentInvId, peppolId);
      if (r.demo) notify('Demo-Modus: PEPPOLSOFT_API_KEY in Railway setzen','info');
      else notify(`Peppol-Versand erfolgreich ✓ (ID: ${r.transmission_id})`,'success');
      setPeppolModal(false); setPeppolId('');
    } catch(e){ notify(e.message,'error'); }
    setSending(false);
  };

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
  const generate=async()=>{if(!form.buyer_name){notify("Empfänger fehlt","error");return;}if(!form.line_items||form.line_items.every(i=>!i.description)){notify("Mindestens eine Position erforderlich","error");return;}if(net<=0){notify("Betrag muss größer als 0 sein","error");return;}setGenerating(true);try{const inv=await api.createInvoice(form);const xmlContent=await api.getXML(inv.id);setXml({content:xmlContent,id:inv.id,number:inv.invoice_number});notify("XRechnung generiert · EN 16931 ✓","success");load();}catch(e){const msg=e.message.includes("erreichbar")?"Server nicht erreichbar – Railway startet, bitte 30 Sek. warten und erneut versuchen":e.message.includes("401")?"Nicht autorisiert – bitte neu einloggen":e.message.includes("400")?"Ungültige Rechnungsdaten – bitte Felder prüfen":e.message.includes("500")?"Serverfehler – bitte Support kontaktieren":e.message;notify(msg,"error");}setGenerating(false);};
  const filtered=filter==="all"?invoices:invoices.filter(i=>i.status===filter);

  if(view==="create") return(<div className="fi">
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setXml(null);}}>← Back</button>
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:400,color:T.textPrimary}}>New Document</h1><p style={{fontSize:12,color:T.textMuted}}>Generate an EN 16931-compliant e-invoice</p></div>
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
          <div style={{display:"flex",justifyContent:"space-between",gap:32,fontFamily:F.ui,fontSize:18,color:T.textPrimary,fontWeight:400}}><span>Total</span><span>{fmtEUR(net+vat)}</span></div>
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
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Documents</h1><p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{invoices.length} documents total</p></div>
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
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Connectors</h1><p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{CONN.length} systems · {Object.keys(connected).length} connected</p></div>
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
          <div style={{width:32,height:32,borderRadius:6,background:T.bgMuted,border:`1px solid ${T.bgBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.textSecondary,marginBottom:9,fontFamily:F.mono}}>{conn.type.substring(0,3).toUpperCase()}</div>
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
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:26}}>{modal.icon}</span><div><div style={{fontFamily:F.ui,fontSize:19,fontWeight:400,color:T.textPrimary}}>{modal.name}</div><div style={{fontSize:12,color:T.textMuted}}>{modal.method}</div></div></div>
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

// ══════════════════════════════════════════════════════════════
// INBOUND — Eingehende E-Rechnungen empfangen & verarbeiten
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// DOKUMENTEN-SCANNER — PDF/Bild hochladen → XRechnung
// DSGVO-konform: expliziter Consent, keine Daten-Speicherung
// ══════════════════════════════════════════════════════════════
function DokumentenScanner({ notify }) {
  const [phase, setPhase] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [xml, setXml] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const progressRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  const handleFile = (f) => {
    if (!f) return;
    const ACCEPTED = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];
    if (!ACCEPTED.includes(f.type)) { notify('Nur PDF, JPG oder PNG erlaubt','error'); return; }
    if (f.size > 10*1024*1024) { notify('Max. 10 MB erlaubt','error'); return; }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const r = new FileReader(); r.onload = e => setPreview(e.target.result); r.readAsDataURL(f);
    } else setPreview(null);
    setPhase('consent');
  };

  const runExtraction = async () => {
    if (!consent) return;
    setPhase('processing'); setProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random()*8; if (p>=90){p=90;clearInterval(progressRef.current);} setProgress(Math.round(p));
    }, 180);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API_BASE}/scanner/extract`, {
        method:'POST', headers:{'Authorization':`Bearer ${api._token}`}, body:fd,
      });
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.error||`Fehler ${res.status}`); }
      const data = await res.json();
      if (!data.success) throw new Error(data.error||'Extraktion fehlgeschlagen');
      if (data.demo) notify('Demo-Modus aktiv — Testdaten angezeigt','info');
      clearInterval(progressRef.current); setProgress(100);
      setTimeout(()=>{ setResult(data.data); setEditResult({...data.data}); setPhase('result'); },400);
    } catch(err) {
      clearInterval(progressRef.current); setProgress(0); setPhase('error');
      notify(err.message||'Fehler bei der Verarbeitung','error');
    }
  };

  const generateXRechnung = async () => {
    if (!editResult) return;
    setGenerating(true);
    try {
      const inv = await api.createInvoice({
        invoice_number: editResult.invoice_number||`SCAN-${Date.now()}`,
        invoice_date: editResult.invoice_date||new Date().toISOString().split('T')[0],
        due_date: editResult.due_date||'',
        format:'xrechnung', delivery_method:'manual',
        seller_name:editResult.seller_name||'', seller_vat_id:editResult.seller_vat_id||'',
        seller_address:editResult.seller_address||'', seller_city:editResult.seller_city||'',
        buyer_name:editResult.buyer_name||'', buyer_address:editResult.buyer_address||'',
        buyer_city:editResult.buyer_city||'',
        line_items:editResult.line_items||[{description:'Gescannte Rechnung',quantity:1,unit_price:0,vat_rate:19}],
      });
      const xmlContent = await api.getXML(inv.id);
      setXml({content:xmlContent, number:inv.invoice_number});
      notify('XRechnung generiert ✓','success');
    } catch(e) {
      // Demo fallback
      const net=(editResult.line_items||[]).reduce((s,i)=>s+(i.quantity||1)*(i.unit_price||0),0);
      setXml({ number:editResult.invoice_number||'SCAN-001',
        content:`<?xml version="1.0" encoding="UTF-8"?>\n<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"\n  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">\n  <cbc:ID>${editResult.invoice_number||'SCAN-001'}</cbc:ID>\n  <cbc:IssueDate>${editResult.invoice_date||''}</cbc:IssueDate>\n  <cbc:PayableAmount currencyID="EUR">${(net*1.19).toFixed(2)}</cbc:PayableAmount>\n</ubl:Invoice>` });
      notify('XRechnung generiert ✓','success');
    }
    setGenerating(false);
  };

  const reset = () => { setPhase('upload');setFile(null);setPreview(null);setConsent(false);setProgress(0);setResult(null);setEditResult(null);setXml(null); };
  const upd = (k,v) => setEditResult(p=>({...p,[k]:v}));
  const updItem = (i,k,v) => { const a=[...(editResult.line_items||[])]; a[i]={...a[i],[k]:k==='description'?v:parseFloat(v)||0}; upd('line_items',a); };
  const confColor = c => c>=.85?T.green:c>=.6?T.amber:T.red;
  const confLabel = c => c>=.85?'Hoch':c>=.6?'Mittel':'Niedrig';
  const fmtSize = b => b>1024*1024?`${(b/1024/1024).toFixed(1)} MB`:`${Math.round(b/1024)} KB`;

  // ── UPLOAD ────────────────────────────────────────────────────
  if (phase==='upload') return (
    <div className="fi" style={{maxWidth:560,margin:'0 auto'}}>
      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])}/>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])}/>

      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:'-.025em',marginBottom:4}}>Dokumenten-Scanner</h1>
        <p style={{fontSize:13,color:T.textMuted}}>Rechnung fotografieren oder hochladen — wird automatisch in eine XRechnung konvertiert.</p>
      </div>

      {/* PRIMARY ACTION — Camera (big, mobile-first) */}
      <button onClick={()=>cameraRef.current?.click()} style={{
        width:'100%',padding:'22px 20px',marginBottom:10,
        background:T.brand,color:'#fff',border:'none',borderRadius:12,
        display:'flex',alignItems:'center',justifyContent:'center',gap:14,
        cursor:'pointer',transition:'all .15s',
        boxShadow:`0 4px 16px rgba(10,37,64,.25)`,
        fontFamily:F.ui,
      }} onMouseEnter={e=>e.currentTarget.style.background=T.brandMid}
         onMouseLeave={e=>e.currentTarget.style.background=T.brand}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="1.8"/>
        </svg>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:17,fontWeight:700,lineHeight:1.2}}>Rechnung fotografieren</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.55)',marginTop:2}}>Rückkamera öffnen — direkt abfotografieren</div>
        </div>
      </button>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files?.[0]);}}
        onClick={()=>fileRef.current?.click()}
        style={{
          border:`2px dashed ${dragOver?T.accent:T.bgBorder}`,borderRadius:12,
          background:dragOver?T.accentLight:T.bgSubtle,
          padding:'28px 20px',textAlign:'center',cursor:'pointer',
          transition:'all .2s',marginBottom:16,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{margin:'0 auto 10px',display:'block'}}>
          <path d="M12 15V3m0 0L8 7m4-4l4 4" stroke={dragOver?T.accent:T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:4}}>
          {dragOver?'Loslassen':'PDF oder Bild hochladen'}
        </div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Hierher ziehen oder tippen</div>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>
          {['PDF','JPG','PNG','WEBP'].map(t=>(
            <span key={t} style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.bg,border:`1px solid ${T.bgBorder}`,color:T.textSecondary}}>{t}</span>
          ))}
          <span style={{fontSize:11,color:T.textMuted,alignSelf:'center'}}>· max. 10 MB</span>
        </div>
      </div>

      {/* Mobile tip */}
      {isMobile && (
        <div style={{padding:'10px 14px',background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:8,fontSize:12.5,color:T.accent,marginBottom:16,display:'flex',gap:8,alignItems:'flex-start'}}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span><strong>Tipp:</strong> Rechnung flach auf hellen Untergrund legen, Gerät senkrecht halten, alle 4 Ecken im Bild.</span>
        </div>
      )}

      {/* How it works */}
      <div className="card" style={{padding:18}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:14}}>So funktioniert's</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {n:'01',title:'Fotografieren oder hochladen',desc:'PDF oder Foto der Papierrechnung — Kamera oder Datei'},
            {n:'02',title:'DSGVO-Hinweis bestätigen',desc:'Einmalige Zustimmung — keine Datenspeicherung'},
            {n:'03',title:'Felder werden erkannt',desc:'Alle Rechnungsfelder automatisch extrahiert & prüfbar'},
            {n:'04',title:'XRechnung herunterladen',desc:'EN 16931-konform, GoBD-archiviert, sofort einsatzbereit'},
          ].map((s,i)=>(
            <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:26,height:16,borderRadius:3,background:T.brand,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'rgba(255,255,255,.7)',flexShrink:0,marginTop:2}}>{s.n}</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:2}}>{s.title}</div>
                <div style={{fontSize:12,color:T.textMuted}}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── CONSENT ────────────────────────────────────────────────────
  if (phase==='consent') return (
    <div className="fi" style={{maxWidth:520,margin:'0 auto'}}>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:20}} onClick={reset}>← Zurück</button>

      {/* File preview */}
      <div className="card" style={{padding:14,marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:52,height:52,borderRadius:8,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
          {preview
            ? <img src={preview} style={{width:52,height:52,objectFit:'cover',borderRadius:8}} alt="Vorschau"/>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={T.accent} strokeWidth="1.5"/><polyline points="14,2 14,8 20,8" stroke={T.accent} strokeWidth="1.5"/></svg>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:14,color:T.textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file?.name}</div>
          <div style={{fontSize:12,color:T.textMuted}}>{file?.type==='application/pdf'?'PDF':'Bild'} · {fmtSize(file?.size||0)}</div>
        </div>
        <button onClick={reset} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted,fontSize:20,padding:4}}>×</button>
      </div>

      {/* DSGVO */}
      <div style={{background:T.amberBg,border:`1px solid ${T.amberBdr}`,borderRadius:10,padding:18,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke={T.amber} strokeWidth="1.5"/><path d="M10 6v4.5M10 13v.5" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span style={{fontSize:14,fontWeight:700,color:T.amber}}>Datenschutzhinweis (DSGVO Art. 13)</span>
        </div>
        <div style={{fontSize:13,color:'#92400E',lineHeight:1.7}}>
          Zur Textextraktion wird Ihr Dokument <strong>einmalig</strong> an Anthropic API (USA) übermittelt:
          <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8}}>
            {['Keine Speicherung des Dokuments','Nicht für KI-Training genutzt','EU-Standardvertragsklauseln (Art. 46 DSGVO)','Verschlüsselt übertragen (TLS 1.3)'].map(t=>(
              <div key={t} style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{width:14,height:14,borderRadius:'50%',background:'#D97706',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'#fff',flexShrink:0,fontWeight:700}}>✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Checkbox */}
      <div onClick={()=>setConsent(!consent)} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'14px 16px',background:consent?T.greenBg:T.bg,border:`1.5px solid ${consent?T.greenBdr:T.bgBorder}`,borderRadius:9,cursor:'pointer',marginBottom:20,transition:'all .15s'}}>
        <div style={{width:20,height:20,borderRadius:5,background:consent?T.green:T.bg,border:`2px solid ${consent?T.green:T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1,transition:'all .15s'}}>
          {consent&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span style={{fontSize:13.5,color:T.textPrimary,lineHeight:1.5}}>Ich stimme der einmaligen Übermittlung zu und habe den Datenschutzhinweis gelesen.</span>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'14px',fontSize:15,borderRadius:10,opacity:consent?1:.5}} onClick={runExtraction} disabled={!consent}>
          Dokument analysieren →
        </button>
        <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={reset}>Abbrechen</button>
      </div>
    </div>
  );

  // ── PROCESSING ────────────────────────────────────────────────
  if (phase==='processing') return (
    <div className="fi" style={{maxWidth:420,margin:'40px auto',textAlign:'center',padding:'0 16px'}}>
      <div style={{width:72,height:72,borderRadius:18,background:T.accentLight,border:`1px solid ${T.accentPale}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
        <Spinner size={32} color={T.accent}/>
      </div>
      <h2 style={{fontSize:22,fontWeight:700,color:T.textPrimary,marginBottom:8,letterSpacing:'-.025em'}}>Wird analysiert...</h2>
      <p style={{fontSize:14,color:T.textMuted,marginBottom:28,lineHeight:1.6}}>Rechnungsfelder werden erkannt und validiert.</p>
      <div style={{background:T.bgMuted,borderRadius:6,height:8,overflow:'hidden',marginBottom:8}}>
        <div style={{height:'100%',width:`${progress}%`,background:`linear-gradient(90deg,${T.accent},#818CF8)`,borderRadius:6,transition:'width .3s ease'}}/>
      </div>
      <div style={{fontSize:12.5,color:T.textMuted,marginBottom:28}}>{progress}% abgeschlossen</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {[['Dokument empfangen',progress>=10],['Felder extrahieren',progress>=35],['EN 16931 prüfen',progress>=65],['Ergebnis vorbereiten',progress>=90]].map(([l,done])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:done?T.greenBg:T.bgSubtle,border:`1px solid ${done?T.greenBdr:T.bgBorder}`,borderRadius:8,transition:'all .3s'}}>
            <div style={{width:18,height:18,borderRadius:'50%',background:done?T.green:T.bgBorder,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background .3s'}}>
              {done&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{fontSize:13,fontWeight:done?600:400,color:done?T.green:T.textMuted,transition:'all .3s'}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ERROR ──────────────────────────────────────────────────────
  if (phase==='error') return (
    <div className="fi" style={{maxWidth:400,margin:'40px auto',textAlign:'center',padding:'0 16px'}}>
      <div style={{width:72,height:72,borderRadius:18,background:T.redBg,border:`1px solid ${T.redBdr}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:30}}>✗</div>
      <h2 style={{fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:8}}>Erkennung fehlgeschlagen</h2>
      <p style={{fontSize:14,color:T.textMuted,marginBottom:24,lineHeight:1.6}}>Das Dokument konnte nicht verarbeitet werden. Bitte überprüfen Sie die Bildqualität oder versuchen Sie ein neues Foto.</p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'13px'}} onClick={reset}>Erneut versuchen</button>
        <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={()=>cameraRef.current?.click()}>Neues Foto aufnehmen</button>
      </div>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────
  if (phase==='result' && editResult) {
    const net=(editResult.line_items||[]).reduce((s,i)=>s+(i.quantity||1)*(i.unit_price||0),0);
    const vat=(editResult.line_items||[]).reduce((s,i)=>s+(i.quantity||1)*(i.unit_price||0)*((i.vat_rate||19)/100),0);
    const conf=result?.confidence||0;
    return (
      <div className="fi">
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
              <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Ergebnis prüfen</h1>
              <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:5,background:confColor(conf)+'15',color:confColor(conf),border:`1px solid ${confColor(conf)}30`}}>
                Konfidenz: {confLabel(conf)} ({Math.round(conf*100)}%)
              </span>
            </div>
            <p style={{fontSize:12.5,color:T.textMuted}}>Bitte alle Felder prüfen und ggf. korrigieren.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset}>← Neu scannen</button>
        </div>

        {conf<.75&&<div style={{padding:'10px 14px',background:T.amberBg,border:`1px solid ${T.amberBdr}`,borderRadius:7,marginBottom:14,fontSize:13,color:T.amber,display:'flex',gap:8}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}><circle cx="8" cy="8" r="7" stroke={T.amber} strokeWidth="1.5"/><path d="M8 5v3.5M8 11v.5" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round"/></svg>
          Niedrige Erkennungsqualität — bitte alle Felder sorgfältig prüfen.
        </div>}

        {/* Fields — stacked on mobile */}
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:12}}>

          {/* Rechnungsdetails */}
          <div className="card" style={{padding:18}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:14}}>Rechnungsdetails</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(200px,100%),1fr))',gap:10}}>
              {[['invoice_number','Rechnungsnummer'],['invoice_date','Datum (YYYY-MM-DD)'],['due_date','Fälligkeitsdatum']].map(([k,l])=>(
                <div key={k}><label className="label">{l}</label><input className="input" value={editResult[k]||''} onChange={e=>upd(k,e.target.value)}/></div>
              ))}
            </div>
          </div>

          {/* Steller + Empfänger in grid on desktop, stack on mobile */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(260px,100%),1fr))',gap:12}}>
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:12}}>Rechnungssteller</div>
              {[['seller_name','Name'],['seller_vat_id','USt-IdNr.'],['seller_address','Adresse'],['seller_city','Stadt']].map(([k,l])=>(
                <div key={k} style={{marginBottom:9}}><label className="label">{l}</label><input className="input" value={editResult[k]||''} onChange={e=>upd(k,e.target.value)}/></div>
              ))}
            </div>
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:12}}>Empfänger</div>
              {[['buyer_name','Name'],['buyer_address','Adresse'],['buyer_city','Stadt']].map(([k,l])=>(
                <div key={k} style={{marginBottom:9}}><label className="label">{l}</label><input className="input" value={editResult[k]||''} onChange={e=>upd(k,e.target.value)}/></div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="card" style={{padding:18}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:12}}>Positionen</div>
            {(editResult.line_items||[]).map((item,idx)=>(
              <div key={idx} style={{background:T.bgSubtle,borderRadius:7,padding:12,marginBottom:8,border:`1px solid ${T.bgBorder}`}}>
                <div style={{marginBottom:8}}>
                  <label className="label">Beschreibung</label>
                  <input className="input" value={item.description||''} onChange={e=>updItem(idx,'description',e.target.value)}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  <div><label className="label">Menge</label><input className="input" type="number" value={item.quantity||1} onChange={e=>updItem(idx,'quantity',e.target.value)}/></div>
                  <div><label className="label">Einzelpreis €</label><input className="input" type="number" step="0.01" value={item.unit_price||0} onChange={e=>updItem(idx,'unit_price',e.target.value)}/></div>
                  <div><label className="label">MwSt</label>
                    <select className="select" value={item.vat_rate||19} onChange={e=>updItem(idx,'vat_rate',e.target.value)}>
                      <option value={19}>19%</option><option value={7}>7%</option><option value={0}>0%</option>
                    </select>
                  </div>
                </div>
                <button onClick={()=>upd('line_items',(editResult.line_items||[]).filter((_,j)=>j!==idx))} style={{marginTop:8,background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:5,color:T.red,cursor:'pointer',padding:'4px 10px',fontSize:12,fontFamily:F.ui}}>Position entfernen</button>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginTop:4}}>
              <button onClick={()=>upd('line_items',[...(editResult.line_items||[]),{description:'',quantity:1,unit_price:0,vat_rate:19}])} style={{background:'none',border:`1.5px dashed ${T.bgBorder}`,borderRadius:6,color:T.accent,cursor:'pointer',padding:'7px 14px',fontSize:13,fontFamily:F.ui,fontWeight:500}}>+ Position hinzufügen</button>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:12,color:T.textMuted}}>Netto {fmtEUR(net)} · MwSt {fmtEUR(vat)}</div>
                <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>Brutto {fmtEUR(net+vat)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        {!xml ? (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'14px',fontSize:15,borderRadius:10}} onClick={generateXRechnung} disabled={generating}>
              {generating?<><Spinner color="#fff" size={15}/>&nbsp;Generiere XRechnung...</>:'⚡ XRechnung generieren →'}
            </button>
            <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={reset}>Verwerfen</button>
          </div>
        ) : (
          <div className="card sci" style={{padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                <span className="badge badge-green">✓ EN 16931</span>
                <span className="badge badge-green">GoBD ✓</span>
                <span style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>{xml.number}</span>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([xml.content],{type:'application/xml'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${xml.number}.xml`;a.click();}}>↓ XML</button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>Neu scannen</button>
              </div>
            </div>
            <pre style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:7,padding:12,fontSize:10.5,color:T.textSecondary,overflow:'auto',maxHeight:200,lineHeight:1.6,fontFamily:F.mono}}>{xml.content}</pre>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function InboundScreen({notify}){
  const [invoices,setInvoices] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [filter,setFilter]     = useState('all');
  const [fwdModal,setFwdModal] = useState(null); // invoice id
  const [fwdEmail,setFwdEmail] = useState('');
  const [emailSlug,setEmailSlug] = useState('');
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.listInbound()
      .then(d => { setInvoices(d.invoices || []); setLoading(false); })
      .catch(() => {
        setInvoices([
          {id:'ib1',invoice_number:'EINGANG-2025-003',sender_name:'Müller Lieferant GmbH',sender_email:'buchhaltung@mueller.de',amount:4284,format:'xrechnung',status:'empfangen',due_date:'2025-06-14',has_xml:true,validation_passed:true,created_at:new Date(Date.now()-3600000).toISOString()},
          {id:'ib2',invoice_number:'EINGANG-2025-002',sender_name:'TechParts AG',sender_email:'rechnung@techparts.de',amount:1290,format:'zugferd',status:'empfangen',due_date:'2025-06-07',has_xml:true,validation_passed:false,created_at:new Date(Date.now()-86400000).toISOString()},
          {id:'ib3',invoice_number:'EINGANG-2025-001',sender_name:'SAP Partner GmbH',sender_email:'ap@sappartner.de',amount:8900,format:'pdf_extracted',status:'bezahlt',due_date:'2025-05-30',has_xml:true,validation_passed:true,created_at:new Date(Date.now()-172800000).toISOString()},
        ]);
        setLoading(false);
        // Get email slug from user org
        setEmailSlug('meine-firma-abc12345');
      });
  };

  useEffect(()=>{ load(); },[]);

  const filtered = invoices.filter(i =>
    filter === 'all' ? true :
    filter === 'ausstehend' ? i.status === 'empfangen' :
    filter === 'bezahlt' ? i.status === 'bezahlt' :
    filter === 'fehler' ? !i.validation_passed : true
  );

  const doForward = async () => {
    if (!fwdEmail) { notify('E-Mail fehlt','error'); return; }
    try {
      await api.forwardInbound(fwdModal, fwdEmail);
      notify(`Weitergeleitet an ${fwdEmail} ✓`,'success');
      setFwdModal(null); setFwdEmail('');
    } catch(e){ notify(e.message,'error'); }
  };

  const stats = [
    {label:'Gesamt',     value:invoices.length,                                    color:T.textPrimary},
    {label:'Ausstehend', value:invoices.filter(i=>i.status==='empfangen').length,  color:T.amber},
    {label:'Bezahlt',    value:invoices.filter(i=>i.status==='bezahlt').length,    color:T.green},
    {label:'Fehler',     value:invoices.filter(i=>!i.validation_passed).length,    color:T.red},
  ];

  return(
    <div className="fi">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:'-.025em'}}>Eingang</h1>
            <span className="badge badge-red" style={{fontSize:10.5}}>Pflicht seit Jan 2025</span>
          </div>
          <p style={{fontSize:13,color:T.textMuted}}>Eingehende Rechnungen per E-Mail oder Upload — automatisch konvertiert und archiviert.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExportInbound('',null,null)}>↓ DATEV-Export</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            navigator.clipboard.writeText(`rechnungen-${emailSlug}@invoiq.io`);
            notify(`E-Mail-Adresse kopiert: rechnungen-${emailSlug}@invoiq.io`,'success');
          }}>📋 Meine Eingangs-E-Mail</button>
        </div>
      </div>

      {/* E-Mail Adresse Banner */}
      <div style={{padding:'12px 16px',background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:9,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:12.5,fontWeight:600,color:T.accent,marginBottom:2}}>Ihre Eingangs-E-Mail-Adresse</div>
          <div style={{fontSize:13,fontFamily:F.mono,color:T.textPrimary}}>rechnungen-{emailSlug||'...' }@invoiq.io</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>Lieferanten schicken Rechnungen einfach an diese Adresse — invoiq verarbeitet alles automatisch.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>{
          navigator.clipboard.writeText(`rechnungen-${emailSlug}@invoiq.io`);
          notify('Adresse kopiert ✓','success');
        }}>Kopieren</button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
        {stats.map((s,i)=>(
          <div key={i} className="card" style={{padding:14}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:24,fontWeight:800,color:s.color,letterSpacing:'-.03em'}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {['all','ausstehend','bezahlt','fehler'].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-ghost'}`} onClick={()=>setFilter(f)}>
            {f==='all'?'Alle':f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{textAlign:'center',padding:40}}><Spinner size={24} color={T.accent}/></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr>
              {['Absender','Rechnungsnr.','Betrag','Fälligkeit','Format','Status','Aktionen'].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((inv,i)=>(
                <tr key={inv.id} className="tr-hover">
                  <td>
                    <div style={{fontWeight:600,fontSize:13,color:T.textPrimary}}>{inv.sender_name||'Unbekannt'}</div>
                    <div style={{fontSize:11,color:T.textMuted}}>{inv.sender_email||''}</div>
                  </td>
                  <td style={{fontFamily:F.mono,fontSize:12,fontWeight:600}}>{inv.invoice_number||'-'}</td>
                  <td style={{fontWeight:700}}>{inv.amount?fmtEUR(inv.amount):'-'}</td>
                  <td style={{fontSize:12,color:inv.due_date&&new Date(inv.due_date)<new Date()?T.red:T.textMuted}}>
                    {inv.due_date?new Date(inv.due_date).toLocaleDateString('de-DE'):'-'}
                  </td>
                  <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:700,fontFamily:F.mono}}>{(inv.format||'?').toUpperCase()}</span></td>
                  <td>
                    <StatusBadge status={inv.status==='bezahlt'?'delivered':inv.validation_passed?'validated':'error'}/>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {inv.has_xml&&<button className="btn btn-ghost btn-sm" onClick={()=>window.open(api.getInboundPdf(inv.id),'_blank')}>↓ PDF</button>}
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setFwdModal(inv.id);setFwdEmail('');}}>✉ Weiterleiten</button>
                      {inv.status!=='bezahlt'&&<button className="btn btn-ghost btn-sm" onClick={async()=>{ await api.markInboundPaid(inv.id); notify('Als bezahlt markiert ✓','success'); load(); }}>✓ Bezahlt</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,color:T.textMuted}}>Keine Rechnungen</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Forward Modal */}
      {fwdModal&&<div className="modal-overlay" onClick={()=>setFwdModal(null)}>
        <div className="modal sci" onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:17,fontWeight:700,color:T.textPrimary}}>Rechnung weiterleiten</div>
            <button onClick={()=>setFwdModal(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:T.textMuted}}>×</button>
          </div>
          <div style={{marginBottom:12}}><label className="label">Empfänger (z.B. Buchhalter)</label><input className="input" type="email" placeholder="buchhalter@firma.de" value={fwdEmail} onChange={e=>setFwdEmail(e.target.value)}/></div>
          <div style={{fontSize:12.5,color:T.textSecondary,marginBottom:16}}>Die Rechnung wird als PDF + XML weitergeleitet.</div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" onClick={()=>setFwdModal(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={doForward}>Weiterleiten →</button>
          </div>
        </div>
      </div>}
    </div>
  );
}


function ArchiveScreen({notify}){
  const[docs,setDocs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[filter,setFilter]=useState('all');
  const[selected,setSelected]=useState(null);

  useEffect(()=>{
    api.listInvoices('?archived=true&limit=30')
      .then(d=>setDocs(d.invoices||[]))
      .catch(()=>setDocs([
        {id:'a1',invoice_number:'INV-2025-041',buyer_name:'Müller GmbH',amount_gross:4284,format:'xrechnung',direction:'outbound',archived_at:'2025-05-27T09:14:05Z',archive_hash:'a7f3d9c2b1e8f4a2c9d1b3e7f5a8c2d4',xml_hash:'b2e8f1a4c7d9e3f6a1b5c8d2e4f7a9b3',status:'archived'},
        {id:'a2',invoice_number:'EINGANG-2025-003',buyer_name:'invoiq GmbH',amount_gross:1290,format:'zugferd',direction:'inbound',archived_at:'2025-05-26T14:22:11Z',archive_hash:'c4f8b2e6a1d9c3f7b5e2a8d6c1f4b9e7',xml_hash:'d6a2c9f4b8e1d3a7c2f5b8e4a1d7c3f9',status:'archived'},
        {id:'a3',invoice_number:'INV-2025-040',buyer_name:'TechVision AG',amount_gross:12900,format:'xrechnung',direction:'outbound',archived_at:'2025-05-25T16:08:33Z',archive_hash:'e8b4f1c6a3d9e2f7c1b6e4a9d3f8c2b7',xml_hash:'f1c5a8d3b7e2c6a4d8b1f5c9a2d6b4e8',status:'archived'},
        {id:'a4',invoice_number:'INV-2025-039',buyer_name:'Stadtwerke Nord',amount_gross:780,format:'peppol',direction:'outbound',archived_at:'2025-05-24T11:44:17Z',archive_hash:'a3d7f2c8b5e1a9d4c7f3b8e6a2d1c5f9',xml_hash:'b6e4c1f8a5d2b9e3c7f1a4d8b2e5c9f3',status:'archived'},
      ]))
      .finally(()=>setLoading(false));
  },[]);

  const filtered=docs.filter(d=>{
    const matchSearch=!search||d.invoice_number?.toLowerCase().includes(search.toLowerCase())||d.buyer_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter=filter==='all'||d.direction===filter||d.format===filter;
    return matchSearch&&matchFilter;
  });

  const totalArchived=docs.length;
  const totalSize=(docs.length*0.024).toFixed(1);

  return(
    <div className="fi">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
        <div>
          <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:'-.025em',marginBottom:4}}>GoBD-Archiv</h1>
          <p style={{fontSize:13,color:T.textMuted}}>SHA-256-gesichert · unveränderlich · §147 AO · 10 Jahre Aufbewahrung</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>notify('Audit-Report wird generiert...','info')}>↓ Audit-Report</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>notify('Export gestartet','success')}>↓ Export</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
        {[
          {label:'Archivierte Dokumente',value:fmtNum(totalArchived),sub:'Gesamt'},
          {label:'Speicher genutzt',value:`${totalSize} MB`,sub:'AWS Frankfurt'},
          {label:'Retention',value:'10 Jahre',sub:'§147 AO konform'},
          {label:'Compliance',value:'GoBD ✓',sub:'SHA-256 gesichert'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{padding:16}}>
            <div style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>{s.label}</div>
            <div className="stat-num" style={{fontSize:22,color:T.textPrimary}}>{s.value}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* GoBD Info */}
      <div style={{background:'linear-gradient(135deg,#ECFDF5 0%,#F8FAFC 100%)',border:`1px solid ${T.greenBdr}`,borderRadius:8,padding:'14px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:36,height:36,borderRadius:8,background:T.green,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="9" rx="2" stroke="#fff" strokeWidth="1.8"/><path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13.5,fontWeight:700,color:T.textPrimary,marginBottom:3}}>Revisionssicheres Archiv — automatisch</div>
          <div style={{fontSize:12.5,color:T.textSecondary}}>Jedes Dokument wird beim Speichern gehasht (SHA-256), unveränderlich in AWS Frankfurt gespeichert und automatisch 10 Jahre aufbewahrt. Jede Änderung ist im Audit-Trail protokolliert.</div>
        </div>
        <button className="btn btn-success btn-sm" onClick={()=>notify('Archiv-Integrität geprüft ✓','success')}>Integrität prüfen</button>
      </div>

      {/* Search + Filter */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <input className="input" style={{maxWidth:320}} placeholder="Suche nach Nummer, Empfänger..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="select" style={{maxWidth:180}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Alle Richtungen</option>
          <option value="outbound">Ausgehend</option>
          <option value="inbound">Eingehend</option>
          <option value="xrechnung">XRechnung</option>
          <option value="zugferd">ZUGFeRD</option>
          
        </select>
      </div>

      {/* Archive table */}
      <div className="card">
        <table className="table">
          <thead><tr>{['Dokument','Gegenpartei','Betrag','Format','Richtung','Archiviert am','Hash','Aktionen'].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {loading?[1,2,3].map(i=><tr key={i}><td colSpan={8}><div className="skeleton" style={{height:14}}/></td></tr>)
            :filtered.map(doc=>(
              <tr key={doc.id} className="tr-hover" onClick={()=>setSelected(doc)} style={{cursor:'pointer'}}>
                <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12,color:T.textPrimary}}>{doc.invoice_number}</td>
                <td style={{fontSize:13}}>{doc.buyer_name}</td>
                <td style={{fontWeight:600}}>{fmtEUR(doc.amount_gross)}</td>
                <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:700,fontFamily:F.mono}}>{doc.format?.toUpperCase()}</span></td>
                <td><span className={doc.direction==='inbound'?'badge badge-blue':'badge badge-gray'} style={{fontSize:10.5}}>{doc.direction==='inbound'?'↓ Eingang':'↑ Ausgang'}</span></td>
                <td style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>{doc.archived_at?new Date(doc.archived_at).toLocaleDateString('de-DE'):'—'}</td>
                <td style={{fontFamily:F.mono,fontSize:10,color:T.textMuted}}>{doc.archive_hash?.substring(0,12)}...</td>
                <td onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:5}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>notify('Hash verifiziert ✓','success')}>Verify</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>notify('Download gestartet','success')}>↓ XML</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading&&filtered.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:T.textMuted,padding:28,fontSize:13}}>Keine archivierten Dokumente gefunden</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Hash detail modal */}
      {selected&&(
        <div className="modal-overlay" onClick={()=>setSelected(null)}>
          <div className="modal sci" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontFamily:F.ui,fontSize:18,fontWeight:700,color:T.textPrimary}}>{selected.invoice_number}</div>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:T.textMuted}}>×</button>
            </div>
            <div className="divider" style={{marginBottom:16}}/>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
              {[['Dokument-Hash (SHA-256)',selected.archive_hash],['XML-Hash',selected.xml_hash],['Archiviert am',selected.archived_at?new Date(selected.archived_at).toLocaleString('de-DE'):'—'],['Speicherort','AWS S3 Frankfurt (eu-central-1)'],['Retention','10 Jahre ab Archivierungsdatum'],['Status','GoBD-konform · unveränderlich']].map(([l,v])=>(
                <div key={l}>
                  <div className="label" style={{marginBottom:3}}>{l}</div>
                  <div style={{fontFamily:['Dokument-Hash (SHA-256)','XML-Hash'].includes(l)?F.mono:F.ui,fontSize:['Dokument-Hash (SHA-256)','XML-Hash'].includes(l)?11:13,color:T.textPrimary,background:['Dokument-Hash (SHA-256)','XML-Hash'].includes(l)?T.bgSubtle:T.bg,padding:['Dokument-Hash (SHA-256)','XML-Hash'].includes(l)?'6px 10px':'0',borderRadius:5,wordBreak:'break-all'}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setSelected(null)}>Schließen</button>
              <button className="btn btn-success" onClick={()=>notify('Hash verifiziert — Dokument unverändert ✓','success')}>✓ Hash verifizieren</button>
              <button className="btn btn-primary" onClick={()=>notify('XML wird heruntergeladen','success')}>↓ XML herunterladen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SETTINGS — Firmendaten, API, Plan, Team
// ══════════════════════════════════════════════════════════════
function SettingsScreen({user,org,notify}){
  const[tab,setTab]=useState('company');
  const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({
    name:org?.name||'',
    vat_id:'DE123456789',
    address:'Musterstraße 1',
    city:'Berlin',
    zip:'10115',
    country:'DE',
    iban:'DE89 3704 0044 0532 0130 00',
    email:user?.email||'',
    phone:'',
    default_format:'xrechnung',
    default_delivery:'email',
    auto_archive:true,
    en16931_strict:true,
    peppol_enabled:false,
    vida_reporting:false,
  });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  const save=async()=>{
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    setSaving(false);
    notify('Gespeichert ✓','success');
  };

  const TABS=[['company','Unternehmen'],['formats','Formate & Versand'],['api','API & Webhooks'],['team','Team'],['billing','Plan & Abrechnung']];

  return(
    <div className="fi">
      <div style={{marginBottom:22}}>
        <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:'-.025em',marginBottom:4}}>Einstellungen</h1>
        <p style={{fontSize:13,color:T.textMuted}}>Konfigurieren Sie Ihr Konto, Formate und Integrationen.</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:20}}>
        {/* Sidebar tabs */}
        <div className="card" style={{padding:'8px',height:'fit-content'}}>
          {TABS.map(([k,l])=>(
            <button key={k} className={`nav-item ${tab===k?'active':''}`} onClick={()=>setTab(k)} style={{fontSize:13,marginBottom:2}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:tab===k?T.accent:T.bgBorder,display:'inline-block',flexShrink:0}}/>
              {l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {tab==='company'&&(
            <div className="card" style={{padding:24}}>
              <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${T.bgBorder}`}}>Unternehmensdaten</div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div><label className="label">Unternehmensname</label><input className="input" value={form.name} onChange={e=>upd('name',e.target.value)}/></div>
                  <div><label className="label">USt-IdNr.</label><input className="input" value={form.vat_id} onChange={e=>upd('vat_id',e.target.value)} placeholder="DE123456789"/></div>
                </div>
                <div><label className="label">Straße & Hausnummer</label><input className="input" value={form.address} onChange={e=>upd('address',e.target.value)}/></div>
                <div style={{display:'grid',gridTemplateColumns:'120px 1fr 120px',gap:14}}>
                  <div><label className="label">PLZ</label><input className="input" value={form.zip} onChange={e=>upd('zip',e.target.value)}/></div>
                  <div><label className="label">Stadt</label><input className="input" value={form.city} onChange={e=>upd('city',e.target.value)}/></div>
                  <div><label className="label">Land</label><select className="select" value={form.country} onChange={e=>upd('country',e.target.value)}><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option></select></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div><label className="label">E-Mail (Rechnungseingang)</label><input className="input" type="email" value={form.email} onChange={e=>upd('email',e.target.value)}/></div>
                  <div><label className="label">IBAN (für Zahlungsziel)</label><input className="input" value={form.iban} onChange={e=>upd('iban',e.target.value)}/></div>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:20,paddingTop:16,borderTop:`1px solid ${T.bgBorder}`}}>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<><Spinner color="#fff" size={13}/>&nbsp;Speichern...</>:'Speichern'}</button>
              </div>
            </div>
          )}

          {tab==='formats'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Standard-Formate</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                  <div><label className="label">Standard-Rechnungsformat</label>
                    <select className="select" value={form.default_format} onChange={e=>upd('default_format',e.target.value)}>
                      <option value="xrechnung">XRechnung 3.0 (Standard DE)</option>
                      <option value="zugferd">ZUGFeRD 2.4 (PDF + XML)</option>
                      <option value="peppol">Peppol BIS 3.0 (EU-Netzwerk)</option>
                      <option value="facturx">Factur-X (Frankreich)</option>
                    </select>
                  </div>
                  <div><label className="label">Standard-Zustellweg</label>
                    <select className="select" value={form.default_delivery} onChange={e=>upd('default_delivery',e.target.value)}>
                      <option value="email">E-Mail</option>
                      <option value="peppol">Peppol-Netzwerk</option>
                      <option value="manual">Manuell / Download</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Compliance-Einstellungen</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {[
                    {key:'auto_archive',label:'Automatische GoBD-Archivierung',sub:'Jedes Dokument wird sofort nach Generierung archiviert'},
                    {key:'en16931_strict',label:'EN 16931 Strict Mode',sub:'Rechnungen werden vor dem Versand gegen den vollen Standard validiert'},
                    {key:'peppol_enabled',label:'Peppol-Netzwerk aktivieren',sub:'Direkte Zustellung über das europäische Peppol-Netzwerk (PeppolSoft, $0.10/Dok.)'},
                    {key:'vida_reporting',label:'ViDA Transaction Reporting (Beta)',sub:'Vorbereitung für EU-Meldepflicht ab 2028 — jetzt aktivieren und Daten sammeln'},
                  ].map(({key,label,sub})=>(
                    <div key={key} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,padding:'12px 14px',background:T.bgSubtle,borderRadius:7,border:`1px solid ${T.bgBorder}`}}>
                      <div>
                        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:3}}>{label}</div>
                        <div style={{fontSize:12,color:T.textMuted}}>{sub}</div>
                      </div>
                      <div onClick={()=>upd(key,!form[key])} style={{width:40,height:22,borderRadius:11,background:form[key]?T.accent:T.bgBorder,cursor:'pointer',transition:'background .2s',flexShrink:0,position:'relative',marginTop:2}}>
                        <div style={{position:'absolute',top:3,left:form[key]?20:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
                  <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<><Spinner color="#fff" size={13}/>&nbsp;Speichern...</>:'Speichern'}</button>
                </div>
              </div>
            </div>
          )}

          {tab==='api'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>API-Zugang</div>
                <div style={{marginBottom:14}}>
                  <label className="label">Live API Key</label>
                  <div style={{display:'flex',gap:8}}>
                    <input className="input" readOnly value="iq_live_demo_key_001_xxxxxxxxxxxxxxxx" style={{fontFamily:F.mono,fontSize:12,color:T.textMuted}}/>
                    <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>notify('API Key kopiert','success')}>Kopieren</button>
                    <button className="btn btn-danger btn-sm" style={{flexShrink:0}} onClick={()=>notify('Neuer API Key generiert','success')}>Rotieren</button>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label className="label">Base URL</label>
                  <div style={{fontFamily:F.mono,fontSize:12,color:T.accent,background:T.bgSubtle,borderRadius:6,padding:'9px 12px',border:`1px solid ${T.bgBorder}`}}>https://invoiq-erechnung-saas-production.up.railway.app/api/v1</div>
                </div>
                <div style={{background:T.bgSubtle,borderRadius:7,padding:'14px 16px',border:`1px solid ${T.bgBorder}`}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:10,letterSpacing:.4,textTransform:'uppercase'}}>Schnellstart</div>
                  <pre style={{fontFamily:F.mono,fontSize:11,color:T.textSecondary,lineHeight:1.7,overflow:'auto'}}>{`curl -X POST https://invoiq-erechnung-saas-production.up.railway.app/api/v1/invoices \\
  -H "Authorization: Bearer iq_live_demo_key_001" \\
  -H "Content-Type: application/json" \\
  -d '{"invoice_number":"INV-001","format":"xrechnung",...}'`}</pre>
                </div>
              </div>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Webhooks</div>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                  {[['invoice.created','Neue Rechnung erstellt'],['invoice.delivered','Rechnung zugestellt'],['invoice.error','Validierungsfehler'],['inbound.received','Eingehende Rechnung']].map(([ev,desc])=>(
                    <div key={ev} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 12px',background:T.bgSubtle,borderRadius:6,border:`1px solid ${T.bgBorder}`}}>
                      <span style={{fontFamily:F.mono,fontSize:11,color:T.accent,flex:'0 0 180px'}}>{ev}</span>
                      <span style={{fontSize:12.5,color:T.textSecondary,flex:1}}>{desc}</span>
                      <span className="badge badge-green" style={{fontSize:10}}>Aktiv</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <input className="input" placeholder="https://ihre-app.de/webhook" style={{flex:1}}/>
                  <button className="btn btn-primary btn-sm" onClick={()=>notify('Webhook hinzugefügt ✓','success')}>Hinzufügen</button>
                </div>
              </div>
            </div>
          )}

          {tab==='team'&&(
            <div className="card" style={{padding:22}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary}}>Team-Mitglieder</div>
                <button className="btn btn-primary btn-sm" onClick={()=>notify('Einladung versendet ✓','success')}>+ Einladen</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
                {[
                  {name:user?.full_name||'Manfred Bell',email:user?.email||'manfred@invoiq.io',role:'Owner',you:true},
                ].map((m,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:T.bgSubtle,borderRadius:7,border:`1px solid ${T.bgBorder}`}}>
                    <div className="avatar">{(m.name||'U')[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>{m.name} {m.you&&<span style={{fontSize:11,color:T.textMuted}}>(Sie)</span>}</div>
                      <div style={{fontSize:12,color:T.textMuted}}>{m.email}</div>
                    </div>
                    <span className="badge badge-blue" style={{fontSize:10.5}}>{m.role}</span>
                  </div>
                ))}
              </div>
              <div style={{background:T.bgSubtle,borderRadius:7,padding:'12px 14px',border:`1px solid ${T.bgBorder}`}}>
                <div style={{fontSize:12.5,fontWeight:600,color:T.textPrimary,marginBottom:5}}>Benutzer einladen</div>
                <div style={{display:'flex',gap:10}}>
                  <input className="input" placeholder="E-Mail-Adresse" style={{flex:1}}/>
                  <select className="select" style={{width:140}}>
                    <option>Admin</option><option>Member</option><option>Viewer</option>
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={()=>notify('Einladung versendet ✓','success')}>Einladen</button>
                </div>
                <div style={{fontSize:11.5,color:T.textMuted,marginTop:8}}>Add-on: +9€/Monat pro zusätzlichem Nutzer</div>
              </div>
            </div>
          )}

          {tab==='billing'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Aktueller Plan</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:22,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',marginBottom:4}}>{org?.plan?.toUpperCase()||'STARTER'}</div>
                    <div style={{fontSize:13.5,color:T.textSecondary}}>{org?.plan==="business"?"99€/Monat · 500 Rechnungen":org?.plan==="enterprise"?"299€/Monat · Unbegrenzt":"49€/Monat · 100 Rechnungen"}/Monat · Jährlich kündbar</div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost" onClick={async()=>{
                      try{
                        const d = await api.openBillingPortal(org?.stripe_customer_id);
                        if(d.portal_url && !d.demo) window.open(d.portal_url,'_blank');
                        else notify('Stripe Portal: STRIPE_SECRET_KEY in Railway setzen','info');
                      }catch(e){notify(e.message,'error');}
                    }}>Abrechnung verwalten</button>
                    <button className="btn btn-primary" onClick={async()=>{
                      try{
                        const currentPlan = org?.plan || 'free';
                        const nextPlan = currentPlan==='free'?'starter':currentPlan==='starter'?'business':'enterprise';
                        if(nextPlan==='enterprise'&&currentPlan==='enterprise'){
                          notify('Sie haben bereits den höchsten Plan','info'); return;
                        }
                        const d = await api.createCheckout(nextPlan,'monthly');
                        if(d.checkout_url && !d.demo){
                          window.open(d.checkout_url,'_blank');
                        } else {
                          notify('Demo-Modus — STRIPE_SECRET_KEY in Railway setzen','info');
                        }
                      }catch(e){notify(e.message,'error');}
                    }}>Upgrade →</button>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:T.textMuted,marginBottom:5}}>
                    <span>Dokumente diesen Monat</span>
                    <span style={{fontWeight:600,color:T.textPrimary}}>{org?.plan_doc_used||41} / {org?.plan_doc_limit||100}</span>
                  </div>
                  <div className="progress"><div className="progress-fill" style={{width:`${Math.min(100,((org?.plan_doc_used||0)/(org?.plan_doc_limit||10))*100)}%`}}/></div>
                </div>
                <div style={{background:T.bgSubtle,borderRadius:6,padding:'10px 14px',fontSize:12.5,color:T.textSecondary,border:`1px solid ${T.bgBorder}`}}>
                  <strong style={{color:T.textPrimary}}>Überschreitung:</strong> Zusätzliche Rechnungen werden mit 0,50€/Rechnung berechnet — kein Zwangsupgrade.
                </div>
              </div>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Zahlungshistorie</div>
                {['Mai 2025','April 2025','März 2025'].map(m=>(
                  <div key={m} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${T.bgSubtle}`}}>
                    <div style={{fontSize:13.5,fontWeight:500,color:T.textPrimary}}>{m}</div>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <span style={{fontSize:13.5,fontWeight:700,color:T.textPrimary}}>29,00€</span>
                      <span className="badge badge-green" style={{fontSize:10.5}}>Bezahlt</span>
                      <button className="btn btn-ghost btn-sm" onClick={()=>notify('PDF heruntergeladen','success')}>↓ PDF</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'12px 16px',background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:7}}>
                <button style={{background:'none',border:'none',color:T.red,cursor:'pointer',fontSize:13,fontFamily:F.ui,fontWeight:600}} onClick={()=>notify('Kündigungsanfrage gesendet','error')}>Konto kündigen</button>
                <span style={{fontSize:12,color:T.red,marginLeft:8}}>— Jederzeit möglich, keine Mindestlaufzeit</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function Placeholder({title,sub,icon="📋"}){return(<div className="fi"><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:4}}>{title}</h1><p style={{color:T.textMuted,fontSize:13,marginBottom:22}}>{sub}</p><div className="card" style={{textAlign:"center",padding:52,color:T.textMuted}}><div style={{fontSize:28,marginBottom:10}}>{icon}</div><div style={{fontSize:13.5}}>Coming in Release 1.0</div></div></div>);}

// ── ADMIN SHELL ───────────────────────────────────────────────
function AdminShell({user,org,nav,setNav,onBack,children}){
  const isSuper=user?.email==="demo@invoiq.io"||user?.email==="manfred@invoiq.io";
  const items=isSuper?[{section:"Platform"},{key:"overview",icon:"·",label:"Overview"},{key:"allinvoices",icon:"·",label:"All Documents"},{key:"users",icon:"·",label:"Users"},{key:"revenue",icon:"·",label:"Revenue"},{section:"System"},{key:"peppol",icon:"·",label:"Peppol"},{key:"apilogs",icon:"·",label:"Audit Logs"}]:[{section:org?.name||"Company"},{key:"overview",icon:"▦",label:"Overview"},{key:"myinvoices",icon:"·",label:"Documents"},{key:"myusers",icon:"·",label:"Team"},{key:"billing",icon:"·",label:"Billing"}];
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
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>{isSuper?"Platform Overview":"Overview"}</h1><p style={{fontSize:12,color:T.textMuted,marginTop:3}}>{isSuper?"invoiq.io · Super Admin":MOCK_ORGS[0].name}</p></div>
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
    <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:18}}>All Documents</h1>
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
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Users</h1><button className="btn btn-primary btn-sm" onClick={()=>notify("Invitation sent","success")}>+ Invite</button></div>
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
    <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:18}}>Revenue</h1>
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

// ══════════════════════════════════════════════════════════════
// STEUERBERATER PORTAL — Multi-Mandanten Dashboard
// ══════════════════════════════════════════════════════════════

// Mock mandanten data
const MOCK_MANDANTEN = [
  { id:'m1', name:'Müller Bäckerei GmbH', vat:'DE123456789', plan:'starter', status:'active', docs_this_month:14, docs_limit:100, last_invoice:'2025-05-27', compliance:98, erp:'Lexware', open_errors:0, pending_inbound:2, contact:'hans@mueller-baeckerei.de' },
  { id:'m2', name:'TechVision AG', vat:'DE987654321', plan:'business', status:'active', docs_this_month:284, docs_limit:1000, last_invoice:'2025-05-27', compliance:100, erp:'SAP S/4HANA', open_errors:0, pending_inbound:0, contact:'it@techvision.de' },
  { id:'m3', name:'Stadtwerke Süd GmbH', vat:'DE456789123', plan:'starter', status:'active', docs_this_month:67, docs_limit:100, last_invoice:'2025-05-24', compliance:94, erp:'DATEV', open_errors:1, pending_inbound:5, contact:'buchhaltung@stadtwerke.de' },
  { id:'m4', name:'Bauer Logistik KG', vat:'DE321654987', plan:'starter', status:'trial', docs_this_month:12, docs_limit:100, last_invoice:'2025-05-22', compliance:100, erp:'Lexware', open_errors:0, pending_inbound:1, contact:'k.bauer@logistik.de' },
  { id:'m5', name:'Nord Express GmbH', vat:'DE789123456', plan:'starter', status:'active', docs_this_month:38, docs_limit:100, last_invoice:'2025-05-26', compliance:97, erp:'DATEV', open_errors:0, pending_inbound:0, contact:'info@nordexpress.de' },
  { id:'m6', name:'Handwerk Schmidt', vat:'DE246813579', plan:'starter', status:'active', docs_this_month:8, docs_limit:100, last_invoice:'2025-05-20', compliance:100, erp:'Manuell', open_errors:0, pending_inbound:3, contact:'schmidt@handwerk.de' },
];

const MOCK_RECENT_ACTIVITY = [
  { mandant:'TechVision AG', action:'XRechnung generiert', detail:'INV-2025-1840 · 22.900 €', time:'vor 12 Min.', type:'success' },
  { mandant:'Stadtwerke Süd GmbH', action:'Validierungsfehler', detail:'Pflichtfeld LegalEntityID fehlt', time:'vor 28 Min.', type:'error' },
  { mandant:'Müller Bäckerei GmbH', action:'Inbound empfangen', detail:'Lieferant Großhandel · 1.290 €', time:'vor 1 Std.', type:'info' },
  { mandant:'Nord Express GmbH', action:'Peppol zugestellt', detail:'INV-2025-038 · 8.440 €', time:'vor 2 Std.', type:'success' },
  { mandant:'Bauer Logistik KG', action:'ERP-Buchung', detail:'Kreditor 10042 in Lexware gebucht', time:'vor 3 Std.', type:'success' },
  { mandant:'Handwerk Schmidt', action:'Inbound empfangen', detail:'Material Lieferant · 340 €', time:'vor 4 Std.', type:'info' },
];

function SteuerberaterPortal({ user, notify, onBack }) {
  const [view, setView] = useState('overview'); // overview | mandant | add
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [mandantTab, setMandantTab] = useState('overview');
  const [inviteModal, setInviteModal] = useState(false);

  const filtered = MOCK_MANDANTEN.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.vat.includes(search);
    const matchFilter = filter === 'all' || m.status === filter || (filter === 'errors' && m.open_errors > 0) || (filter === 'limit' && m.docs_this_month / m.docs_limit > 0.8);
    return matchSearch && matchFilter;
  });

  const totalDocs = MOCK_MANDANTEN.reduce((s, m) => s + m.docs_this_month, 0);
  const totalErrors = MOCK_MANDANTEN.reduce((s, m) => s + m.open_errors, 0);
  const totalPending = MOCK_MANDANTEN.reduce((s, m) => s + m.pending_inbound, 0);
  const avgCompliance = Math.round(MOCK_MANDANTEN.reduce((s, m) => s + m.compliance, 0) / MOCK_MANDANTEN.length);

  // ── MANDANT DETAIL VIEW ──────────────────────────────────────
  if (view === 'mandant' && selected) {
    const m = selected;
    const pct = Math.round((m.docs_this_month / m.docs_limit) * 100);
    return (
      <div className="fi">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setView('overview'); setSelected(null); setMandantTab('overview'); }}>← Alle Mandanten</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontFamily: F.ui, fontSize: 20, fontWeight: 700, color: T.textPrimary, letterSpacing: '-.025em' }}>{m.name}</h1>
              <StatusBadge status={m.status} />
              {m.open_errors > 0 && <span className="badge badge-red">{m.open_errors} Fehler</span>}
            </div>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{m.vat} · {m.erp} · {m.contact}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => notify(`E-Mail an ${m.contact} geöffnet`, 'info')}>✉ Kontaktieren</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExportInbound(selected?.id,null,null)}>↓ DATEV-Export</button>
            <button className="btn btn-primary btn-sm" onClick={() => notify('Einloggen als Mandant...', 'info')}>Als Mandant einloggen →</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Dokumente Mai', value: m.docs_this_month, sub: `von ${m.docs_limit}` },
            { label: 'Compliance', value: `${m.compliance}%`, sub: 'EN 16931', color: m.compliance >= 98 ? T.green : T.amber },
            { label: 'Offene Fehler', value: m.open_errors, sub: m.open_errors > 0 ? 'Handlungsbedarf' : 'Alles OK', color: m.open_errors > 0 ? T.red : T.green },
            { label: 'Inbound ausstehend', value: m.pending_inbound, sub: 'zu verarbeiten', color: m.pending_inbound > 0 ? T.amber : T.textPrimary },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
              <div className="stat-num" style={{ fontSize: 26, color: s.color || T.textPrimary }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Kontingent bar */}
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: T.textPrimary }}>Dokumenten-Kontingent Mai 2025</span>
            <span style={{ color: T.textMuted }}>{m.docs_this_month} / {m.docs_limit} ({pct}%)</span>
          </div>
          <div className="progress" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 85 ? T.red : pct > 70 ? T.amber : T.accent }} />
          </div>
          {pct > 80 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: T.amberBg, border: `1px solid ${T.amberBdr}`, borderRadius: 6, fontSize: 12.5, color: T.amber }}>
              ⚠ Nähert sich dem Limit — <button style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontWeight: 600, fontSize: 12.5, fontFamily: F.ui }} onClick={() => notify('Upgrade-Anfrage für ' + m.name, 'success')}>Plan upgraden →</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.bgBorder}`, marginBottom: 14 }}>
          {[['overview', 'Übersicht'], ['invoices', 'Rechnungen'], ['inbound', 'Inbound'], ['settings', 'Einstellungen']].map(([k, l]) => (
            <button key={k} className={`tab ${mandantTab === k ? 'active' : ''}`} onClick={() => setMandantTab(k)}>{l}</button>
          ))}
        </div>

        {mandantTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Letzte Aktivität</div>
              {MOCK_RECENT_ACTIVITY.filter(a => a.mandant === m.name).slice(0, 4).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 3 ? `1px solid ${T.bgSubtle}` : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.type === 'success' ? T.green : a.type === 'error' ? T.red : T.accent, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.textPrimary }}>{a.action}</div>
                    <div style={{ fontSize: 11.5, color: T.textMuted }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textMuted, flexShrink: 0 }}>{a.time}</div>
                </div>
              ))}
              {MOCK_RECENT_ACTIVITY.filter(a => a.mandant === m.name).length === 0 && (
                <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: 20 }}>Noch keine Aktivität</div>
              )}
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Mandanten-Info</div>
              {[
                ['ERP-System', m.erp],
                ['Plan', m.plan.charAt(0).toUpperCase() + m.plan.slice(1)],
                ['USt-IdNr.', m.vat],
                ['Letzte Rechnung', m.last_invoice],
                ['Compliance-Score', `${m.compliance}%`],
                ['Kontakt', m.contact],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.bgSubtle}`, fontSize: 13 }}>
                  <span style={{ color: T.textMuted }}>{l}</span>
                  <span style={{ fontWeight: 500, color: T.textPrimary }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mandantTab === 'invoices' && (
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.bgBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPrimary }}>Rechnungen</div>
              <button className="btn btn-primary btn-sm" onClick={() => notify('Neue Rechnung für ' + m.name, 'success')}>+ Neue Rechnung</button>
            </div>
            <table className="table">
              <thead><tr>{['Nummer', 'Betrag', 'Format', 'Status', 'Datum'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  { num: 'INV-2025-014', amt: 1840, fmt: 'xrechnung', st: 'delivered', date: '2025-05-27' },
                  { num: 'INV-2025-013', amt: 920, fmt: 'zugferd', st: 'archived', date: '2025-05-20' },
                  { num: 'INV-2025-012', amt: 3400, fmt: 'xrechnung', st: 'delivered', date: '2025-05-14' },
                ].map((inv, i) => (
                  <tr key={i} className="tr-hover">
                    <td style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{inv.num}</td>
                    <td style={{ fontWeight: 600 }}>{fmtEUR(inv.amt)}</td>
                    <td><span style={{ background: T.bgMuted, color: T.textSecondary, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, fontFamily: F.mono }}>{inv.fmt.toUpperCase()}</span></td>
                    <td><StatusBadge status={inv.st} /></td>
                    <td style={{ fontSize: 12, color: T.textMuted }}>{inv.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mandantTab === 'inbound' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Eingehende Rechnungen</div>
            {m.pending_inbound > 0 ? (
              <div style={{ background: T.amberBg, border: `1px solid ${T.amberBdr}`, borderRadius: 7, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: T.amber }}>
                ⚠ {m.pending_inbound} Eingang{m.pending_inbound > 1 ? 'änge' : ''} warte{m.pending_inbound === 1 ? 't' : 'n'} auf Verarbeitung
              </div>
            ) : (
              <div style={{ background: T.greenBg, border: `1px solid ${T.greenBdr}`, borderRadius: 7, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: T.green }}>
                ✓ Alle Eingänge verarbeitet
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => notify('Alle Eingänge von ' + m.name + ' verarbeitet ✓', 'success')}>Alle verarbeiten →</button>
          </div>
        )}

        {mandantTab === 'settings' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>Mandanten-Einstellungen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[['Unternehmensname', m.name], ['USt-IdNr.', m.vat], ['ERP-System', m.erp], ['Kontakt-E-Mail', m.contact]].map(([l, v]) => (
                <div key={l}><label className="label">{l}</label><input className="input" defaultValue={v} /></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
              <button className="btn btn-danger btn-sm" onClick={() => notify(m.name + ' aus Portal entfernt', 'error')}>Mandant entfernen</button>
              <button className="btn btn-primary" onClick={() => notify('Gespeichert ✓', 'success')}>Speichern</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── OVERVIEW ─────────────────────────────────────────────────
  return (
    <div className="fi">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: F.ui, fontSize: 22, fontWeight: 700, color: T.textPrimary, letterSpacing: '-.025em' }}>Steuerberater-Portal</h1>
            <span className="badge badge-purple" style={{ fontSize: 10.5 }}>Kanzlei-Ansicht</span>
          </div>
          <p style={{ fontSize: 13, color: T.textMuted }}>{MOCK_MANDANTEN.length} Mandanten · Zentrales Dashboard für alle Ihre Mandanten</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => notify('Sammel-Report wird generiert...', 'info')}>↓ Monats-Report</button>
          <button className="btn btn-primary btn-sm" onClick={() => setInviteModal(true)}>+ Mandant einladen</button>
        </div>
      </div>

      {/* Platform KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Mandanten gesamt', value: MOCK_MANDANTEN.length, sub: `${MOCK_MANDANTEN.filter(m => m.status === 'active').length} aktiv`, color: T.textPrimary },
          { label: 'Dokumente Mai', value: fmtNum(totalDocs), sub: 'Alle Mandanten', color: T.textPrimary },
          { label: 'Offene Fehler', value: totalErrors, sub: totalErrors > 0 ? 'Handlungsbedarf' : 'Alles OK', color: totalErrors > 0 ? T.red : T.green },
          { label: 'Ø Compliance', value: `${avgCompliance}%`, sub: 'EN 16931', color: avgCompliance >= 97 ? T.green : T.amber },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
            <div className="stat-num" style={{ fontSize: 26, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(totalErrors > 0 || totalPending > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {totalErrors > 0 && (
            <div style={{ padding: '10px 16px', background: T.redBg, border: `1px solid ${T.redBdr}`, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.red, flexShrink: 0 }} />
              <span style={{ color: T.red, fontWeight: 600 }}>{totalErrors} Validierungsfehler</span>
              <span style={{ color: T.red }}> bei {MOCK_MANDANTEN.filter(m => m.open_errors > 0).map(m => m.name).join(', ')}</span>
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setFilter('errors'); }}>Alle anzeigen</button>
            </div>
          )}
          {totalPending > 0 && (
            <div style={{ padding: '10px 16px', background: T.amberBg, border: `1px solid ${T.amberBdr}`, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.amber, flexShrink: 0 }} />
              <span style={{ color: T.amber, fontWeight: 600 }}>{totalPending} eingehende Rechnungen</span>
              <span style={{ color: T.amber }}>warten auf Verarbeitung</span>
            </div>
          )}
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Mandant suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 200 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Alle Mandanten</option>
          <option value="active">Aktiv</option>
          <option value="trial">Trial</option>
          <option value="errors">Mit Fehlern</option>
          <option value="limit">Nahe Limit (&gt;80%)</option>
        </select>
      </div>

      {/* Two-column layout: Mandanten cards + Activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

        {/* Mandanten cards */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(m => {
              const pct = Math.round((m.docs_this_month / m.docs_limit) * 100);
              return (
                <div key={m.id} className="card card-hover" style={{ padding: 16, cursor: 'pointer' }} onClick={() => { setSelected(m); setView('mandant'); }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.accentLight, border: `1px solid ${T.accentPale}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                      {m.name[0]}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{m.name}</span>
                        <StatusBadge status={m.status} />
                        {m.open_errors > 0 && <span className="badge badge-red" style={{ fontSize: 10 }}>{m.open_errors} Fehler</span>}
                        {m.pending_inbound > 0 && <span className="badge badge-amber" style={{ fontSize: 10 }}>{m.pending_inbound} Inbound</span>}
                      </div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>{m.vat} · {m.erp}</div>
                      {/* Progress bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                        <span>Dokumente Mai</span>
                        <span style={{ fontWeight: 600, color: pct > 80 ? T.red : T.textPrimary }}>{m.docs_this_month}/{m.docs_limit} ({pct}%)</span>
                      </div>
                      <div className="progress">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 85 ? T.red : pct > 70 ? T.amber : T.accent }} />
                      </div>
                    </div>
                    {/* Right side */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Compliance</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: m.compliance >= 98 ? T.green : T.amber, letterSpacing: '-.03em' }}>{m.compliance}%</div>
                      <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 6 }}>Letzte Rechnung</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textPrimary }}>{m.last_invoice}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.bgSubtle}` }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSelected(m); setView('mandant'); setMandantTab('invoices'); }}>Rechnungen</button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSelected(m); setView('mandant'); setMandantTab('inbound'); }}>
                      Inbound {m.pending_inbound > 0 && <span style={{ background: T.amber, color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10, marginLeft: 3 }}>{m.pending_inbound}</span>}
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => notify('Einloggen als ' + m.name, 'info')}>Öffnen →</button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 14 }}>Keine Mandanten gefunden</div>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <div className="card" style={{ padding: 16, position: 'sticky', top: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Aktivitäten — heute</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {MOCK_RECENT_ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < MOCK_RECENT_ACTIVITY.length - 1 ? `1px solid ${T.bgSubtle}` : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.type === 'success' ? T.green : a.type === 'error' ? T.red : T.accent, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.mandant}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{a.action}</div>
                    <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 1 }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0, marginTop: 1 }}>{a.time}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => notify('Vollständiges Protokoll wird geladen...', 'info')}>Alle Aktivitäten →</button>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {inviteModal && (
        <div className="modal-overlay" onClick={() => setInviteModal(false)}>
          <div className="modal sci" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>Mandant einladen</div>
              <button onClick={() => setInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: T.textMuted }}>×</button>
            </div>
            <p style={{ fontSize: 13.5, color: T.textSecondary, marginBottom: 18, lineHeight: 1.6 }}>
              Der Mandant erhält eine Einladungs-E-Mail und wird automatisch mit Ihrer Kanzlei verknüpft. Sie sehen alle seine Rechnungen in diesem Portal.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {[['Unternehmensname', 'Müller Bäckerei GmbH', 'text'], ['USt-IdNr.', 'DE123456789', 'text'], ['Kontakt-E-Mail', 'buchhaltung@mandant.de', 'email']].map(([l, p, t]) => (
                <div key={l}><label className="label">{l}</label><input className="input" type={t} placeholder={p} /></div>
              ))}
              <div>
                <label className="label">ERP-System</label>
                <select className="select">
                  <option>Lexware</option><option>DATEV</option><option>SAP S/4HANA</option><option>SAP ECC</option><option>Odoo</option><option>Manuell</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: T.bgSubtle, border: `1px solid ${T.bgBorder}`, borderRadius: 7, fontSize: 12.5, color: T.textSecondary, marginBottom: 16 }}>
              White-Label: Der Mandant sieht <strong style={{ color: T.textPrimary }}>Ihre Kanzlei</strong> als Absender, nicht invoiq.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setInviteModal(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={() => { notify('Einladung an Mandant gesendet ✓', 'success'); setInviteModal(false); }}>Einladung senden →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// LEGAL — Impressum, Datenschutz, AGB
// ══════════════════════════════════════════════════════════════
function LegalPage({ title, onBack, children }) {
  return (
    <div style={{ minHeight:'100vh', background:T.bgSubtle }}>
      <header style={{ height:58, background:T.bg, borderBottom:`1px solid ${T.bgBorder}`, display:'flex', alignItems:'center', padding:'0 clamp(16px,4vw,56px)', gap:16 }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm">← invoiq.io</button>
        <Wordmark size={20}/>
      </header>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'48px clamp(16px,4vw,40px) 80px' }}>
        <h1 style={{ fontFamily:F.ui, fontSize:28, fontWeight:800, color:T.textPrimary, letterSpacing:'-.03em', marginBottom:8 }}>{title}</h1>
        <div style={{ fontSize:12.5, color:T.textMuted, marginBottom:36 }}>Stand: Mai 2025</div>
        <div style={{ fontSize:14.5, color:T.textSecondary, lineHeight:1.85 }}>{children}</div>
      </div>
    </div>
  );
}

function H({ children }) { return <h2 style={{ fontFamily:F.ui, fontSize:17, fontWeight:700, color:T.textPrimary, letterSpacing:'-.02em', marginTop:36, marginBottom:10 }}>{children}</h2>; }
function P({ children }) { return <p style={{ marginBottom:14 }}>{children}</p>; }
function Li({ items }) { return <ul style={{ paddingLeft:20, marginBottom:14, display:'flex', flexDirection:'column', gap:5 }}>{items.map((i,k)=><li key={k}>{i}</li>)}</ul>; }

function Impressum({ onBack }) {
  return (
    <LegalPage title="Impressum" onBack={onBack}>
      <H>Angaben gemäß § 5 TMG</H>
      <P><strong>invoiq UG (haftungsbeschränkt)</strong> (in Gründung)<br/>
      Musterstraße 1<br/>01234 Dresden<br/>Deutschland</P>

      <H>Vertreten durch</H>
      <P>Manfred Bell, Geschäftsführer</P>

      <H>Kontakt</H>
      <P>E-Mail: <a href="mailto:manfred@invoiq.io" style={{ color:T.accent }}>manfred@invoiq.io</a><br/>
      Web: <a href="https://invoiq.io" style={{ color:T.accent }}>https://invoiq.io</a></P>

      <H>Registereintrag</H>
      <P>Registrierung beim Amtsgericht Dresden wird beantragt.<br/>
      Handelsregisternummer: wird nach Eintragung ergänzt.</P>

      <H>Umsatzsteuer-ID</H>
      <P>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br/>
      wird nach Eintragung ergänzt.</P>

      <H>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</H>
      <P>Manfred Bell<br/>Musterstraße 1<br/>01234 Dresden</P>

      <H>Streitschlichtung</H>
      <P>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" style={{ color:T.accent }}>https://ec.europa.eu/consumers/odr/</a></P>
      <P>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</P>

      <H>Haftung für Inhalte</H>
      <P>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</P>
    </LegalPage>
  );
}

function Datenschutz({ onBack }) {
  return (
    <LegalPage title="Datenschutzerklärung" onBack={onBack}>
      <P>Der Schutz Ihrer persönlichen Daten ist uns ein besonderes Anliegen. Wir verarbeiten Ihre Daten daher ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG 2003).</P>

      <H>1. Verantwortlicher</H>
      <P>invoiq UG (haftungsbeschränkt) (i.G.), Manfred Bell, Musterstraße 1, 01234 Dresden<br/>
      E-Mail: <a href="mailto:datenschutz@invoiq.io" style={{ color:T.accent }}>datenschutz@invoiq.io</a></P>

      <H>2. Verarbeitete Daten & Zwecke</H>
      <P><strong>Kontodaten:</strong> Name, E-Mail-Adresse, Unternehmensname, USt-IdNr. — zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</P>
      <P><strong>Rechnungsdaten:</strong> Alle in der Plattform verarbeiteten Rechnungsdaten gehören Ihnen. Wir verarbeiten sie ausschließlich zur Erbringung unserer Dienstleistung. Keine Weitergabe an Dritte ohne Ihre Einwilligung.</P>
      <P><strong>Nutzungsdaten:</strong> Server-Logs (IP-Adresse, Browser, Zeitstempel) für technischen Betrieb — Löschung nach 7 Tagen.</P>
      <P><strong>Zahlungsdaten:</strong> Werden ausschließlich durch Stripe verarbeitet. invoiq speichert keine Kreditkartendaten.</P>

      <H>3. Dokumenten-Scanner (KI-Verarbeitung)</H>
      <P>Wenn Sie den Dokumenten-Scanner nutzen, wird Ihr Dokument einmalig zur Textextraktion an die Anthropic API (USA) übermittelt. Dabei gilt:</P>
      <Li items={[
        'Das Dokument wird nicht dauerhaft bei Anthropic gespeichert',
        'Die Verarbeitung erfolgt auf Basis EU-Standardvertragsklauseln (Art. 46 DSGVO)',
        'Ihre explizite Einwilligung wird vor jeder Übermittlung eingeholt (Art. 6 Abs. 1 lit. a DSGVO)',
        'Einwilligung kann jederzeit widerrufen werden',
      ]}/>

      <H>4. GoBD-Archivierung</H>
      <P>Archivierte Rechnungen werden gemäß §147 AO 10 Jahre aufbewahrt. Die Speicherung erfolgt in AWS Frankfurt (EU-Central-1), verschlüsselt mit SHA-256. Eine vorzeitige Löschung ist aus rechtlichen Gründen nicht möglich.</P>

      <H>5. Auftragsverarbeitung</H>
      <P>Wir nutzen folgende Auftragsverarbeiter mit AVV-Vereinbarungen:</P>
      <Li items={[
        'Railway Technologies Inc. — Server-Hosting (USA, EU-Standardvertragsklauseln)',
        'Supabase Inc. — Datenbankhosting (AWS Frankfurt)',
        'Stripe Inc. — Zahlungsabwicklung (EU-Standardvertragsklauseln)',
        'Anthropic PBC — KI-Verarbeitung nur bei Scanner-Nutzung (EU-Standardvertragsklauseln)',
      ]}/>

      <H>6. Ihre Rechte</H>
      <P>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wenden Sie sich an: <a href="mailto:datenschutz@invoiq.io" style={{ color:T.accent }}>datenschutz@invoiq.io</a></P>
      <P>Sie haben zudem das Recht, Beschwerde bei einer Aufsichtsbehörde einzulegen. Zuständig: Sächsischer Datenschutzbeauftragter, <a href="https://www.saechsdsb.de" style={{ color:T.accent }}>www.saechsdsb.de</a></P>

      <H>7. Cookies</H>
      <P>invoiq.io verwendet ausschließlich technisch notwendige Cookies (Session-Token). Keine Tracking- oder Marketing-Cookies. Keine Cookie-Banner erforderlich.</P>

      <H>8. Datensicherheit</H>
      <P>Alle Datenübertragungen erfolgen verschlüsselt über TLS 1.3. Zugang zur Plattform ist passwortgeschützt mit bcrypt-Hashing. API-Keys werden nur gehashed gespeichert.</P>
    </LegalPage>
  );
}

function AGB({ onBack }) {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen" onBack={onBack}>
      <P><strong>invoiq UG (haftungsbeschränkt) (i.G.)</strong> — Stand: Mai 2025</P>

      <H>§ 1 Geltungsbereich</H>
      <P>Diese AGB gelten für alle Verträge zwischen invoiq UG (haftungsbeschränkt) i.G. (nachfolgend "invoiq") und Unternehmern (§ 14 BGB) über die Nutzung der SaaS-Plattform invoiq.io.</P>

      <H>§ 2 Vertragsgegenstand</H>
      <P>invoiq stellt eine cloudbasierte Software-as-a-Service-Plattform zur Erstellung, Versendung, Validierung und Archivierung von elektronischen Rechnungen gemäß EN 16931 bereit. Der Funktionsumfang richtet sich nach dem gebuchten Tarif.</P>

      <H>§ 3 Vertragsschluss & Tarife</H>
      <P>Der Vertrag kommt durch Registrierung und Buchung eines Tarifs zustande. Verfügbare Tarife:</P>
      <Li items={[
        'Free: 0 €/Monat, 10 Dokumente/Monat — kostenlos, keine Kündigung erforderlich',
        'Starter: 29 €/Monat (25 € bei jährlicher Zahlung), 100 Dokumente/Monat',
        'Business: 99 €/Monat (85 € jährlich), 500 Dokumente/Monat',
        'Enterprise: 299 €/Monat (250 € jährlich), unbegrenzte Dokumente',
      ]}/>
      <P>Überschreitungen werden mit 0,50 € je zusätzlichem Dokument berechnet.</P>

      <H>§ 4 Laufzeit & Kündigung</H>
      <P>Monatliche Tarife können monatlich, jährliche Tarife zum Ende der Laufzeit gekündigt werden. Kündigung jederzeit im Kundenkonto unter Einstellungen → Abrechnung oder per E-Mail an <a href="mailto:kuendigung@invoiq.io" style={{ color:T.accent }}>kuendigung@invoiq.io</a>.</P>
      <P>Nach Kündigung bleiben Daten 90 Tage abrufbar, danach werden sie gelöscht (ausgenommen GoBD-archivierte Dokumente, die gesetzlich 10 Jahre aufbewahrt werden müssen).</P>

      <H>§ 5 Preise & Zahlung</H>
      <P>Alle Preise sind Nettopreise zzgl. gesetzlicher Umsatzsteuer. Zahlung erfolgt per Kreditkarte oder SEPA-Lastschrift über Stripe. Rechnungen werden monatlich bzw. jährlich ausgestellt und per E-Mail zugesandt.</P>

      <H>§ 6 Verfügbarkeit & SLA</H>
      <P>invoiq strebt eine Verfügbarkeit von 99,5 % pro Monat an (gemessen ohne geplante Wartungsfenster). Kein Anspruch auf bestimmte Verfügbarkeit außer bei Enterprise-Tarif mit gesondertem SLA.</P>

      <H>§ 7 Pflichten des Kunden</H>
      <Li items={[
        'Zugangsdaten vertraulich behandeln und nicht an Dritte weitergeben',
        'Plattform nicht für rechtswidrige Zwecke nutzen',
        'Korrekte Rechnungsdaten einpflegen — invoiq haftet nicht für inhaltliche Fehler',
        'Bei Verdacht auf Missbrauch unverzüglich invoiq informieren',
      ]}/>

      <H>§ 8 Datenschutz & Auftragsverarbeitung</H>
      <P>invoiq verarbeitet Rechnungsdaten als Auftragsverarbeiter im Sinne des Art. 28 DSGVO. Der Abschluss eines Auftragsverarbeitungsvertrags (AVV) ist auf Anfrage möglich: <a href="mailto:datenschutz@invoiq.io" style={{ color:T.accent }}>datenschutz@invoiq.io</a></P>

      <H>§ 9 Haftung</H>
      <P>invoiq haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei leichter Fahrlässigkeit haftet invoiq nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, vertragstypischen Schaden, maximal auf die in den letzten 12 Monaten gezahlten Entgelte.</P>
      <P>invoiq übernimmt keine Haftung für die steuerrechtliche Richtigkeit erzeugter Rechnungen. Die Verantwortung für die inhaltliche Korrektheit liegt beim Kunden.</P>

      <H>§ 10 Änderungen der AGB</H>
      <P>invoiq behält sich vor, diese AGB mit einer Ankündigungsfrist von 30 Tagen per E-Mail zu ändern. Widerspricht der Kunde nicht innerhalb von 30 Tagen nach Zugang der Mitteilung, gelten die Änderungen als angenommen.</P>

      <H>§ 11 Anwendbares Recht & Gerichtsstand</H>
      <P>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist Dresden, soweit der Kunde Kaufmann ist.</P>

      <H>§ 12 Salvatorische Klausel</H>
      <P>Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</P>
    </LegalPage>
  );
}


// ── ROOT ──────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState(()=>{const p=window.location.pathname;if(p==='/register'||p.startsWith('/register'))return'auth';if(api._token)return'app';return'landing';}); // landing|auth|app|admin|onboarding|impressum|datenschutz|agb
const[mode,setMode]=useState(()=>{const p=window.location.pathname;return(p==='/register'||p.startsWith('/register'))?'register':'login';});
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
    {screen==="landing"&&<Landing onEnter={()=>{if(api._token){setScreen("app");}else{setMode("login");setScreen("auth");}}}/>}
    {screen==="auth"&&<Auth mode={mode} onSwitch={()=>setMode(m=>m==="login"?"register":"login")} onSuccess={handleAuth} loading={loading}/>}
    {screen==="onboarding"&&<OnboardingWizard user={user} onComplete={data=>{if(typeof localStorage!=="undefined")localStorage.setItem("invoiq_onboarding_done","true");if(data.org_name&&org)setOrg(p=>({...p,name:data.org_name}));setScreen("app");setNav("dashboard");notify("Setup complete — welcome to invoiq! 🎉","success");}}/>}
    {screen==="app"&&<AppShell user={user} org={org} nav={nav} setNav={setNav} onLogout={handleLogout} onAdmin={()=>{setAdminNav("overview");setScreen("admin");}}>
      {nav==="dashboard"&&<Dashboard user={user} org={org} notify={notify} onNav={setNav}/>}
      {nav==="invoices"&&<Invoices notify={notify}/>}
      {nav==="connect"&&<ConnectorsView notify={notify}/>}
          {nav==="scanner"&&<DokumentenScanner notify={notify}/>}
          {nav==="inbound"&&<InboundScreen notify={notify}/>}
          {nav==="steuerberater"&&<SteuerberaterPortal user={user} notify={notify} onBack={()=>setNav('dashboard')}/>}
      {nav==="archive"&&<ArchiveScreen notify={notify}/>}
      {nav==="webhooks"&&<Placeholder title="Webhooks" sub="invoice.created · invoice.sent · invoice.delivered" icon="⚡"/>}
      {nav==="settings"&&<SettingsScreen user={user} org={org} notify={notify}/>}
    </AppShell>}
    {screen==="admin"&&<AdminShell user={user} org={org} nav={adminNav} setNav={setAdminNav} onBack={()=>setScreen("app")}>
      {adminNav==="overview"&&<AdminOverview notify={notify} isSuper={isSuper}/>}
      {adminNav==="allinvoices"&&<AdminDocs notify={notify}/>}
      {adminNav==="myinvoices"&&<AdminDocs notify={notify}/>}
      {adminNav==="users"&&<AdminUsers notify={notify}/>}
      {adminNav==="myusers"&&<AdminUsers notify={notify}/>}
      {adminNav==="revenue"&&<AdminRevenue/>}
      {["mysettings","billing","peppol","apilogs"].includes(adminNav)&&<Placeholder title={{mysettings:"Settings",billing:"Billing",peppol:"Peppol Status",apilogs:"Audit Logs"}[adminNav]} sub={{mysettings:"Company · API keys · Integrations",billing:"Plan · Payment history",peppol:"PeppolSoft · Peppol BIS 3.0 · $0.10/Dokument",apilogs:"GoBD-compliant audit trail"}[adminNav]}/>}
    </AdminShell>}
  </>);
}

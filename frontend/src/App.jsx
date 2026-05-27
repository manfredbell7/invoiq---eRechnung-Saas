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

const API_BASE=(import.meta?.env?.VITE_API_URL)||"http://localhost:3000/api/v1";
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
function Landing({onEnter}){
  const[scrolled,setScrolled]=useState(false);
  const[tick,setTick]=useState(0);
  const[activeStep,setActiveStep]=useState(-1);
  const[heroTab,setHeroTab]=useState(0);
  const heroRef=useRef(null);

  // Ticker for live dashboard animation
  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),2200);
    return()=>clearInterval(id);
  },[]);

  // Auto-cycle hero tabs
  useEffect(()=>{
    const id=setInterval(()=>setHeroTab(t=>(t+1)%3),3500);
    return()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>40);
    window.addEventListener('scroll',h,{passive:true});

    // Scroll reveal
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target);}
    }),{threshold:.1,rootMargin:'0px 0px -30px 0px'});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

    // Step reveal
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

  // Animated invoice rows cycling
  const liveRows=[
    {num:'INV-2025-041',co:'Müller GmbH',amt:'4.284 €',st:'delivered'},
    {num:'INV-2025-040',co:'TechVision AG',amt:'12.900 €',st:'validated'},
    {num:'INV-2025-039',co:'Stadtwerke Nord',amt:'780 €',st:'error'},
    {num:'INV-2025-038',co:'Bauer Logistik',amt:'2.190 €',st:'delivered'},
    {num:'INV-2025-037',co:'Nord Express',amt:'8.440 €',st:'delivered'},
  ];
  const visibleRows=liveRows.slice(tick%5,(tick%5)+3).concat(liveRows).slice(0,3);

  const integrations=['SAP S/4HANA','SAP ECC','DATEV','Lexware','MS Dynamics','Odoo','Xero','QuickBooks','NetSuite','sevDesk','lexoffice','Weclapp'];

  // Process steps
  const STEPS=[
    {
      n:1,
      title:'ERP verbinden',
      desc:'Einmalige Konfiguration in unter 2 Stunden. SAP, DATEV oder REST API — danach läuft alles automatisch.',
      tags:['SAP S/4HANA','SAP ECC','DATEV','Lexware','REST API'],
      preview:(
        <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
          {[['SAP S/4HANA','Connected'],['DATEV Connect','Connected'],['Lexware Office','Configure →']].map(([n,s],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<2?`1px solid ${T.bgBorder}`:'none'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:s==='Connected'?T.green:T.bgBorder,flexShrink:0}}/>
              <span style={{fontSize:12.5,color:T.textPrimary,flex:1}}>{n}</span>
              <span style={{fontSize:11,fontWeight:600,color:s==='Connected'?T.green:T.accent}}>{s}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      n:2,
      title:'Rechnungsdaten empfangen',
      desc:'Jede gebuchte Faktura landet in Echtzeit bei invoiq. Alle Felder automatisch gemappt — keine doppelte Datenpflege.',
      tags:['IDoc INVOIC02','REST JSON','SFTP XML'],
      preview:(
        <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
          {[['Empfang','84%',T.accent],['Verarbeitung','93%',T.green],['Fehlerrate','2%',T.red]].map(([l,p,c],i)=>(
            <div key={i} style={{marginBottom:i<2?10:0}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11.5,marginBottom:4}}>
                <span style={{color:T.textSecondary}}>{l}</span>
                <span style={{fontWeight:600,color:T.textPrimary}}>{p}</span>
              </div>
              <div style={{height:3,background:T.bgBorder,borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:p,background:c,borderRadius:2,transition:'width 1s ease'}}/>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      n:3,
      title:'EN 16931 Validierung & XML',
      desc:'invoiq generiert XRechnung UBL 2.1 oder ZUGFeRD CII und validiert sofort gegen den europäischen Standard.',
      tags:['XRechnung 3.0','ZUGFeRD 2.4','Peppol BIS 3.0'],
      preview:(
        <div style={{marginTop:12,background:T.brand,borderRadius:6,padding:'12px 14px',fontFamily:F.mono,fontSize:10.5,lineHeight:1.7,color:'rgba(255,255,255,.5)',overflow:'hidden',maxHeight:110}}>
          <span style={{color:'#818CF8'}}>&lt;ubl:Invoice&gt;</span><br/>
          {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:ID&gt;</span><span style={{color:'#6EE7B7'}}>INV-2025-041</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
          {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:IssueDate&gt;</span><span style={{color:'#6EE7B7'}}>2025-05-27</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
          {'  '}<span style={{color:'#818CF8'}}>&lt;cbc:PayableAmount&gt;</span><span style={{color:'#6EE7B7'}}>4284.00</span><span style={{color:'#818CF8'}}>&lt;/&gt;</span><br/>
          <span style={{color:'#818CF8'}}>&lt;/ubl:Invoice&gt;</span>
        </div>
      )
    },
    {
      n:4,
      title:'Versand & Zustellung',
      desc:'Per E-Mail, Peppol-Netzwerk oder API-Webhook. Status-Tracking in Echtzeit für jede einzelne Rechnung.',
      tags:['E-Mail','Peppol','Webhook','Download'],
      preview:(
        <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
          {[['INV-2025-041','Delivered',T.green],['INV-2025-040','Validated',T.accent],['INV-2025-039','Sending…',T.amber]].map(([n,s,c],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<2?`1px solid ${T.bgBorder}`:'none'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:c,flexShrink:0}}/>
              <span style={{fontFamily:F.mono,fontSize:11,color:T.textPrimary,flex:1}}>{n}</span>
              <span style={{fontSize:11,fontWeight:600,color:c}}>{s}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      n:5,
      title:'GoBD-konforme Archivierung',
      desc:'SHA-256-gesichert, unveränderlich in AWS Frankfurt gespeichert und 10 Jahre aufbewahrt — §147 AO konform.',
      tags:['SHA-256','AWS Frankfurt','§147 AO','10 Jahre'],
      preview:(
        <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:28,height:28,borderRadius:6,background:T.green,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#fff" strokeWidth="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div style={{fontFamily:F.mono,fontSize:10,color:T.textSecondary,lineHeight:1.5}}>
              <div style={{color:T.textMuted,fontSize:9,marginBottom:1}}>SHA-256</div>
              a7f3d9c2b1e8f4...4d2a9c1b3e7f
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[['12.441','Archiviert'],['10J','Aufbewahrung'],['98%','Compliance']].map(([v,l])=>(
              <div key={l} style={{background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:5,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:16,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em'}}>{v}</div>
                <div style={{fontSize:9.5,color:T.textMuted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
  ];

  const stBadge=(s)=>{
    const m={delivered:[T.green,'#ECFDF5','#A7F3D0','Delivered'],validated:[T.accent,'#EEF2FF','#C7D2FE','Validated'],error:[T.red,'#FEF2F2','#FECACA','Error'],pending:[T.amber,'#FFFBEB','#FDE68A','Pending']};
    const[c,bg,bd,lbl]=m[s]||[T.textMuted,T.bgMuted,T.bgBorder,s];
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:bg,color:c,border:`1px solid ${bd}`}}>{lbl}</span>;
  };

  // Hero tabs content
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
            <div key={i} style={{flex:1,background:i===6?T.accent:`${T.accent}28`,borderRadius:'2px 2px 0 0',height:`${(v/41)*100}%`,minHeight:3,transition:'height .4s'}}/>
          ))}
        </div>
        {visibleRows.map((r,i)=>(
          <div key={r.num+i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:i<2?`1px solid ${T.bgSubtle}`:'none',transition:'opacity .3s'}}>
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

    {/* ── HERO ── */}
    <section style={{minHeight:'100vh',display:'flex',alignItems:'center',padding:'80px clamp(16px,4vw,56px) 60px',position:'relative',overflow:'hidden'}}>
      {/* Subtle grid */}
      <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${T.bgBorder} 1px,transparent 1px),linear-gradient(90deg,${T.bgBorder} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:.35,pointerEvents:'none'}}/>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse 70% 80% at 60% 50%,transparent 30%,${T.bg} 75%)`,pointerEvents:'none'}}/>

      <div style={{maxWidth:1100,margin:'0 auto',width:'100%',display:'grid',gridTemplateColumns:'1fr 1.1fr',gap:64,alignItems:'center',position:'relative'}}>

        {/* Left — Copy */}
        <div>
          <div className="fu" style={{marginBottom:20}}>
            <span className="hero-pill">
              <span style={{width:6,height:6,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite',display:'inline-block'}}/>
              E-Rechnungspflicht 2027 — Jetzt vorbereiten
            </span>
          </div>
          <h1 className="fu2" style={{fontFamily:F.ui,fontSize:'clamp(32px,4.5vw,56px)',fontWeight:800,color:T.textPrimary,lineHeight:1.1,letterSpacing:'-.04em',marginBottom:18}}>
            E-Invoice<br/>Compliance.<br/><span style={{color:T.accent}}>Automatisch.</span>
          </h1>
          <p className="fu3" style={{fontSize:16,color:T.textSecondary,lineHeight:1.7,marginBottom:32,maxWidth:420}}>
            XRechnung · ZUGFeRD · Peppol — für SAP, DATEV, Lexware und jedes andere ERP-System. In 48 Stunden live.
          </p>
          <div className="fu4" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:40}}>
            <button className="btn btn-primary btn-lg" onClick={onEnter}>Kostenlos starten →</button>
            <button className="btn btn-ghost btn-lg" onClick={onEnter}>Demo ansehen</button>
          </div>
          {/* Social proof numbers */}
          <div className="fu5" style={{display:'flex',gap:28,paddingTop:24,borderTop:`1px solid ${T.bgBorder}`}}>
            {[['48h','bis Go-Live'],['100%','EN 16931'],['10J','GoBD-Archiv']].map(([v,l])=>(
              <div key={l}>
                <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,letterSpacing:'-.04em'}}>{v}</div>
                <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Live Dashboard Preview */}
        <div className="fu3" style={{position:'relative'}}>
          {/* Glow behind card */}
          <div style={{position:'absolute',top:'10%',left:'10%',right:'10%',bottom:'10%',background:`radial-gradient(ellipse,${T.accentPale} 0%,transparent 70%)`,borderRadius:16,filter:'blur(20px)',opacity:.5,pointerEvents:'none'}}/>

          <div style={{background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:10,boxShadow:T.shadowXl,overflow:'hidden',position:'relative'}}>
            {/* Window chrome */}
            <div style={{height:34,background:T.bgSubtle,borderBottom:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',padding:'0 12px',gap:7}}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:9,height:9,borderRadius:'50%',background:c}}/>)}
              <div style={{flex:1,height:14,background:T.bgBorder,borderRadius:3,marginLeft:8,maxWidth:180}}/>
            </div>

            {/* App layout inside preview */}
            <div style={{display:'flex',height:320}}>
              {/* Mini sidebar */}
              <div style={{width:110,background:T.bgSubtle,borderRight:`1px solid ${T.bgBorder}`,padding:'10px 8px',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:14,padding:'0 4px'}}>
                  <div style={{width:16,height:16,borderRadius:3,background:T.brand,flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:700,color:T.textPrimary}}>invoiq</span>
                </div>
                {['Overview','Documents','Connectors','Archive','Settings'].map((item,i)=>(
                  <div key={item} style={{padding:'5px 7px',borderRadius:5,marginBottom:2,background:i===heroTab===0&&item==='Documents'?T.bgMuted:i===0&&heroTab===0?T.bgMuted:i===1&&heroTab===1?T.bgMuted:i===2&&heroTab===2?T.bgMuted:'transparent',fontSize:11,fontWeight:i===heroTab?600:400,color:i===heroTab?T.textPrimary:T.textMuted,cursor:'default',transition:'all .2s'}}>
                    {item}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div style={{flex:1,overflow:'hidden'}}>
                {/* Topbar inside preview */}
                <div style={{height:36,borderBottom:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px'}}>
                  <div style={{display:'flex',gap:2}}>
                    {heroTabs.map((t,i)=>(
                      <span key={t.label} onClick={()=>setHeroTab(i)} style={{fontSize:11,fontWeight:i===heroTab?600:500,color:i===heroTab?T.textPrimary:T.textMuted,padding:'4px 8px',borderBottom:`2px solid ${i===heroTab?T.accent:'transparent'}`,cursor:'pointer',transition:'all .15s'}}>{t.label}</span>
                    ))}
                  </div>
                  <div style={{width:7,height:7,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite'}}/>
                </div>
                {/* Tab content */}
                <div style={{overflow:'hidden',height:283,transition:'opacity .3s'}}>
                  {heroTabs[heroTab].content}
                </div>
              </div>
            </div>
          </div>

          {/* Floating notification */}
          <div style={{position:'absolute',bottom:-16,right:-12,background:T.bg,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:'10px 14px',boxShadow:T.shadow3,display:'flex',alignItems:'center',gap:10,animation:'fadeIn .4s ease'}}>
            <div style={{width:28,height:28,borderRadius:6,background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{fontSize:11.5,fontWeight:600,color:T.textPrimary}}>XRechnung generiert</div>
              <div style={{fontSize:10.5,color:T.textMuted}}>EN 16931 · GoBD ✓</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* INTEGRATIONS MARQUEE */}
    <section style={{padding:'48px 0',borderTop:`1px solid rgba(99,91,255,.12)`,borderBottom:`1px solid rgba(99,91,255,.12)`,background:'#07102A',overflow:'hidden',position:'relative'}}>
      {/* Subtle grid overlay */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(99,91,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,91,255,.07) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>
      {/* Glow center */}
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'60%',height:'100px',background:'radial-gradient(ellipse,rgba(99,91,255,.15) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <p style={{fontSize:10.5,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:1.4,textTransform:'uppercase',marginBottom:24,textAlign:'center',position:'relative'}}>Kompatibel mit führenden ERP-Systemen</p>
      <div className="marquee-wrap" style={{position:'relative'}}>
        <div className="marquee-track">
          {[...integrations,...integrations].map((n,i)=>(
            <div key={i} className="integration-logo" style={{color:'rgba(255,255,255,.55)',background:'rgba(255,255,255,.04)',borderColor:'rgba(255,255,255,.08)'}}>
              {/* Subtle dot indicator */}
              <span style={{width:5,height:5,borderRadius:'50%',background:'rgba(99,91,255,.7)',display:'inline-block',flexShrink:0}}/>
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── ANIMATED PROCESS FLOW ── */}
    <section id="funktionen" style={{padding:'96px clamp(16px,4vw,56px)'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:64}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14,fontSize:11}}>So funktioniert's</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:700,color:T.textPrimary,letterSpacing:'-.03em',lineHeight:1.15,marginBottom:12}}>
            Von der Faktura zur<br/>EN 16931-Rechnung.
          </h2>
          <p className="reveal" style={{fontSize:15,color:T.textSecondary,maxWidth:480,margin:'0 auto'}}>Fünf automatische Schritte — komplett ohne manuelle Eingriffe.</p>
        </div>

        {/* Step flow */}
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {STEPS.map((s,i)=>(
            <div key={s.n} className="flow-step" data-step={i} style={{display:'grid',gridTemplateColumns:'56px 1fr',gap:24,paddingBottom:i<STEPS.length-1?40:0,position:'relative',opacity:activeStep>=i?1:0,transform:activeStep>=i?'translateY(0)':'translateY(16px)',transition:'opacity .5s ease, transform .5s ease'}}>

              {/* Vertical connector line */}
              {i<STEPS.length-1 && (
                <div style={{position:'absolute',left:27,top:56,width:2,height:'calc(100% - 30px)',background:`linear-gradient(to bottom,${activeStep>i?T.accent:T.bgBorder} 0%,${T.bgBorder} 100%)`,transition:'background .5s',borderRadius:1}}/>
              )}

              {/* Step circle */}
              <div style={{width:56,height:56,borderRadius:'50%',background:activeStep>=i?T.accent:T.bg,border:`2px solid ${activeStep>=i?T.accent:T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,color:activeStep>=i?'#fff':T.textMuted,flexShrink:0,zIndex:1,transition:'all .4s cubic-bezier(.16,1,.3,1)',transform:activeStep===i?'scale(1.12)':'scale(1)',boxShadow:activeStep===i?`0 0 0 6px ${T.accentPale}`:activeStep>i?`0 0 0 4px ${T.accentLight}`:'none'}}>
                {activeStep>i
                  ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : s.n
                }
              </div>

              {/* Content */}
              <div style={{paddingTop:12}}>
                <h3 style={{fontSize:17,fontWeight:700,color:T.textPrimary,marginBottom:6,letterSpacing:'-.025em'}}>{s.title}</h3>
                <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65,marginBottom:10,maxWidth:560}}>{s.desc}</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:activeStep>=i?0:0}}>
                  {s.tags.map(t=>(
                    <span key={t} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:4,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,color:T.textSecondary}}>{t}</span>
                  ))}
                </div>
                {/* Animated preview panel */}
                <div style={{overflow:'hidden',maxHeight:activeStep>=i?300:0,transition:'max-height .6s cubic-bezier(.16,1,.3,1) .15s',opacity:activeStep>=i?1:0,transitionDelay:activeStep>=i?'.15s':'0s'}}>
                  {s.preview}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* BENEFITS */}
    <section style={{padding:'88px clamp(16px,4vw,56px)',background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`,borderBottom:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:1080,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <span className="reveal badge badge-blue" style={{marginBottom:14,fontSize:11}}>Warum invoiq</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:700,color:T.textPrimary,letterSpacing:'-.03em',lineHeight:1.15}}>Weniger Aufwand.<br/>Mehr Compliance.</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(240px,100%),1fr))',gap:12}}>
          {[
            {n:'01',title:'In 48 Stunden live',desc:'Keine monatelangen Projekte. Verbinden, konfigurieren, fertig.'},
            {n:'02',title:'Rechtssicher ab Tag 1',desc:'EN 16931, GoBD, §147 AO — alle Anforderungen automatisch.'},
            {n:'03',title:'Jedes ERP-System',desc:'SAP, DATEV, Lexware oder REST API — ein Portal.'},
            {n:'04',title:'EU-weit einsatzbereit',desc:'XRechnung, ZUGFeRD, Peppol BIS 3.0 — bereit für ViDA.'},
          ].map((b,i)=>(
            <div key={i} className="feature-card reveal" style={{transitionDelay:`${i*.07}s`}}>
              <div style={{width:28,height:18,borderRadius:3,background:T.brand,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9.5,fontWeight:800,color:'rgba(255,255,255,.65)',marginBottom:16,letterSpacing:.5}}>{b.n}</div>
              <h3 style={{fontWeight:600,fontSize:15,color:T.textPrimary,marginBottom:7,letterSpacing:'-.02em'}}>{b.title}</h3>
              <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65}}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* SECURITY */}
    <section id="sicherheit" style={{padding:'88px clamp(16px,4vw,56px)'}}>
      <div style={{maxWidth:920,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
        <div>
          <span className="reveal badge badge-green" style={{marginBottom:16,fontSize:11}}>Security & Compliance</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(24px,3vw,40px)',fontWeight:700,color:T.textPrimary,letterSpacing:'-.03em',marginBottom:18}}>Revisionssicher.<br/>Gerichtsfest.</h2>
          <p className="reveal" style={{fontSize:14,color:T.textSecondary,lineHeight:1.75,marginBottom:20}}>SHA-256-gesichert, unveränderlich für 10 Jahre nach §147 AO archiviert. Vollständiger Audit-Trail für jede Transaktion.</p>
          <div className="reveal" style={{display:'flex',flexDirection:'column',gap:8}}>
            {['EN 16931 — Europäischer E-Rechnungsstandard','GoBD — Grundsätze ordnungsmäßiger Buchführung','§ 147 AO — 10 Jahre Aufbewahrungspflicht','DSGVO — Datenhaltung in AWS Frankfurt (EU)','SHA-256 — Kryptographische Integrität'].map(item=>(
              <div key={item} style={{display:'flex',gap:10,alignItems:'center',fontSize:13.5,color:T.textSecondary}}>
                <span style={{width:16,height:16,borderRadius:'50%',background:T.greenBg,border:`1px solid ${T.greenBdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.green,flexShrink:0,fontWeight:700}}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="reveal" style={{background:T.brand,borderRadius:8,padding:28,color:'#fff'}}>
          {[['Compliance Score','98%',T.green],['Archivierte Dok.','12.441','rgba(255,255,255,.85)'],['Ø Verarbeitungszeit','< 1.2s','rgba(255,255,255,.6)'],['Verfügbarkeit','99.98%','#86EFAC']].map(([l,v,c])=>(
            <div key={l} style={{padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
              <div style={{fontSize:10.5,color:'rgba(255,255,255,.4)',fontWeight:600,letterSpacing:.5,marginBottom:4,textTransform:'uppercase'}}>{l}</div>
              <div style={{fontSize:24,fontWeight:800,color:c,lineHeight:1,letterSpacing:'-.03em'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* PRICING */}
    <section id="preise" style={{padding:'88px clamp(16px,4vw,56px)',background:T.bgSubtle,borderTop:`1px solid ${T.bgBorder}`}}>
      <div style={{maxWidth:940,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <span className="reveal badge badge-gray" style={{marginBottom:14,fontSize:11}}>Preise</span>
          <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',fontWeight:700,color:T.textPrimary,letterSpacing:'-.03em'}}>Transparent.<br/>Kein usage-based Billing.</h2>
          <p className="reveal" style={{fontSize:14,color:T.textSecondary,marginTop:10}}>Fester Monatspreis — keine Überraschungen. Jederzeit kündbar.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(250px,100%),1fr))',gap:12}}>
          {[{name:'Starter',price:49,docs:'100 Dok./Monat',features:['XRechnung + ZUGFeRD','E-Mail-Versand','GoBD-Archiv','1 Nutzer'],featured:false},{name:'Business',price:199,docs:'1.000 Dok./Monat',features:['+ Peppol BIS 3.0','+ Inbound-Empfang','+ 5 Konnektoren','5 Nutzer'],featured:true},{name:'Pro',price:599,docs:'10.000 Dok./Monat',features:['+ Alle Konnektoren','+ Public REST API','+ Webhooks','15 Nutzer'],featured:false}].map((p,i)=>{
            const bg=p.featured?T.brand:T.bg;
            const bd=p.featured?T.brand:T.bgBorder;
            return(
            <div key={i} className="pricing-card reveal" style={{transitionDelay:`${i*.1}s`,position:'relative',background:bg,borderColor:bd}}>
              {p.featured&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:T.accent,color:'#fff',fontSize:10.5,fontWeight:700,padding:'3px 14px',borderRadius:10,letterSpacing:.4,whiteSpace:'nowrap',zIndex:2}}>EMPFOHLEN</div>}
              <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:p.featured?'rgba(255,255,255,.5)':T.textMuted}}>{p.name}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:3,marginBottom:3}}>
                <span style={{fontFamily:F.ui,fontSize:44,fontWeight:800,lineHeight:1,color:p.featured?'#fff':T.textPrimary,letterSpacing:'-.04em'}}>{p.price}</span>
                <span style={{fontSize:13.5,color:p.featured?'rgba(255,255,255,.4)':T.textMuted}}>€/Mo</span>
              </div>
              <div style={{fontSize:12,color:p.featured?'rgba(255,255,255,.4)':T.textMuted,marginBottom:18}}>{p.docs}</div>
              <div style={{height:1,background:p.featured?'rgba(255,255,255,.1)':T.bgBorder,margin:'0 0 16px'}}/>
              {p.features.map((f,j)=>(
                <div key={j} style={{display:'flex',gap:7,marginBottom:8,fontSize:13.5,color:j===0?(p.featured?'#fff':T.textPrimary):(p.featured?'rgba(255,255,255,.55)':T.textSecondary),alignItems:'center'}}>
                  <span style={{fontSize:10,color:p.featured?'rgba(255,255,255,.35)':'#635BFF',flexShrink:0,fontWeight:700}}>✓</span>{f}
                </div>
              ))}
              <button onClick={onEnter} style={{marginTop:16,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',background:p.featured?'rgba(255,255,255,.12)':'transparent',color:p.featured?'#fff':'#635BFF',border:p.featured?'1px solid rgba(255,255,255,.2)':`1px solid ${T.accentPale}`,padding:'9px',fontSize:13,fontWeight:600,borderRadius:6,cursor:'pointer',fontFamily:F.ui,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.background=p.featured?'rgba(255,255,255,.18)':T.accentLight;}} onMouseLeave={e=>{e.currentTarget.style.background=p.featured?'rgba(255,255,255,.12)':'transparent';}}>{p.featured?'Jetzt starten →':'Kostenlos testen'}</button>
            </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{background:T.brand,padding:'72px clamp(16px,4vw,56px)',textAlign:'center'}}>
      <span className="reveal badge" style={{background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.6)',borderColor:'rgba(255,255,255,.12)',marginBottom:14,fontSize:11}}>E-Rechnungspflicht 2027</span>
      <h2 className="reveal" style={{fontFamily:F.ui,fontSize:'clamp(26px,3.5vw,44px)',color:'#fff',fontWeight:800,letterSpacing:'-.04em',marginBottom:10}}>Bereit vor dem Stichtag.</h2>
      <p className="reveal" style={{color:'rgba(255,255,255,.45)',fontSize:15,marginBottom:28}}>In 48 Stunden gesetzeskonform — für jedes ERP-System.</p>
      <button className="reveal btn btn-xl" onClick={onEnter} style={{background:'#fff',color:T.brand,border:'none',fontWeight:700}}>Kostenlos starten →</button>
    </section>

    {/* FOOTER */}
    <footer style={{background:T.bg,borderTop:`1px solid ${T.bgBorder}`,padding:'24px clamp(16px,4vw,56px)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <Wordmark size={18}/>
      <div style={{fontSize:12,color:T.textMuted}}>© 2025 invoiq · invoiq.io · EN 16931 · GoBD · DSGVO</div>
      <div style={{display:'flex',gap:16}}>
        {['Impressum','Datenschutz','AGB'].map(l=><a key={l} href="#" style={{fontSize:12,color:T.textMuted,textDecoration:'none'}} onMouseEnter={e=>e.target.style.color=T.textPrimary} onMouseLeave={e=>e.target.style.color=T.textMuted}>{l}</a>)}
      </div>
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
  const items=[{key:"dashboard",icon:"·",label:"Overview"},{key:"invoices",icon:"·",label:"Documents"},{key:"connect",icon:"·",label:"Connectors"},{key:"archive",icon:"·",label:"Archive"},{key:"webhooks",icon:"·",label:"Webhooks"},{key:"settings",icon:"·",label:"Settings"}];
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
        <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:"-.025em"}}>Good morning{user?.full_name?`, ${user.full_name.split(" ")[0]}`:""}.</h1>
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

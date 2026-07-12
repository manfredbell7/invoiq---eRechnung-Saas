import { useState, useEffect, useCallback, useRef, Component } from "react";
import OnboardingWizard from "./OnboardingWizard.jsx";
import { T, F, CSS } from "./theme.js"; class PortalErrorBoundary extends Component{constructor(p){super(p);this.state={err:false};}static getDerivedStateFromError(){return{err:true};}componentDidCatch(e,i){console.error('Portal crash:',e,i);}render(){if(this.state.err)return(<div style={{padding:40,textAlign:'center',color:'#697386'}}><div style={{fontSize:40}}>⚠️</div><h3 style={{color:'#0A2540',marginTop:8}}>Kanzlei-Portal nicht verfügbar</h3><p>Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu.</p><button onClick={()=>this.setState({err:false})} style={{marginTop:16,padding:'10px 20px',background:'#635BFF',color:'#fff',border:'none',borderRadius:8,cursor:'pointer'}}>Erneut versuchen</button></div>);return this.props.children;}}

/* ═══════════════════════════════════════════════════════════════
   invoiq — Complete App · Design System v2
   Inspired by: Linear, Stripe, Notion, Lattice
   Palette: Deep Navy · Pure White · Slate grays · Electric Blue
   Fonts: Instrument Serif + Inter
   ═══════════════════════════════════════════════════════════════ */




const API_BASE=(import.meta?.env?.VITE_API_URL)||"https://api.invoiq.io/v1";
const api={
  _token:(typeof localStorage!=='undefined'&&localStorage.getItem("invoiq_token"))||null,
  setToken(t){this._token=t;if(typeof localStorage!=='undefined'){if(t)localStorage.setItem("invoiq_token",t);else localStorage.removeItem("invoiq_token");}},
  async req(method,path,body){
    const headers={"Content-Type":"application/json"};
    if(this._token)headers["Authorization"]=`Bearer ${this._token}`;
    try{const res=await fetch(`${API_BASE}${path}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data;}
    catch(err){if(err.message.includes("fetch"))throw new Error("");throw err;}
  },
  get:(p)=>api.req("GET",p),post:(p,b)=>api.req("POST",p,b),patch:(p,b)=>api.req("PATCH",p,b),
  login:(b)=>api.post("/auth/login",b),register:(b)=>api.post("/auth/register",b),
  me:()=>api.get("/auth/me"),logout:()=>api.post("/auth/logout",{}),
  getStats:()=>api.get("/invoices/stats"),listInvoices:(q="")=>api.get(`/invoices${q}`),
  createInvoice:(b)=>api.post("/invoices",b),sendInvoice:(id,b)=>api.post(`/invoices/${id}/send`,b),
  getXML:(id)=>fetch(`${API_BASE}/invoices/${id}/xml`,{headers:{Authorization:`Bearer ${api._token}`}}).then(r=>r.text()),
  getPDFUrl:(id)=>`${API_BASE}/invoices/${id}/pdf`,
  openPDF:(id)=>fetch(`${API_BASE}/invoices/${id}/pdf`,{headers:{Authorization:`Bearer ${api._token}`}}).then(r=>r.blob()).then(b=>{const u=URL.createObjectURL(b);window.open(u,'_blank');}),
  // E-Mail Ausgang
  sendInvoiceEmail:(id,recipient_email,message,sender_copy=false)=>api.post(`/invoices/${id}/send-email`,{recipient_email,message,sender_copy}),
  // Peppol
  sendViaPeppol:(id,peppol_id)=>api.post(`/invoices/${id}/send-peppol`,{peppol_id}),
  lookupPeppol:(peppol_id)=>api.get(`/invoices/peppol/lookup?peppol_id=${encodeURIComponent(peppol_id)}`),
  // Authentifizierter Datei-Download (Backend akzeptiert nur den
  // Authorization-Header — window.open mit ?token= lief immer auf 401).
  async downloadFile(path,filename){
    const res=await fetch(`${API_BASE}${path}`,{headers:{Authorization:`Bearer ${api._token}`}});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`Download fehlgeschlagen (${res.status})`);}
    const blob=await res.blob();
    const cd=res.headers.get('content-disposition')||'';
    const name=filename||(cd.match(/filename="?([^";]+)"?/)?.[1])||'download';
    const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(u),5000);
  },
  // KI-Berater (AI Core)
  aiChat:(messages)=>api.post('/ai/chat',{messages}),
  aiExecute:(type,payload)=>api.post('/ai/execute-action',{type,payload}),
  aiInsights:()=>api.get('/ai/insights'),
  aiReview:(id)=>api.post(`/ai/review/${id}`,{}),
  // DATEV Export
  datevExport:()=>api.downloadFile('/invoices/datev-export'),
  datevExportInbound:(orgId,from,to)=>api.downloadFile(`/inbound/datev-export?from=${from||''}&to=${to||''}`),
  // Inbound
  listInbound:(params='')=>api.get(`/inbound${params}`),
  openInboundPDF:(id)=>fetch(`${API_BASE}/inbound/${id}/pdf`,{headers:{Authorization:`Bearer ${api._token}`}}).then(r=>{if(!r.ok)throw new Error(`PDF konnte nicht geladen werden (${r.status})`);return r.blob();}).then(b=>{const u=URL.createObjectURL(b);window.open(u,'_blank');}),
  markInboundPaid:(id)=>api.post(`/inbound/${id}/mark-paid`,{}),
  forwardInbound:(id,email)=>api.post(`/inbound/${id}/forward`,{recipient_email:email}),
  downloadSepa:(id,discount=false)=>api.downloadFile(`/inbound/${id}/sepa-pain001?discount=${discount}`),
  checkDiscount:(id)=>api.get(`/inbound/${id}/discount-check`),
  getInboundDetail:(id)=>api.get(`/inbound/${id}/detail`),
  patchInbound:(id,fields)=>api.patch(`/inbound/${id}`,fields),
  reviewInbound:(id,decision)=>api.post(`/inbound/${id}/review`,{decision}),
  getQualityStats:()=>api.get('/inbound/quality-stats'),
  // Einstellungen
  saveSettings:(b)=>api.post('/auth/settings',b),
  getOrgSettings:()=>api.get('/auth/settings'),
  // Kundenstammdaten
  listCustomers:(search='')=>api.get(`/customers${search?`?search=${encodeURIComponent(search)}`:''}`),
  // Belegfluss (SAP-nah): Anfrage/Angebot/Auftrag/Lieferung
  listBusinessDocs:(q='')=>api.get(`/business/documents${q}`),
  getBusinessDoc:(id)=>api.get(`/business/documents/${id}`),
  createBusinessDoc:(b)=>api.post('/business/documents',b),
  setBusinessDocStatus:(id,status)=>api.req('PATCH',`/business/documents/${id}/status`,{status}),
  convertBusinessDoc:(id,target_type)=>api.post(`/business/documents/${id}/convert`,{target_type}),
  // Artikel/Leistungen
  listBusinessItems:(search='')=>api.get(`/business/items${search?`?search=${encodeURIComponent(search)}`:''}`),
  createBusinessItem:(b)=>api.post('/business/items',b),
  patchBusinessItem:(id,b)=>api.req('PATCH',`/business/items/${id}`,b),
  deleteBusinessItem:(id)=>api.req('DELETE',`/business/items/${id}`),
  getTaxCodes:()=>api.get('/business/tax-codes'),
  // Cashflow & Stats
  getCashflowStats:()=>api.get('/invoices/cashflow-stats'),
  getInboundStats:()=>api.get('/inbound/stats'),
  // Payments
  createCheckout:(plan,billing='monthly')=>api.post('/payments/checkout',{plan,billing}),
  openBillingPortal:()=>api.post('/payments/portal',{}),
  getPlans:()=>api.get('/payments/plans'),
};

const fmtEUR=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
const fmtNum=n=>new Intl.NumberFormat("de-DE").format(n||0);
const fmtAgo=d=>{const s=Date.now()-new Date(d);if(s<3600000)return`vor ${Math.floor(s/60000)} Min.`;if(s<86400000)return`vor ${Math.floor(s/3600000)} Std.`;return"gestern";};



function Wordmark({size=22,inverted=false,iconOnly=false}){
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
    {!iconOnly&&<span style={{fontFamily:F.ui,fontSize:size*.9,fontWeight:400,color:c,letterSpacing:"-.02em"}}>inv<span style={{color:a}}>o</span>iq</span>}
  </div>);
}

function StatusBadge({status}){
  const m={delivered:["badge-green","Zugestellt"],validated:["badge-blue","Validiert"],sent:["badge-blue","Gesendet"],error:["badge-red","Fehler"],pending:["badge-amber","Ausstehend"],archived:["badge-gray","Archiviert"],draft:["badge-gray","Entwurf"],paid:["badge-green","Bezahlt"],overdue:["badge-red","Überfällig"],cancelled:["badge-red","Storniert"],active:["badge-green","Aktiv"],trial:["badge-purple","Trial"],suspended:["badge-red","Gesperrt"],free:["badge-gray","Free"],starter:["badge-gray","Starter"],business:["badge-blue","Business"],enterprise:["badge-purple","Enterprise"],pro:["badge-amber","Pro"],super_admin:["badge-red","Super Admin"],owner:["badge-gray","Owner"],admin:["badge-blue","Admin"],member:["badge-gray","Member"],
  // Belegfluss-Status (SAP-nah)
  offen:["badge-amber","Offen"],beantwortet:["badge-blue","Beantwortet"],entwurf:["badge-gray","Entwurf"],gesendet:["badge-blue","Gesendet"],angenommen:["badge-green","Angenommen"],abgelehnt:["badge-red","Abgelehnt"],abgelaufen:["badge-gray","Abgelaufen"],bestaetigt:["badge-blue","Bestätigt"],geliefert:["badge-purple","Geliefert"],fakturiert:["badge-green","Fakturiert"],storniert:["badge-red","Storniert"]};
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

// ── Zentrale Zustands-Komponenten ─────────────────────────────
// Alert: fachliche Hinweise/Fehler (severity: error | warning | info | success)
function Alert({severity="info",children,style}){
  const s={
    error:  [T.red,  T.redBg,  T.redBdr,  "✗"],
    warning:[T.amber,T.amberBg,T.amberBdr,"⚠"],
    success:[T.green,T.greenBg,T.greenBdr,"✓"],
    info:   [T.accent,T.accentLight,T.accentPale,"i"],
  }[severity]||[T.accent,T.accentLight,T.accentPale,"i"];
  return(
    <div role="alert" style={{padding:"10px 13px",borderRadius:8,fontSize:12.5,display:"flex",gap:9,alignItems:"flex-start",background:s[1],border:`1px solid ${s[2]}`,color:s[0],lineHeight:1.55,...style}}>
      <span style={{flexShrink:0,fontWeight:700}}>{s[3]}</span><div style={{flex:1}}>{children}</div>
    </div>
  );
}

// EmptyState: Leerer Zustand mit Icon, Erklärung und Primäraktion
function EmptyState({icon="📄",title,text,cta,onCta}){
  return(
    <div style={{textAlign:"center",padding:"52px 24px",color:T.textMuted}}>
      <div style={{width:56,height:56,borderRadius:14,background:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>{icon}</div>
      <div style={{fontSize:16,fontWeight:600,color:T.textPrimary,marginBottom:8}}>{title}</div>
      {text&&<div style={{fontSize:13.5,marginBottom:cta?18:0,maxWidth:420,margin:cta?"0 auto 18px":"0 auto"}}>{text}</div>}
      {cta&&<button className="btn btn-primary" onClick={onCta}>{cta}</button>}
    </div>
  );
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
  const integrations=['DATEV','Lexware','lexoffice','sevDesk','SAP S/4HANA','SAP ECC','Weclapp','MS Dynamics 365','Odoo','REST API','Xero','QuickBooks'];

  const stBadge=(s)=>{
    const m={delivered:[T.green,'#ECFDF5','#A7F3D0','Delivered'],validated:[T.accent,'#EEF2FF','#C7D2FE','Validated'],error:[T.red,'#FEF2F2','#FECACA','Error'],pending:[T.amber,'#FFFBEB','#FDE68A','Pending']};
    const[c,bg,bd,lbl]=m[s]||[T.textMuted,T.bgMuted,T.bgBorder,s];
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:bg,color:c,border:`1px solid ${bd}`}}>{lbl}</span>;
  };

  const heroTabs=[
    {label:'Overview',content:(
      <div style={{padding:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:8,marginBottom:12}}>
          {[['41','Versendet','▲ +8%',T.green],['28','Empfangen','Diese Woche',T.accent],['1','Fehler','Prüfen',T.red],['98%','Compliance','EN 16931',T.green]].map(([v,l,s,c])=>(
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
    {n:1,title:'E-Mail-Adresse einrichten',desc:'In 2 Minuten startklar. Deine persönliche invoiq-Adresse empfängt automatisch alle Eingangsrechnungen — kein ERP, kein IT-Aufwand.',tags:['firma@rechnungen.invoiq.io','XRechnung','ZUGFeRD','PDF'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        {[['firma@rechnungen.invoiq.io','Aktiv ✓'],['XRechnung','Automatisch erkannt'],['ZUGFeRD / PDF','Automatisch erkannt']].map(([n,s],i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<2?`1px solid ${T.bgBorder}`:'none'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:s==='Connected'?T.green:T.bgBorder,flexShrink:0}}/>
            <span style={{fontSize:12.5,color:T.textPrimary,flex:1}}>{n}</span>
            <span style={{fontSize:11,fontWeight:600,color:s==='Connected'?T.green:T.accent}}>{s}</span>
          </div>
        ))}
      </div>
    )},
    {n:2,title:'Rechnung erstellen oder empfangen',desc:'Ausgang: Rechnungsdaten eingeben oder PDF/Foto hochladen → invoiq generiert konforme XRechnung und versendet per E-Mail. Eingang: Lieferant schickt Rechnung an deine invoiq-Adresse → automatisch geparst, validiert, gespeichert.',tags:['Outbound XRechnung','Inbound Parsing','Peppol Empfang','PDF-Konvertierung'],preview:(
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
    {n:4,title:'DATEV-Export & Weiterleitung',desc:'Eingangsrechnungen mit einem Klick als DATEV-CSV exportieren oder per E-Mail an deinen Steuerberater weiterleiten. Kein manuelles Abtippen mehr.',tags:['DATEV-CSV Export','E-Mail Weiterleitung','1-Klick','Steuerberater-ready'],preview:(
      <div style={{marginTop:12,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:'12px 14px'}}>
        {[['Rechnung empfangen','XRechnung automatisch geparst',T.green],['Validiert','EN 16931 ✓ · Pflichtfelder OK',T.green],['DATEV-Export','CSV für Steuerberater bereit',T.accent],['Weitergeleitet','Per E-Mail an Kanzlei gesendet',T.green]].map(([s,d,c],i)=>(
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
      name:'Starter',price:29,yearlyPrice:25,docs:'100 Dok./Monat',
      sub:'Pro Monat, jederzeit kündbar',
      badge:null,
      features:['XRechnung + ZUGFeRD','Inbound-Empfang + Parsing','E-Mail-Versand','GoBD-Archiv','API Basic'],
      cta:'14 Tage gratis testen',ctaStyle:'outline',
    },
    {
      name:'Business',price:99,yearlyPrice:85,docs:'500 Dok./Monat',
      sub:'Pro Monat, jederzeit kündbar',
      badge:'EMPFOHLEN',
      features:['Alles in Starter','Peppol BIS 3.0 Versand','KI-Rechnungserkennung (Scanner)','DATEV-Export inklusive','Kanzlei-Portal Zugang','ViDA-Reporting ready'],
      cta:'Jetzt starten',ctaStyle:'primary',
    },
    {
      name:'Enterprise',price:299,yearlyPrice:250,docs:'Unbegrenzt',
      sub:'Pro Monat, jederzeit kündbar',
      badge:null,
      features:['Alles in Business','Multi-Mandanten','Public REST API + Webhooks','GoBD-Archiv 10 Jahre','Account Manager','SLA & Telefon-Support'],
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
        <button className="btn btn-ghost btn-sm" onClick={()=>onEnter('login')}>Anmelden</button>
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
          <h1 className="fu2" style={{fontFamily:F.ui,fontSize:'clamp(34px,4.8vw,60px)',fontWeight:800,color:T.textPrimary,lineHeight:1.02,letterSpacing:'-.045em',marginBottom:18}}>
            E-Rechnungen.<br/>Empfangen. Senden.<br/><span style={{color:T.accent}}>Automatisch.</span>
          </h1>
          <p className="fu3" style={{fontSize:16,color:T.textSecondary,lineHeight:1.7,marginBottom:10,maxWidth:'52ch'}}>
            Seit <strong>Januar 2025</strong> müssen alle Unternehmen E-Rechnungen empfangen können. Ab <strong>2027</strong> auch versenden.
          </p>
          <p className="fu3" style={{fontSize:14,color:T.textMuted,lineHeight:1.65,marginBottom:32,maxWidth:440}}>
            invoiq deckt beides — E-Rechnungen empfangen, erstellen und per E-Mail versenden. Einfach, compliant, ohne IT-Aufwand.
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
                {[['Übersicht',0],['Ausgang',1],['Scan & Import',2],['Eingang',3],['Archiv',4],['Einstellungen',5],['Kanzlei-Portal',6]].map(([label,idx])=>(
                  <div key={label} onClick={()=>setHeroTab(idx)} style={{padding:'5px 7px',borderRadius:5,fontSize:10.5,fontWeight:heroTab===idx?700:400,color:heroTab===idx?T.textPrimary:T.textMuted,background:heroTab===idx?T.bgMuted:'transparent',cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>{label}</div>
                ))}
              </div>
              {/* Content */}
              <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <div style={{height:36,borderBottom:`1px solid ${T.bgBorder}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',flexShrink:0}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:T.textPrimary}}>{['Übersicht','Ausgang','Scan & Import','Eingang','Archiv','Einstellungen','Kanzlei-Portal'][heroTab]}</span>
                  <div style={{width:7,height:7,borderRadius:'50%',background:T.green,animation:'pulse 2s ease-in-out infinite'}}/>
                </div>
                <div style={{flex:1,overflow:'hidden'}}>
                  {heroTab===0&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:7,marginBottom:10}}>
                      {[['41','Versendet','▲ +8%',T.green],['28','Empfangen','Diese Woche',T.accent],['1','Fehler','Prüfen',T.red],['98%','Compliance','EN 16931',T.green]].map(([v,l,s,c])=>(
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
                  {heroTab===4&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
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
                  {heroTab===5&&<div style={{padding:14,animation:'fadeIn .3s ease'}}>
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
          {heroTab===6&&<div style={{padding:14,animation:'fadeIn .3s ease',textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>🏛️</div><div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:8}}>Kanzlei-Portal</div><div style={{fontSize:10.5,color:T.textMuted}}>Alle Mandanten zentral verwalten — enthalten ab dem Business-Plan.</div></div>}{/* Floating notification */}
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

    {/* INTEGRATIONS MARQUEE — coming soon */}
    <section style={{padding:'48px 0',borderTop:`1px solid rgba(99,91,255,.12)`,borderBottom:`1px solid rgba(99,91,255,.12)`,background:'#07102A',overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(99,91,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(99,91,255,.07) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>
      {/* Coming Soon Badge */}
      <div style={{position:'absolute',top:12,right:20,zIndex:10,background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',borderRadius:6,padding:'4px 12px',fontSize:11,fontWeight:700,color:'#f59e0b',letterSpacing:.5}}>⚙ ERP-Konnektoren — In Entwicklung</div>
      <p style={{fontSize:10.5,fontWeight:700,color:'rgba(255,255,255,.3)',letterSpacing:1.4,textTransform:'uppercase',marginBottom:24,textAlign:'center',position:'relative'}}>Kompatibel mit führenden ERP-Systemen <span style={{fontSize:10,color:'#f59e0b',marginLeft:6}}>— demnächst verfügbar</span></p>
      <div className="marquee-wrap" style={{position:'relative'}}>
        <div className="marquee-track">
          {[...integrations,...integrations].map((n,i)=>(
            <div key={i} className="integration-logo" style={{color:'rgba(255,255,255,.6)',background:'rgba(255,255,255,.05)',borderColor:'rgba(255,255,255,.1)',padding:'10px 20px',fontSize:13.5,fontWeight:600,minWidth:160,justifyContent:'center',gap:10,borderRadius:10}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'rgba(99,91,255,.6)',display:'inline-block',flexShrink:0}}/>
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
              {icon:'📊',step:'DATEV-Export bereit',detail:'CSV für Steuerberater · 1-Klick',status:'done',time:'09:14:04'},
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
        <div className="bento-grid">
          {/* Bento 1 — WIDE: KI-Scanner mit Live-Typewriter-Demo */}
          <div className="bento-card bento-wide reveal" style={{transitionDelay:'0s'}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.purple+'15',color:T.purple,border:`1px solid ${T.purple}30`}}>Neu</span>
            <h3 style={{fontWeight:700,fontSize:17,color:T.textPrimary,margin:'14px 0 7px',letterSpacing:'-.02em'}}>KI-Rechnungserkennung</h3>
            <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65,maxWidth:'52ch'}}>Foto oder PDF hochladen — invoiq extrahiert alle Felder automatisch und erzeugt eine konforme XRechnung. Ohne Abtippen.</p>
            <div style={{marginTop:18,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
              <span className="live-dot" style={{background:T.purple}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontFamily:F.mono,color:T.textSecondary,marginBottom:6}}>rechnung_scan_0472.pdf wird analysiert…</div>
                <div className="shimmer-bar" style={{height:6,borderRadius:3,width:'72%'}}/>
              </div>
              <span style={{fontSize:10.5,fontWeight:700,color:T.green,fontFamily:F.mono}}>14 Felder ✓</span>
            </div>
          </div>
          {/* Bento 2 — Inbound mit Pulse */}
          <div className="bento-card reveal" style={{transitionDelay:'.07s'}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.green+'15',color:T.green,border:`1px solid ${T.green}30`}}>Pflicht seit 2025</span>
            <h3 style={{fontWeight:700,fontSize:15.5,color:T.textPrimary,margin:'14px 0 7px',letterSpacing:'-.02em'}}>Eingang in jedem Tarif</h3>
            <p style={{fontSize:13,color:T.textSecondary,lineHeight:1.6}}>Empfang, Parsing und Validierung eingehender E-Rechnungen — auch im Free-Plan.</p>
            <div style={{marginTop:16,display:'flex',alignItems:'center',gap:8}}>
              <span className="live-dot" style={{background:T.green}}/>
              <span style={{fontSize:11,fontFamily:F.mono,color:T.textMuted}}>Empfangsbereit</span>
            </div>
          </div>
          {/* Bento 3 — Kanzlei */}
          <div className="bento-card reveal" style={{transitionDelay:'.14s'}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.accent+'15',color:T.accent,border:`1px solid ${T.accent}30`}}>Business-Plan</span>
            <h3 style={{fontWeight:700,fontSize:15.5,color:T.textPrimary,margin:'14px 0 7px',letterSpacing:'-.02em'}}>Kanzlei-Portal</h3>
            <p style={{fontSize:13,color:T.textSecondary,lineHeight:1.6}}>Ein Login, alle Mandanten — zentral verwalten und als DATEV-Export weitergeben.</p>
          </div>
          {/* Bento 4 */}
          <div className="bento-card reveal" style={{transitionDelay:'.21s'}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.amber+'15',color:T.amber,border:`1px solid ${T.amber}30`}}>2028 ready</span>
            <h3 style={{fontWeight:700,fontSize:15.5,color:T.textPrimary,margin:'14px 0 7px',letterSpacing:'-.02em'}}>ViDA Reporting</h3>
            <p style={{fontSize:13,color:T.textSecondary,lineHeight:1.6}}>Die EU-Meldepflicht kommt 2028 — invoiq baut die Schnittstellen jetzt schon mit ein.</p>
          </div>
          {/* Bento 5 — WIDE: GoBD-Archiv mit Daten-Strip */}
          <div className="bento-card bento-wide reveal" style={{transitionDelay:'.28s'}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:T.blue+'15',color:T.blue,border:`1px solid ${T.blue}30`}}>Rechtssicher</span>
            <h3 style={{fontWeight:700,fontSize:17,color:T.textPrimary,margin:'14px 0 7px',letterSpacing:'-.02em'}}>GoBD-Archiv — 10 Jahre, unveränderbar</h3>
            <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.65,maxWidth:'52ch'}}>Jedes Dokument wird mit SHA-256 versiegelt und revisionssicher archiviert. Prüfbar per Klick.</p>
            <div style={{marginTop:16,display:'flex',gap:0,borderTop:`1px solid ${T.bgBorder}`}}>
              {[['10 Jahre','Aufbewahrung'],['SHA-256','Hash-Siegel'],['EN 16931','Validierung'],['DSGVO','EU-Hosting']].map(([v,l],i)=>(
                <div key={l} style={{flex:1,padding:'12px 0 0',borderLeft:i>0?`1px solid ${T.bgBorder}`:'none',paddingLeft:i>0?16:0}}>
                  <div style={{fontSize:14,fontWeight:800,fontFamily:F.mono,color:T.textPrimary,letterSpacing:'-.02em'}}>{v}</div>
                  <div style={{fontSize:10.5,color:T.textMuted,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
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
        <div className="zg-grid">
          {[
            {num:'01',target:'Einzelunternehmer & KMU',sub:'Handwerker · Freelancer · kleine Firmen · ohne IT-Aufwand',points:['XRechnung per E-Mail empfangen & senden','Foto/PDF → XRechnung per KI-Scanner','GoBD-Archivierung automatisch','Kein ERP · kein IT-Wissen nötig'],cta:'Kostenlos starten →',color:T.accent},
            {num:'02',target:'Steuerberater & Kanzleien',sub:'Ein Portal · alle Mandanten · zentrale E-Rechnungs-Verwaltung',points:['Kanzlei-Portal: alle Mandanten auf einen Blick','Eingangsrechnungen pro Mandant empfangen','DATEV-Export für jeden Mandanten','Dokumenten-Archiv GoBD-konform'],cta:'Kanzlei-Portal testen →',color:T.purple},
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:10,marginBottom:20}}>
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
                <button onClick={()=>onEnter(p.name.toLowerCase())} style={{marginTop:16,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',gap:5,background:isFeatured?'rgba(255,255,255,.12)':'transparent',color:isFeatured?'#fff':'#635BFF',border:isFeatured?'1px solid rgba(255,255,255,.2)':`1px solid ${T.accentPale}`,padding:'9px',fontSize:12.5,fontWeight:600,borderRadius:6,cursor:'pointer',fontFamily:F.ui,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.opacity='.8';}} onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}>
                  {p.cta} →
                </button>
              </div>
            );
          })}
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
function Auth({mode,onSwitch,onSuccess,loading,notify}){
  // Registrierung bewusst schlank gehalten: Name, Firma, E-Mail, Passwort, Adresse.
  // IBAN/SEPA und ERP-Anbindung werden NICHT mehr bei der Registrierung verlangt —
  // diese können später im Onboarding-Wizard (überspringbar) oder in den
  // Einstellungen ergänzt werden.
  const[form,setForm]=useState({email:"",password:"",full_name:"",org_name:"",address:"",zip:"",city:"",country:"DE"});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const[forgot,setForgot]=useState(false);
  const[forgotSent,setForgotSent]=useState(false);
  const[forgotBusy,setForgotBusy]=useState(false);

  const requestReset=async()=>{
    if(!form.email){notify?.("Bitte E-Mail-Adresse eingeben","error");return;}
    setForgotBusy(true);
    try{await api.post('/auth/forgot-password',{email:form.email});setForgotSent(true);}
    catch(e){notify?.(e.message||'Anfrage fehlgeschlagen','error');}
    setForgotBusy(false);
  };

  if(forgot)return(<div style={{minHeight:"100vh",background:T.bgSubtle,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{width:"100%",maxWidth:400}}>
      <div style={{textAlign:"center",marginBottom:28}}><Wordmark size={24}/></div>
      <div className="card sci" style={{padding:30,boxShadow:T.shadow3}}>
        <h2 style={{fontFamily:F.ui,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:5,letterSpacing:"-.02em"}}>Passwort vergessen?</h2>
        {forgotSent?(
          <>
            <p style={{fontSize:13.5,color:T.textSecondary,lineHeight:1.6,marginBottom:20}}>Falls ein Konto mit <strong>{form.email}</strong> existiert, haben wir einen Reset-Link gesendet. Der Link ist 1 Stunde gültig — bitte auch den Spam-Ordner prüfen.</p>
            <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setForgot(false);setForgotSent(false);}}>← Zurück zur Anmeldung</button>
          </>
        ):(
          <>
            <p style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Wir senden Ihnen einen Link zum Zurücksetzen.</p>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&requestReset()} autoFocus/></div>
              <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={requestReset} disabled={forgotBusy}>{forgotBusy?<><Spinner color="#fff"/>&nbsp;Sendet...</>:"Reset-Link senden →"}</button>
              <button onClick={()=>setForgot(false)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13,fontFamily:F.ui}}>← Zurück zur Anmeldung</button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>);

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
            <div><label className="label">Straße & Hausnummer</label><input className="input" value={form.address} onChange={e=>upd("address",e.target.value)} placeholder="Musterstraße 1"/></div>
            <div style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:10}}>
              <div><label className="label">PLZ</label><input className="input" value={form.zip} onChange={e=>upd("zip",e.target.value)} placeholder="80331"/></div>
              <div><label className="label">Stadt</label><input className="input" value={form.city} onChange={e=>upd("city",e.target.value)} placeholder="München"/></div>
            </div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:-4}}>IBAN und ERP-Anbindung können Sie später im Setup oder in den Einstellungen ergänzen.</div>
          </>}
          <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)}/></div>
          <div><label className="label">Passwort</label><input className="input" type="password" value={form.password} onChange={e=>upd("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSuccess(form)}/></div>
          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:4,padding:"11px"}} onClick={()=>onSuccess(form)} disabled={loading}>{loading?<><Spinner color="#fff"/>&nbsp;Bitte warten...</>:mode==="login"?"Anmelden →":"Konto erstellen →"}</button>
          <button onClick={onSwitch} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13,fontFamily:F.ui}}>{mode==="login"?"Noch kein Konto? Registrieren →":"Bereits registriert? Anmelden →"}</button>
          {mode==="login"&&<button onClick={()=>setForgot(true)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:12.5,fontFamily:F.ui}}>Passwort vergessen?</button>}
        </div>
      </div>
    </div>
  </div>);
}

// ── RESET PASSWORD (via /reset-password?token=...) ────────────
function ResetPassword({onDone,notify}){
  const token=new URLSearchParams(window.location.search).get('token')||'';
  const[pw,setPw]=useState('');
  const[pw2,setPw2]=useState('');
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);

  const submit=async()=>{
    if(pw.length<8){notify('Passwort muss mindestens 8 Zeichen haben','error');return;}
    if(pw!==pw2){notify('Passwörter stimmen nicht überein','error');return;}
    setBusy(true);
    try{
      await api.post('/auth/reset-password',{token,password:pw});
      setDone(true);
    }catch(e){notify(e.message||'Reset fehlgeschlagen','error');}
    setBusy(false);
  };

  return(<div style={{minHeight:"100vh",background:T.bgSubtle,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{width:"100%",maxWidth:400}}>
      <div style={{textAlign:"center",marginBottom:28}}><Wordmark size={24}/></div>
      <div className="card sci" style={{padding:30,boxShadow:T.shadow3}}>
        {done?(
          <>
            <h2 style={{fontFamily:F.ui,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:8}}>Passwort geändert ✓</h2>
            <p style={{fontSize:13.5,color:T.textSecondary,marginBottom:20}}>Sie können sich jetzt mit dem neuen Passwort anmelden.</p>
            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={onDone}>Zur Anmeldung →</button>
          </>
        ):!token?(
          <>
            <h2 style={{fontFamily:F.ui,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:8}}>Link ungültig</h2>
            <p style={{fontSize:13.5,color:T.textSecondary,marginBottom:20}}>Dieser Reset-Link ist unvollständig. Bitte fordern Sie über „Passwort vergessen?" einen neuen an.</p>
            <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center"}} onClick={onDone}>Zur Anmeldung →</button>
          </>
        ):(
          <>
            <h2 style={{fontFamily:F.ui,fontSize:22,fontWeight:400,color:T.textPrimary,marginBottom:5}}>Neues Passwort vergeben</h2>
            <p style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Mindestens 8 Zeichen.</p>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <div><label className="label">Neues Passwort</label><input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} autoFocus/></div>
              <div><label className="label">Passwort wiederholen</label><input className="input" type="password" value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
              <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={submit} disabled={busy}>{busy?<><Spinner color="#fff"/>&nbsp;Speichert...</>:"Passwort ändern →"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>);
}

// ── APP SHELL ─────────────────────────────────────────────────
// Icon-Set der Navigation — schlanke 15px-Stroke-Icons, erben currentColor
const NAV_ICONS={
  dashboard:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  invoices:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2.5h7l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M10 2.5v3h3M5 9h6M5 11.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  inbound:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 9.5l2-6h8l2 6v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2 9.5h3.5a2.5 2.5 0 005 0H14" stroke="currentColor" strokeWidth="1.4"/></svg>,
  scanner:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M5.5 3.5L6.5 2h3l1 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  archive:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M3 6v6.5a1 1 0 001 1h8a1 1 0 001-1V6M6.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  belege:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="3.5" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/><circle cx="12.5" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/><circle cx="12.5" cy="12.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M5.2 7.2l5.5-2.9M5.2 8.8l5.5 2.9" stroke="currentColor" strokeWidth="1.4"/></svg>,
  artikel:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l5.5 3v6.4l-5.5 3-5.5-3V4.8l5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2.7 4.9L8 7.8l5.3-2.9M8 7.8v6.2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  kunden:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="5.8" cy="5.4" r="2.4" stroke="currentColor" strokeWidth="1.4"/><path d="M1.8 13.4c.5-2.3 2.1-3.6 4-3.6s3.5 1.3 4 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11.6" cy="6.2" r="1.9" stroke="currentColor" strokeWidth="1.4"/><path d="M11.2 10.4c1.7.1 2.8 1.2 3.2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  settings:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  steuerberater:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="8.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 5V3.5a1 1 0 011-1h3a1 1 0 011 1V5M2 8.5h12" stroke="currentColor" strokeWidth="1.4"/></svg>,
  ki:<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.4 3.6a2 2 0 001.2 1.2L14.2 7.7a.35.35 0 010 .66l-3.6 1.4a2 2 0 00-1.2 1.2L8 14.5a.35.35 0 01-.66 0L6 10.96a2 2 0 00-1.2-1.2L1.14 8.36a.35.35 0 010-.66L4.8 6.3A2 2 0 006 5.1L7.34 1.5a.35.35 0 01.66 0z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><circle cx="13" cy="2.8" r="1.1" fill="currentColor"/></svg>,
};

function AppShell({user,org,nav,setNav,onLogout,onAdmin,onSearch,children}){
  // Kanzlei-Portal ab Business-Plan (siehe Pricing: Business/Pro/Enterprise enthalten es)
  const plan = (org?.plan||'free').toLowerCase();
  const hasKanzlei = plan === 'business' || plan === 'enterprise' || plan === 'pro';
  const [mobileNav,setMobileNav]=useState(false);
  const [collapsed,setCollapsed]=useState(()=>typeof localStorage!=="undefined"&&localStorage.getItem("invoiq_sidebar_collapsed")==="1");
  const [userMenu,setUserMenu]=useState(false);
  const [searchQ,setSearchQ]=useState("");
  const go=(key)=>{setNav(key);setMobileNav(false);};
  const toggleCollapse=()=>{setCollapsed(c=>{const n=!c;if(typeof localStorage!=="undefined")localStorage.setItem("invoiq_sidebar_collapsed",n?"1":"0");return n;});};

  const sections=[
    {title:"Rechnungen",items:[
      {key:"dashboard",   label:"Übersicht"},
      {key:"invoices",    label:"Ausgang"},
      {key:"inbound",     label:"Eingang"},
      {key:"scanner",     label:"Scan & Import"},
      {key:"archive",     label:"Archiv"},
    ]},
    {title:"Vertrieb",items:[
      {key:"belege",      label:"Belege & Aufträge"},
      {key:"artikel",     label:"Artikel & Leistungen"},
      {key:"kunden",      label:"Kunden"},
    ]},
    {title:"KI",items:[
      {key:"ki",          label:"KI-Berater"},
    ]},
  ];

  const pct=Math.min(100,((org?.plan_doc_used||0)/(org?.plan_doc_limit||100))*100);
  // Admin-Panel rollenbasiert (Backend prüft zusätzlich serverseitig)
  const isAdmin=["owner","admin","super_admin"].includes(user?.role);

  const NavBtn=({k,label})=>(
    <button className={`nav-item ${nav===k?"active":""}`} onClick={()=>go(k)} title={collapsed?label:undefined}>
      {NAV_ICONS[k]||NAV_ICONS.dashboard}<span className="nav-label">{label}</span>
      {k==="steuerberater"&&!hasKanzlei&&<span className="nav-label" style={{marginLeft:'auto',fontSize:9,background:'#7c3aed',color:'#fff',borderRadius:3,padding:'1px 5px',fontWeight:700}}>PRO</span>}
    </button>
  );

  return(<div style={{display:"flex",minHeight:"100vh",background:T.bgSubtle}}>
    {mobileNav&&<div className="mobile-nav-overlay" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav?"mobile-open":""} ${collapsed&&!mobileNav?"collapsed":""}`}>
      <div style={{padding:collapsed?"14px 0 10px":"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",flexDirection:"column",alignItems:collapsed?"center":"flex-start"}}>
        <Wordmark size={20} inverted iconOnly={collapsed&&!mobileNav}/>
        {org&&<div className="sb-hide" style={{fontSize:11,color:"rgba(255,255,255,.45)",marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,maxWidth:"100%"}}>{org.name}</div>}
      </div>
      <nav style={{flex:1,padding:"6px 8px 0"}}>
        {sections.map(sec=>(<div key={sec.title}>
          <div className="nav-section">{sec.title}</div>
          {sec.items.map(({key,label})=><NavBtn key={key} k={key} label={label}/>)}
        </div>))}
        <div className="nav-section" style={{marginTop:6}}>Konto</div>
        <NavBtn k="settings" label="Einstellungen"/>
        <NavBtn k="steuerberater" label="Kanzlei-Portal"/>
        {isAdmin&&<><div className="nav-section" style={{marginTop:6}}>Admin</div>
          <button className="nav-item" onClick={onAdmin} style={{color:"#FCA5A5"}} title={collapsed?"Admin Panel":undefined}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l5.5 2.4v3.6c0 3.4-2.3 5.7-5.5 6.6-3.2-.9-5.5-3.2-5.5-6.6V4.2L8 1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            <span className="nav-label">Admin Panel</span>
          </button>
        </>}
      </nav>
      <div style={{padding:collapsed?"10px 8px 14px":"10px 10px 14px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
        {org&&<div className="sb-hide" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 11px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:12,fontWeight:600,color:"#fff",textTransform:"capitalize"}}>{org.plan||"Free"}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}} className="num">{org.plan_doc_used||0}/{org.plan_doc_limit||10}</span>
          </div>
          <div className="progress" style={{background:"rgba(255,255,255,.12)"}}><div className="progress-fill" style={{width:`${pct}%`}}/></div>
        </div>}
        <div className="sb-hide" style={{display:"flex",alignItems:"center",gap:9,padding:"4px 2px",marginBottom:8}}>
          <div className="avatar" style={{background:"rgba(109,91,255,.35)",color:"#fff"}}>{(user?.full_name||"U")[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.full_name||"—"}</div>
            <div style={{fontSize:10.5,color:"rgba(255,255,255,.45)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email||""}</div>
          </div>
        </div>
        <button onClick={toggleCollapse} className="nav-item" style={{justifyContent:collapsed?"center":"flex-start"}} title={collapsed?"Navigation ausklappen":"Navigation einklappen"}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{transform:collapsed?"rotate(180deg)":"none",transition:"transform .2s"}}><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="nav-label">Einklappen</span>
        </button>
      </div>
    </aside>
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <div className="topbar">
        <button className="mobile-menu-btn" onClick={()=>setMobileNav(true)} aria-label="Menü öffnen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke={T.textSecondary} strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{fontSize:14,fontWeight:700,color:T.textPrimary,letterSpacing:"-.01em",whiteSpace:"nowrap"}}>{{"dashboard":"Übersicht","invoices":"Ausgang","scanner":"Scan & Import","inbound":"Eingang","belege":"Belege & Aufträge","artikel":"Artikel & Leistungen","kunden":"Kunden","steuerberater":"Kanzlei-Portal","archive":"Archiv","settings":"Einstellungen","ki":"KI-Berater"}[nav]||nav}</div>
        <div style={{flex:1,maxWidth:340}}>
          <div style={{position:"relative"}}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}><circle cx="7" cy="7" r="4.5" stroke={T.textMuted} strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&searchQ.trim()){onSearch&&onSearch(searchQ.trim());setSearchQ("");}}}
              style={{width:"100%",background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:"7px 12px 7px 30px",fontSize:13,color:T.textPrimary,outline:"none",fontFamily:F.ui}}
              placeholder="Rechnungen durchsuchen… (Enter)"/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",position:"relative"}}>
          {org&&<button className="sb-hide" onClick={()=>go("settings")} style={{display:"flex",alignItems:"center",gap:6,background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:16,padding:"4px 11px",fontSize:11.5,fontWeight:700,color:T.accent,cursor:"pointer",fontFamily:F.ui,textTransform:"capitalize",whiteSpace:"nowrap"}}>
            {org.plan||"Free"}<span style={{fontWeight:500,color:T.textMuted}} className="num">{org.plan_doc_used||0}/{org.plan_doc_limit||10}</span>
          </button>}
          <div className="avatar" style={{cursor:"pointer",width:30,height:30,fontSize:12}} onClick={()=>setUserMenu(m=>!m)}>{(user?.full_name||"U")[0]}</div>
          {userMenu&&<>
            <div style={{position:"fixed",inset:0,zIndex:998}} onClick={()=>setUserMenu(false)}/>
            <div className="card sci" style={{position:"absolute",top:40,right:0,zIndex:999,width:240,padding:0,boxShadow:T.shadowXl}}>
              <div style={{padding:"13px 15px",borderBottom:`1px solid ${T.bgBorder}`}}>
                <div style={{fontSize:13.5,fontWeight:700,color:T.textPrimary}}>{user?.full_name||"—"}</div>
                <div style={{fontSize:11.5,color:T.textMuted,marginTop:1}}>{user?.email||""}</div>
                {org&&<div style={{fontSize:11.5,color:T.textSecondary,marginTop:6,display:"flex",justifyContent:"space-between"}}><span>{org.name}</span><span style={{textTransform:"capitalize",fontWeight:600,color:T.accent}}>{org.plan}</span></div>}
              </div>
              <div style={{padding:6}}>
                <button className="menu-item" onClick={()=>{setUserMenu(false);go("settings");}}>{NAV_ICONS.settings}<span>Einstellungen</span></button>
                <button className="menu-item" style={{color:T.red}} onClick={onLogout}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span>Abmelden</span>
                </button>
              </div>
            </div>
          </>}
        </div>
      </div>
      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>{children}</main>
    </div>
  </div>);
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({user,org,notify,onNav}){
  const[stats,setStats]       = useState(null);
  const[cashflow,setCashflow] = useState(null);
  const[invoices,setInvoices] = useState([]);
  const[bizDocs,setBizDocs]   = useState([]);
  const[loading,setLoading]   = useState(true);

  useEffect(()=>{
    Promise.all([
      api.getStats(),
      api.listInvoices('?limit=5'),
      api.getCashflowStats(),
      api.listBusinessDocs('?limit=100').catch(()=>({documents:[]})),
    ]).then(([s,i,cf,bd])=>{
      setStats(s);
      setInvoices(i.invoices||[]);
      setCashflow(cf);
      setBizDocs(bd.documents||[]);
    }).catch(()=>{
      // Fallback: leere Zustände — keine Fake-Daten
      setStats({outbound_total:0,inbound_total:0,errors_total:0,compliance_score:100,week_data:[0,0,0,0,0,0,0]});
      setInvoices([]);
      setCashflow({open_receivables:0,open_payables:0,due_this_week_in:0,due_this_week_out:0,forecast:[]});
    }).finally(()=>setLoading(false));
  },[]);

  const weekData = stats?.week_data || [0,0,0,0,0,0,0];
  const forecast = cashflow?.forecast || [];

  // Cashflow-Prognose: 30-Tage Balkendiagramm
  const CashflowChart = ()=>{
    if(!forecast.length) return(
      <div style={{textAlign:'center',padding:'20px 0',color:T.textMuted,fontSize:12.5}}>
        Noch keine Daten — erstelle Rechnungen um die Prognose zu sehen.
      </div>
    );
    const maxVal = Math.max(...forecast.map(d=>Math.abs(d.balance)),1);
    return(
      <div style={{display:'flex',alignItems:'flex-end',gap:3,height:72,paddingTop:8}}>
        {forecast.slice(0,30).map((d,i)=>{
          const h = Math.max(4, (Math.abs(d.balance)/maxVal)*64);
          const col = d.balance>=0 ? T.green : T.red;
          return(
            <div key={i} title={`${new Date(d.date).toLocaleDateString('de-DE')}: ${fmtEUR(d.balance)}`}
              style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'default'}}>
              <div style={{width:'100%',background:col,borderRadius:'2px 2px 0 0',height:`${h}px`,opacity:.85,transition:'height .3s'}}/>
              {i%7===0&&<div style={{fontSize:8,color:T.textMuted,whiteSpace:'nowrap'}}>{new Date(d.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return(<div className="fi">
    {/* Header */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
      <div>
        <h1 style={{fontFamily:F.ui,fontSize:22,fontWeight:700,color:T.textPrimary,letterSpacing:'-.025em'}}>
          Guten Tag{user?.full_name?`, ${user.full_name.split(' ')[0]}`:''}.</h1>
        <p style={{color:T.textMuted,fontSize:12.5,marginTop:4}}>{new Date().toLocaleDateString('de-DE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={()=>onNav('invoices','create')}>+ Neue Rechnung</button>
    </div>

    {/* Eingangs-E-Mail-Adresse — zentral sichtbar, auch auf dem Dashboard */}
    {org?.inbound_email_slug&&(
      <div style={{padding:'12px 16px',background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:9,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:12.5,fontWeight:600,color:T.accent,marginBottom:2}}>Ihre e-Rechnungs-Adresse</div>
          <div style={{fontSize:13,fontFamily:F.mono,color:T.textPrimary}}>{org.inbound_email_slug}@rechnungen.invoiq.io</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>Schicken Sie Rechnungen an diese Adresse — invoiq erfasst sie automatisch.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>{ navigator.clipboard.writeText(`${org.inbound_email_slug}@rechnungen.invoiq.io`); notify('Adresse kopiert ✓','success'); }}>Kopieren</button>
      </div>
    )}

    {/* KPIs — klickbar */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:10,marginBottom:16}}>
      {loading?[1,2,3,4].map(i=><div key={i} className="card" style={{padding:18,height:96}}><div className="skeleton" style={{height:'100%'}}/></div>)
      :[
        {label:'Versandt',   value:stats?.outbound_total||0, delta:'Ausgangsrechnungen', color:T.textPrimary, chart:weekData,                          nav:'invoices'},
        {label:'Empfangen',  value:stats?.inbound_total||0,  delta:'Eingangsrechnungen', color:T.textPrimary, chart:weekData.map(v=>Math.floor(v*.7)), nav:'inbound'},
        {label:'Fehler',     value:stats?.errors_total||0,   delta:stats?.errors_total>0?'⚠ Offen':'✓ Alles OK', color:stats?.errors_total>0?T.red:T.green, nav:'invoices'},
        {label:'Compliance', value:`${stats?.compliance_score||100}%`, delta:'EN 16931 ✓', color:T.green,     nav:'archive'},
      ].map((s,i)=>(
        <div key={i} className="card" style={{padding:18,cursor:'pointer',transition:'box-shadow .15s'}}
          onClick={()=>onNav(s.nav)}
          onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.accent}`}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
          <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:.4,marginBottom:10,textTransform:'uppercase',display:'flex',justifyContent:'space-between'}}>
            {s.label}<span style={{fontSize:10,color:T.accent,opacity:.7}}>→</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div>
              <div className="stat-num" style={{color:s.color,fontSize:28}}>{s.value}</div>
              <div style={{fontSize:11,color:s.color===T.green?T.green:s.color===T.red?T.red:T.textMuted,marginTop:4,fontWeight:600}}>{s.delta}</div>
            </div>
            {s.chart&&<MiniChart data={s.chart} height={32} color={T.accent}/>}
          </div>
        </div>
      ))}
    </div>

    {/* Cashflow-Cockpit — klickbar */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(230px,100%),1fr))',gap:10,marginBottom:16}}>
      {/* Offene Forderungen → Ausgang */}
      <div className="card" style={{padding:18,borderLeft:`3px solid ${T.green}`,cursor:'pointer',transition:'box-shadow .15s'}}
        onClick={()=>onNav('invoices')}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.green}`}
        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
          Offene Forderungen<span style={{fontSize:10,color:T.green,opacity:.8}}>→ Ausgang</span>
        </div>
        <div style={{fontSize:26,fontWeight:800,color:T.green,letterSpacing:'-.03em'}}>{loading?'—':fmtEUR(cashflow?.open_receivables||0)}</div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:4}}>Ausgangsrechnungen, noch nicht bezahlt</div>
        {cashflow?.due_this_week_in>0&&<div style={{marginTop:8,fontSize:11.5,color:T.green,fontWeight:600}}>↑ {fmtEUR(cashflow.due_this_week_in)} fällig diese Woche</div>}
      </div>
      {/* Offene Verbindlichkeiten → Eingang */}
      <div className="card" style={{padding:18,borderLeft:`3px solid ${T.red}`,cursor:'pointer',transition:'box-shadow .15s'}}
        onClick={()=>onNav('inbound')}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.red}`}
        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
          Offene Verbindlichkeiten<span style={{fontSize:10,color:T.red,opacity:.8}}>→ Eingang</span>
        </div>
        <div style={{fontSize:26,fontWeight:800,color:T.red,letterSpacing:'-.03em'}}>{loading?'—':fmtEUR(cashflow?.open_payables||0)}</div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:4}}>Eingangsrechnungen, noch nicht bezahlt</div>
        {cashflow?.due_this_week_out>0&&<div style={{marginTop:8,fontSize:11.5,color:T.red,fontWeight:600}}>↓ {fmtEUR(cashflow.due_this_week_out)} fällig diese Woche</div>}
      </div>
      {/* Netto-Cashflow → Archiv */}
      <div className="card" style={{padding:18,borderLeft:`3px solid ${T.accent}`,cursor:'pointer',transition:'box-shadow .15s'}}
        onClick={()=>onNav('archive')}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.accent}`}
        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
          Netto-Cashflow<span style={{fontSize:10,color:T.accent,opacity:.8}}>→ Archiv</span>
        </div>
        <div style={{fontSize:26,fontWeight:800,letterSpacing:'-.03em',color:(cashflow?.open_receivables||0)-(cashflow?.open_payables||0)>=0?T.green:T.red}}>
          {loading?'—':fmtEUR((cashflow?.open_receivables||0)-(cashflow?.open_payables||0))}
        </div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:4}}>Forderungen minus Verbindlichkeiten</div>
      </div>
    </div>

    {/* Belegfluss — offene Vorgänge im Vertrieb */}
    {bizDocs.length>0&&(()=>{
      const openOf=(t)=>bizDocs.filter(d=>d.doc_type===t&&!["storniert","fakturiert","abgelehnt","abgelaufen"].includes(d.status));
      const stages=[["request","Anfragen"],["quote","Angebote"],["order","Aufträge"],["delivery","Lieferungen"]];
      return(
        <div className="card" style={{padding:18,marginBottom:16,cursor:"pointer",transition:"box-shadow .15s"}}
          onClick={()=>onNav("belege")}
          onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.accent}`}
          onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Belegfluss — offene Vorgänge</div>
              <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>Anfrage → Angebot → Auftrag → Lieferung → Rechnung</div>
            </div>
            <span style={{fontSize:11,color:T.accent,fontWeight:600}}>→ Belege & Aufträge</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto"}}>
            {stages.map(([t,label],i)=>{
              const open=openOf(t);
              const sum=open.reduce((s,d)=>s+(parseFloat(d.amount_gross)||0),0);
              return(
                <div key={t} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                  <div style={{background:open.length?T.accentLight:T.bgSubtle,border:`1px solid ${open.length?T.accentPale:T.bgBorder}`,borderRadius:8,padding:"9px 14px",minWidth:112}}>
                    <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                      <span className="num" style={{fontSize:19,fontWeight:800,color:open.length?T.accent:T.textPlaceholder}}>{open.length}</span>
                      {open.length>0&&<span style={{fontSize:10.5,color:T.textMuted}}>{fmtEUR(sum)}</span>}
                    </div>
                  </div>
                  {i<stages.length-1&&<span style={{padding:"0 8px",color:T.textPlaceholder,fontSize:14}}>→</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    })()}

    {/* Cashflow-Prognose 30 Tage + Aktivität */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(320px,100%),2fr))',gap:12,marginBottom:16}}>
      <div className="card" style={{padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div>
            <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Cashflow-Prognose — nächste 30 Tage</div>
            <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>Basierend auf Fälligkeitsdaten deiner Rechnungen</div>
          </div>
          <div style={{display:'flex',gap:8,fontSize:11}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:T.green,display:'inline-block'}}/>Einnahmen</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:T.red,display:'inline-block'}}/>Ausgaben</span>
          </div>
        </div>
        {loading?<div className="skeleton" style={{height:72}}/>:<CashflowChart/>}
      </div>
      <div className="card" style={{padding:18}}>
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Format-Verteilung</div>
        {loading?<div className="skeleton" style={{height:80}}/>:
          (stats?.format_breakdown||[['XRechnung',0,T.accent],['ZUGFeRD',0,T.purple],['Peppol',0,T.green]]).map(([f,pct,c],i)=>(
            <div key={i} style={{marginBottom:11}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12.5}}>
                <span style={{color:T.textSecondary}}>{f}</span>
                <span style={{fontWeight:600,color:T.textPrimary}}>{pct}%</span>
              </div>
              <div className="progress"><div className="progress-fill" style={{width:`${pct}%`,background:c}}/></div>
            </div>
          ))
        }
      </div>
    </div>

    {/* Letzte Dokumente */}
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.bgBorder}`}}>
        <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Letzte Dokumente</div>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav('invoices')}>Alle anzeigen →</button>
      </div>
      <table className="table">
        <thead><tr>{['Nummer','Empfänger','Betrag','Format','Status','Zeit'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2,3].map(i=><tr key={i}><td colSpan={6}><div className="skeleton" style={{height:14,margin:'6px 0'}}/></td></tr>)
          :invoices.length===0
            ?<tr><td colSpan={6} style={{textAlign:'center',padding:28,color:T.textMuted,fontSize:13}}>Noch keine Rechnungen — <button className="btn btn-ghost btn-sm" onClick={()=>onNav('invoices')}>Erste Rechnung erstellen →</button></td></tr>
            :invoices.map(inv=><tr key={inv.id} className="tr-hover" style={{cursor:'pointer'}}>
              <td style={{fontWeight:600,color:T.textPrimary,fontFamily:F.mono,fontSize:12.5}}>{inv.invoice_number}</td>
              <td style={{color:T.textPrimary}}>{inv.buyer_name||'—'}</td>
              <td style={{fontWeight:600,color:T.textPrimary}}>{fmtEUR(inv.amount_gross)}</td>
              <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:'2px 7px',fontSize:11.5,fontWeight:600,fontFamily:F.mono}}>{inv.format?.toUpperCase()}</span></td>
              <td><StatusBadge status={inv.effective_status||inv.status}/></td>
              <td style={{color:T.textMuted,fontSize:12}}>{fmtAgo(inv.created_at)}</td>
            </tr>)
          }
        </tbody>
      </table>
    </div>
  </div>);
}

// ── DOCUMENTS ─────────────────────────────────────────────────
function Invoices({notify,initialView=null,onNavDone=null,searchQuery=null,onClearSearch=null}){
  const [emailModal,setEmailModal] = useState(false);
  const [senderCopy,setSenderCopy] = useState(true);
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

  const[view,setView]=useState(initialView||"list");const[filter,setFilter]=useState("all");
  const[sort,setSort]=useState({key:"created_at",dir:"desc"});
  useEffect(()=>{if(initialView){setView(initialView);onNavDone&&onNavDone();}},[]);
  const[invoices,setInvoices]=useState([]);const[loading,setLoading]=useState(true);
  const[detail,setDetail]=useState(null);          // ausgewählte Rechnung (Detail-Modal)
  const[auditLogs,setAuditLogs]=useState(null);    // Audit-Trail der Detail-Rechnung
  const openDetail=async(inv)=>{
    setDetail(inv);setAuditLogs(null);
    try{const d=await api.get(`/invoices/${inv.id}/audit`);setAuditLogs(d.logs||[]);}
    catch(e){setAuditLogs([]);}
  };
  const[generating,setGenerating]=useState(false);const[xml,setXml]=useState(null);
  const[fieldErrors,setFieldErrors]=useState({});
  const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({invoice_number:`INV-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,invoice_date:new Date().toISOString().split("T")[0],due_date:new Date(Date.now()+30*86400000).toISOString().split("T")[0],format:"xrechnung",template:"modern",delivery_method:"email",seller_name : "",_orgLoaded:false,seller_vat_id:"",seller_address:"",seller_city:"",buyer_name:"",buyer_address:"",buyer_zip:"",buyer_city:"",buyer_country:"DE",buyer_email:"",line_items:[{description:"",quantity:1,unit_price:0,vat_rate:19}]});
  // Kundenstammdaten für Schnellauswahl (SAP-ready: Stammdaten → Beleg)
  const[customers,setCustomers]=useState([]);
  useEffect(()=>{if(view==="create")api.listCustomers().then(d=>setCustomers(d.customers||[])).catch(()=>setCustomers([]));},[view]);
  const pickCustomer=(id)=>{
    const c=customers.find(x=>x.id===id);
    if(!c)return;
    setForm(p=>({...p,
      buyer_name:c.name||"",buyer_address:c.address||"",buyer_zip:c.zip||"",
      buyer_city:c.city||"",buyer_country:c.country||"DE",buyer_email:c.email||"",
      due_date:c.payment_terms_days?new Date(Date.now()+c.payment_terms_days*86400000).toISOString().split("T")[0]:p.due_date,
    }));
    setFieldErrors({});
  };
  const load=useCallback(()=>{setLoading(true);api.listInvoices().then(d=>setInvoices(d.invoices||[])).catch(()=>setInvoices([])).finally(()=>setLoading(false));},[]);
  useEffect(()=>load(),[load]);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const updItem=(i,k,v)=>{const a=[...form.line_items];a[i]={...a[i],[k]:k==="description"?v:parseFloat(v)||0};upd("line_items",a);};
  const net=form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
  const vat=form.line_items.reduce((s,i)=>s+i.quantity*i.unit_price*(i.vat_rate/100),0);
  const generate=async()=>{
    const errors={};
    if(!form.buyer_name) errors.buyer_name=true;
    if(!form.buyer_city) errors.buyer_city=true;
    if(!form.line_items||form.line_items.every(i=>!i.description)) errors.line_items=true;
    if(Object.keys(errors).length>0){setFieldErrors(errors);notify("Bitte alle Pflichtfelder ausfüllen","error");return;}
    if(net<=0){notify("Betrag muss größer als 0 sein","error");return;}
    setFieldErrors({});
    setGenerating(true);
    try{
      const inv=await api.createInvoice({...form, seller_name: form.seller_name||(await api.getOrgSettings().catch(()=>({}))).name||''});
      const xmlContent=await api.getXML(inv.id);
      setXml({content:xmlContent,id:inv.id,number:inv.invoice_number});
      notify("XRechnung generiert · EN 16931 ✓","success");
      load();
           setView('list');
    }catch(e){const msg=e.message.includes("erreichbar")?"Server nicht erreichbar – Railway startet, bitte 30 Sek. warten und erneut versuchen":e.message.includes("401")?"Nicht autorisiert – bitte neu einloggen":e.message.includes("400")?"Ungültige Rechnungsdaten – bitte Felder prüfen":e.message.includes("500")?"Serverfehler – Railway Logs prüfen":e.message.includes("seller")||e.message.includes("buyer")||e.message.includes("required")?"Pflichtfeld fehlt – Absender und Empfänger müssen ausgefüllt sein":e.message;notify(msg,"error");}
    setGenerating(false);
  };
  const saveDraft=async()=>{
    setSaving(true);
    try{
      await api.createInvoice({...form,status:'draft'});
      notify("Entwurf gespeichert","success");
      setView('list');
      load();
    }catch(e){notify(e.message,"error");}
    setSaving(false);
  };
  const searched=searchQuery
    ?invoices.filter(i=>(i.invoice_number||"").toLowerCase().includes(searchQuery.toLowerCase())||(i.buyer_name||"").toLowerCase().includes(searchQuery.toLowerCase()))
    :invoices;
  const filteredRaw=filter==="all"?searched:searched.filter(i=>i.status===filter);
  const sortVal=(i)=>sort.key==="amount_gross"?parseFloat(i.amount_gross)||0:sort.key==="invoice_number"?(i.invoice_number||""):(i.created_at||"");
  const filtered=[...filteredRaw].sort((a,b)=>{
    const va=sortVal(a),vb=sortVal(b);
    const c=typeof va==="number"?va-vb:String(va).localeCompare(String(vb));
    return sort.dir==="asc"?c:-c;
  });
  const toggleSort=(key)=>setSort(s=>s.key===key?{key,dir:s.dir==="asc"?"desc":"asc"}:{key,dir:"desc"});
  const SortTh=({k,children})=>(
    <th onClick={()=>toggleSort(k)} style={{cursor:"pointer",userSelect:"none"}}>
      {children} <span style={{opacity:sort.key===k?1:.3,fontSize:9}}>{sort.key===k&&sort.dir==="asc"?"▲":"▼"}</span>
    </th>
  );

  if(view==="create") return(<div className="fi">
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setXml(null);}}>← Back</button>
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:400,color:T.textPrimary}}>Neue Rechnung</h1><p style={{fontSize:12,color:T.textMuted}}>EN 16931-konforme E-Rechnung erstellen</p></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>Rechnungsdetails</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div><label className="label">Nummer</label><input className="input" value={form.invoice_number} onChange={e=>upd("invoice_number",e.target.value)}/></div>
          <div><label className="label">Format</label><select className="select" value={form.format} onChange={e=>upd("format",e.target.value)}><option value="xrechnung">XRechnung 3.0</option><option value="zugferd">ZUGFeRD 2.4</option><option value="facturx">FacturX 1.0</option><option value="peppol">Peppol BIS 3.0</option></select></div>
          <div><label className="label">PDF-Farbe <span style={{fontWeight:400,color:T.textMuted}}>(Standard: Firmenfarbe)</span></label>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="color" value={form.brand_color||"#635BFF"} onChange={e=>upd("brand_color",e.target.value)} style={{width:38,height:32,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:2,cursor:"pointer",background:"#fff"}}/>
              {form.brand_color&&<button className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={()=>upd("brand_color",undefined)}>zurücksetzen</button>}
            </div>
          </div>
          <div><label className="label">Rechnungsdatum</label><input className="input" type="date" value={form.invoice_date} onChange={e=>upd("invoice_date",e.target.value)}/></div>
          <div><label className="label">Fälligkeitsdatum</label><input className="input" type="date" value={form.due_date} onChange={e=>upd("due_date",e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase"}}>Empfänger</div>
          {customers.length>0&&(
            <select className="select" style={{width:200,fontSize:12.5,padding:"5px 10px"}} value="" onChange={e=>pickCustomer(e.target.value)}>
              <option value="">Bestehenden Kunden wählen…</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` · ${c.city}`:''}</option>)}
            </select>
          )}
        </div>
                {[["buyer_name","Firma"],["buyer_address","Straße"],["buyer_zip","PLZ"],["buyer_city","Stadt"],["buyer_country","Land"],["buyer_email","Email"]].map(([k,l])=>(<div key={k}><label className="label">{l}</label><input className="input" value={form[k]||''} onChange={e=>{upd(k,e.target.value);if(fieldErrors[k])setFieldErrors(p=>({...p,[k]:false}));}} placeholder={l} style={{borderColor:fieldErrors[k]?T.red:undefined}}/></div>))}
        <div style={{fontSize:11,color:T.textMuted,marginTop:10}}>Neue Empfänger werden automatisch als Kunde gespeichert und stehen beim nächsten Mal zur Auswahl.</div>
      </div>
    </div>
    <div className="card" style={{padding:20,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Positionen</div>
      <div style={{display:"grid",gridTemplateColumns:"3fr 70px 130px 80px 32px",gap:7,marginBottom:8}}>{["Beschreibung","Menge","Einzelpreis","MwSt.",""].map((h,i)=><div key={i} style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.3,textTransform:"uppercase"}}>{h}</div>)}</div>
      {form.line_items.map((item,idx)=><div key={idx} style={{display:"grid",gridTemplateColumns:"3fr 70px 130px 80px 32px",gap:7,marginBottom:6}}>
        <input className="input" value={item.description} onChange={e=>updItem(idx,"description",e.target.value)} placeholder="Leistungsbeschreibung..."/>
        <input className="input" type="number" min="0" value={item.quantity} onChange={e=>updItem(idx,"quantity",e.target.value)}/>
        <input className="input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updItem(idx,"unit_price",e.target.value)}/>
        <select className="select" value={item.vat_rate} onChange={e=>updItem(idx,"vat_rate",e.target.value)}><option value={19}>19%</option><option value={7}>7%</option><option value={0}>0%</option></select>
        <button onClick={()=>upd("line_items",form.line_items.filter((_,j)=>j!==idx))} style={{background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:7,color:T.red,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>)}
      <button onClick={()=>upd("line_items",[...form.line_items,{description:"",quantity:1,unit_price:0,vat_rate:19}])} style={{width:"100%",padding:"7px",border:`1.5px dashed ${T.bgBorder}`,background:"transparent",color:T.accent,cursor:"pointer",borderRadius:7,marginTop:7,fontSize:13,fontFamily:F.ui,fontWeight:500}}>+ Position hinzufügen</button>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
        <div style={{background:T.bgSubtle,borderRadius:9,padding:"12px 16px",minWidth:220,border:`1px solid ${T.bgBorder}`}}>
          {[["Netto",fmtEUR(net)],["MwSt.",fmtEUR(vat)]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:32,marginBottom:7,fontSize:13,color:T.textMuted}}><span>{l}</span><span>{v}</span></div>)}
          <div style={{height:1,background:T.bgBorder,margin:"7px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:32,fontFamily:F.ui,fontSize:18,color:T.textPrimary,fontWeight:400}}><span>Gesamt</span><span>{fmtEUR(net+vat)}</span></div>
        </div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:16}}>
      <button className="btn btn-outline" style={{fontSize:13.5,padding:"10px 20px"}} disabled={saving||generating} onClick={async()=>{
        try{
          const res=await fetch(`${API_BASE}/invoices/preview-pdf`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${api._token}`},body:JSON.stringify(form)});
          if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`Vorschau fehlgeschlagen (${res.status})`);}
          const blob=await res.blob();
          window.open(URL.createObjectURL(blob),"_blank");
        }catch(e){notify(e.message||"Vorschau fehlgeschlagen","error");}
      }}>👁 Vorschau (PDF)</button>
      <button className="btn btn-ghost" style={{fontSize:13.5,padding:"10px 20px"}} onClick={saveDraft} disabled={saving||generating}>{saving?<><Spinner size={14}/>&nbsp;Speichert...</>:"Als Entwurf speichern"}</button>
      <button className="btn btn-primary" style={{fontSize:13.5,padding:"10px 24px"}} onClick={generate} disabled={generating||saving}>{generating?<><Spinner color="#fff" size={14}/>&nbsp;Wird generiert...</>:"⚡ XRechnung generieren"}</button>
    </div>
    {xml&&<div className="card fi" style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:7}}><span className="badge badge-green">✓ EN 16931</span><span className="badge badge-green">GoBD ✓</span><span style={{fontSize:12.5,color:T.textMuted,fontFamily:F.mono}}>{xml.number}</span></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([xml.content],{type:"application/xml"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`${xml.number}.xml`;a.click();}}>↓ Herunterladen</button>
      </div>
      <pre style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:14,fontSize:11,color:T.textSecondary,overflow:"auto",maxHeight:300,lineHeight:1.6,fontFamily:F.mono}}>{xml.content.substring(0,1500)}…</pre>
    </div>}
  </div>);

  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Ausgang</h1><p style={{fontSize:12,color:T.textMuted,marginTop:2}}>{invoices.length} Rechnungen gesamt</p></div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-ghost btn-sm" onClick={()=>api.datevExport().then(()=>notify("DATEV-Export heruntergeladen ✓","success")).catch(e=>notify(e.message,"error"))}>↓ DATEV-Export</button><button className="btn btn-primary btn-sm" style={{padding:"8px 18px",fontSize:13.5,fontWeight:700}} onClick={()=>setView("create")}>+ Neue Rechnung</button></div>
    </div>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:14,overflowX:"auto"}}>
      {["all","draft","delivered","validated","sent","error","archived"].map(s=><button key={s} className={`tab ${filter===s?"active":""}`} onClick={()=>setFilter(s)}>
        {{all:"Alle",draft:"Entwürfe",delivered:"Zugestellt",validated:"Validiert",sent:"Gesendet",error:"Fehler",archived:"Archiviert"}[s]}
        {s!=="all"&&<span style={{marginLeft:4,fontSize:10,background:T.bgMuted,padding:"1px 5px",borderRadius:7,color:T.textMuted}}>{invoices.filter(i=>i.status===s).length}</span>}
      </button>)}
    </div>
    {searchQuery&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <span style={{fontSize:12.5,color:T.textSecondary}}>Suche:</span>
      <span style={{display:"inline-flex",alignItems:"center",gap:6,background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:14,padding:"3px 11px",fontSize:12.5,fontWeight:600,color:T.accent}}>
        „{searchQuery}“
        <button onClick={onClearSearch} style={{background:"none",border:"none",cursor:"pointer",color:T.accent,fontSize:14,lineHeight:1,padding:0}}>×</button>
      </span>
      <span style={{fontSize:12,color:T.textMuted}}>{filtered.length} Treffer</span>
    </div>}
    <div className="card">
      <div style={{overflowX:"auto"}}>
      <table className="table">
        <thead><tr><SortTh k="invoice_number">Nummer</SortTh><th>Empfänger</th><SortTh k="amount_gross">Betrag</SortTh><th>Format</th><th>Status</th><SortTh k="created_at">Datum</SortTh><th>Aktionen</th></tr></thead>
        <tbody>
          {loading?[1,2,3].map(i=><tr key={i}><td colSpan={7}><div className="skeleton" style={{height:14}}/></td></tr>)
          :filtered.map(inv=><tr key={inv.id} className="tr-hover" onClick={()=>openDetail(inv)} style={{cursor:"pointer"}}>
            <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12.5,color:T.textPrimary}}>{inv.invoice_number}</td>
            <td>{inv.buyer_name||"—"}</td>
            <td style={{fontWeight:600}}>{fmtEUR(inv.amount_gross)}</td>
            <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:F.mono}}>{inv.format?.toUpperCase()}</span></td>
            <td><StatusBadge status={inv.effective_status||inv.status}/></td>
            <td style={{fontSize:12,color:T.textMuted,whiteSpace:"nowrap"}} className="num">{inv.created_at?new Date(inv.created_at).toLocaleDateString("de-DE"):"—"}</td>
            <td onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:5}}>
              {inv.status==="validated"&&<button className="btn btn-outline btn-sm" onClick={()=>{setCurrentInvId(inv.id);setEmailTo(inv.buyer_email||'');setEmailModal(true);}}>✉ Senden</button>}
              {inv.has_xml&&<button className="btn btn-ghost btn-sm" onClick={()=>api.getXML(inv.id).then(c=>setXml({content:c,id:inv.id,number:inv.invoice_number})).catch(e=>notify(e.message,"error"))}>XML</button>}
              <button className="btn btn-ghost btn-sm" onClick={()=>api.openPDF(inv.id).catch(e=>notify(e.message,"error"))}>PDF</button>
            </div></td>
          </tr>)}
          {!loading&&filtered.length===0&&invoices.length===0&&<tr><td colSpan={7} style={{padding:0}}>
            <div style={{textAlign:'center',padding:'60px 24px',color:T.textMuted}}>
              <div style={{width:56,height:56,borderRadius:14,background:T.accentLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 16px'}}>📄</div>
              <div style={{fontSize:16,fontWeight:600,color:T.textPrimary,marginBottom:8}}>Noch keine Rechnung erstellt</div>
              <div style={{fontSize:14,marginBottom:20}}>Erstelle deine erste XRechnung in wenigen Sekunden.</div>
              <button className="btn btn-primary" onClick={()=>setView('create')}>Erste Rechnung erstellen →</button>
            </div>
          </td></tr>}
          {!loading&&filtered.length===0&&invoices.length>0&&<tr><td colSpan={7} style={{textAlign:"center",color:T.textMuted,padding:28,fontSize:13}}>Keine Dokumente in diesem Filter</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
    {xml&&<div className="modal-overlay" onClick={()=>setXml(null)}>
      <div className="modal fi" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",gap:7}}><span className="badge badge-green">EN 16931 ✓</span><span style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>{xml.number}</span></div>
          <div style={{display:"flex",gap:7}}><button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([xml.content],{type:"application/xml"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`${xml.number}.xml`;a.click();}}>↓ Herunterladen</button><button className="btn btn-ghost btn-sm" onClick={()=>setXml(null)}>×</button></div>
        </div>
        <pre style={{background:T.bgSubtle,borderRadius:8,padding:14,fontSize:10.5,color:T.textSecondary,overflow:"auto",maxHeight:420,lineHeight:1.55,fontFamily:F.mono}}>{xml.content}</pre>
      </div>
    </div>}
    {detail&&<div className="modal-overlay" onClick={()=>setDetail(null)}>
      <div className="modal sci" style={{maxWidth:640,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        {/* Kopf */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span style={{fontSize:17,fontWeight:700,fontFamily:F.mono,color:T.textPrimary}}>{detail.invoice_number}</span>
              <StatusBadge status={detail.effective_status||detail.status}/>
              {detail.validation_passed===false&&<span className="badge badge-red">Validierung fehlgeschlagen</span>}
            </div>
            <div style={{fontSize:12.5,color:T.textMuted}}>{detail.buyer_name||"—"} · {detail.format?.toUpperCase()} · {detail.invoice_date?new Date(detail.invoice_date).toLocaleDateString("de-DE"):"—"}</div>
          </div>
          <button onClick={()=>setDetail(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textMuted}}>×</button>
        </div>

        {/* Beträge & Eckdaten */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {[["Netto",fmtEUR(detail.amount_net)],["MwSt.",fmtEUR(detail.amount_vat)],["Brutto",fmtEUR(detail.amount_gross)]].map(([l,v])=>(
            <div key={l} style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:7,padding:"9px 12px"}}>
              <div style={{fontSize:10,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:3}}>{l}</div>
              <div style={{fontSize:15,fontWeight:700,color:T.textPrimary}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px",fontSize:12.5,marginBottom:14}}>
          {[["Fällig",detail.due_date?new Date(detail.due_date).toLocaleDateString("de-DE"):"—"],
            ["Zustellweg",detail.delivery_method||"—"],
            ["Empfänger-E-Mail",detail.buyer_email||"—"],
            ["Archiviert",detail.archived?`✓ ${detail.archived_at?new Date(detail.archived_at).toLocaleDateString("de-DE"):""}`:"Nein"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.bgSubtle}`}}>
              <span style={{color:T.textMuted}}>{l}</span><span style={{fontWeight:500,color:T.textPrimary}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Validierungsfehler, falls vorhanden */}
        {Array.isArray(detail.validation_result?.errors)&&detail.validation_result.errors.length>0&&(
          <div style={{background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:7,padding:"10px 13px",marginBottom:14}}>
            <div style={{fontSize:11.5,fontWeight:700,color:T.red,marginBottom:6}}>Validierungsfehler (EN 16931)</div>
            {detail.validation_result.errors.map((er,i)=>(
              <div key={i} style={{fontSize:12,color:T.red,marginBottom:3}}><span style={{fontFamily:F.mono,fontSize:10.5}}>{er.code}</span> — {er.msg}</div>
            ))}
          </div>
        )}

        {/* Audit-Verlauf */}
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:8}}>Verlauf (Audit-Trail)</div>
        {auditLogs===null?<div className="skeleton" style={{height:48,marginBottom:8}}/>
        :auditLogs.length===0?<div style={{fontSize:12.5,color:T.textMuted,padding:"8px 0"}}>Keine Einträge.</div>
        :<div style={{marginBottom:6}}>
          {auditLogs.map((log,i)=>{
            const labels={created:"Erstellt",validated:"Validiert",sent:"Versendet",sent_email:"Per E-Mail gesendet",sent_peppol:"Per Peppol gesendet",delivered:"Zugestellt",archived:"Archiviert (GoBD)",viewed:"Angesehen",inbound_received:"Empfangen",delivery_failed:"Zustellung fehlgeschlagen",integrity_check:"Integritätsprüfung"};
            const isErr=(log.action||"").includes("failed")||(log.action||"").includes("error");
            return(
              <div key={log.id||i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<auditLogs.length-1?`1px solid ${T.bgSubtle}`:"none",alignItems:"flex-start"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:isErr?T.red:T.accent,flexShrink:0,marginTop:5}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:isErr?T.red:T.textPrimary}}>{labels[log.action]||log.action}</div>
                  {log.details?.recipient_email&&<div style={{fontSize:11.5,color:T.textMuted}}>an {log.details.recipient_email}</div>}
                  {log.details?.method&&!log.details?.recipient_email&&<div style={{fontSize:11.5,color:T.textMuted}}>via {log.details.method}</div>}
                </div>
                <div style={{fontSize:11,color:T.textMuted,flexShrink:0,fontFamily:F.mono}}>{log.created_at?new Date(log.created_at).toLocaleString("de-DE"):""}</div>
              </div>
            );
          })}
        </div>}

        {/* Aktionen */}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14,paddingTop:14,borderTop:`1px solid ${T.bgBorder}`}}>
          {detail.has_xml&&<button className="btn btn-ghost btn-sm" onClick={()=>api.getXML(detail.id).then(c=>setXml({content:c,id:detail.id,number:detail.invoice_number})).catch(e=>notify(e.message,"error"))}>XML ansehen</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>api.openPDF(detail.id).catch(e=>notify(e.message,"error"))}>PDF öffnen</button>
          {["validated","sent"].includes(detail.status)&&detail.invoice_kind!=="cancellation"&&<>
            <button className="btn btn-ghost btn-sm" onClick={async()=>{
              try{await api.post(`/invoices/${detail.id}/mark-paid`,{});notify("Als bezahlt markiert ✓","success");setDetail(null);load();}
              catch(e){notify(e.message,"error");}
            }}>✓ Bezahlt</button>
            <button className="btn btn-ghost btn-sm" onClick={async()=>{
              if(!window.confirm(`Rechnung ${detail.invoice_number} korrigieren?\n\nDas Original wird per Stornorechnung ausgeglichen und ein Korrektur-Entwurf mit allen Positionen angelegt.`))return;
              try{const r=await api.post(`/invoices/${detail.id}/correct`,{});notify(`Korrektur-Entwurf ${r.draft?.invoice_number} angelegt ✓`,"success");setDetail(null);load();}
              catch(e){notify(e.message,"error");}
            }}>✎ Korrigieren</button>
            <button className="btn btn-danger btn-sm" onClick={async()=>{
              if(!window.confirm(`Rechnung ${detail.invoice_number} stornieren?\n\nEs wird eine Stornorechnung mit Negativbeträgen erstellt. Das Original bleibt GoBD-konform erhalten.`))return;
              try{const r=await api.post(`/invoices/${detail.id}/cancel`,{});notify(`Storniert — ${r.storno?.invoice_number} erstellt ✓`,"success");setDetail(null);load();}
              catch(e){notify(e.message,"error");}
            }}>⊘ Stornieren</button>
          </>}
          {detail.status==="validated"&&<button className="btn btn-primary btn-sm" onClick={()=>{setCurrentInvId(detail.id);setEmailTo(detail.buyer_email||'');setDetail(null);setEmailModal(true);}}>✉ Senden</button>}
        </div>
      </div>
    </div>}
    {emailModal&&<div className="modal-overlay" onClick={()=>setEmailModal(false)}>
      <div className="modal sci" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:T.textPrimary}}>✉ Per E-Mail senden</div>
          <button onClick={()=>setEmailModal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textMuted}}>×</button>
        </div>
        <div style={{marginBottom:12}}><label className="label">Empfänger-E-Mail</label><input className="input" type="email" placeholder="kunde@firma.de" value={emailTo} onChange={e=>setEmailTo(e.target.value)} autoFocus/></div>
        <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#f0fdf4",borderRadius:7,border:"1px solid #bbf7d0",cursor:"pointer"}} onClick={()=>setSenderCopy(p=>!p)}>
          <input type="checkbox" checked={senderCopy} onChange={()=>setSenderCopy(p=>!p)} style={{width:15,height:15,accentColor:T.accent}}/>
          <span style={{fontSize:12.5,color:"#166534"}}>Kopie an mich senden (Absender-Bestätigung)</span>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={()=>setEmailModal(false)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={doSendEmail} disabled={sending}>{sending?<><Spinner size={14} color="#fff"/>&nbsp;Wird gesendet...</>:"Senden →"}</button>
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
      // Kein Fake-XML bei Fehlern — der Nutzer muss wissen, dass nichts
      // gespeichert wurde (fehlende Pflichtfelder etc. korrigierbar machen).
      notify(e.message||'XRechnung konnte nicht erstellt werden — bitte Felder prüfen','error');
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
              {[['seller_name','Firmenname'],['seller_vat_id','USt-IdNr.'],['seller_address','Straße'],['seller_city','Stadt']].map(([k,l])=>(
                <div key={k} style={{marginBottom:9}}><label className="label">{l}</label><input className="input" value={editResult[k]||''} onChange={e=>upd(k,e.target.value)}/></div>
              ))}
            </div>
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:'uppercase',marginBottom:12}}>Empfänger</div>
              {[['buyer_name','Firmenname'],['buyer_address','Straße'],['buyer_city','Stadt']].map(([k,l])=>(
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

function InboundScreen({notify, org}){
  const [invoices,setInvoices]   = useState([]);
  const [loading,setLoading]     = useState(true);
  const [filter,setFilter]       = useState('all');
  const [fwdModal,setFwdModal]   = useState(null);
  const [fwdEmail,setFwdEmail]   = useState('');
  const [emailSlug,setEmailSlug] = useState('');
  useEffect(()=>{ if(org?.inbound_email_slug) setEmailSlug(org.inbound_email_slug); },[org]);
  const [sepaModal,setSepaModal] = useState(null); // invoice object
  const [discountInfo,setDiscountInfo] = useState({}); // id → {active,daysLeft,savingEur}
  const [reviewInv,setReviewInv]   = useState(null);   // Split-Pane: ausgewählte Rechnung
  const [reviewEdit,setReviewEdit] = useState({});     // editierte Felder
  const [reviewVendor,setReviewVendor] = useState(null);
  const [reviewSaving,setReviewSaving] = useState(false);
  const [quality,setQuality]       = useState(null);   // Lerncenter-Metriken

  const openReview = async (inv) => {
    setReviewInv(inv); setReviewEdit({}); setReviewVendor(null);
    try {
      const d = await api.getInboundDetail(inv.id);
      setReviewInv(d.invoice); setReviewVendor(d.vendor);
    } catch(e){}
  };
  const saveCorrections = async () => {
    if(!Object.keys(reviewEdit).length){ notify('Keine Änderungen','info'); return; }
    setReviewSaving(true);
    try {
      await api.patchInbound(reviewInv.id, reviewEdit);
      notify('Korrekturen gespeichert — Lieferant lernt mit ✓','success');
      setReviewEdit({}); load();
      const d = await api.getInboundDetail(reviewInv.id);
      setReviewInv(d.invoice);
    } catch(e){ notify(e.message,'error'); }
    finally{ setReviewSaving(false); }
  };
  const doReview = async (decision) => {
    try {
      await api.reviewInbound(reviewInv.id, decision);
      notify(decision==='freigegeben'?'Rechnung freigegeben ✓':'Rechnung abgelehnt','success');
      setReviewInv(null); load();
    } catch(e){ notify(e.message,'error'); }
  };

  const load = () => {
    setLoading(true);
    api.getQualityStats().then(setQuality).catch(()=>{});
    api.listInbound()
      .then(d => {
        const invs = d.invoices || [];
        setInvoices(invs);
        setLoading(false);
        // Skonto-Check für alle ausstehenden Rechnungen mit discount_percent
        invs.filter(i=>i.status==='empfangen'&&i.discount_percent).forEach(inv=>{
          api.checkDiscount(inv.id).then(info=>{
            setDiscountInfo(prev=>({...prev,[inv.id]:info}));
          }).catch(()=>{});
        });
      })
      .catch(() => {
        setInvoices([]);
        setLoading(false);
        if(org?.inbound_email_slug) setEmailSlug(org.inbound_email_slug);
      });
  };

  useEffect(()=>{ load(); },[]);

  const filtered = invoices.filter(i =>
    filter==='all'       ? true :
    filter==='ausstehend'? i.status==='empfangen' :
    filter==='bezahlt'   ? i.status==='bezahlt' :
    filter==='fehler'    ? !i.validation_passed : true
  );

  const doForward = async () => {
    if (!fwdEmail) { notify('E-Mail fehlt','error'); return; }
    try {
      await api.forwardInbound(fwdModal, fwdEmail);
      notify(`Weitergeleitet an ${fwdEmail} ✓`,'success');
      setFwdModal(null); setFwdEmail('');
    } catch(e){ notify(e.message,'error'); }
  };

  // Aktive Skonto-Warnungen (nur ausstehende mit aktivem Skonto)
  const skontoAlerts = invoices.filter(i=>i.status==='empfangen'&&discountInfo[i.id]?.active);

  const stats = [
    {label:'Gesamt',     value:invoices.length,                                   color:T.textPrimary},
    {label:'Ausstehend', value:invoices.filter(i=>i.status==='empfangen').length, color:T.amber},
    {label:'Bezahlt',    value:invoices.filter(i=>i.status==='bezahlt').length,   color:T.green},
    {label:'Skonto aktiv',value:skontoAlerts.length,                              color:'#f59e0b'},
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
          <p style={{fontSize:13,color:T.textMuted}}>Eingehende Rechnungen per E-Mail — automatisch geparst, mit SEPA-Zahlung per Klick.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExportInbound('',null,null).then(()=>notify('DATEV-Export heruntergeladen ✓','success')).catch(e=>notify(e.message,'error'))}>↓ DATEV-Export</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            navigator.clipboard.writeText(`${emailSlug}@rechnungen.invoiq.io`);
            notify(`E-Mail-Adresse kopiert ✓`,'success');
          }}>📋 Meine Eingangs-E-Mail</button>
        </div>
      </div>

      {/* E-Mail Adresse Banner */}
      <div style={{padding:'12px 16px',background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:9,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:12.5,fontWeight:600,color:T.accent,marginBottom:2}}>Ihre Eingangs-E-Mail-Adresse</div>
          <div style={{fontSize:13,fontFamily:F.mono,color:T.textPrimary}}>{emailSlug||'...'}@rechnungen.invoiq.io</div>
          <div style={{fontSize:11.5,color:T.textMuted,marginTop:2}}>Lieferanten schicken Rechnungen einfach an diese Adresse — invoiq verarbeitet alles automatisch.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>{ navigator.clipboard.writeText(`${emailSlug}@rechnungen.invoiq.io`); notify('Adresse kopiert ✓','success'); }}>Kopieren</button>
      </div>

      {/* Skonto-Alerts */}
      {skontoAlerts.map(inv=>{
        const d = discountInfo[inv.id];
        return (
          <div key={inv.id} style={{padding:'12px 16px',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:9,marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>💰</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#92400e'}}>
                  Skonto verfügbar — spare {fmtEUR(d.savingEur)} ({d.percent}%)
                </div>
                <div style={{fontSize:12,color:'#b45309'}}>
                  {inv.seller_name} · Rechnung {inv.invoice_number} · noch {d.daysLeft} {d.daysLeft===1?'Tag':'Tage'} (bis {new Date(d.deadline).toLocaleDateString('de-DE')})
                </div>
              </div>
            </div>
            <button className="btn btn-sm" style={{background:'#f59e0b',color:'#fff',border:'none',fontWeight:700}}
              onClick={()=>setSepaModal({...inv,_applyDiscount:true})}>
              💳 Jetzt zahlen + Skonto
            </button>
          </div>
        );
      })}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:8,marginBottom:16}}>
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

      {/* Lerncenter-Metriken */}
      {quality&&quality.total>0&&(
        <div style={{display:'flex',gap:0,background:'#fff',border:`1px solid ${T.bgBorder}`,borderRadius:12,padding:'14px 0',marginBottom:14}}>
          {[
            ['KI-Trefferquote',`${quality.clean_rate}%`,'freigegeben ohne Korrektur',T.green],
            ['Ø Konfidenz',`${quality.avg_confidence}%`,'Felderkennungs-Sicherheit',T.accent],
            ['Gelernte Lieferanten',quality.learned_vendors,'mit gespeicherten Regeln',T.purple],
            ['Geprüft',`${quality.reviewed}/${quality.total}`,'Rechnungen im Review',T.textPrimary],
          ].map(([l,v,s,c],i)=>(
            <div key={l} style={{flex:1,padding:'0 18px',borderLeft:i>0?`1px solid ${T.bgBorder}`:'none'}}>
              <div style={{fontSize:10,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>{l}</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:F.mono,color:c,letterSpacing:'-.03em'}}>{v}</div>
              <div style={{fontSize:10.5,color:T.textMuted,marginTop:2}}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {/* Split-Pane: Tabelle + Review-Detail */}
      <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
      <div style={{flex:reviewInv?'1 1 46%':'1 1 100%',minWidth:0,transition:'flex .3s cubic-bezier(.16,1,.3,1)'}}>
      {loading ? (
        <div style={{textAlign:'center',padding:40}}><Spinner size={24} color={T.accent}/></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr>
              {['Absender','Rechnungsnr.','Betrag','Fälligkeit','Format','Status','Aktionen'].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((inv)=>{
                const dk = discountInfo[inv.id];
                return (
                <tr key={inv.id} className="tr-hover" onClick={()=>openReview(inv)} style={{cursor:'pointer',background:reviewInv?.id===inv.id?T.accentLight:undefined}}>
                  <td>
                    <div style={{fontWeight:600,fontSize:13,color:T.textPrimary}}>{inv.sender_name||'Unbekannt'}</div>
                    <div style={{fontSize:11,color:T.textMuted}}>{inv.sender_email||''}</div>
                    {dk?.active&&<span style={{fontSize:10,background:'#fef3c7',color:'#92400e',borderRadius:3,padding:'1px 5px',fontWeight:700}}>💰 Skonto</span>}
                  </td>
                  <td style={{fontFamily:F.mono,fontSize:12,fontWeight:600}}>{inv.invoice_number||'-'}</td>
                  <td>
                    <div style={{fontWeight:700}}>{inv.amount?fmtEUR(inv.amount):'-'}</div>
                    {dk?.active&&<div style={{fontSize:11,color:'#16a34a',fontWeight:600}}>-{fmtEUR(dk.savingEur)} Skonto</div>}
                  </td>
                  <td style={{fontSize:12,color:inv.due_date&&new Date(inv.due_date)<new Date()?T.red:T.textMuted}}>
                    {inv.due_date?new Date(inv.due_date).toLocaleDateString('de-DE'):'-'}
                  </td>
                  <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:700,fontFamily:F.mono}}>{(inv.format||'?').toUpperCase()}</span></td>
                  <td><StatusBadge status={inv.status==='bezahlt'?'delivered':inv.validation_passed?'validated':'error'}/></td>
                  <td>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                      {(inv.has_xml||inv.format==='pdf')&&<button className="btn btn-ghost btn-sm" onClick={()=>api.openInboundPDF(inv.id).catch(e=>notify(e.message,'error'))}>📄 PDF</button>}
                      {inv.status!=='bezahlt'&&inv.seller_iban&&(
                        <button className="btn btn-sm btn-primary" style={{fontSize:11,padding:'3px 8px'}}
                          onClick={()=>setSepaModal({...inv,_applyDiscount:dk?.active||false})}>
                          💳 Zahlen
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setFwdModal(inv.id);setFwdEmail('');}}>✉</button>
                      {inv.status!=='bezahlt'&&<button className="btn btn-ghost btn-sm" onClick={async()=>{ await api.markInboundPaid(inv.id); notify('Als bezahlt markiert ✓','success'); load(); }}>✓</button>}
                    </div>
                  </td>
                </tr>
              )})}
              {filtered.length===0&&<tr><td colSpan={7} style={{padding:0}}>
                <div style={{textAlign:'center',padding:'56px 24px',color:T.textMuted}}>
                  <div style={{width:56,height:56,borderRadius:14,background:T.accentLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 16px'}}>📬</div>
                  <div style={{fontSize:16,fontWeight:600,color:T.textPrimary,marginBottom:8}}>Noch keine Eingangsrechnung</div>
                  <div style={{fontSize:14,marginBottom:6}}>Deine Eingangs-E-Mail-Adresse ist bereit:</div>
                  <code style={{background:T.accentLight,padding:'4px 10px',borderRadius:5,fontSize:12.5,fontFamily:F.mono,color:T.accent}}>{emailSlug}@rechnungen.invoiq.io</code>
                  <div style={{fontSize:13,marginTop:14}}>Lieferanten schicken Rechnungen einfach dorthin.</div>
                </div>
              </td></tr>}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* ── REVIEW DETAIL-PANEL (Split-Pane rechts) ── */}
      {reviewInv&&(()=>{
        const f = (key)=> reviewEdit[key]!==undefined ? reviewEdit[key] : (reviewInv[key]??'');
        const edited = (key)=> reviewEdit[key]!==undefined;
        const wasCorrected = (key)=> Array.isArray(reviewInv.corrected_fields)&&reviewInv.corrected_fields.includes(key);
        const conf = Math.round((parseFloat(reviewInv.confidence)||0.85)*100);
        const confColor = conf>=90?T.green:conf>=75?T.amber:T.red;
        const Field = ({label,k,type='text',mono=false})=>(
          <div style={{marginBottom:11}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
              <label style={{fontSize:10.5,fontWeight:600,color:T.textMuted,letterSpacing:.3,textTransform:'uppercase'}}>{label}</label>
              {edited(k)?<span style={{fontSize:9,fontWeight:700,color:T.amber}}>● geändert</span>
               :wasCorrected(k)?<span style={{fontSize:9,fontWeight:700,color:T.purple}}>✎ korrigiert</span>
               :<span style={{fontSize:9,fontWeight:700,color:T.green}}>KI ✓</span>}
            </div>
            <input className="input" type={type} value={f(k)}
              style={{fontFamily:mono?F.mono:F.ui,fontSize:13,borderColor:edited(k)?T.amber:undefined}}
              onChange={e=>setReviewEdit(p=>({...p,[k]:e.target.value}))}/>
          </div>
        );
        return (
        <div className="card fi" style={{flex:'1 1 54%',minWidth:340,position:'sticky',top:14,maxHeight:'calc(100vh - 90px)',overflowY:'auto'}}>
          {/* Kopf */}
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.bgBorder}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,letterSpacing:'-.02em'}}>{reviewInv.seller_name||reviewInv.sender_name||'Rechnung'}</div>
              <div style={{fontSize:11.5,color:T.textMuted,marginTop:2,fontFamily:F.mono}}>{reviewInv.invoice_number||'—'} · {(reviewInv.format||'?').toUpperCase()}</div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:10.5,fontWeight:700,padding:'3px 9px',borderRadius:5,background:confColor+'15',color:confColor,border:`1px solid ${confColor}30`,fontFamily:F.mono}}>KI {conf}%</span>
              <button onClick={()=>setReviewInv(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:19,color:T.textMuted,lineHeight:1}}>×</button>
            </div>
          </div>

          {/* Lieferanten-Wissen */}
          {reviewVendor&&(
            <div style={{margin:'14px 20px 0',padding:'10px 13px',background:T.accentLight,border:`1px solid ${T.accentPale}`,borderRadius:9,fontSize:12,color:T.textSecondary}}>
              <strong style={{color:T.accent}}>Bekannter Lieferant</strong> — {reviewVendor.auto_approved||0}× ohne Korrektur freigegeben{reviewVendor.default_account?`, Konto ${reviewVendor.default_account}`:''}
            </div>
          )}

          {/* Felder — KI-Vorschläge editierbar */}
          <div style={{padding:'16px 20px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
              <Field label="Rechnungsnummer" k="invoice_number" mono/>
              <Field label="Betrag (Brutto €)" k="amount" type="number" mono/>
              <Field label="Fälligkeit" k="due_date" type="date"/>
              <Field label="Netto €" k="amount_net" type="number" mono/>
              <Field label="Lieferant" k="seller_name"/>
              <Field label="USt-IdNr." k="seller_vat_id" mono/>
              <Field label="IBAN" k="seller_iban" mono/>
              <Field label="Verwendungszweck" k="payment_reference"/>
              <Field label="Skonto %" k="discount_percent" type="number" mono/>
              <Field label="Skonto Tage" k="discount_days" type="number" mono/>
              <Field label="DATEV-Konto (Vorschlag)" k="suggested_account" mono/>
            </div>

            {/* Aktionen */}
            <div style={{display:'flex',gap:8,marginTop:14,paddingTop:14,borderTop:`1px solid ${T.bgBorder}`}}>
              {Object.keys(reviewEdit).length>0&&(
                <button className="btn btn-ghost" onClick={saveCorrections} disabled={reviewSaving} style={{borderColor:T.amber,color:T.amber}}>
                  {reviewSaving?<Spinner size={13} color={T.amber}/>:`✎ ${Object.keys(reviewEdit).length} Korrektur${Object.keys(reviewEdit).length>1?'en':''} speichern`}
                </button>
              )}
              <div style={{flex:1}}/>
              <button className="btn btn-ghost" onClick={()=>doReview('abgelehnt')} style={{color:T.red,borderColor:T.redBdr}}>Ablehnen</button>
              <button className="btn btn-primary" onClick={()=>doReview('freigegeben')}>✓ Freigeben</button>
            </div>
            {reviewInv.review_status&&reviewInv.review_status!=='neu'&&(
              <div style={{marginTop:10,fontSize:11.5,color:T.textMuted}}>Status: <strong style={{color:reviewInv.review_status==='freigegeben'?T.green:reviewInv.review_status==='abgelehnt'?T.red:T.amber}}>{reviewInv.review_status}</strong>{reviewInv.reviewed_at?` · ${new Date(reviewInv.reviewed_at).toLocaleString('de-DE')}`:''}</div>
            )}
          </div>
        </div>
        );
      })()}
      </div>

      {/* SEPA Modal */}
      {sepaModal&&<div className="modal-overlay" onClick={()=>setSepaModal(null)}>
        <div className="modal sci" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:17,fontWeight:700,color:T.textPrimary}}>💳 SEPA-Zahlung vorbereiten</div>
            <button onClick={()=>setSepaModal(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:T.textMuted}}>×</button>
          </div>

          {/* Zahlungsdetails */}
          <div style={{background:T.bgMuted,borderRadius:8,padding:14,marginBottom:16,fontSize:13}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>EMPFÄNGER</div><div style={{fontWeight:600,color:T.textPrimary}}>{sepaModal.seller_name||'Lieferant'}</div></div>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>BETRAG</div>
                <div style={{fontWeight:700,fontSize:15,color:sepaModal._applyDiscount?'#16a34a':T.textPrimary}}>
                  {sepaModal._applyDiscount&&sepaModal.discount_percent
                    ? fmtEUR(sepaModal.amount*(1-sepaModal.discount_percent/100))
                    : fmtEUR(sepaModal.amount)
                  }
                  {sepaModal._applyDiscount&&sepaModal.discount_percent&&(
                    <span style={{fontSize:11,color:'#16a34a',marginLeft:6}}>(-{sepaModal.discount_percent}% Skonto)</span>
                  )}
                </div>
              </div>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>IBAN</div><div style={{fontFamily:F.mono,fontSize:12}}>{sepaModal.seller_iban||'—'}</div></div>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:2}}>VERWENDUNGSZWECK</div><div style={{fontSize:12}}>{sepaModal.payment_reference||sepaModal.invoice_number||'—'}</div></div>
            </div>
          </div>

          {/* Skonto Toggle */}
          {sepaModal.discount_percent&&discountInfo[sepaModal.id]?.active&&(
            <div style={{padding:'10px 12px',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:7,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:12.5,color:'#92400e'}}>
                <strong>Skonto anwenden:</strong> spare {fmtEUR(discountInfo[sepaModal.id].savingEur)} ({sepaModal.discount_percent}%)<br/>
                <span style={{fontSize:11}}>Frist: noch {discountInfo[sepaModal.id].daysLeft} Tage</span>
              </div>
              <button className="btn btn-sm" style={{background:sepaModal._applyDiscount?'#16a34a':'#e5e7eb',color:sepaModal._applyDiscount?'#fff':'#374151',border:'none',fontWeight:700,minWidth:60}}
                onClick={()=>setSepaModal(p=>({...p,_applyDiscount:!p._applyDiscount}))}>
                {sepaModal._applyDiscount?'✓ An':'Aus'}
              </button>
            </div>
          )}

          <div style={{fontSize:12,color:T.textMuted,marginBottom:16,lineHeight:1.5}}>
            📥 Die SEPA-Datei (pain.001 XML) wird heruntergeladen. Laden Sie diese in Ihr Online-Banking hoch — alle Felder sind vorausgefüllt. Nur noch PIN eingeben.
          </div>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" onClick={()=>setSepaModal(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={async()=>{
              try{
                await api.downloadSepa(sepaModal.id, sepaModal._applyDiscount||false);
                notify('SEPA-Datei heruntergeladen ✓','success');
                setSepaModal(null);
              }catch(e){ notify(e.message,'error'); }
            }}>
              ↓ SEPA-Datei herunterladen
            </button>
          </div>
        </div>
      </div>}

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


// ══════════════════════════════════════════════════════════════
// VERTRIEB — SAP-naher Belegfluss (Anfrage→Angebot→Auftrag→Lieferung→Rechnung)
// ══════════════════════════════════════════════════════════════

const DOC_LABELS={request:"Anfrage",quote:"Angebot",order:"Auftrag",delivery:"Lieferung",invoice:"Rechnung"};
const DOC_CHAIN=["request","quote","order","delivery","invoice"];
const STATUS_LABELS={offen:"Offen",beantwortet:"Beantwortet",entwurf:"Entwurf",gesendet:"Gesendet",angenommen:"Angenommen",abgelehnt:"Abgelehnt",abgelaufen:"Abgelaufen",bestaetigt:"Bestätigt",geliefert:"Geliefert",fakturiert:"Fakturiert",storniert:"Storniert"};

// Client-seitige Steuer-Summierung (spiegelt services/taxEngine.js:
// Rundung pro Kennzeichen-Gruppe). Verbindlich rechnet immer das Backend.
function clientComputeTotals(items,taxCodes){
  const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
  const rateOf=c=>taxCodes.find(t=>t.code===c)?.rate??19;
  const groups={};
  let net=0;
  for(const it of items){
    const code=it.tax_code||"S19";
    const n=r2((parseFloat(it.quantity)||0)*(parseFloat(it.unit_price)||0));
    groups[code]=r2((groups[code]||0)+n);
    net=r2(net+n);
  }
  let tax=0;
  const breakdown=Object.entries(groups).map(([code,gNet])=>{
    const gTax=r2(gNet*(rateOf(code)/100));
    tax=r2(tax+gTax);
    return {code,rate:rateOf(code),net:gNet,tax:gTax,label:taxCodes.find(t=>t.code===code)?.label||code};
  });
  return {net,tax,gross:r2(net+tax),breakdown};
}

// Belegfluss-Kette: Anfrage → Angebot → Auftrag → Lieferung → Rechnung
function FlowChain({flow,currentId,onOpen}){
  const byType={};
  (flow?.nodes||[]).forEach(n=>{(byType[n.type]=byType[n.type]||[]).push(n);});
  return(
    <div style={{display:"flex",alignItems:"stretch",gap:0,overflowX:"auto",padding:"4px 0"}}>
      {DOC_CHAIN.map((t,i)=>{
        const nodes=byType[t]||[];
        return(
          <div key={t} style={{display:"flex",alignItems:"center",flexShrink:0}}>
            <div style={{minWidth:132}}>
              <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:5}}>{DOC_LABELS[t]}</div>
              {nodes.length===0
                ?<div style={{border:`1.5px dashed ${T.bgBorder}`,borderRadius:8,padding:"9px 11px",fontSize:11.5,color:T.textPlaceholder,textAlign:"center"}}>—</div>
                :nodes.map(n=>(
                  <div key={n.id} onClick={()=>n.id!==currentId&&onOpen&&onOpen(n)}
                    style={{border:`1.5px solid ${n.id===currentId?T.accent:T.bgBorder}`,background:n.id===currentId?T.accentLight:T.bg,borderRadius:8,padding:"7px 11px",marginBottom:4,cursor:n.id===currentId?"default":"pointer",boxShadow:n.id===currentId?`0 0 0 2px ${T.accentPale}`:"none"}}>
                    <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:T.textPrimary}}>{n.number}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,marginTop:3}}>
                      <StatusBadge status={n.status}/>
                      <span style={{fontSize:10.5,color:T.textMuted,fontWeight:600}}>{fmtEUR(n.amount_gross)}</span>
                    </div>
                  </div>
                ))}
            </div>
            {i<DOC_CHAIN.length-1&&<div style={{width:26,display:"flex",justifyContent:"center",color:T.textPlaceholder,fontSize:15,paddingTop:14}}>→</div>}
          </div>
        );
      })}
    </div>
  );
}

function BusinessScreen({notify,onOpenInvoice}){
  const[tab,setTab]=useState("all");
  const[docs,setDocs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[view,setView]=useState("list"); // list | create | detail
  const[detail,setDetail]=useState(null); // {document, flow, next_statuses, convert_targets}
  const[busy,setBusy]=useState(false);
  const[taxCodes,setTaxCodes]=useState([]);
  const[customers,setCustomers]=useState([]);
  const[bizItems,setBizItems]=useState([]);
  const[warnings,setWarnings]=useState([]);

  const emptyForm={doc_type:"quote",partner_id:"",partner_name:"",doc_date:new Date().toISOString().slice(0,10),valid_until:"",delivery_date:"",reference:"",notes:"",items:[{description:"",quantity:1,unit_price:0,tax_code:"S19"}]};
  const[form,setForm]=useState(emptyForm);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const updItem=(i,k,v)=>{const a=[...form.items];a[i]={...a[i],[k]:["quantity","unit_price"].includes(k)?(parseFloat(v)||0):v};upd("items",a);};

  const load=useCallback(()=>{
    setLoading(true);
    api.listBusinessDocs(tab==="all"?"":`?type=${tab}`)
      .then(d=>setDocs(d.documents||[])).catch(()=>setDocs([])).finally(()=>setLoading(false));
  },[tab]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    api.getTaxCodes().then(d=>setTaxCodes(d.tax_codes||[])).catch(()=>setTaxCodes([{code:"S19",rate:19,label:"USt 19 %"},{code:"S7",rate:7,label:"USt 7 %"}]));
    api.listCustomers().then(d=>setCustomers(d.customers||[])).catch(()=>{});
    api.listBusinessItems().then(d=>setBizItems(d.items||[])).catch(()=>{});
  },[]);

  const openDetail=async(id)=>{
    try{const d=await api.getBusinessDoc(id);setDetail(d);setWarnings([]);setView("detail");window.scrollTo(0,0);}
    catch(e){notify(e.message,"error");}
  };

  const pickItem=(rowIdx,itemId)=>{
    const it=bizItems.find(x=>x.id===itemId);
    if(!it)return;
    const a=[...form.items];
    a[rowIdx]={...a[rowIdx],item_id:it.id,description:it.name,unit_price:parseFloat(it.unit_price)||0,unit:it.unit||"C62",tax_code:it.tax_code||"S19"};
    upd("items",a);
  };

  const create=async()=>{
    setBusy(true);setWarnings([]);
    try{
      const r=await api.createBusinessDoc(form);
      setWarnings(r.warnings||[]);
      notify(`${DOC_LABELS[form.doc_type]} ${r.document.doc_number} angelegt ✓`,"success");
      setForm(emptyForm);load();openDetail(r.document.id);
    }catch(e){
      // 422 mit fachlichen Warnungen strukturiert anzeigen
      notify(e.message||"Beleg konnte nicht angelegt werden","error");
    }
    setBusy(false);
  };

  const doStatus=async(status)=>{
    setBusy(true);
    try{
      await api.setBusinessDocStatus(detail.document.id,status);
      notify(`Status: ${STATUS_LABELS[status]||status} ✓`,"success");
      load();openDetail(detail.document.id);
    }catch(e){notify(e.message,"error");}
    setBusy(false);
  };

  const doConvert=async(target)=>{
    setBusy(true);setWarnings([]);
    try{
      const r=await api.convertBusinessDoc(detail.document.id,target);
      setWarnings(r.warnings||[]);
      if(target==="invoice"){
        notify(`Rechnung ${r.invoice.invoice_number} erzeugt ✓ (EN 16931 validiert)`,"success");
        load();openDetail(detail.document.id);
      }else{
        notify(`${DOC_LABELS[target]} ${r.document.doc_number} angelegt ✓`,"success");
        load();openDetail(r.document.id);
      }
    }catch(e){notify(e.message,"error");}
    setBusy(false);
  };

  const totals=clientComputeTotals(form.items,taxCodes);
  const filtered=docs.filter(d=>!search||(d.doc_number||"").toLowerCase().includes(search.toLowerCase())||(d.partner_name||"").toLowerCase().includes(search.toLowerCase()));

  const WarningList=()=>warnings.length===0?null:(
    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
      {warnings.map((w,i)=><Alert key={i} severity={w.severity==="error"?"error":"warning"}>{w.msg}</Alert>)}
    </div>
  );

  // ── CREATE ────────────────────────────────────────────────────
  if(view==="create")return(<div className="fi" style={{maxWidth:860}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setWarnings([]);}}>← Zurück</button>
      <div><h1 style={{fontSize:20,fontWeight:700,color:T.textPrimary}}>Neuen Beleg anlegen</h1>
      <p style={{fontSize:12,color:T.textMuted}}>Anfrage, Angebot, Auftrag oder Lieferung — Folgebelege entstehen per „Anlegen mit Bezug".</p></div>
    </div>
    <WarningList/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(300px,100%),1fr))",gap:12,marginBottom:12}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>Belegart & Datum</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div><label className="label">Belegart</label>
            <select className="select" value={form.doc_type} onChange={e=>upd("doc_type",e.target.value)}>
              {["request","quote","order","delivery"].map(t=><option key={t} value={t}>{DOC_LABELS[t]}</option>)}
            </select>
          </div>
          <div><label className="label">Belegdatum</label><input className="input" type="date" value={form.doc_date} onChange={e=>upd("doc_date",e.target.value)}/></div>
          {form.doc_type==="quote"&&<div><label className="label">Gültig bis (Bindefrist)</label><input className="input" type="date" value={form.valid_until} onChange={e=>upd("valid_until",e.target.value)}/></div>}
          {["order","delivery"].includes(form.doc_type)&&<div><label className="label">Liefertermin</label><input className="input" type="date" value={form.delivery_date} onChange={e=>upd("delivery_date",e.target.value)}/></div>}
          <div><label className="label">Referenz (Bestell-Nr. des Kunden)</label><input className="input" value={form.reference} onChange={e=>upd("reference",e.target.value)} placeholder="z.B. PO-4711"/></div>
        </div>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:14}}>Geschäftspartner</div>
        <div style={{marginBottom:10}}><label className="label">Kunde (aus Stammdaten)</label>
          <select className="select" value={form.partner_id} onChange={e=>upd("partner_id",e.target.value)}>
            <option value="">— Kunde wählen —</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` · ${c.city}`:""}</option>)}
          </select>
        </div>
        {!form.partner_id&&<div><label className="label">…oder Name frei eingeben</label><input className="input" value={form.partner_name} onChange={e=>upd("partner_name",e.target.value)} placeholder="Firma GmbH"/></div>}
        <div style={{fontSize:11,color:T.textMuted,marginTop:10}}>Belege übernehmen die Partnerdaten als Momentaufnahme — spätere Stammdaten-Änderungen verändern bestehende Belege nicht.</div>
      </div>
    </div>
    <div className="card" style={{padding:20,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Positionen</div>
      {form.items.map((item,idx)=>(
        <div key={idx} style={{background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:12,marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:8,marginBottom:8}}>
            {bizItems.length>0&&<div><label className="label">Artikel/Leistung (Stammdaten)</label>
              <select className="select" value={item.item_id||""} onChange={e=>pickItem(idx,e.target.value)}>
                <option value="">— frei erfassen —</option>
                {bizItems.map(b=><option key={b.id} value={b.id}>{b.name} · {fmtEUR(b.unit_price)}</option>)}
              </select>
            </div>}
            <div style={{gridColumn:bizItems.length>0?"auto":"1 / -1"}}><label className="label">Beschreibung</label>
              <input className="input" value={item.description} onChange={e=>updItem(idx,"description",e.target.value)} placeholder="Leistungsbeschreibung…"/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"90px 130px 1fr auto",gap:8,alignItems:"end"}}>
            <div><label className="label">Menge</label><input className="input" type="number" min="0" step="0.001" value={item.quantity} onChange={e=>updItem(idx,"quantity",e.target.value)}/></div>
            <div><label className="label">Einzelpreis €</label><input className="input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updItem(idx,"unit_price",e.target.value)}/></div>
            <div><label className="label">Steuerkennzeichen</label>
              <select className="select" value={item.tax_code||"S19"} onChange={e=>updItem(idx,"tax_code",e.target.value)}>
                {taxCodes.map(t=><option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </select>
            </div>
            <button onClick={()=>upd("items",form.items.filter((_,j)=>j!==idx))} style={{background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:7,color:T.red,cursor:"pointer",fontSize:15,width:32,height:34}}>×</button>
          </div>
        </div>
      ))}
      <button onClick={()=>upd("items",[...form.items,{description:"",quantity:1,unit_price:0,tax_code:"S19"}])} style={{width:"100%",padding:"8px",border:`1.5px dashed ${T.bgBorder}`,background:"transparent",color:T.accent,cursor:"pointer",borderRadius:7,marginTop:4,fontSize:13,fontFamily:F.ui,fontWeight:500}}>+ Position hinzufügen</button>

      {/* Steuer-Breakdown live */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
        <div style={{background:T.bgSubtle,borderRadius:9,padding:"12px 16px",minWidth:280,border:`1px solid ${T.bgBorder}`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:32,marginBottom:6,fontSize:13,color:T.textMuted}}><span>Netto</span><span>{fmtEUR(totals.net)}</span></div>
          {totals.breakdown.map(b=>(
            <div key={b.code} style={{display:"flex",justifyContent:"space-between",gap:32,marginBottom:4,fontSize:12,color:T.textMuted}}>
              <span><span style={{fontFamily:F.mono,fontSize:10.5,background:T.bgMuted,borderRadius:3,padding:"1px 5px",marginRight:6}}>{b.code}</span>{b.rate} %</span>
              <span>{fmtEUR(b.tax)}</span>
            </div>
          ))}
          <div style={{height:1,background:T.bgBorder,margin:"7px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:32,fontSize:17,color:T.textPrimary,fontWeight:700}}><span>Brutto</span><span>{fmtEUR(totals.gross)}</span></div>
        </div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:16}}>
      <button className="btn btn-ghost" onClick={()=>{setView("list");setWarnings([]);}}>Abbrechen</button>
      <button className="btn btn-primary" style={{padding:"10px 24px"}} onClick={create} disabled={busy}>{busy?<><Spinner color="#fff" size={14}/>&nbsp;Legt an…</>:`${DOC_LABELS[form.doc_type]} anlegen →`}</button>
    </div>
  </div>);

  // ── DETAIL ────────────────────────────────────────────────────
  if(view==="detail"&&detail){
    const d=detail.document;
    return(<div className="fi">
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>{setView("list");setWarnings([]);load();}}>← Alle Belege</button>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <h1 style={{fontSize:20,fontWeight:700,color:T.textPrimary,fontFamily:F.mono}}>{d.doc_number}</h1>
            <span className="badge badge-purple">{DOC_LABELS[d.doc_type]}</span>
            <StatusBadge status={d.status}/>
          </div>
          <p style={{fontSize:12.5,color:T.textMuted,marginTop:3}}>{d.partner_name} · {d.doc_date?new Date(d.doc_date).toLocaleDateString("de-DE"):""}{d.reference?` · Ref: ${d.reference}`:""}</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {(detail.next_statuses||[]).map(s=>(
            <button key={s} className={`btn btn-sm ${s==="storniert"?"btn-danger":"btn-ghost"}`} onClick={()=>doStatus(s)} disabled={busy}>
              {s==="storniert"?"Stornieren":`→ ${STATUS_LABELS[s]||s}`}
            </button>
          ))}
          {(detail.convert_targets||[]).map(t=>(
            <button key={t} className="btn btn-primary btn-sm" onClick={()=>doConvert(t)} disabled={busy}>
              {t==="invoice"?"⚡ Rechnung erzeugen":`+ ${DOC_LABELS[t]} mit Bezug`}
            </button>
          ))}
        </div>
      </div>
      <WarningList/>

      {/* Belegfluss */}
      <div className="card" style={{padding:18,marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Belegfluss</div>
        <FlowChain flow={detail.flow} currentId={d.id} onOpen={(n)=>{
          if(n.type==="invoice"){onOpenInvoice&&onOpenInvoice();return;}
          openDetail(n.id);
        }}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:14}}>
        {/* Positionen */}
        <div className="card" style={{gridColumn:"1 / -1"}}>
          <div style={{padding:"13px 18px",borderBottom:`1px solid ${T.bgBorder}`,fontSize:13,fontWeight:700,color:T.textPrimary}}>Positionen</div>
          <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead><tr>{["Pos.","Beschreibung","Menge","Einzelpreis","Steuer","Netto"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {(d.items||[]).map(it=>(
                <tr key={it.id||it.position}>
                  <td style={{color:T.textMuted,fontFamily:F.mono,fontSize:12}}>{it.position}</td>
                  <td style={{fontWeight:500}}>{it.description}</td>
                  <td>{parseFloat(it.quantity)}</td>
                  <td>{fmtEUR(it.unit_price)}</td>
                  <td><span style={{fontFamily:F.mono,fontSize:11,background:T.bgMuted,borderRadius:4,padding:"2px 6px",color:T.textSecondary}}>{it.tax_code}</span></td>
                  <td style={{fontWeight:600}}>{fmtEUR(it.net_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Steuerübersicht */}
        <div className="card" style={{padding:18}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Steuerübersicht</div>
          {(d.tax_breakdown||[]).map(b=>(
            <div key={b.code} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.bgSubtle}`,fontSize:12.5}}>
              <span><span style={{fontFamily:F.mono,fontSize:10.5,background:T.bgMuted,borderRadius:3,padding:"1px 5px",marginRight:7}}>{b.code}</span>{b.label||`${b.rate} %`}</span>
              <span style={{fontWeight:600}}>{fmtEUR(b.net)} → {fmtEUR(b.tax)}</span>
            </div>
          ))}
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:5,fontSize:13.5}}>
            <div style={{display:"flex",justifyContent:"space-between",color:T.textMuted}}><span>Netto</span><span>{fmtEUR(d.amount_net)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",color:T.textMuted}}><span>Steuer</span><span>{fmtEUR(d.amount_tax)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:16,color:T.textPrimary,paddingTop:5,borderTop:`1px solid ${T.bgBorder}`}}><span>Brutto</span><span>{fmtEUR(d.amount_gross)}</span></div>
          </div>
          {(d.tax_breakdown||[]).filter(b=>b.note).map(b=>(
            <div key={b.code+"n"} style={{marginTop:10,fontSize:11.5,color:T.textSecondary,background:T.bgSubtle,border:`1px solid ${T.bgBorder}`,borderRadius:6,padding:"8px 10px"}}>{b.note}</div>
          ))}
        </div>

        {/* Partner-Snapshot */}
        <div className="card" style={{padding:18}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:.5,textTransform:"uppercase",marginBottom:12}}>Geschäftspartner (Belegstand)</div>
          {[["Name",d.partner_name],["USt-IdNr.",d.partner_vat_id||"—"],["Adresse",[d.partner_address,`${d.partner_zip||""} ${d.partner_city||""}`.trim(),d.partner_country].filter(Boolean).join(", ")||"—"],["E-Mail",d.partner_email||"—"],["Zahlungsziel",d.payment_terms_days?`${d.payment_terms_days} Tage`:"—"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"6px 0",borderBottom:`1px solid ${T.bgSubtle}`,fontSize:12.5}}>
              <span style={{color:T.textMuted,flexShrink:0}}>{l}</span><span style={{fontWeight:500,color:T.textPrimary,textAlign:"right"}}>{v}</span>
            </div>
          ))}
          {d.notes&&<div style={{marginTop:10,fontSize:12.5,color:T.textSecondary}}><strong>Notiz:</strong> {d.notes}</div>}
        </div>
      </div>
    </div>);
  }

  // ── LISTE ─────────────────────────────────────────────────────
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <h1 style={{fontSize:20,fontWeight:700,color:T.textPrimary}}>Belege & Aufträge</h1>
        <p style={{fontSize:12.5,color:T.textMuted,marginTop:2}}>Anfrage → Angebot → Auftrag → Lieferung → Rechnung — mit durchgängigem Belegfluss.</p>
      </div>
      <button className="btn btn-primary btn-sm" style={{padding:"8px 18px",fontWeight:700}} onClick={()=>{setForm(emptyForm);setView("create");setWarnings([]);}}>+ Neuer Beleg</button>
    </div>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:12,overflowX:"auto"}}>
      {["all","request","quote","order","delivery"].map(t=>(
        <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
          {t==="all"?"Alle":DOC_LABELS[t]+"n"}
          {t!=="all"&&<span style={{marginLeft:4,fontSize:10,background:T.bgMuted,padding:"1px 5px",borderRadius:7,color:T.textMuted}}>{docs.filter(d=>d.doc_type===t).length}</span>}
        </button>
      ))}
    </div>
    <div style={{marginBottom:12}}>
      <input className="input" style={{maxWidth:320}} placeholder="Suche: Nummer, Partner, Referenz…" value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
    <div className="card">
      <div style={{overflowX:"auto"}}>
      <table className="table">
        <thead><tr>{["Beleg","Art","Partner","Datum","Brutto","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2,3].map(i=><tr key={i}><td colSpan={6}><div className="skeleton" style={{height:14}}/></td></tr>)
          :filtered.map(d=>(
            <tr key={d.id} className="tr-hover" style={{cursor:"pointer"}} onClick={()=>openDetail(d.id)}>
              <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12.5,color:T.textPrimary}}>{d.doc_number}</td>
              <td><span className="badge badge-purple" style={{fontSize:10.5}}>{DOC_LABELS[d.doc_type]}</span></td>
              <td>{d.partner_name||"—"}</td>
              <td style={{fontSize:12.5,color:T.textMuted}}>{d.doc_date?new Date(d.doc_date).toLocaleDateString("de-DE"):"—"}</td>
              <td style={{fontWeight:600}}>{fmtEUR(d.amount_gross)}</td>
              <td><StatusBadge status={d.status}/></td>
            </tr>
          ))}
          {!loading&&filtered.length===0&&(
            <tr><td colSpan={6} style={{padding:0}}>
              <div style={{textAlign:"center",padding:"56px 24px",color:T.textMuted}}>
                <div style={{width:56,height:56,borderRadius:14,background:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>🔗</div>
                <div style={{fontSize:16,fontWeight:600,color:T.textPrimary,marginBottom:8}}>Noch keine Belege</div>
                <div style={{fontSize:13.5,marginBottom:18,maxWidth:400,margin:"0 auto 18px"}}>Starte mit einer Anfrage oder direkt einem Angebot — Folgebelege bis zur Rechnung entstehen per Klick, mit vollständigem Belegfluss.</div>
                <button className="btn btn-primary" onClick={()=>{setForm(emptyForm);setView("create");}}>Ersten Beleg anlegen →</button>
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  </div>);
}

// ── ARTIKEL & LEISTUNGEN (Stammdaten) ─────────────────────────
function ItemsScreen({notify}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[taxCodes,setTaxCodes]=useState([]);
  const[modal,setModal]=useState(null); // null | {} (neu) | item (edit)
  const[busy,setBusy]=useState(false);

  const load=()=>{setLoading(true);api.listBusinessItems().then(d=>setItems(d.items||[])).catch(()=>setItems([])).finally(()=>setLoading(false));};
  useEffect(()=>{load();api.getTaxCodes().then(d=>setTaxCodes(d.tax_codes||[])).catch(()=>setTaxCodes([{code:"S19",rate:19,label:"USt 19 %"}]));},[]);

  const save=async()=>{
    if(!(modal.name||"").trim()||modal.name.trim().length<2){notify("Name (min. 2 Zeichen) erforderlich","error");return;}
    setBusy(true);
    try{
      const payload={name:modal.name.trim(),item_number:modal.item_number||"",description:modal.description||"",unit:modal.unit||"C62",unit_price:parseFloat(modal.unit_price)||0,tax_code:modal.tax_code||"S19",external_ref:modal.external_ref||""};
      if(modal.id)await api.patchBusinessItem(modal.id,payload);
      else await api.createBusinessItem(payload);
      notify("Artikel gespeichert ✓","success");setModal(null);load();
    }catch(e){notify(e.message,"error");}
    setBusy(false);
  };
  const remove=async(id)=>{
    try{await api.deleteBusinessItem(id);notify("Artikel deaktiviert","success");load();}
    catch(e){notify(e.message,"error");}
  };

  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <h1 style={{fontSize:20,fontWeight:700,color:T.textPrimary}}>Artikel & Leistungen</h1>
        <p style={{fontSize:12.5,color:T.textMuted,marginTop:2}}>Stammdaten für Angebote, Aufträge und Rechnungen — mit Preis und Steuerkennzeichen.</p>
      </div>
      <button className="btn btn-primary btn-sm" style={{fontWeight:700}} onClick={()=>setModal({unit:"C62",tax_code:"S19",unit_price:0})}>+ Neuer Artikel</button>
    </div>
    <div className="card">
      <div style={{overflowX:"auto"}}>
      <table className="table">
        <thead><tr>{["Artikel-Nr.","Name","Einheit","Einzelpreis","Steuer","ERP-Ref.",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2].map(i=><tr key={i}><td colSpan={7}><div className="skeleton" style={{height:14}}/></td></tr>)
          :items.map(it=>(
            <tr key={it.id} className="tr-hover" style={{cursor:"pointer"}} onClick={()=>setModal({...it})}>
              <td style={{fontFamily:F.mono,fontSize:12,color:T.textMuted}}>{it.item_number||"—"}</td>
              <td style={{fontWeight:600,color:T.textPrimary}}>{it.name}</td>
              <td style={{fontSize:12.5}}>{it.unit==="HUR"?"Stunde":it.unit==="C62"?"Stück":it.unit}</td>
              <td style={{fontWeight:600}}>{fmtEUR(it.unit_price)}</td>
              <td><span style={{fontFamily:F.mono,fontSize:11,background:T.bgMuted,borderRadius:4,padding:"2px 6px",color:T.textSecondary}}>{it.tax_code}</span></td>
              <td style={{fontSize:12,color:T.textMuted,fontFamily:F.mono}}>{it.external_ref||"—"}</td>
              <td onClick={e=>e.stopPropagation()}><button className="btn btn-danger btn-sm" onClick={()=>remove(it.id)}>Deaktivieren</button></td>
            </tr>
          ))}
          {!loading&&items.length===0&&(
            <tr><td colSpan={7} style={{textAlign:"center",padding:36,color:T.textMuted,fontSize:13.5}}>
              Noch keine Artikel — lege wiederverwendbare Leistungen mit Preis und Steuerkennzeichen an.
            </td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
    {modal&&<div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal sci" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:T.textPrimary}}>{modal.id?"Artikel bearbeiten":"Neuer Artikel"}</div>
          <button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textMuted}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 130px",gap:10}}>
            <div><label className="label">Name *</label><input className="input" value={modal.name||""} onChange={e=>setModal(p=>({...p,name:e.target.value}))} placeholder="Beratung Senior" autoFocus/></div>
            <div><label className="label">Artikel-Nr.</label><input className="input" value={modal.item_number||""} onChange={e=>setModal(p=>({...p,item_number:e.target.value}))} placeholder="A-100"/></div>
          </div>
          <div><label className="label">Beschreibung</label><input className="input" value={modal.description||""} onChange={e=>setModal(p=>({...p,description:e.target.value}))}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><label className="label">Einzelpreis €</label><input className="input" type="number" min="0" step="0.01" value={modal.unit_price} onChange={e=>setModal(p=>({...p,unit_price:e.target.value}))}/></div>
            <div><label className="label">Einheit</label>
              <select className="select" value={modal.unit||"C62"} onChange={e=>setModal(p=>({...p,unit:e.target.value}))}>
                <option value="C62">Stück</option><option value="HUR">Stunde</option><option value="DAY">Tag</option><option value="KGM">kg</option><option value="MTR">Meter</option>
              </select>
            </div>
            <div><label className="label">Steuerkennzeichen</label>
              <select className="select" value={modal.tax_code||"S19"} onChange={e=>setModal(p=>({...p,tax_code:e.target.value}))}>
                {taxCodes.map(t=><option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">ERP-Referenz (z.B. SAP-Materialnummer)</label><input className="input" value={modal.external_ref||""} onChange={e=>setModal(p=>({...p,external_ref:e.target.value}))} placeholder="MATNR / DATEV-Konto"/></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:18}}>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy?<><Spinner color="#fff" size={13}/>&nbsp;Speichert…</>:"Speichern"}</button>
        </div>
      </div>
    </div>}
  </div>);
}

// ── KI-BERATER (AI Core: Chat + Insights + Aktionsbestätigung) ─
function KIScreen({notify}){
  const[messages,setMessages]=useState([]);       // {role, content}
  const[actions,setActions]=useState([]);          // bestätigungspflichtige Vorschläge
  const[input,setInput]=useState("");
  const[busy,setBusy]=useState(false);
  const[insights,setInsights]=useState(null);
  const[insightsLoading,setInsightsLoading]=useState(true);
  const scrollRef=useRef(null);

  useEffect(()=>{api.aiInsights().then(setInsights).catch(()=>setInsights(null)).finally(()=>setInsightsLoading(false));},[]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[messages,busy]);

  const send=async(text)=>{
    const q=(text||input).trim();
    if(!q||busy)return;
    setInput("");
    const next=[...messages,{role:"user",content:q}];
    setMessages(next);
    setBusy(true);
    try{
      const res=await api.aiChat(next.slice(-16));
      setMessages(m=>[...m,{role:"assistant",content:res.reply}]);
      if(res.actions?.length)setActions(a=>[...a,...res.actions]);
    }catch(e){
      setMessages(m=>[...m,{role:"assistant",content:`⚠ ${e.message||"KI-Dienst nicht erreichbar."}`}]);
    }finally{setBusy(false);}
  };

  const executeAction=async(action)=>{
    setBusy(true);
    try{
      await api.aiExecute(action.type,action.payload);
      setActions(a=>a.filter(x=>x.id!==action.id));
      notify("Aktion ausgeführt ✓","success");
      setMessages(m=>[...m,{role:"assistant",content:`✓ Ausgeführt: ${action.summary}`}]);
    }catch(e){notify(e.message||"Ausführung fehlgeschlagen","error");}
    finally{setBusy(false);}
  };

  const SUGGESTIONS=[
    "Wie ist meine Liquiditätslage?",
    "Zeige mir alle unbezahlten Rechnungen",
    "Erstelle eine Rechnung für Mustermann GmbH über 5.000 € Beratungsleistung",
    "Welche Angebote sind noch offen?",
  ];

  return(<div>
    <div style={{marginBottom:18}}>
      <h1 className="h1">KI-Berater</h1>
      <div className="caption">Ihr ERP-Berater: fragt Zahlen ab, prüft Belege, setzt Sprache in Aktionen um — jede Schreibaktion bestätigen Sie vorher.</div>
    </div>

    {/* Insights-Karte */}
    <div className="card" style={{marginBottom:16,padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        {NAV_ICONS.ki}<b style={{fontSize:14}}>KI-Insights</b>
        {insights&&!insights.ai_available&&<span className="badge">nur Kennzahlen — KI offline</span>}
      </div>
      {insightsLoading?<div className="caption">Analysiere Kennzahlen…</div>
       :insights?.commentary?<div style={{fontSize:13.5,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{insights.commentary}</div>
       :insights?.cashflow?<div style={{fontSize:13.5}}>
          Offene Forderungen: <b>{(insights.cashflow.open_receivables||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}</b>
          {" · "}Verbindlichkeiten: <b>{(insights.cashflow.open_payables||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}</b>
          {" · "}Fällig diese Woche: <b>{(insights.cashflow.due_this_week_in||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}</b>
        </div>
       :<div className="caption">Keine Kennzahlen verfügbar.</div>}
    </div>

    {/* Bestätigungspflichtige Aktionen */}
    {actions.map(a=>(
      <div key={a.id} className="card" style={{marginBottom:12,padding:"14px 16px",borderLeft:`3px solid ${T.accent||"#635BFF"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div style={{minWidth:220,flex:1}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,color:T.textMuted,marginBottom:3}}>Vorschlag zur Bestätigung</div>
            <div style={{fontSize:14,fontWeight:600}}>{a.summary}</div>
            {a.totals&&<div className="caption" style={{marginTop:4}}>
              Netto {a.totals.net.toFixed(2)} € · Steuer {a.totals.tax.toFixed(2)} € · <b>Brutto {a.totals.gross.toFixed(2)} €</b>
            </div>}
            {(a.warnings||[]).map((w,i)=>(
              <div key={i} style={{fontSize:12.5,marginTop:5,color:w.severity==="error"?"#DC2626":"#B45309"}}>⚠ {w.msg}</div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>setActions(x=>x.filter(y=>y.id!==a.id))}>Verwerfen</button>
            <button className="btn btn-primary btn-sm" disabled={busy||(a.warnings||[]).some(w=>w.severity==="error")} onClick={()=>executeAction(a)}>Bestätigen & ausführen</button>
          </div>
        </div>
      </div>
    ))}

    {/* Chat */}
    <div className="card" style={{padding:0,display:"flex",flexDirection:"column",height:"52vh",minHeight:340}}>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
        {messages.length===0&&<div>
          <div className="caption" style={{marginBottom:10}}>Fragen Sie auf Deutsch — zum Beispiel:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {SUGGESTIONS.map(s=>(
              <button key={s} className="btn btn-outline btn-sm" style={{fontWeight:500}} onClick={()=>send(s)}>{s}</button>
            ))}
          </div>
        </div>}
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10}}>
            <div style={{
              maxWidth:"78%",padding:"9px 13px",borderRadius:12,fontSize:13.5,lineHeight:1.55,whiteSpace:"pre-wrap",
              background:m.role==="user"?(T.accent||"#635BFF"):T.bgSubtle,
              color:m.role==="user"?"#fff":"inherit",
              borderBottomRightRadius:m.role==="user"?4:12,
              borderBottomLeftRadius:m.role==="user"?12:4,
            }}>{m.content}</div>
          </div>
        ))}
        {busy&&<div className="caption" style={{padding:"4px 2px"}}>KI-Berater denkt nach…</div>}
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 14px",borderTop:`1px solid ${T.border||"#E5E7EB"}`}}>
        <input className="input" style={{flex:1}} placeholder="z. B. „Erstelle Rechnung für Kunde Mustermann über 5000 EUR Beratung“"
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} disabled={busy}/>
        <button className="btn btn-primary" onClick={()=>send()} disabled={busy||!input.trim()}>Senden</button>
      </div>
    </div>
  </div>);
}

// ── KUNDEN (Stammdaten) ───────────────────────────────────────
function KundenScreen({notify}){
  const[customers,setCustomers]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[modal,setModal]=useState(null);
  const[busy,setBusy]=useState(false);

  const load=()=>{setLoading(true);api.listCustomers().then(d=>setCustomers(d.customers||[])).catch(()=>setCustomers([])).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[]);

  const save=async()=>{
    if(!(modal.name||"").trim()||modal.name.trim().length<2){notify("Name (min. 2 Zeichen) erforderlich","error");return;}
    setBusy(true);
    try{
      const payload={name:modal.name.trim(),vat_id:modal.vat_id||"",address:modal.address||"",zip:modal.zip||"",city:modal.city||"",country:modal.country||"DE",email:modal.email||"",payment_terms_days:parseInt(modal.payment_terms_days)||30,external_ref:modal.external_ref||""};
      if(modal.id)await api.req("PATCH",`/customers/${modal.id}`,payload);
      else await api.post("/customers",payload);
      notify("Kunde gespeichert ✓","success");setModal(null);load();
    }catch(e){notify(e.message,"error");}
    setBusy(false);
  };

  const filtered=customers.filter(c=>!search||(c.name||"").toLowerCase().includes(search.toLowerCase())||(c.vat_id||"").includes(search));

  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <h1 style={{fontSize:20,fontWeight:700,color:T.textPrimary}}>Kunden</h1>
        <p style={{fontSize:12.5,color:T.textMuted,marginTop:2}}>Geschäftspartner-Stammdaten — fließen in Belege und Rechnungen ein und lernen aus jeder Rechnung mit.</p>
      </div>
      <button className="btn btn-primary btn-sm" style={{fontWeight:700}} onClick={()=>setModal({country:"DE",payment_terms_days:30})}>+ Neuer Kunde</button>
    </div>
    <div style={{marginBottom:12}}>
      <input className="input" style={{maxWidth:320}} placeholder="Suche: Name, USt-IdNr.…" value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
    <div className="card">
      <div style={{overflowX:"auto"}}>
      <table className="table">
        <thead><tr>{["Name","USt-IdNr.","Ort","Land","Zahlungsziel","Rechnungen","Letzte Rechnung"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {loading?[1,2].map(i=><tr key={i}><td colSpan={7}><div className="skeleton" style={{height:14}}/></td></tr>)
          :filtered.map(c=>(
            <tr key={c.id} className="tr-hover" style={{cursor:"pointer"}} onClick={()=>setModal({...c})}>
              <td style={{fontWeight:600,color:T.textPrimary}}>{c.name}</td>
              <td style={{fontFamily:F.mono,fontSize:12}}>{c.vat_id||"—"}</td>
              <td style={{fontSize:12.5}}>{c.city||"—"}</td>
              <td style={{fontSize:12.5}}>{c.country||"DE"}</td>
              <td style={{fontSize:12.5}}>{c.payment_terms_days?`${c.payment_terms_days} Tage`:"—"}</td>
              <td style={{fontWeight:600}}>{c.invoice_count||0}</td>
              <td style={{fontSize:12,color:T.textMuted}}>{c.last_invoice_at?new Date(c.last_invoice_at).toLocaleDateString("de-DE"):"—"}</td>
            </tr>
          ))}
          {!loading&&filtered.length===0&&(
            <tr><td colSpan={7} style={{textAlign:"center",padding:36,color:T.textMuted,fontSize:13.5}}>
              Noch keine Kunden — sie entstehen automatisch aus Rechnungen oder werden hier manuell angelegt.
            </td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
    {modal&&<div className="modal-overlay" onClick={()=>setModal(null)}>
      <div className="modal sci" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:T.textPrimary}}>{modal.id?"Kunde bearbeiten":"Neuer Kunde"}</div>
          <button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textMuted}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div><label className="label">Firma *</label><input className="input" value={modal.name||""} onChange={e=>setModal(p=>({...p,name:e.target.value}))} autoFocus/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label className="label">USt-IdNr.</label><input className="input" value={modal.vat_id||""} onChange={e=>setModal(p=>({...p,vat_id:e.target.value}))} placeholder="DE123456789"/></div>
            <div><label className="label">E-Mail</label><input className="input" type="email" value={modal.email||""} onChange={e=>setModal(p=>({...p,email:e.target.value}))}/></div>
          </div>
          <div><label className="label">Straße</label><input className="input" value={modal.address||""} onChange={e=>setModal(p=>({...p,address:e.target.value}))}/></div>
          <div style={{display:"grid",gridTemplateColumns:"100px 1fr 90px",gap:10}}>
            <div><label className="label">PLZ</label><input className="input" value={modal.zip||""} onChange={e=>setModal(p=>({...p,zip:e.target.value}))}/></div>
            <div><label className="label">Stadt</label><input className="input" value={modal.city||""} onChange={e=>setModal(p=>({...p,city:e.target.value}))}/></div>
            <div><label className="label">Land</label><input className="input" value={modal.country||"DE"} onChange={e=>setModal(p=>({...p,country:e.target.value.toUpperCase().slice(0,2)}))}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label className="label">Zahlungsziel (Tage)</label><input className="input" type="number" min="0" max="365" value={modal.payment_terms_days??30} onChange={e=>setModal(p=>({...p,payment_terms_days:e.target.value}))}/></div>
            <div><label className="label">ERP-Referenz (SAP KUNNR / Debitor)</label><input className="input" value={modal.external_ref||""} onChange={e=>setModal(p=>({...p,external_ref:e.target.value}))}/></div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:18}}>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy?<><Spinner color="#fff" size={13}/>&nbsp;Speichert…</>:"Speichern"}</button>
        </div>
      </div>
    </div>}
  </div>);
}

function ArchiveScreen({notify}){
  const[docs,setDocs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState('');
  const[filter,setFilter]=useState('all');
  const[selected,setSelected]=useState(null);
  const[verifying,setVerifying]=useState(false);

  useEffect(()=>{
    api.listInvoices('?archived=true&limit=100')
      .then(d=>setDocs(d.invoices||[]))
      .catch(()=>setDocs([]))
      .finally(()=>setLoading(false));
  },[]);

  const runIntegrityCheck=async()=>{
    setVerifying(true);
    try{
      const r=await api.get('/archive/verify/integrity');
      if(r.failed>0)notify(`⚠ ${r.failed} von ${r.total} Dokumenten fehlerhaft — bitte Support kontaktieren`,'error');
      else notify(`Integrität geprüft: ${r.total} Dokumente, alle unverändert ✓`,'success');
    }catch(e){notify(e.message,'error');}
    setVerifying(false);
  };

  const downloadXml=async(doc)=>{
    try{
      const c=await api.getXML(doc.id);
      const b=new Blob([c],{type:'application/xml'});const u=URL.createObjectURL(b);
      const a=document.createElement('a');a.href=u;a.download=`${doc.invoice_number}.xml`;a.click();
      setTimeout(()=>URL.revokeObjectURL(u),5000);
    }catch(e){notify(e.message,'error');}
  };

  const downloadAuditLog=async()=>{
    try{
      const r=await api.get('/archive/audit/logs');
      const b=new Blob([JSON.stringify(r.logs,null,2)],{type:'application/json'});
      const u=URL.createObjectURL(b);const a=document.createElement('a');
      a.href=u;a.download=`audit-log-${new Date().toISOString().slice(0,10)}.json`;a.click();
      setTimeout(()=>URL.revokeObjectURL(u),5000);
      notify('Audit-Protokoll heruntergeladen ✓','success');
    }catch(e){notify(e.message,'error');}
  };

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
          <button className="btn btn-ghost btn-sm" onClick={downloadAuditLog}>↓ Audit-Protokoll</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExport().then(()=>notify('DATEV-Export heruntergeladen ✓','success')).catch(e=>notify(e.message,'error'))}>↓ DATEV-Export</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(170px,100%),1fr))',gap:10,marginBottom:18}}>
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
        <button className="btn btn-success btn-sm" onClick={runIntegrityCheck} disabled={verifying}>{verifying?'Prüft...':'Integrität prüfen'}</button>
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
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(doc)}>Details</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>downloadXml(doc)}>↓ XML</button>
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
              <button className="btn btn-success" onClick={runIntegrityCheck} disabled={verifying}>{verifying?'Prüft...':'✓ Integrität prüfen'}</button>
              <button className="btn btn-primary" onClick={()=>downloadXml(selected)}>↓ XML herunterladen</button>
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

// API & Webhooks — echte Daten statt hartkodiertem Demo-Key
function ApiSettingsTab({org,notify}){
  const[apiKey,setApiKey]=useState(org?.api_key||'');
  const[keyVisible,setKeyVisible]=useState(false);
  const[rotating,setRotating]=useState(false);
  const[webhooks,setWebhooks]=useState([]);
  const[whUrl,setWhUrl]=useState('');
  const[whSaving,setWhSaving]=useState(false);
  const[newSecret,setNewSecret]=useState(null);

  useEffect(()=>{
    if(!apiKey)api.me().then(d=>setApiKey(d.org?.api_key||'')).catch(()=>{});
    api.get('/webhooks').then(d=>setWebhooks(d.webhooks||[])).catch(()=>setWebhooks([]));
  },[]);

  const rotate=async()=>{
    if(!window.confirm('API-Key wirklich rotieren? Bestehende Integrationen mit dem alten Key funktionieren danach nicht mehr.'))return;
    setRotating(true);
    try{const d=await api.post('/auth/rotate-api-key',{});setApiKey(d.api_key);setKeyVisible(true);notify('Neuer API-Key generiert ✓','success');}
    catch(e){notify(e.message,'error');}
    setRotating(false);
  };

  const addWebhook=async()=>{
    if(!whUrl||!whUrl.startsWith('https://')){notify('Bitte eine gültige https://-URL eingeben','error');return;}
    setWhSaving(true);
    try{
      const d=await api.post('/webhooks',{url:whUrl});
      setNewSecret(d.secret_shown_once);
      setWhUrl('');
      const l=await api.get('/webhooks');setWebhooks(l.webhooks||[]);
      notify('Webhook angelegt ✓','success');
    }catch(e){notify(e.message,'error');}
    setWhSaving(false);
  };

  const deleteWebhook=async(id)=>{
    try{
      await api.req('DELETE',`/webhooks/${id}`);
      setWebhooks(w=>w.filter(x=>x.id!==id));
      notify('Webhook gelöscht','success');
    }catch(e){notify(e.message,'error');}
  };

  const maskedKey=apiKey?(keyVisible?apiKey:apiKey.slice(0,12)+'••••••••••••••••'):'';

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div className="card" style={{padding:22}}>
        <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>API-Zugang</div>
        <div style={{marginBottom:14}}>
          <label className="label">Live API Key</label>
          {apiKey?(
            <div style={{display:'flex',gap:8}}>
              <input className="input" readOnly value={maskedKey} style={{fontFamily:F.mono,fontSize:12,color:T.textSecondary}}/>
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>setKeyVisible(v=>!v)}>{keyVisible?'Verbergen':'Anzeigen'}</button>
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>{navigator.clipboard.writeText(apiKey);notify('API-Key kopiert ✓','success');}}>Kopieren</button>
              <button className="btn btn-danger btn-sm" style={{flexShrink:0}} onClick={rotate} disabled={rotating}>{rotating?'Rotiert...':'Rotieren'}</button>
            </div>
          ):(
            <div style={{fontSize:12.5,color:T.textMuted,padding:'9px 12px',background:T.bgSubtle,borderRadius:6,border:`1px solid ${T.bgBorder}`}}>API-Key ist nur für Owner/Admin sichtbar.</div>
          )}
        </div>
        <div style={{marginBottom:14}}>
          <label className="label">Base URL</label>
          <div style={{fontFamily:F.mono,fontSize:12,color:T.accent,background:T.bgSubtle,borderRadius:6,padding:'9px 12px',border:`1px solid ${T.bgBorder}`}}>{API_BASE}</div>
        </div>
        <div style={{background:T.bgSubtle,borderRadius:7,padding:'14px 16px',border:`1px solid ${T.bgBorder}`}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:10,letterSpacing:.4,textTransform:'uppercase'}}>Schnellstart</div>
          <pre style={{fontFamily:F.mono,fontSize:11,color:T.textSecondary,lineHeight:1.7,overflow:'auto'}}>{`curl -X POST ${API_BASE}/invoices \\
  -H "Authorization: Bearer ${apiKey?apiKey.slice(0,12)+'...':'<Ihr API-Key>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"invoice_number":"INV-001","format":"xrechnung",...}'`}</pre>
        </div>
      </div>
      <div className="card" style={{padding:22}}>
        <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Webhooks</div>
        {newSecret&&(
          <div style={{padding:'12px 14px',background:T.amberBg,border:`1px solid ${T.amberBdr}`,borderRadius:7,marginBottom:12,fontSize:12.5,color:T.amber}}>
            <strong>Webhook-Secret (wird nur einmal angezeigt):</strong>
            <div style={{fontFamily:F.mono,fontSize:11,marginTop:6,wordBreak:'break-all',color:T.textPrimary}}>{newSecret}</div>
            <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>{navigator.clipboard.writeText(newSecret);notify('Secret kopiert ✓','success');}}>Kopieren</button>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
          {webhooks.length===0&&<div style={{fontSize:12.5,color:T.textMuted,textAlign:'center',padding:'14px 0'}}>Noch keine Webhooks konfiguriert.</div>}
          {webhooks.map(w=>(
            <div key={w.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 12px',background:T.bgSubtle,borderRadius:6,border:`1px solid ${T.bgBorder}`}}>
              <span style={{fontFamily:F.mono,fontSize:11,color:T.accent,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.url}</span>
              <span className={`badge ${w.active?'badge-green':'badge-gray'}`} style={{fontSize:10}}>{w.active?'Aktiv':'Inaktiv'}</span>
              <button className="btn btn-danger btn-sm" onClick={()=>deleteWebhook(w.id)}>Löschen</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input className="input" placeholder="https://ihre-app.de/webhook" style={{flex:1}} value={whUrl} onChange={e=>setWhUrl(e.target.value)}/>
          <button className="btn btn-primary btn-sm" onClick={addWebhook} disabled={whSaving}>{whSaving?'Speichert...':'Hinzufügen'}</button>
        </div>
        <div style={{fontSize:11.5,color:T.textMuted,marginTop:8}}>Events: invoice.created · invoice.sent · invoice.delivered · invoice.rejected — signiert per HMAC-SHA256 (Header X-Invoiq-Signature).</div>
      </div>
    </div>
  );
}

function SettingsScreen({user,org,notify}){
  const inboundAddress = org?.inbound_email_slug ? `${org.inbound_email_slug}@rechnungen.invoiq.io` : null;
  const[tab,setTab]   = useState('company');
  const[saving,setSaving] = useState(false);
  const[form,setForm] = useState({
    name:             org?.name||'',
    vat_id:           org?.vat_id||'',
    address:          org?.address||'',
    city:             org?.city||'',
    zip:              org?.zip||'',
    country:          org?.country||'DE',
    iban:             org?.iban||'',
    bic:              org?.bic||'',
    email:            user?.email||'',
    phone:            org?.phone||'',
    bank_name:        org?.bank_name||'',
    tax_number:       org?.tax_number||'',
    register_number:  org?.register_number||'',
    register_court:   org?.register_court||'',
    managing_director: org?.managing_director||'',
    logo_data:        org?.logo_data||'',
    brand_color:      org?.brand_color||'#635BFF',
    website:          org?.website||'',
    default_format:   org?.default_format||'xrechnung',
    default_delivery: org?.default_delivery||'email',
    auto_archive:     org?.auto_archive!==false,
    en16931_strict:   org?.en16931_strict!==false,
    peppol_enabled:   org?.peppol_enabled||false,
    vida_reporting:   org?.vida_reporting||false,
  });

  const onLogoFile=(file)=>{
    if(!file)return;
    if(!/image\/(png|jpeg)/.test(file.type)){notify('Bitte PNG oder JPEG wählen','error');return;}
    if(file.size>300*1024){notify('Logo zu groß — max. 300 KB','error');return;}
    const r=new FileReader();
    r.onload=()=>upd('logo_data',r.result);
    r.readAsDataURL(file);
  };

  // Org-Daten beim Laden holen
  useEffect(()=>{
    api.getOrgSettings().then(d=>{
      if(d) setForm(p=>({...p,...d}));
    }).catch(()=>{});
  },[]);

  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  const save=async()=>{
    setSaving(true);
    try{
      await api.saveSettings(form);
      notify('Gespeichert ✓','success');
    }catch(e){
      notify(e.message||'Fehler beim Speichern','error');
    }finally{
      setSaving(false);
    }
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
                  <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e=>upd('phone',e.target.value)} placeholder="+49 30 123456"/></div>
                </div>

                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,margin:'12px 0 0',paddingTop:14,borderTop:`1px solid ${T.bgBorder}`}}>Bank & Registerdaten <span style={{fontWeight:400,color:T.textMuted}}>(erscheinen auf jeder Rechnung)</span></div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14}}>
                  <div><label className="label">IBAN</label><input className="input" value={form.iban} onChange={e=>upd('iban',e.target.value)} placeholder="DE89 3704 0044 0532 0130 00"/></div>
                  <div><label className="label">BIC</label><input className="input" value={form.bic} onChange={e=>upd('bic',e.target.value)} placeholder="COBADEFFXXX"/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div><label className="label">Bank</label><input className="input" value={form.bank_name} onChange={e=>upd('bank_name',e.target.value)} placeholder="Commerzbank Saarbrücken"/></div>
                  <div><label className="label">Steuernummer</label><input className="input" value={form.tax_number} onChange={e=>upd('tax_number',e.target.value)} placeholder="040/123/45678"/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
                  <div><label className="label">Handelsregister-Nr.</label><input className="input" value={form.register_number} onChange={e=>upd('register_number',e.target.value)} placeholder="HRB 12345"/></div>
                  <div><label className="label">Amtsgericht</label><input className="input" value={form.register_court} onChange={e=>upd('register_court',e.target.value)} placeholder="Amtsgericht Saarbrücken"/></div>
                  <div><label className="label">Geschäftsführung</label><input className="input" value={form.managing_director} onChange={e=>upd('managing_director',e.target.value)} placeholder="Max Mustermann"/></div>
                </div>

                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,margin:'12px 0 0',paddingTop:14,borderTop:`1px solid ${T.bgBorder}`}}>Branding <span style={{fontWeight:400,color:T.textMuted}}>(Logo & Farbe für Rechnungs-PDFs)</span></div>
                <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
                  <div>
                    <label className="label">Primärfarbe</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="color" value={form.brand_color||'#635BFF'} onChange={e=>upd('brand_color',e.target.value)} style={{width:44,height:34,border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:2,cursor:'pointer',background:'#fff'}}/>
                      <input className="input" style={{width:110}} value={form.brand_color||''} onChange={e=>upd('brand_color',e.target.value)} placeholder="#635BFF"/>
                    </div>
                  </div>
                  <div>
                    <label className="label">Logo (PNG/JPEG, max. 300 KB)</label>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      {form.logo_data
                        ? <img src={form.logo_data} alt="Logo" style={{height:40,maxWidth:140,objectFit:'contain',border:`1px solid ${T.bgBorder}`,borderRadius:8,padding:4,background:'#fff'}}/>
                        : <div style={{height:40,width:120,border:`1px dashed ${T.bgBorder}`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:T.textMuted}}>Kein Logo</div>}
                      <label className="btn btn-outline btn-sm" style={{cursor:'pointer'}}>
                        Hochladen<input type="file" accept="image/png,image/jpeg" style={{display:'none'}} onChange={e=>onLogoFile(e.target.files?.[0])}/>
                      </label>
                      {form.logo_data&&<button className="btn btn-ghost btn-sm" onClick={()=>upd('logo_data','')}>Entfernen</button>}
                    </div>
                  </div>
                </div>
                <div><label className="label">Website</label><input className="input" value={form.website} onChange={e=>upd('website',e.target.value)} placeholder="https://ihre-firma.de"/></div>
                <div style={{background:T.bgSubtle,borderRadius:8,padding:'14px 16px',border:`1px solid ${T.bgBorder}`,marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:12,letterSpacing:.4,textTransform:'uppercase'}}>Bankverbindung (für SEPA-Zahlungen) — optional</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div><label className="label">IBAN (eigene)</label><input className="input" value={form.iban} onChange={e=>upd('iban',e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" style={{fontFamily:F.mono}}/><div style={{fontSize:11,color:T.textMuted,marginTop:3}}>Optional — kann jederzeit ergänzt werden. Wird als Auftraggeber in SEPA-Dateien verwendet.</div></div>
                    <div><label className="label">BIC / SWIFT</label><input className="input" value={form.bic} onChange={e=>upd('bic',e.target.value)} placeholder="COBADEFFXXX" style={{fontFamily:F.mono}}/><div style={{fontSize:11,color:T.textMuted,marginTop:3}}>Optional — für ältere Banksysteme</div></div>
                  </div>
                </div>

                {/* e-Rechnungs-Adresse für Eingang */}
                <div style={{background:T.accentLight,borderRadius:8,padding:'14px 16px',border:`1px solid ${T.accentPale}`,marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:8,letterSpacing:.4,textTransform:'uppercase'}}>Ihre e-Rechnungs-Adresse (Eingang)</div>
                  {inboundAddress?(
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontSize:13,fontFamily:F.mono,color:T.textPrimary}}>{inboundAddress}</div>
                        <div style={{fontSize:11.5,color:T.textMuted,marginTop:3}}>Senden Sie Rechnungen an diese Adresse, um sie automatisch zu erfassen.</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{ navigator.clipboard.writeText(inboundAddress); notify('Adresse kopiert ✓','success'); }}>Kopieren</button>
                    </div>
                  ):(
                    <div style={{fontSize:12.5,color:T.textMuted}}>Wird geladen…</div>
                  )}
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

          {tab==='api'&&<ApiSettingsTab org={org} notify={notify}/>}

          {tab==='team'&&(
            <div className="card" style={{padding:22}}>
              <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Team-Mitglieder</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:T.bgSubtle,borderRadius:7,border:`1px solid ${T.bgBorder}`}}>
                  <div className="avatar">{(user?.full_name||'U')[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary}}>{user?.full_name||'—'} <span style={{fontSize:11,color:T.textMuted}}>(Sie)</span></div>
                    <div style={{fontSize:12,color:T.textMuted}}>{user?.email||''}</div>
                  </div>
                  <span className="badge badge-blue" style={{fontSize:10.5,textTransform:'capitalize'}}>{user?.role||'owner'}</span>
                </div>
              </div>
              <div style={{background:T.accentLight,borderRadius:7,padding:'12px 14px',border:`1px solid ${T.accentPale}`,fontSize:12.5,color:T.textSecondary}}>
                <strong style={{color:T.accent}}>Team-Einladungen sind in Vorbereitung.</strong> Bis dahin arbeitet jede Organisation mit einem Konto. Sobald das Feature live ist, informieren wir Sie per E-Mail.
              </div>
            </div>
          )}

          {tab==='billing'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Aktueller Plan</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:22,fontWeight:800,color:T.textPrimary,letterSpacing:'-.03em',marginBottom:4}}>{org?.plan?.toUpperCase()||'FREE'}</div>
                    <div style={{fontSize:13.5,color:T.textSecondary}}>{org?.plan_doc_limit||10} Dokumente/Monat · monatlich kündbar</div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost" onClick={async()=>{
                      try{
                        const d = await api.openBillingPortal();
                        if(d.portal_url) window.open(d.portal_url,'_blank');
                      }catch(e){notify(e.message,'error');}
                    }}>Abrechnung verwalten</button>
                    <button className="btn btn-primary" onClick={async()=>{
                      try{
                        const currentPlan = (org?.plan||'free').toLowerCase();
                        if(currentPlan==='enterprise'){ notify('Sie haben bereits den höchsten Plan','info'); return; }
                        const nextPlan = currentPlan==='free'?'starter':currentPlan==='starter'?'business':'enterprise';
                        const d = await api.createCheckout(nextPlan,'monthly');
                        if(d.checkout_url) window.location.href = d.checkout_url;
                      }catch(e){notify(e.message,'error');}
                    }}>Upgrade →</button>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:T.textMuted,marginBottom:5}}>
                    <span>Dokumente diesen Monat</span>
                    <span style={{fontWeight:600,color:T.textPrimary}}>{org?.plan_doc_used||0} / {org?.plan_doc_limit||100}</span>
                  </div>
                  <div className="progress"><div className="progress-fill" style={{width:`${Math.min(100,((org?.plan_doc_used||0)/(org?.plan_doc_limit||10))*100)}%`}}/></div>
                </div>
                <div style={{background:T.bgSubtle,borderRadius:6,padding:'10px 14px',fontSize:12.5,color:T.textSecondary,border:`1px solid ${T.bgBorder}`}}>
                  <strong style={{color:T.textPrimary}}>Überschreitung:</strong> Zusätzliche Rechnungen werden mit 0,50€/Rechnung berechnet — kein Zwangsupgrade.
                </div>
              </div>
              <div className="card" style={{padding:22}}>
                <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${T.bgBorder}`}}>Zahlungshistorie & Kündigung</div>
                <div style={{fontSize:13,color:T.textSecondary,lineHeight:1.6}}>
                  Rechnungen, Zahlungsmethoden und Kündigung verwalten Sie sicher im Stripe-Kundenportal — jederzeit, ohne Mindestlaufzeit.
                </div>
                <button className="btn btn-ghost" style={{marginTop:12}} onClick={async()=>{
                  try{
                    const d = await api.openBillingPortal();
                    if(d.portal_url) window.open(d.portal_url,'_blank');
                  }catch(e){notify(e.message,'error');}
                }}>Stripe-Kundenportal öffnen →</button>
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
  const items=isSuper?[{section:"Platform"},{key:"overview",icon:"·",label:"Übersicht"},{key:"allinvoices",icon:"·",label:"All Documents"},{key:"users",icon:"·",label:"Users"},{key:"revenue",icon:"·",label:"Revenue"},{section:"System"},{key:"peppol",icon:"·",label:"Peppol"},{key:"apilogs",icon:"·",label:"Audit Logs"}]:[{section:org?.name||"Company"},{key:"overview",icon:"▦",label:"Übersicht"},{key:"myinvoices",icon:"·",label:"Documents"},{key:"myusers",icon:"·",label:"Team"},{key:"billing",icon:"·",label:"Billing"}];
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
  const [adminStats,setAdminStats] = useState(null);
  const [orgs,setOrgs]             = useState([]);
  const [loadingA,setLoadingA]     = useState(true);
  const [seedingDemo,setSeedingDemo] = useState(false);
     const seedDemo = async () => {
            setSeedingDemo(true);
            try {
                     await api.post('/admin/seed-demo');
                     notify('20 Demo-Rechnungen erstellt', 'success');
                   } catch(e) {
                     notify('Fehler beim Seeden: ' + (e?.message || e), 'error');
                   } finally {
                     setSeedingDemo(false);
                   }
          };
  useEffect(()=>{
    // Echte Daten aus API laden
    Promise.all([
      api.get('/admin/stats').catch(()=>null),
      api.get('/admin/orgs').catch(()=>null),
    ]).then(([stats,orgsData])=>{
      if(stats) setAdminStats(stats);
      if(orgsData?.orgs) setOrgs(orgsData.orgs);
    }).finally(()=>setLoadingA(false));
  },[]);

  const mrr = orgs.filter(o=>o.status==="active").reduce((s,o)=>s+(o.mrr||0),0);
  const totalDocs = orgs.reduce((s,o)=>s+(o.plan_doc_used||0),0);
  const openErrors = adminStats?.open_errors || 0;
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
      <div><h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>{isSuper?"Plattform-Übersicht":"Übersicht"}</h1><p style={{fontSize:12,color:T.textMuted,marginTop:3}}>{isSuper?"invoiq.io · Super-Admin":(orgs[0]?.name||"")}</p></div>
      {isSuper&&<button className="btn btn-ghost btn-sm" onClick={seedDemo} disabled={seedingDemo}>⚡ {seedingDemo?"Seeding...":"Seed Demo (nur Dev)"}</button>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(170px,100%),1fr))",gap:10,marginBottom:16}}>
      {loadingA?[1,2,3,4].map(i=><div key={i} className="card" style={{padding:18,height:90}}><div className="skeleton" style={{height:"100%"}}/></div>)
      :(isSuper
        ?[["MRR",fmtEUR(mrr),"Monatlich wiederkehrend"],["Aktive Kunden",orgs.filter(o=>o.status==="active").length,`${orgs.length} gesamt`],["Dokumente",fmtNum(totalDocs),"Diesen Monat"],["Offene Fehler",openErrors,openErrors>0?"⚠ Prüfen":"✓ Alles OK"]]
        :[["Dokumente",adminStats?.docs_used||0,"von "+(adminStats?.docs_limit||100)],["Nutzer",adminStats?.users||0,"Aktiv"],["Fehler",adminStats?.errors||0,"Offen"],["Compliance","100%","EN 16931 ✓"]]
      ).map(([l,v,s])=>(
        <div key={l} className="card" style={{padding:18}}>
          <div style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:9}}>{l}</div>
          <div className="stat-num" style={{fontSize:28}}>{v}</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{s}</div>
        </div>
      ))}
    </div>
    <div className="card">
      <div style={{padding:"13px 18px",borderBottom:`1px solid ${T.bgBorder}`,fontSize:13.5,fontWeight:600,color:T.textPrimary}}>Kunden</div>
      {loadingA
        ? <div style={{padding:20}}><div className="skeleton" style={{height:60}}/></div>
        : orgs.length===0
          ? <div style={{padding:28,textAlign:"center",color:T.textMuted,fontSize:13}}>Noch keine Kunden registriert.</div>
          : <table className="table"><thead><tr>{["Kunde","Plan","Status","Dokumente","MRR"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>{orgs.map(org=><tr key={org.id} className="tr-hover">
                <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="avatar">{(org.name||"?")[0]}</div><div><div style={{fontWeight:600,fontSize:13}}>{org.name}</div><div style={{fontSize:10.5,color:T.textMuted}}>{org.vat_id||org.slug}</div></div></div></td>
                <td><StatusBadge status={org.plan}/></td>
                <td><StatusBadge status={org.status||"active"}/></td>
                <td><div style={{fontSize:12.5}}>{fmtNum(org.plan_doc_used||0)}/{fmtNum(org.plan_doc_limit||100)}</div><div className="progress" style={{width:60,marginTop:3}}><div className="progress-fill" style={{width:`${Math.min(100,((org.plan_doc_used||0)/(org.plan_doc_limit||100))*100)}%`}}/></div></td>
                <td style={{fontWeight:600}}>{fmtEUR(org.mrr||0)}</td>
              </tr>)}</tbody>
            </table>
      }
    </div>
  </div>);
}

function AdminDocs({notify}){
  const[filter,setFilter] = useState("all");
  const[invoices,setInvoices] = useState([]);
  const[loading,setLoading]   = useState(true);
  useEffect(()=>{
    api.listInvoices("?limit=50").then(d=>setInvoices(d.invoices||[])).catch(()=>setInvoices([])).finally(()=>setLoading(false));
  },[]);
  const filtered = filter==="all" ? invoices : invoices.filter(i=>i.status===filter);
  return(<div className="fi">
    <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:18}}>Alle Dokumente</h1>
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgBorder}`,marginBottom:14}}>
      {["all","delivered","validated","error","archived"].map(s=><button key={s} className={`tab ${filter===s?"active":""}`} onClick={()=>setFilter(s)}>
        {{all:"Alle",delivered:"Zugestellt",validated:"Validiert",error:"Fehler",archived:"Archiviert"}[s]}
        <span style={{marginLeft:4,fontSize:10,background:T.bgMuted,padding:"1px 5px",borderRadius:7,color:T.textMuted}}>{s==="all"?invoices.length:invoices.filter(i=>i.status===s).length}</span>
      </button>)}
    </div>
    <div className="card"><table className="table"><thead><tr>{["Nummer","Empfänger","Betrag","Format","Status","Datum","Aktion"].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {loading?[1,2,3].map(i=><tr key={i}><td colSpan={7}><div className="skeleton" style={{height:14}}/></td></tr>)
        :filtered.length===0?<tr><td colSpan={7} style={{textAlign:"center",padding:24,color:T.textMuted}}>Keine Dokumente</td></tr>
        :filtered.map(inv=><tr key={inv.id} className="tr-hover">
          <td style={{fontWeight:600,fontFamily:F.mono,fontSize:12}}>{inv.invoice_number}</td>
          <td style={{fontSize:13}}>{inv.buyer_name||"—"}</td>
          <td style={{fontWeight:600}}>{fmtEUR(inv.amount_gross)}</td>
          <td><span style={{background:T.bgMuted,color:T.textSecondary,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:F.mono}}>{inv.format?.toUpperCase()}</span></td>
          <td><StatusBadge status={inv.effective_status||inv.status}/></td>
          <td style={{color:T.textMuted,fontSize:12}}>{inv.created_at?new Date(inv.created_at).toLocaleDateString("de-DE"):"—"}</td>
          <td></td>
        </tr>)}
      </tbody>
    </table></div>
  </div>);
}

function AdminUsers({notify}){
  const[users,setUsers]   = useState([]);
  const[loading,setLoading] = useState(true);
  useEffect(()=>{
    api.get("/admin/users").then(d=>setUsers(d.users||[])).catch(()=>setUsers([])).finally(()=>setLoading(false));
  },[]);
  return(<div className="fi">
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
      <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary}}>Nutzer</h1>
    </div>
    <div className="card"><table className="table"><thead><tr>{["Nutzer","Rolle","Organisation","Status","Letzter Login","Aktionen"].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {loading?[1,2,3].map(i=><tr key={i}><td colSpan={6}><div className="skeleton" style={{height:14}}/></td></tr>)
        :users.length===0?<tr><td colSpan={6} style={{textAlign:"center",padding:24,color:T.textMuted}}>Keine Nutzer gefunden</td></tr>
        :users.map(u=><tr key={u.id} className="tr-hover">
          <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="avatar">{(u.full_name||u.email||"?")[0]}</div><div><div style={{fontWeight:600,fontSize:13}}>{u.full_name||"—"}</div><div style={{fontSize:10.5,color:T.textMuted}}>{u.email}</div></div></div></td>
          <td><StatusBadge status={u.role}/></td>
          <td style={{fontSize:13,color:T.textSecondary}}>{u.org_name||"—"}</td>
          <td><StatusBadge status={u.status||"active"}/></td>
          <td style={{fontSize:12,color:T.textMuted}}>{u.last_login_at?new Date(u.last_login_at).toLocaleDateString("de-DE"):"—"}</td>
          <td><div style={{display:"flex",gap:5}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>notify("Passwort-Reset gesendet ✓","success")}>Reset</button>
            {u.role!=="super_admin"&&<button className="btn btn-danger btn-sm" onClick={()=>notify(`${u.full_name} gesperrt`,"error")}>Sperren</button>}
          </div></td>
        </tr>)}
      </tbody>
    </table></div>
  </div>);
}

function AdminRevenue(){
  const[orgs,setOrgs]=useState([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    api.get('/admin/orgs').then(d=>setOrgs(d.orgs||[])).catch(()=>setOrgs([])).finally(()=>setLoading(false));
  },[]);
  const active=orgs.filter(o=>o.status==='active');
  const mrr=active.reduce((s,o)=>s+(o.mrr||0),0);
  const planCounts=active.reduce((acc,o)=>{const p=(o.plan||'free').toLowerCase();acc[p]=(acc[p]||0)+1;return acc;},{});
  return(<div className="fi">
    <h1 style={{fontFamily:F.ui,fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:18}}>Revenue</h1>
    {loading?<div className="card" style={{padding:18}}><div className="skeleton" style={{height:60}}/></div>:<>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
      {[["MRR",fmtEUR(mrr)],["ARR",fmtEUR(mrr*12)],["Ø/Kunde",fmtEUR(active.length?mrr/active.length:0)]].map(([l,v])=><div key={l} className="card" style={{padding:18}}><div style={{fontSize:10.5,color:T.textMuted,fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:9}}>{l}</div><div className="stat-num">{v}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div className="card" style={{padding:18}}><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Plan-Verteilung</div>
        {Object.keys(planCounts).length===0&&<div style={{fontSize:12.5,color:T.textMuted,textAlign:'center',padding:'12px 0'}}>Noch keine aktiven Kunden</div>}
        {Object.entries(planCounts).map(([p,count])=><div key={p} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span style={{fontWeight:600,textTransform:'capitalize'}}>{p}</span><span style={{color:T.textMuted}}>{count} Kunde{count>1?'n':''}</span></div><div className="progress"><div className="progress-fill" style={{width:`${(count/Math.max(active.length,1))*100}%`}}/></div></div>)}
      </div>
      <div className="card" style={{padding:18}}><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:14}}>Dokumenten-Volumen</div>
        {active.length===0&&<div style={{fontSize:12.5,color:T.textMuted,textAlign:'center',padding:'12px 0'}}>Noch keine aktiven Kunden</div>}
        {active.map(org=><div key={org.id} style={{marginBottom:11}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140,fontWeight:500}}>{org.name}</span><span style={{color:T.textMuted,flexShrink:0}}>{fmtNum(org.plan_doc_used||0)}</span></div><div className="progress"><div className="progress-fill" style={{width:`${Math.min(100,((org.plan_doc_used||0)/(org.plan_doc_limit||100))*100)}%`}}/></div></div>)}
      </div>
    </div>
    </>}
  </div>);
}

// ══════════════════════════════════════════════════════════════
// STEUERBERATER PORTAL — Multi-Mandanten Dashboard
// ══════════════════════════════════════════════════════════════

// mandanten entfernt — Kanzlei-Portal lädt echte Daten aus API


const MANDANTEN_LIMITS = { business: 10, pro: 25, enterprise: Infinity };

// Normalisiert die rohe /admin/orgs API-Antwort (plan_doc_used/plan_doc_limit/name/vat_id/...)
// auf die Feldnamen, die die Portal-UI überall erwartet (docs_this_month/docs_limit/vat/erp/contact/...).
// Wichtig: jedes Feld hat einen sicheren Default, damit nichts mit "undefined" crasht oder NaN anzeigt.
function normalizeMandant(o) {
  return {
    id: o.id,
    name: o.name || 'Unbenannte Organisation',
    vat: o.vat_id || o.vat || '—',
    vat_id: o.vat_id || '',
    plan: (o.plan || 'starter').toLowerCase(),
    status: o.status || 'active',
    erp: o.erp || 'Manuell',
    contact: o.contact || o.email || '—',
    last_invoice: o.last_invoice || '—',
    compliance: typeof o.compliance === 'number' ? o.compliance : 100,
    open_errors: o.open_errors || 0,
    pending_inbound: o.pending_inbound || 0,
    docs_this_month: o.plan_doc_used ?? o.docs_used ?? 0,
    docs_limit: o.plan_doc_limit ?? o.docs_limit ?? 100,
    mrr: o.mrr || 0,
  };
}

function SteuerberaterPortal({ user, org, notify, onBack }) {
  const [view, setView]           = useState('overview');
  const [selected, setSelected]   = useState(null);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [mandantTab, setMandantTab] = useState('overview');
  const [inviteModal, setInviteModal] = useState(false);
  const [mandanten, setMandanten] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(()=>{
    let active = true;
    setLoadError(null);
    api.get('/admin/orgs')
      .then(d=>{ if(active) setMandanten((d.orgs||[]).map(normalizeMandant)); })
      .catch(err=>{ if(active){ setMandanten([]); setLoadError(err?.message||'Mandanten konnten nicht geladen werden.'); } })
      .finally(()=>{ if(active) setLoading(false); });
    return ()=>{ active = false; };
  },[]);

  const plan = (org?.plan||'starter').toLowerCase();
  const mandantenLimit = MANDANTEN_LIMITS[plan] ?? 5;
  const limitReached = mandanten.length >= mandantenLimit;

  const filtered = mandanten.filter(m => {
    const matchSearch = !search || (m.name||'').toLowerCase().includes(search.toLowerCase()) || (m.vat_id||'').includes(search);
    const matchFilter = filter === 'all' || m.status === filter || (filter === 'errors' && (m.open_errors||0) > 0) || (filter === 'limit' && Math.round((m.docs_this_month/(m.docs_limit||100))*100) > 80);
    return matchSearch && matchFilter;
  });

  const totalDocs     = mandanten.reduce((s, m) => s + (m.docs_this_month||0), 0);
  const totalErrors   = mandanten.reduce((s, m) => s + (m.open_errors||0), 0);
  const totalPending  = mandanten.reduce((s, m) => s + (m.pending_inbound||0), 0);

  // Echte Aktivitäten-API gibt es (noch) nicht — statt eines undefinierten Mocks
  // leiten wir einen ehrlichen Feed aus den tatsächlich geladenen Mandanten-Daten ab.
  const recentActivity = mandanten
    .filter(m => (m.open_errors||0) > 0 || (m.pending_inbound||0) > 0)
    .slice(0, 6)
    .map(m => ({
      mandant: m.name,
      action: m.open_errors > 0 ? `${m.open_errors} Validierungsfehler` : `${m.pending_inbound} Inbound ausstehend`,
      detail: m.open_errors > 0 ? 'Handlungsbedarf' : 'Zu verarbeiten',
      time: '',
      type: m.open_errors > 0 ? 'error' : 'info',
    }));
  const avgCompliance = mandanten.length ? Math.round(mandanten.reduce((s, m) => s + (m.compliance||100), 0) / mandanten.length) : 100;

  // ── MANDANT DETAIL VIEW ──────────────────────────────────────
  if (view === 'mandant' && selected) {
    const m = selected;
    const pct = Math.round((m.docs_this_month / (m.docs_limit||100)) * 100);
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
            <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExportInbound(selected?.id,null,null).then(()=>notify('DATEV-Export heruntergeladen ✓','success')).catch(e=>notify(e.message,'error'))}>↓ DATEV-Export</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(170px,100%),1fr))', gap: 10, marginBottom: 16 }}>
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
              ⚠ Nähert sich dem Limit — der Mandant kann seinen Plan unter Einstellungen → Plan & Abrechnung upgraden.
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
              {[].map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 3 ? `1px solid ${T.bgSubtle}` : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.type === 'success' ? T.green : a.type === 'error' ? T.red : T.accent, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.textPrimary }}>{a.action}</div>
                    <div style={{ fontSize: 11.5, color: T.textMuted }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textMuted, flexShrink: 0 }}>{a.time}</div>
                </div>
              ))}
              {true && (
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
          <div className="card" style={{ padding: 24, textAlign: 'center', color: T.textMuted }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>Rechnungsliste pro Mandant</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              Die mandantenspezifische Rechnungsansicht ist in Vorbereitung. Nutzen Sie bis dahin den DATEV-Export oben — er enthält alle Eingangsbelege des Mandanten.
            </div>
          </div>
        )}

        {mandantTab === 'inbound' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 14 }}>Eingehende Rechnungen</div>
            {m.pending_inbound > 0 ? (
              <div style={{ background: T.amberBg, border: `1px solid ${T.amberBdr}`, borderRadius: 7, padding: '12px 14px', fontSize: 13, color: T.amber }}>
                ⚠ {m.pending_inbound} Eingang{m.pending_inbound > 1 ? 'änge' : ''} warte{m.pending_inbound === 1 ? 't' : 'n'} auf Verarbeitung — Prüfung erfolgt im Bereich „Eingang" des Mandanten.
              </div>
            ) : (
              <div style={{ background: T.greenBg, border: `1px solid ${T.greenBdr}`, borderRadius: 7, padding: '12px 14px', fontSize: 13, color: T.green }}>
                ✓ Alle Eingänge verarbeitet
              </div>
            )}
          </div>
        )}

        {mandantTab === 'settings' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>Mandanten-Stammdaten</div>
            {[['Unternehmensname', m.name], ['USt-IdNr.', m.vat], ['Plan', m.plan]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.bgSubtle}`, fontSize: 13 }}>
                <span style={{ color: T.textMuted }}>{l}</span>
                <span style={{ fontWeight: 500, color: T.textPrimary, textTransform: l==='Plan'?'capitalize':'none' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 12.5, color: T.textMuted }}>
              Stammdaten verwaltet der Mandant selbst unter Einstellungen → Unternehmen.
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LOADING / ERROR ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="fi" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh' }}>
        <div style={{ width:32, height:32, border:`3px solid ${T.accentLight}`, borderTopColor:T.accent, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  if (loadError && mandanten.length === 0) {
    return (
      <div className="fi" style={{ padding:40, textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
        <h3 style={{ color:T.textPrimary, marginBottom:8 }}>Kanzlei-Portal</h3>
        <p style={{ color:T.textMuted, marginBottom:16 }}>Mandanten konnten nicht geladen werden ({loadError}).</p>
        <button className="btn btn-primary btn-sm" onClick={onBack}>Zurück</button>
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
          <p style={{ fontSize: 13, color: T.textMuted }}>{mandanten.length} Mandanten · Zentrales Dashboard für alle Ihre Mandanten</p>{limitReached&&<div style={{background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:8,padding:'10px 14px',marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#92400E'}}>⚠️ Mandanten-Limit ({mandanten.length}/{mandantenLimit===Infinity?'∞':mandantenLimit})</span><button onClick={onBack} style={{fontSize:13,fontWeight:600,color:'#D97706',background:'none',border:'none',cursor:'pointer',padding:0}}>Plan upgraden →</button></div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>api.datevExportInbound('',null,null).then(()=>notify('DATEV-Export heruntergeladen ✓','success')).catch(e=>notify(e.message,'error'))}>↓ DATEV-Export</button>
          <button className="btn btn-primary btn-sm" onClick={()=>limitReached?notify(`Mandanten-Limit erreicht (${mandantenLimit} max). Bitte Plan upgraden.`,'warning'):setInviteModal(true)}>{limitReached?`🔒 Limit erreicht`:'+ Mandant einladen'}</button>
        </div>
      </div>

      {/* Platform KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(170px,100%),1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Mandanten gesamt', value: mandanten.length, sub: `${mandanten.filter(m => m.status === 'active').length} aktiv`, color: T.textPrimary },
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
              <span style={{ color: T.red }}> bei {mandanten.filter(m => m.open_errors > 0).map(m => m.name).join(', ')}</span>
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
              const pct = Math.round((m.docs_this_month / (m.docs_limit||100)) * 100);
              return (
                <div key={m.id} className="card card-hover" style={{ padding: 16, cursor: 'pointer' }} onClick={() => { setSelected(m); setView('mandant'); }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.accentLight, border: `1px solid ${T.accentPale}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                      {(m.name||'?')[0]}
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
                    <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSelected(m); setView('mandant'); }}>Öffnen →</button>
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
              {recentActivity.length === 0 && (
                <div style={{ fontSize: 12.5, color: T.textMuted, textAlign: 'center', padding: '16px 0' }}>Noch keine Aktivität</div>
              )}
              {recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < recentActivity.length - 1 ? `1px solid ${T.bgSubtle}` : 'none', alignItems: 'flex-start' }}>
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
            <div style={{ padding: '10px 14px', background: T.amberBg, border: `1px solid ${T.amberBdr}`, borderRadius: 7, fontSize: 12.5, color: T.amber, marginBottom: 16 }}>
              Der automatische Einladungs-Flow ist in Vorbereitung. Bis dahin: Der Mandant registriert sich selbst unter invoiq.io — melden Sie sich beim Support, um die Verknüpfung mit Ihrer Kanzlei einzurichten.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setInviteModal(false)}>Schließen</button>
              <button className="btn btn-primary" onClick={() => { window.location.href = 'mailto:support@invoiq.io?subject=Mandanten-Verknüpfung Kanzlei-Portal'; }}>Support kontaktieren →</button>
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
function InstallPrompt(){
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [show,setShow]=useState(false);
  const [iosHint,setIosHint]=useState(false);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    // Bereits installiert? → nicht zeigen
    if(window.matchMedia?.('(display-mode: standalone)').matches)return;
    if(localStorage.getItem('invoiq_install_dismissed'))return;

    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
    if(isIOS){
      // iOS hat kein beforeinstallprompt → manueller Hinweis nach kurzer Verzögerung
      const t=setTimeout(()=>{setIosHint(true);setShow(true);},4000);
      return ()=>clearTimeout(t);
    }
    const handler=(e)=>{e.preventDefault();setDeferredPrompt(e);setShow(true);};
    window.addEventListener('beforeinstallprompt',handler);
    return ()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const dismiss=()=>{setShow(false);if(typeof localStorage!=="undefined")localStorage.setItem('invoiq_install_dismissed','1');};
  const install=async()=>{
    if(!deferredPrompt)return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);setShow(false);
  };

  if(!show)return null;
  return(
    <div style={{position:'fixed',bottom:16,left:16,right:16,maxWidth:380,margin:'0 auto',zIndex:9999,
      background:'#fff',borderRadius:14,boxShadow:'0 20px 48px -12px rgba(10,37,64,.22)',
      border:'1px solid rgba(99,91,255,.2)',padding:'16px 18px',
      display:'flex',alignItems:'center',gap:13,animation:'drawIn .4s cubic-bezier(.16,1,.3,1)'}}>
      <div style={{width:44,height:44,borderRadius:11,background:'#635BFF',flexShrink:0,
        display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:19,letterSpacing:'-1px'}}>ia</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13.5,color:'#0A2540'}}>invoiq installieren</div>
        <div style={{fontSize:12,color:'#697386',lineHeight:1.4}}>
          {iosHint?'Tippe auf „Teilen" und dann „Zum Home-Bildschirm".':'Als App auf dem Startbildschirm — schneller Zugriff.'}
        </div>
      </div>
      {!iosHint&&<button onClick={install} style={{flexShrink:0,background:'#635BFF',color:'#fff',border:'none',
        borderRadius:8,padding:'8px 14px',fontSize:12.5,fontWeight:700,cursor:'pointer'}}>Installieren</button>}
      <button onClick={dismiss} style={{flexShrink:0,background:'none',border:'none',cursor:'pointer',
        fontSize:18,color:'#9AA5B1',lineHeight:1,padding:4}}>×</button>
    </div>
  );
}

export default function App(){
  const[screen,setScreen]=useState(()=>{const p=window.location.pathname;if(p.startsWith('/reset-password'))return'reset';if(p==='/register'||p.startsWith('/register'))return'auth';if(api._token)return'loading';return'landing';}); // loading|landing|auth|reset|app|admin|onboarding|impressum|datenschutz|agb
const[mode,setMode]=useState(()=>{const p=window.location.pathname;return(p==='/register'||p.startsWith('/register'))?'register':'login';});
  const[nav,setNav]=useState("dashboard");
  const[subNav,setSubNav]=useState(null);
  const[adminNav,setAdminNav]=useState("overview");
  const[loading,setLoading]=useState(false);
  const[toast,setToast]=useState(null);
  const[globalSearch,setGlobalSearch]=useState(null); // Topbar-Suche → Ausgang
  const[user,setUser]=useState(null);
  const[org,setOrg]=useState(null);
  const notify=(msg,type="info")=>setToast({msg,type});
  const onNav=(page,sub=null)=>{setNav(page);setSubNav(sub);window.scrollTo(0,0);};

  useEffect(()=>{
    const token=typeof localStorage!=="undefined"&&localStorage.getItem("invoiq_token");
    if(token){api.setToken(token);api.me().then(d=>{setUser(d.user);setOrg(d.org);setScreen("app");}).catch(()=>{if(typeof localStorage!=="undefined")localStorage.removeItem("invoiq_token");api.setToken(null);setScreen("landing");});}
    else if(screen==="loading"){setScreen("landing");}
  },[]);

  const handleAuth=async form=>{
    setLoading(true);
    try{
      const fn=mode==="login"?api.login:api.register;const d=await fn(form);
      api.setToken(d.access_token);setUser(d.user);setOrg(d.org);
      const isNew=!d.org?.onboarding_completed&&typeof localStorage!=="undefined"&&!localStorage.getItem("invoiq_onboarding_done");
      if(isNew&&mode==="register"){setScreen("onboarding");}else{setScreen("app");setNav("dashboard");}
      notify(`Willkommen${d.user.full_name?`, ${d.user.full_name.split(" ")[0]}`:""}!`,"success");
    }catch(e){
      // Kein Fake-Fallback: ein fehlgeschlagener Login darf niemals eine
      // Schein-Session öffnen. Fehler ehrlich anzeigen.
      const msg=e?.message&&e.message!==""?e.message:"Server nicht erreichbar — bitte in wenigen Sekunden erneut versuchen.";
      notify(msg,"error");
    }
    setLoading(false);
  };

  const handleLogout=async()=>{await api.logout().catch(()=>{});api.setToken(null);setUser(null);setOrg(null);setScreen("landing");notify("Abgemeldet","info");};
  // Rollenbasiert statt hartkodierter E-Mail-Adressen
  const isSuper=user?.role==="super_admin";
  const hasKanzlei=["business","pro","enterprise"].includes((org?.plan||"").toLowerCase());

  return(<>
    <style>{CSS}</style>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    {screen==="loading"&&(
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:T.bgSubtle}}>
        <div>
          <div style={{width:40,height:40,border:`3px solid ${T.accentLight}`,borderTopColor:T.accent,borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 16px'}}></div>
          <div style={{fontSize:14,color:T.textMuted,fontFamily:F.ui}}>Wird geladen...</div>
        </div>
      </div>
    )}
    {screen==="landing"&&<Landing onEnter={(plan)=>{if(plan==='login'){setMode('login');setScreen('auth');return;}if(plan)localStorage.setItem('invoiq_selected_plan',plan);if(api._token){setScreen("app");}else{setMode("register");setScreen("auth");}}} onLegal={(s)=>{setScreen(s);window.scrollTo(0,0);}}/>}
    {screen==="impressum"&&<Impressum onBack={()=>setScreen("landing")}/>}
    {screen==="datenschutz"&&<Datenschutz onBack={()=>setScreen("landing")}/>}
    {screen==="agb"&&<AGB onBack={()=>setScreen("landing")}/>}
    {screen==="auth"&&<Auth mode={mode} onSwitch={()=>setMode(m=>m==="login"?"register":"login")} onSuccess={handleAuth} loading={loading} notify={notify}/>}
    {screen==="reset"&&<ResetPassword notify={notify} onDone={()=>{window.history.replaceState(null,'','/');setMode('login');setScreen('auth');}}/>}
    {screen==="onboarding"&&<OnboardingWizard user={user} onComplete={data=>{if(typeof localStorage!=="undefined")localStorage.setItem("invoiq_onboarding_done","true");if(data.org_name&&org)setOrg(p=>({...p,name:data.org_name}));setScreen("app");setNav("dashboard");notify("Setup abgeschlossen — willkommen bei invoiq! 🎉","success");}}/>}
    {screen==="app"&&<AppShell user={user} org={org} nav={nav} setNav={setNav} onLogout={handleLogout} onSearch={(q)=>{setGlobalSearch(q);setNav("invoices");window.scrollTo(0,0);}} onAdmin={()=>{setAdminNav("overview");setScreen("admin");}}>
      {nav==="dashboard"&&<Dashboard user={user} org={org} notify={notify} onNav={onNav}/>}
      {nav==="invoices"&&<Invoices notify={notify} initialView={subNav} onNavDone={()=>setSubNav(null)} searchQuery={globalSearch} onClearSearch={()=>setGlobalSearch(null)}/>}
          {nav==="scanner"&&<DokumentenScanner notify={notify}/>}
          {nav==="inbound"&&<InboundScreen notify={notify} org={org}/>}
          {nav==="belege"&&<BusinessScreen notify={notify} onOpenInvoice={()=>onNav("invoices")}/>}
          {nav==="artikel"&&<ItemsScreen notify={notify}/>}
          {nav==="kunden"&&<KundenScreen notify={notify}/>}
          {nav==="ki"&&<KIScreen notify={notify}/>}
          {nav==="steuerberater"&&(
            hasKanzlei
              ? <PortalErrorBoundary><SteuerberaterPortal user={user} org={org} notify={notify} onBack={()=>setNav('dashboard')}/></PortalErrorBoundary>
              : <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',flexDirection:'column',gap:14,padding:40,textAlign:'center'}}>
                  <div style={{width:64,height:64,borderRadius:16,background:T.accentLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🔒</div>
                  <div style={{fontSize:20,fontWeight:700,color:T.textPrimary,letterSpacing:'-.02em'}}>Kanzlei-Portal</div>
                  <div style={{fontSize:14,color:T.textMuted,maxWidth:380,lineHeight:1.6}}>
                    Das Kanzlei-Portal ist ab dem Business-Plan verfügbar. Verwalte alle Mandanten zentral und exportiere DATEV mit einem Klick.
                  </div>
                  <button className="btn btn-primary" onClick={()=>setNav('settings')} style={{marginTop:8}}>Plan upgraden →</button>
                </div>
          )}
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

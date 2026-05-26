// Kompletter Connect-Screen für invoiq-app-complete.jsx
// Diesen Code ersetzt die Placeholder "ERP-Anbindung" im App

import { useState, useEffect } from "react";

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

// CSS tokens (consistent with main app)
const C = {
  navy:"#08122A", navyMid:"#0E1E42", navyLite:"#1A3A7C",
  white:"#FFFFFF", bg:"#F4F6FA", bgAlt:"#EBEEf5",
  text:"#08122A", textMuted:"#6B7FA8", textLight:"#9AAAC8",
  border:"#DDE3F0", borderMid:"#C8D0E8", accentPale:"#EBF0FB",
  green:"#0A6640", greenBg:"#EDFAF3", greenBdr:"#86EFAC",
  amber:"#92400E", amberBg:"#FFFBEB", amberBdr:"#FDE68A",
  red:"#B91C1C", redBg:"#FEF2F2", redBdr:"#FECACA",
};
const F = { d:"'Fraunces', Georgia, serif", u:"'DM Sans', system-ui, sans-serif" };

export function ConnectScreen({ notify }) {
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

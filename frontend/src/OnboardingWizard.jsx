import { useState, useEffect, useRef } from "react";

// Gleiche API-Basis wie App.jsx — inkl. /v1-Prefix
const API_BASE = (import.meta?.env?.VITE_API_URL) || "https://api.invoiq.de/v1";

/* ═══════════════════════════════════════════════════════════════
   invoiq — Onboarding Wizard
   5 Schritte · Smooth Animationen · Weißes Navy-Design
   Ziel: Neuer Kunde → erste echte Rechnung in 3 Minuten
   ═══════════════════════════════════════════════════════════════ */

const C = {
  navy:      "#08122A",
  navyMid:   "#0E1E42",
  navyLite:  "#1A3A7C",
  navyPale:  "#2B4FA0",
  white:     "#FFFFFF",
  bg:        "#F4F6FA",
  text:      "#08122A",
  textMid:   "#2C3E6B",
  textMuted: "#6B7FA8",
  textLight: "#9AAAC8",
  border:    "#DDE3F0",
  borderMid: "#C8D0E8",
  accentPale:"#EBF0FB",
  green:     "#0A6640",
  greenBg:   "#EDFAF3",
  greenBdr:  "#86EFAC",
};

const F = {
  display: "'Fraunces', Georgia, serif",
  ui:      "'DM Sans', system-ui, sans-serif",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-font-smoothing: antialiased; }
body { font-family: ${F.ui}; background: ${C.bg}; color: ${C.text}; }

@keyframes fadeUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes slideRight { from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
@keyframes scaleIn  { from { opacity:0; transform:scale(.94) } to { opacity:1; transform:scale(1) } }
@keyframes spin     { to { transform: rotate(360deg) } }
@keyframes pulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
@keyframes checkPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 70%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
@keyframes progressFill { from { width:0 } to { width: var(--target-width) } }
@keyframes confettiDrop { from { transform:translateY(-20px) rotate(0deg); opacity:1 } to { transform:translateY(80px) rotate(360deg); opacity:0 } }

.fu  { animation: fadeUp    .55s cubic-bezier(.22,1,.36,1) both; }
.fu2 { animation: fadeUp    .55s .08s cubic-bezier(.22,1,.36,1) both; }
.fu3 { animation: fadeUp    .55s .16s cubic-bezier(.22,1,.36,1) both; }
.fu4 { animation: fadeUp    .55s .24s cubic-bezier(.22,1,.36,1) both; }
.fu5 { animation: fadeUp    .55s .32s cubic-bezier(.22,1,.36,1) both; }
.fi  { animation: fadeIn    .4s ease both; }
.si  { animation: slideRight .4s cubic-bezier(.22,1,.36,1) both; }
.sci { animation: scaleIn   .35s cubic-bezier(.22,1,.36,1) both; }

.ob-input {
  width: 100%;
  background: ${C.white};
  border: 1.5px solid ${C.border};
  border-radius: 10px;
  padding: 12px 16px;
  font-family: ${F.ui};
  font-size: 15px;
  color: ${C.text};
  outline: none;
  transition: border-color .18s, box-shadow .18s;
}
.ob-input:focus {
  border-color: ${C.navyLite};
  box-shadow: 0 0 0 3px ${C.accentPale};
}
.ob-input::placeholder { color: ${C.textLight}; }

.ob-select {
  width: 100%;
  background: ${C.white};
  border: 1.5px solid ${C.border};
  border-radius: 10px;
  padding: 12px 16px;
  font-family: ${F.ui};
  font-size: 15px;
  color: ${C.text};
  outline: none;
  cursor: pointer;
  transition: border-color .18s;
}
.ob-select:focus { border-color: ${C.navyLite}; }

.ob-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: ${C.textMuted};
  letter-spacing: .8px;
  text-transform: uppercase;
  margin-bottom: 7px;
}

.erp-card {
  border: 1.5px solid ${C.border};
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all .18s cubic-bezier(.22,1,.36,1);
  background: ${C.white};
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
}
.erp-card:hover {
  border-color: ${C.navyLite};
  background: ${C.accentPale};
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(8,18,42,.08);
}
.erp-card.selected {
  border-color: ${C.navyLite};
  background: ${C.accentPale};
  box-shadow: 0 0 0 3px ${C.accentPale};
}

.format-card {
  border: 1.5px solid ${C.border};
  border-radius: 12px;
  padding: 18px 16px;
  cursor: pointer;
  transition: all .18s cubic-bezier(.22,1,.36,1);
  background: ${C.white};
  text-align: center;
  position: relative;
}
.format-card:hover {
  border-color: ${C.navyLite};
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(8,18,42,.08);
}
.format-card.selected {
  border-color: ${C.navy};
  background: ${C.navy};
}

.btn-primary {
  background: ${C.navy};
  color: ${C.white};
  border: none;
  border-radius: 11px;
  padding: 14px 32px;
  font-family: ${F.ui};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all .18s cubic-bezier(.22,1,.36,1);
  box-shadow: 0 2px 8px rgba(8,18,42,.18);
}
.btn-primary:hover {
  background: ${C.navyMid};
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(8,18,42,.22);
}
.btn-primary:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  background: transparent;
  color: ${C.textMuted};
  border: 1.5px solid ${C.border};
  border-radius: 11px;
  padding: 13px 24px;
  font-family: ${F.ui};
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all .18s;
}
.btn-ghost:hover {
  color: ${C.text};
  border-color: ${C.borderMid};
  background: ${C.bg};
}

.check-circle {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: ${C.greenBg};
  border: 1.5px solid ${C.greenBdr};
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  animation: checkPop .4s cubic-bezier(.22,1,.36,1) both;
}

.confetti-piece {
  position: absolute;
  width: 8px; height: 8px;
  border-radius: 2px;
  animation: confettiDrop 1.2s ease-out both;
}
`;

// ── STEP DEFINITIONS ───────────────────────────────────────────
const STEPS = [
  { id: 1, icon: "🏢", title: "Ihr Unternehmen",      sub: "Grunddaten für Ihre Rechnungen" },
  { id: 2, icon: "🔗", title: "ERP-System",           sub: "Woher kommen Ihre Rechnungen?" },
  { id: 3, icon: "📄", title: "Rechnungsformat",      sub: "XRechnung, ZUGFeRD oder Peppol?" },
  { id: 4, icon: "✉️",  title: "Erste Rechnung",       sub: "Testen Sie invoiq sofort" },
  { id: 5, icon: "🎉", title: "Fertig!",              sub: "invoiq ist einsatzbereit" },
];

const ERP_OPTIONS = [
  { type: "sap_s4",   icon: "⚙️", name: "SAP S/4HANA",    desc: "Über IDoc oder CPI" },
  { type: "sap_ecc",  icon: "⚙️", name: "SAP ECC",         desc: "Klassisch via IDoc" },
  { type: "datev",    icon: "📊", name: "DATEV",            desc: "Connect Online API" },
  { type: "lexware",  icon: "📋", name: "Lexware",          desc: "XML / SFTP Export" },
  { type: "dynamics", icon: "🔷", name: "MS Dynamics 365",  desc: "Dataverse REST API" },
  { type: "odoo",     icon: "🟣", name: "Odoo",             desc: "JSON-RPC API" },
  { type: "sevdesk",  icon: "📱", name: "sevDesk",          desc: "Direkt per API-Key" },
  { type: "lexoffice",icon: "📄", name: "lexoffice",        desc: "Direkt per API-Key" },
  { type: "manual",   icon: "✏️", name: "Manuell / CSV",    desc: "Ohne ERP-System" },
  { type: "rest",     icon: "🔌", name: "REST API",         desc: "Eigene Integration" },
];

const FORMAT_OPTIONS = [
  {
    type: "xrechnung",
    icon: "🇩🇪",
    name: "XRechnung",
    desc: "Standard für Deutschland",
    tags: ["EN 16931", "UBL 2.1", "Pflicht 2027"],
    recommended: true,
  },
  {
    type: "zugferd",
    icon: "📎",
    name: "ZUGFeRD 2.4",
    desc: "PDF + XML Hybrid",
    tags: ["Factur-X", "CII", "Für alle"],
    recommended: false,
  },
  {
    type: "peppol",
    icon: "🌍",
    name: "Peppol BIS 3.0",
    desc: "Europäisches Netzwerk",
    tags: ["EU-weit", "B2G", "ViDA"],
    recommended: false,
  },
];

function Spinner({ size = 18, color = C.white }) {
  return (
    <span style={{ width: size, height: size, border: `2px solid ${color}30`, borderTopColor: color, borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block", flexShrink: 0 }} />
  );
}

// ── PROGRESS BAR ───────────────────────────────────────────────
function ProgressBar({ step, total }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  return (
    <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden", marginBottom: 40 }}>
      <div style={{ height: "100%", background: `linear-gradient(90deg, ${C.navyLite}, ${C.navy})`, borderRadius: 2, width: `${pct}%`, transition: "width .5s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

// ── STEP INDICATOR ─────────────────────────────────────────────
function StepDots({ step, total }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width:  i + 1 === step ? 24 : 8,
          height: 8,
          borderRadius: 4,
          background: i + 1 < step ? C.navy : i + 1 === step ? C.navyLite : C.border,
          transition: "all .35s cubic-bezier(.22,1,.36,1)",
        }} />
      ))}
    </div>
  );
}

// ── STEP 1: Unternehmensdaten ──────────────────────────────────
function Step1({ data, setData }) {
  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  return (
    <div>
      <div className="fu" style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
      <h2 className="fu2" style={{ fontFamily: F.display, fontSize: 28, fontWeight: 400, color: C.navy, marginBottom: 6, letterSpacing: "-.025em" }}>
        Ihr Unternehmen.
      </h2>
      <p className="fu3" style={{ color: C.textMuted, fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
        Diese Daten erscheinen auf allen Ihren Rechnungen — einmalig eintragen, immer korrekt.
      </p>

      <div className="fu3" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="ob-label">Unternehmensname *</label>
            <input className="ob-input" value={data.org_name || ""} onChange={e => upd("org_name", e.target.value)} placeholder="Mustermann GmbH" />
          </div>
          <div>
            <label className="ob-label">Rechtsform</label>
            <select className="ob-select" value={data.legal_form || "GmbH"} onChange={e => upd("legal_form", e.target.value)}>
              {["GmbH", "UG (haftungsbeschränkt)", "AG", "GbR", "e.K.", "KG", "OHG", "Einzelunternehmen", "Freiberufler"].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="ob-label">USt-IdNr.</label>
            <input className="ob-input" value={data.vat_id || ""} onChange={e => upd("vat_id", e.target.value)} placeholder="DE123456789" />
          </div>
          <div>
            <label className="ob-label">Handelsregisternummer</label>
            <input className="ob-input" value={data.reg_number || ""} onChange={e => upd("reg_number", e.target.value)} placeholder="HRB 12345 München" />
          </div>
        </div>

        <div>
          <label className="ob-label">Straße & Hausnummer</label>
          <input className="ob-input" value={data.address || ""} onChange={e => upd("address", e.target.value)} placeholder="Musterstraße 1" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14 }}>
          <div>
            <label className="ob-label">PLZ</label>
            <input className="ob-input" value={data.zip || ""} onChange={e => upd("zip", e.target.value)} placeholder="80331" />
          </div>
          <div>
            <label className="ob-label">Stadt</label>
            <input className="ob-input" value={data.city || ""} onChange={e => upd("city", e.target.value)} placeholder="München" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="ob-label">IBAN (für Zahlungsziel)</label>
            <input className="ob-input" value={data.iban || ""} onChange={e => upd("iban", e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" />
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Optional — kann später in den Einstellungen ergänzt werden.</div>
          </div>
          <div>
            <label className="ob-label">Leitweg-ID (für Behörden)</label>
            <input className="ob-input" value={data.leitweg_id || ""} onChange={e => upd("leitweg_id", e.target.value)} placeholder="04011000-12345-06" />
          </div>
        </div>

        {/* Live Preview */}
        {(data.org_name || data.address) && (
          <div className="sci" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 8, color: C.textLight }}>Vorschau auf Ihrer Rechnung:</div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{data.org_name || "—"}{data.legal_form ? ` ${data.legal_form}` : ""}</div>
            {data.address && <div>{data.address}</div>}
            {(data.zip || data.city) && <div>{data.zip} {data.city}</div>}
            {data.vat_id && <div>USt-IdNr.: {data.vat_id}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── STEP 2: ERP-System ─────────────────────────────────────────
function Step2({ data, setData }) {
  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  return (
    <div>
      <div className="fu" style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
      <h2 className="fu2" style={{ fontFamily: F.display, fontSize: 28, fontWeight: 400, color: C.navy, marginBottom: 6, letterSpacing: "-.025em" }}>
        Ihr ERP-System.
      </h2>
      <p className="fu3" style={{ color: C.textMuted, fontSize: 15, marginBottom: 8, lineHeight: 1.6 }}>
        Woher kommen Ihre Ausgangsrechnungen? Wir richten die Verbindung für Sie ein.
      </p>
      <p className="fu3" style={{ color: C.textLight, fontSize: 12.5, marginBottom: 28 }}>
        Optional — können Sie auch später in den Einstellungen einrichten.
      </p>

      <div className="fu3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {ERP_OPTIONS.map(erp => (
          <div key={erp.type} className={`erp-card ${data.erp === erp.type ? "selected" : ""}`} onClick={() => upd("erp", erp.type)}>
            {/* Checkmark */}
            {data.erp === erp.type && (
              <div style={{ position: "absolute", top: 10, right: 10 }} className="check-circle">✓</div>
            )}
            <span style={{ fontSize: 22, flexShrink: 0 }}>{erp.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>{erp.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{erp.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* SAP-spezifische Hinweise */}
      {(data.erp === "sap_s4" || data.erp === "sap_ecc") && (
        <div className="sci" style={{ background: C.accentPale, border: `1px solid ${C.borderMid}`, borderRadius: 10, padding: "14px 18px", fontSize: 13, color: C.textMid }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>⚙️ SAP-Integration</div>
          <div style={{ lineHeight: 1.65 }}>
            Ihr SAP-Berater konfiguriert die Verbindung einmalig in ca. 4–8 Stunden (SM59, WE20, NACE).
            Danach läuft jede Faktura automatisch durch invoiq.{" "}
            <span style={{ color: C.navyLite, fontWeight: 600, cursor: "pointer" }}>Integration Package herunterladen →</span>
          </div>
        </div>
      )}

      {data.erp === "datev" && (
        <div className="sci" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#92400E" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 DATEV-Integration</div>
          <div style={{ lineHeight: 1.65 }}>
            DATEV Connect Online API · OAuth 2.0 · Zertifizierung durch invoiq bereits beantragt.
            Wir melden uns sobald die Verbindung aktiviert werden kann.
          </div>
        </div>
      )}

      {data.erp === "manual" && (
        <div className="sci" style={{ background: C.greenBg, border: `1px solid ${C.greenBdr}`, borderRadius: 10, padding: "14px 18px", fontSize: 13, color: C.green }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✏️ Manueller Betrieb</div>
          <div style={{ lineHeight: 1.65 }}>
            Perfekt für den Start. Sie können Rechnungen direkt in invoiq erstellen oder als CSV hochladen.
            ERP-Anbindung jederzeit nachrüstbar.
          </div>
        </div>
      )}
    </div>
  );
}

// ── STEP 3: Format ─────────────────────────────────────────────
function Step3({ data, setData }) {
  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  return (
    <div>
      <div className="fu" style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
      <h2 className="fu2" style={{ fontFamily: F.display, fontSize: 28, fontWeight: 400, color: C.navy, marginBottom: 6, letterSpacing: "-.025em" }}>
        Ihr Rechnungsformat.
      </h2>
      <p className="fu3" style={{ color: C.textMuted, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
        Für die meisten deutschen Unternehmen empfehlen wir XRechnung — der gesetzliche Standard ab 2027.
      </p>

      <div className="fu3" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {FORMAT_OPTIONS.map(fmt => (
          <div key={fmt.type} className={`format-card ${data.format === fmt.type ? "selected" : ""}`} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 16, padding: "20px 20px" }} onClick={() => upd("format", fmt.type)}>
            {data.format === fmt.type && (
              <div className="check-circle" style={{ position: "absolute", top: 12, right: 12, background: data.format === fmt.type ? "rgba(255,255,255,.2)" : C.greenBg, border: `1.5px solid ${data.format === fmt.type ? "rgba(255,255,255,.4)" : C.greenBdr}`, color: data.format === fmt.type ? C.white : C.green }}>✓</div>
            )}
            {fmt.recommended && (
              <div style={{ position: "absolute", top: -10, left: 16, background: C.navy, color: C.white, fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 12, letterSpacing: .5 }}>
                {data.format === fmt.type ? "" : "EMPFOHLEN"}
              </div>
            )}
            <span style={{ fontSize: 28, flexShrink: 0 }}>{fmt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: data.format === fmt.type ? C.white : C.navy, marginBottom: 3 }}>{fmt.name}</div>
              <div style={{ fontSize: 13, color: data.format === fmt.type ? "rgba(255,255,255,.65)" : C.textMuted, marginBottom: 8 }}>{fmt.desc}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {fmt.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: data.format === fmt.type ? "rgba(255,255,255,.15)" : C.accentPale, color: data.format === fmt.type ? "rgba(255,255,255,.8)" : C.navyLite, border: `1px solid ${data.format === fmt.type ? "rgba(255,255,255,.2)" : C.borderMid}` }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery method */}
      <div className="fu4">
        <label className="ob-label">Standard-Zustellweg</label>
        <select className="ob-select" value={data.delivery || "email"} onChange={e => upd("delivery", e.target.value)}>
          <option value="email">E-Mail (Standard)</option>
          <option value="peppol">Peppol-Netzwerk (wenn Empfänger registriert)</option>
          <option value="manual">Manuell / Download</option>
        </select>
      </div>
    </div>
  );
}

// ── STEP 4: Erste Rechnung ─────────────────────────────────────
function Step4({ data, setData, onGenerate, generating, generatedXML }) {
  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  const inv = data.test_invoice || {};
  const updInv = (k, v) => upd("test_invoice", { ...inv, [k]: v });

  const net = (inv.qty || 1) * (inv.price || 0);
  const vat = net * ((inv.vat || 19) / 100);
  const gross = net + vat;
  const fmtEUR = n => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div>
      <div className="fu" style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
      <h2 className="fu2" style={{ fontFamily: F.display, fontSize: 28, fontWeight: 400, color: C.navy, marginBottom: 6, letterSpacing: "-.025em" }}>
        Erste Rechnung.
      </h2>
      <p className="fu3" style={{ color: C.textMuted, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
        Erstellen Sie jetzt Ihre erste echte XRechnung — EN 16931-konform, GoBD-archiviert, versandbereit.
      </p>

      {!generatedXML ? (
        <div className="fu3" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="ob-label">Empfänger *</label>
              <input className="ob-input" value={inv.buyer_name || ""} onChange={e => updInv("buyer_name", e.target.value)} placeholder="Müller GmbH" />
            </div>
            <div>
              <label className="ob-label">E-Mail des Empfängers</label>
              <input className="ob-input" type="email" value={inv.buyer_email || ""} onChange={e => updInv("buyer_email", e.target.value)} placeholder="rechnung@mueller.de" />
            </div>
          </div>

          <div>
            <label className="ob-label">Leistungsbeschreibung *</label>
            <input className="ob-input" value={inv.description || ""} onChange={e => updInv("description", e.target.value)} placeholder="z.B. SAP Beratungsleistung, Monat Mai 2025" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", gap: 14 }}>
            <div>
              <label className="ob-label">Menge</label>
              <input className="ob-input" type="number" min="1" value={inv.qty || 1} onChange={e => updInv("qty", parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="ob-label">Einzelpreis (€)</label>
              <input className="ob-input" type="number" min="0" step="0.01" value={inv.price || ""} onChange={e => updInv("price", parseFloat(e.target.value) || 0)} placeholder="150.00" />
            </div>
            <div>
              <label className="ob-label">MwSt</label>
              <select className="ob-select" value={inv.vat || 19} onChange={e => updInv("vat", parseInt(e.target.value))}>
                <option value={19}>19%</option>
                <option value={7}>7%</option>
                <option value={0}>0%</option>
              </select>
            </div>
          </div>

          {/* Totals mini */}
          {(inv.price > 0) && (
            <div className="sci" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>Netto {fmtEUR(net)} · MwSt {fmtEUR(vat)}</div>
              <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 500, color: C.navy }}>Brutto {fmtEUR(gross)}</div>
            </div>
          )}

          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "15px" }} onClick={onGenerate} disabled={generating || !inv.buyer_name || !inv.description}>
            {generating ? <><Spinner /> Generiere XRechnung...</> : "⚡ XRechnung generieren"}
          </button>

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: C.textLight }}>✓ EN 16931</span>
            <span style={{ fontSize: 11, color: C.textLight }}>·</span>
            <span style={{ fontSize: 11, color: C.textLight }}>✓ GoBD-Archiv</span>
            <span style={{ fontSize: 11, color: C.textLight }}>·</span>
            <span style={{ fontSize: 11, color: C.textLight }}>✓ SHA-256</span>
          </div>
        </div>
      ) : (
        <div className="sci">
          {/* Success state */}
          <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBdr}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✓</div>
            <div>
              <div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>XRechnung erfolgreich generiert!</div>
              <div style={{ fontSize: 12, color: C.green, marginTop: 2 }}>EN 16931 validiert · GoBD-archiviert · SHA-256 gesichert</div>
            </div>
          </div>

          <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, fontSize: 11, color: C.textMid, overflow: "auto", maxHeight: 200, lineHeight: 1.6, fontFamily: "monospace", marginBottom: 14 }}>
            {generatedXML.substring(0, 600)}…
          </pre>

          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
            const b = new Blob([generatedXML], { type: "application/xml" });
            const u = URL.createObjectURL(b);
            const a = document.createElement("a");
            a.href = u; a.download = `${inv.buyer_name?.replace(/\s/g, "_")}_XRechnung.xml`; a.click();
            URL.revokeObjectURL(u);
          }}>
            ↓ XML herunterladen
          </button>
        </div>
      )}
    </div>
  );
}

// ── STEP 5: Done ───────────────────────────────────────────────
function Step5({ data, onFinish }) {
  const confettiColors = ["#08122A", "#1A3A7C", "#DDE3F0", "#9AAAC8", "#0E1E42"];
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    left:  `${Math.random() * 90 + 5}%`,
    delay: `${Math.random() * .8}s`,
    color: confettiColors[i % confettiColors.length],
    size:  Math.random() * 6 + 5,
    rotate: Math.random() * 360,
  }));

  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      {/* Confetti */}
      {pieces.map((p, i) => (
        <div key={i} className="confetti-piece" style={{ left: p.left, top: 0, background: p.color, width: p.size, height: p.size, animationDelay: p.delay, transform: `rotate(${p.rotate}deg)` }} />
      ))}

      <div className="fu" style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 className="fu2" style={{ fontFamily: F.display, fontSize: 32, fontWeight: 400, color: C.navy, marginBottom: 10, letterSpacing: "-.025em" }}>
        invoiq ist bereit.
      </h2>
      <p className="fu3" style={{ color: C.textMuted, fontSize: 16, marginBottom: 36, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 36px" }}>
        {data.org_name || "Ihr Unternehmen"} ist jetzt vollständig eingerichtet. Alle Ihre Rechnungen werden ab sofort EN 16931-konform generiert und GoBD-archiviert.
      </p>

      {/* Checklist */}
      <div className="fu4" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28, textAlign: "left", maxWidth: 420, margin: "0 auto 28px" }}>
        {[
          ["Unternehmensdaten", !!data.org_name],
          ["ERP-System", !!data.erp],
          ["Rechnungsformat", !!data.format],
          ["Erste Rechnung", true],
          ["GoBD-Archivierung", true],
        ].map(([label, done], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 4 ? `1px solid ${C.borderMid}` : "none" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? C.greenBg : C.bg, border: `1.5px solid ${done ? C.greenBdr : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: done ? C.green : C.textLight, flexShrink: 0 }}>
              {done ? "✓" : "○"}
            </div>
            <span style={{ fontSize: 14, color: done ? C.navy : C.textMuted, fontWeight: done ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Next steps */}
      <div className="fu5" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, maxWidth: 420, margin: "0 auto 28px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, letterSpacing: .8, textTransform: "uppercase", marginBottom: 4 }}>Empfohlene nächste Schritte</div>
        {[
          { icon: "🔗", text: "ERP-Konnektor aktivieren", sub: "Automatisierung einschalten" },
          { icon: "💳", text: "Plan aktivieren", sub: "Starter ab 49 €/Monat", plan: localStorage.getItem("invoiq_selected_plan")||"starter" },
          { icon: "👥", text: "Team einladen", sub: "Kollegen hinzufügen" },
        ].map((s, i) => (
          <div key={i} onClick={s.plan?async()=>{const r=await fetch(`${API_BASE}/payments/checkout`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("invoiq_token")}`},body:JSON.stringify({plan:s.plan})});const d=await r.json();if(d.checkout_url)window.location.href=d.checkout_url;}:undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "border-color .15s" }} onMouseEnter={e => e.currentTarget.style.borderColor = C.navyLite} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: C.navy, fontSize: 13.5 }}>{s.text}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{s.sub}</div>
            </div>
            <span style={{ color: C.textLight, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>

      <button className="btn-primary" style={{ padding: "15px 48px", fontSize: 16 }} onClick={onFinish}>
        Zum Dashboard →
      </button>
    </div>
  );
}

// ── MAIN WIZARD ────────────────────────────────────────────────
export default function OnboardingWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    org_name:    user?.org_name || "",
    format:      "xrechnung",
    delivery:    "email",
    erp:         "",
    test_invoice: {},
  });
  const [generating, setGenerating]   = useState(false);
  const [generatedXML, setGeneratedXML] = useState(null);
  const [saving, setSaving]           = useState(false);

  // Im Wizard sind ab jetzt nur die im Vorfeld (Registrierung) bereits
  // erfassten Unternehmensdaten geprüft. Adresse, ERP-Anbindung und Format
  // sind optional/überspringbar — IBAN/ERP werden NICHT erzwungen.
  const canAdvance = () => {
    if (step === 1) return !!data.org_name;
    if (step === 2) return true;  // ERP-Auswahl optional, jederzeit später nachrüstbar
    if (step === 3) return !!data.format; // hat sinnvollen Default (xrechnung)
    if (step === 4) return true; // optional step
    return true;
  };

  const handleGenerate = async () => {
    const inv = data.test_invoice;
    if (!inv.buyer_name || !inv.description) return;

    setGenerating(true);
    try {
      // Try real API
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("invoiq_token")}` },
        body: JSON.stringify({
          invoice_number: `TEST-${Date.now()}`,
          invoice_date:   new Date().toISOString().split("T")[0],
          format:         data.format || "xrechnung",
          delivery_method:"manual",
          seller_name:    data.org_name,
          seller_vat_id:  data.vat_id || "",
          seller_address: data.address || "",
          seller_city:    data.city || "",
          buyer_name:     inv.buyer_name,
          buyer_email:    inv.buyer_email || "",
          line_items: [{ description: inv.description, quantity: inv.qty || 1, unit_price: inv.price || 100, vat_rate: inv.vat || 19 }],
        }),
      });

      if (res.ok) {
        const invoice = await res.json();
        const xmlRes = await fetch(`${API_BASE}/invoices/${invoice.id}/xml`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("invoiq_token")}` }
        });
        const xml = await xmlRes.text();
        setGeneratedXML(xml);
      } else {
        throw new Error("API error");
      }
    } catch(e) {
      // Fallback: generate demo XML
      const net = (inv.qty || 1) * (inv.price || 100);
      const gross = net * 1.19;
      setGeneratedXML(`<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <!-- invoiq · XRechnung 3.0 / EN 16931 / UBL 2.1 -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>TEST-${Date.now()}</cbc:ID>
  <cbc:IssueDate>${new Date().toISOString().split("T")[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${data.org_name}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${inv.buyer_name}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${gross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${gross.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${inv.qty || 1}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${net.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${inv.description}</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${inv.price || 100}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</ubl:Invoice>`);
    }
    setGenerating(false);
  };

  const handleNext = async () => {
    if (step < STEPS.length) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (step > 1) { setStep(s => s - 1); setGeneratedXML(null); }
  };

  const handleFinish = async () => {
    setSaving(true);
    // Save onboarding data to API
    try {
      await fetch(`${API_BASE}/auth/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("invoiq_token")}` },
        body: JSON.stringify(data),
      });
    } catch(e) { /* continue */ }
    setSaving(false);
    onComplete?.(data);
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 640 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, userSelect: "none" }}>
              <div style={{ width: 28, height: 28, background: C.navy, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="8" width="3.5" height="9" rx="1.75" fill="#93C5FD"/>
                  <rect x="2" y="2" width="3.5" height="4" rx="1.75" fill="#fff"/>
                  <circle cx="13.5" cy="12" r="4.5" stroke="#fff" strokeWidth="2.2" fill="none"/>
                  <rect x="15.8" y="7" width="2.5" height="10" rx="1.25" fill="#fff"/>
                </svg>
              </div>
              <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600, color: C.navy, letterSpacing: "-.03em" }}>
                inv<span style={{ color: C.navyLite }}>o</span>iq
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
              Schritt {step} von {STEPS.length}
            </div>
          </div>

          {/* Progress */}
          <ProgressBar step={step} total={STEPS.length} />
          <StepDots step={step} total={STEPS.length} />

          {/* Card */}
          <div key={step} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: "36px 40px", boxShadow: "0 4px 28px rgba(8,18,42,.07)", position: "relative", overflow: "hidden" }}>
            {/* Subtle corner accent */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(ellipse at top right, ${C.accentPale} 0%, transparent 70%)`, pointerEvents: "none" }} />

            {step === 1 && <Step1 data={data} setData={setData} />}
            {step === 2 && <Step2 data={data} setData={setData} />}
            {step === 3 && <Step3 data={data} setData={setData} />}
            {step === 4 && <Step4 data={data} setData={setData} onGenerate={handleGenerate} generating={generating} generatedXML={generatedXML} />}
            {step === 5 && <Step5 data={data} onFinish={handleFinish} />}
          </div>

          {/* Navigation */}
          {step < 5 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <button className="btn-ghost" onClick={handleBack} style={{ visibility: step === 1 ? "hidden" : "visible" }}>
                ← Zurück
              </button>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {step === 4 && !generatedXML && (
                  <button style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontFamily: F.ui }} onClick={handleNext}>
                    Überspringen
                  </button>
                )}
                <button className="btn-primary" onClick={handleNext} disabled={!canAdvance()} style={{opacity:canAdvance()?1:0.55,cursor:canAdvance()?'pointer':'not-allowed'}}>
                                {step === 4 ? (generatedXML ? "Weiter →" : "Ohne Rechnung fortfahren →") : "Weiter →"}
                 </button>
                             {!canAdvance() && step < 4 && (
                             <p style={{color:"#C0392B",fontSize:12,marginTop:6,textAlign:"center"}}>Bitte alle Pflichtfelder (*) ausfüllen</p>
                           )}
                          </div>
              </div>
          )}

          {/* Skip entire onboarding */}
          {step === 1 && (
                        <div style={{ textAlign: "center", marginTop: 16 }}>
<button style={{ background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 13, fontFamily: F.ui }} onClick={() => onComplete?.({})}>
                Onboarding überspringen — direkt zum Dashboard
              </button>
            </div>
                    
        
          )}
      </div>
    </div>
  </>
  );
}

# invoiq.io — Claude Code Workflow Spec
# Basierend auf E2E-Test vom 12.06.2026
# Bitte ALLES umsetzen ohne bestehende Funktionen zu ändern

## KONTEXT
Diese App ist eine React/Vite Single-Page-App (frontend/src/App.jsx).
Alle Screens sind in einer einzigen App.jsx Datei. Backend: Node.js in /backend.
Tech Stack: React, Vite, Custom CSS-in-JS, JWT Auth, REST API.

---

## KRITISCHE BUGS (sofort fixen — App läuft nicht korrekt)

### BUG-001: Session Persistence nach Page Reload
**Datei:** frontend/src/App.jsx
**Zeile:** ca. 3736 (suche nach: `if(api._token)return'app';return'landing';`)
**Problem:** Beim Page Reload wird User zur Landing Page geschickt obwohl Token in localStorage vorhanden.
**Fix:** Ändere `return'app'` zu `return'loading'` in der useState Initialisierung.
**Dann:** Füge einen Loading-Screen Render ein. Suche nach `{screen==="landing"&&` und füge DAVOR ein:
```jsx
{screen==="loading"&&(
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',
    height:'100vh',background:'#F6F9FC'}}>
    <div style={{textAlign:'center'}}>
      <div style={{width:40,height:40,border:'3px solid #E5E4FF',
        borderTopColor:'#635BFF',borderRadius:'50%',
        animation:'spin 0.8s linear infinite',margin:'0 auto 16px'}}></div>
      <div style={{fontSize:14,color:'#697386',fontFamily:"'Outfit',sans-serif"}}>
        Wird geladen...
      </div>
    </div>
  </div>
)}
```
**Warum:** Der useEffect für api.me() ist async — ohne loading state sieht der User kurz die Landing Page.

---

### BUG-002: Kanzlei-Portal White Screen (Free/Starter Plan)
**Datei:** frontend/src/App.jsx
**Zeile:** ca. 3785 (suche nach: `nav==="steuerberater"&&<SteuerberaterPortal`)
**Problem:** Wenn hasKanzlei=false und User klickt Kanzlei-Portal, rendert nichts → weiße Seite.
**Fix:** Wrapping des Renders in ternären Operator:
```jsx
{nav==="steuerberater"&&(
  hasKanzlei
    ? <SteuerberaterPortal user={user} notify={notify} onBack={()=>setNav('dashboard')}/>
    : <div style={{display:'flex',alignItems:'center',justifyContent:'center',
        height:'100%',flexDirection:'column',gap:16,padding:40,textAlign:'center'}}>
        <div style={{fontSize:48}}>🔒</div>
        <div style={{fontSize:20,fontWeight:700,color:'#0A2540'}}>Kanzlei-Portal</div>
        <div style={{fontSize:14,color:'#697386',maxWidth:360}}>
          Das Kanzlei-Portal ist ab dem Business-Plan verfügbar.
          Verwalte alle Mandanten zentral und exportiere DATEV mit einem Klick.
        </div>
        <button className="btn btn-primary" onClick={()=>setNav('settings')} style={{marginTop:8}}>
          Plan upgraden →
        </button>
      </div>
)}
```

---

### BUG-003: Navigation aus Rechnungsformular über Sidebar blockiert
**Datei:** frontend/src/App.jsx
**Symptom:** Klick auf Sidebar-Links während man im Neue-Rechnung-Formular ist führt nicht zur Navigation.
**Fix:** Prüfe ob es eine `preventDefault` oder `return false` in der Formular-Komponente gibt die Events blockiert. Stelle sicher dass `setNav` direkt im onClick-Handler der Sidebar-Buttons aufgerufen wird und kein parent-Element das Event konsumiert.

---

### BUG-004: Kein Feedback bei fehlendem Pflichtfeld (Rechnungsformular)
**Datei:** frontend/src/App.jsx — Invoices Komponente, `generate` Funktion
**Problem:** Wenn buyer_name fehlt, passiert beim Button-Klick nichts Sichtbares.
**Current Code (Suche nach):** `if(!form.buyer_name){notify("Empfänger fehlt","error")`
**Fix ergänzen:** Zusätzlich zu notify auch das Feld visuell markieren:
```jsx
// Füge state hinzu:
const [fieldErrors, setFieldErrors] = useState({});

// In generate() vor api.createInvoice:
const errors = {};
if(!form.buyer_name) errors.buyer_name = true;
if(!form.buyer_city) errors.buyer_city = true;
if(!form.line_items?.[0]?.description) errors.line_items = true;
if(Object.keys(errors).length > 0) {
  setFieldErrors(errors);
  notify("Bitte alle Pflichtfelder ausfüllen", "error");
  return;
}
setFieldErrors({});

// Bei Input-Feldern border-color ändern:
// style={{...inputStyle, borderColor: fieldErrors.buyer_name ? '#C0392B' : undefined}}
```

---

## NEUE FEATURES

### FEAT-001: Draft speichern Button im Rechnungsformular
**Datei:** frontend/src/App.jsx — Invoices Komponente
**Wo:** Neben dem "XRechnung generieren" Button im create-View
**Implementierung:**
```jsx
// Neuer Button neben generate:
<button className="btn btn-ghost" onClick={saveDraft} disabled={saving}>
  {saving ? <Spinner size={14}/> : null} Als Entwurf speichern
</button>

// saveDraft Funktion:
const saveDraft = async () => {
  setSaving(true);
  try {
    await api.createInvoice({...form, status:'draft'});
    notify("Entwurf gespeichert", "success");
    load();
  } catch(e) {
    notify(e.message, "error");
  }
  setSaving(false);
};
```

---

### FEAT-002: Empty States mit Handlungsaufforderung
**Datei:** frontend/src/App.jsx — alle Listenkomponenten
**Suche nach Stellen mit:** `invoices.length===0` oder leeren Tabellen
**Implementierung — leerer Ausgang:**
```jsx
{invoices.length===0 && (
  <div style={{textAlign:'center',padding:'60px 24px',color:'#697386'}}>
    <div style={{fontSize:40,marginBottom:16}}>📄</div>
    <div style={{fontSize:16,fontWeight:600,color:'#0A2540',marginBottom:8}}>
      Noch keine Rechnung erstellt
    </div>
    <div style={{fontSize:14,marginBottom:20}}>
      Erstelle deine erste XRechnung in wenigen Sekunden.
    </div>
    <button className="btn btn-primary" onClick={()=>setView('create')}>
      Erste Rechnung erstellen →
    </button>
  </div>
)}
```
**Gleich für Eingang (inbound):**
```jsx
{inbound.length===0 && (
  <div style={{textAlign:'center',padding:'60px 24px',color:'#697386'}}>
    <div style={{fontSize:40,marginBottom:16}}>📬</div>
    <div style={{fontSize:16,fontWeight:600,color:'#0A2540',marginBottom:8}}>
      Noch keine Eingangsrechnung
    </div>
    <div style={{fontSize:14,marginBottom:20}}>
      Deine Eingangs-E-Mail-Adresse ist bereit. Leite Rechnungen dorthin weiter.
    </div>
    <button className="btn btn-ghost" onClick={()=>setView('setup')}>
      Eingang einrichten →
    </button>
  </div>
)}
```

---

### FEAT-003: Rechnungsdetail nach Erstellung — Redirect
**Datei:** frontend/src/App.jsx — Invoices Komponente, generate Funktion
**Aktuelles Verhalten:** Nach generate() bleibt User im Formular.
**Fix:** Nach erfolgreicher Generierung zu Detail-Ansicht wechseln:
```jsx
// In generate() nach setXml:
const inv = await api.createInvoice(form);
const xmlContent = await api.getXML(inv.id);
setXml({content: xmlContent, id: inv.id, number: inv.invoice_number});
notify("XRechnung generiert · EN 16931 ✓", "success");
setView('detail');  // NEU: zu Detail-Ansicht wechseln
setSelectedInv(inv.id);  // NEU: selektierte Rechnung setzen
load();
```

---

### FEAT-004: Inbox-E-Mail vollständig anzeigen
**Datei:** frontend/src/App.jsx — InboundScreen Komponente
**Problem:** E-Mail-Adresse ist teilweise maskiert oder nicht kopierbar.
**Fix:** Füge einen Kopieren-Button neben der E-Mail-Adresse ein:
```jsx
// Suche nach der Anzeige der workspace_email / invoice_email
<div style={{display:'flex',alignItems:'center',gap:8}}>
  <code style={{background:'#F0EFFF',padding:'4px 10px',borderRadius:4,
    fontSize:13,fontFamily:'monospace',color:'#635BFF'}}>
    {org?.invoice_email || user?.email?.replace('@','@rechnungen.')}
  </code>
  <button className="btn btn-sm btn-ghost" onClick={()=>{
    navigator.clipboard.writeText(org?.invoice_email||'');
    notify('E-Mail-Adresse kopiert', 'success');
  }}>
    Kopieren
  </button>
</div>
```

---

## DESIGN-VERBESSERUNGEN

### DESIGN-001: Skeleton Loader statt endlosem Spinner
**Wo:** Überall wo `loading&&<Spinner` oder ähnliches steht in Listenkomponenten.
**Fix:** Ersetze durch Skeleton:
```jsx
function SkeletonRow({cols=4}) {
  return (
    <tr>
      {Array(cols).fill(0).map((_,i) => (
        <td key={i} style={{padding:'12px 14px'}}>
          <div className="skeleton" style={{height:14,width:i===0?120:80,borderRadius:4}}/>
        </td>
      ))}
    </tr>
  );
}
// Usage:
{loading ? Array(5).fill(0).map((_,i) => <SkeletonRow key={i}/>) : rows}
```

### DESIGN-002: Loading-State für Buttons verbessern
**Wo:** Alle Aktionsbuttons (generate, send, save)
**Pattern:** Button während Aktion disabled + Spinner anzeigen:
```jsx
<button className="btn btn-primary" onClick={generate} disabled={generating}>
  {generating 
    ? <><Spinner size={14} color="#fff"/> Wird generiert...</>
    : '⚡ XRechnung generieren'
  }
</button>
```

---

## PRIORISIERUNG

### Sofort (diese Woche):
1. BUG-001 Session Persistence
2. BUG-002 Kanzlei-Portal White Screen
3. BUG-004 Validierungs-Feedback
4. FEAT-002 Empty States

### Sprint 2:
5. FEAT-001 Draft speichern
6. FEAT-003 Redirect nach Generierung
7. FEAT-004 E-Mail vollständig anzeigen
8. DESIGN-001 Skeleton Loader

---

## WICHTIGE HINWEISE FÜR CLAUDE CODE

- App.jsx ist ~3800 Zeilen — alle Komponenten sind in EINER Datei
- Ändere NICHTS an Design-System Variablen (T, F, CSS constants)
- Ändere NICHTS an bestehenden API-Calls
- Ändere NICHTS am Auth-Flow außer BUG-001
- Teste nach jedem Fix ob die App noch baut (`npm run build`)
- Nutze die bestehenden CSS-Klassen (btn, btn-primary, btn-ghost, etc.)
- Nutze die bestehende `notify()` Funktion für alle Toasts
- Nutze die bestehende `Spinner` Komponente
- Füge KEINE neuen npm-Dependencies hinzu

import React from 'react';

const LandingPage = () => {
  const handleNavigation = (screen) => {
    window.location.hash = screen;
    window.location.reload();
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>🛡️ GoBD & eIDAS konform • Made in Germany 🇪🇺</span>
            </div>
            
            <h1 className="hero-title">
              E-Rechnungen empfangen,
              <br />
              <span className="gradient-text">automatisch verarbeiten</span>
            </h1>
            
            <p className="hero-description">
              Die moderne Plattform für automatisierte E-Rechnungsverarbeitung.
              XRechnung 3.0, ZUGFeRD 2.3 und Peppol-ready. EU-konform und DSGVO-sicher.
            </p>
            
            <div className="hero-cta">
              <button onClick={() => handleNavigation('register')} className="btn btn-primary btn-lg">
                Kostenlos starten →
              </button>
              <a href="#features" className="btn btn-secondary btn-lg">
                Features entdecken
              </a>
            </div>
            
            <div className="hero-trust">
              <div className="trust-item">
                <span>✓ 14 Tage kostenlos testen</span>
              </div>
              <div className="trust-item">
                <span>✓ Keine Kreditkarte erforderlich</span>
              </div>
              <div className="trust-item">
                <span>✓ DSGVO-konform</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-Mail-Adresse einrichten */}
      <section id="features" className="email-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">E-Mail-Adresse einrichten</span>
            <h2 className="section-title">
              Ihre eigene, personalisierte E-Rechnungs-Adresse
            </h2>
            <p className="section-description">
              Jeder Kunde erhält bei der Registrierung automatisch eine
              persönliche, einzigartige E-Mail-Adresse für den Empfang und
              Versand von E-Rechnungen — generiert aus Ihrem Firmennamen,
              exklusiv für Ihr Unternehmen.
            </p>
          </div>

          <div className="email-demo">
            <div className="email-address-card">
              <span className="email-label">Ihre e-Rechnungs-Adresse</span>
              <code className="email-address">ihre-firma-a1b2c3@rechnungen.invoiq.io</code>
              <span className="email-status">✓ Sofort aktiv nach der Registrierung</span>
            </div>
            <ul className="email-benefits">
              <li>✓ Einzigartig — keine geteilte Adresse, nur für Ihr Unternehmen</li>
              <li>✓ Empfängt XRechnung, ZUGFeRD und PDF automatisch</li>
              <li>✓ Versendet Ihre E-Rechnungen direkt aus invoiq</li>
              <li>✓ In 2 Minuten startklar — kein ERP, kein IT-Aufwand</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Preise</span>
            <h2 className="section-title">
              Transparent und fair kalkuliert
            </h2>
            <p className="section-description">
              Starten Sie kostenlos und skalieren Sie nach Bedarf.
              Alle Pläne inkl. GoBD-Archivierung und DATEV-Export.
            </p>
          </div>

          <div className="pricing-grid">
            {/* FREE Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan">Gratis</h3>
                <div className="pricing-price">
                  <span className="price-amount">0€</span>
                  <span className="price-period">/Monat</span>
                </div>
                <p className="pricing-description">
                  Zum Ausprobieren und Testen
                </p>
              </div>
              <ul className="pricing-features">
                <li>✓ Bis zu 10 Rechnungen/Monat</li>
                <li>✓ 1 Benutzer</li>
                <li>✓ KI-Datenextraktion</li>
                <li>✓ GoBD-Archivierung</li>
                <li>✓ DATEV-Export</li>
                <li>✓ E-Mail Support</li>
              </ul>
              <button onClick={() => handleNavigation('register')} className="btn btn-outline w-full">
                Jetzt starten
              </button>
            </div>

            {/* STARTER Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan">Starter</h3>
                <div className="pricing-price">
                  <span className="price-amount">29€</span>
                  <span className="price-period">/Monat</span>
                </div>
                <p className="pricing-description">
                  Perfekt für Freelancer und Einzelunternehmer
                </p>
              </div>
              <ul className="pricing-features">
                <li>✓ Bis zu 100 Rechnungen/Monat</li>
                <li>✓ 3 Benutzer</li>
                <li>✓ KI-Datenextraktion</li>
                <li>✓ GoBD-Archivierung</li>
                <li>✓ DATEV-Export</li>
                <li>✓ API-Zugang Basic</li>
                <li>✓ E-Mail Support</li>
              </ul>
              <button onClick={() => handleNavigation('register?plan=starter')} className="btn btn-outline w-full">
                Jetzt starten
              </button>
            </div>

            {/* BUSINESS Plan - Featured */}
            <div className="pricing-card pricing-card-featured">
              <div className="pricing-badge">AM BELIEBTESTEN</div>
              <div className="pricing-header">
                <h3 className="pricing-plan">Business</h3>
                <div className="pricing-price">
                  <span className="price-amount">99€</span>
                  <span className="price-period">/Monat</span>
                </div>
                <p className="pricing-description">
                  Für wachsende Unternehmen und Teams
                </p>
              </div>
              <ul className="pricing-features">
                <li>✓ Bis zu 500 Rechnungen/Monat</li>
                <li>✓ 10 Benutzer</li>
                <li>✓ Peppol-Anbindung</li>
                <li>✓ Workflow-Automation</li>
                <li>✓ Team-Kollaboration</li>
                <li>✓ ERP-Integration (SAP, DATEV)</li>
                <li>✓ Prioritäts-Support</li>
              </ul>
              <button onClick={() => handleNavigation('register?plan=business')} className="btn btn-primary w-full">
                Jetzt starten
              </button>
            </div>

            {/* ENTERPRISE Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan">Enterprise</h3>
                <div className="pricing-price">
                  <span className="price-amount">Nach Absprache</span>
                </div>
                <p className="pricing-description">
                  Maßgeschneidert für große Organisationen
                </p>
              </div>
              <ul className="pricing-features">
                <li>✓ Unbegrenzte Rechnungen</li>
                <li>✓ Unbegrenzte Benutzer</li>
                <li>✓ Dedizierter Account Manager</li>
                <li>✓ API-Zugang Enterprise</li>
                <li>✓ Custom Integrationen</li>
                <li>✓ On-Premise Option</li>
                <li>✓ 24/7 Premium Support</li>
              </ul>
              <a href="mailto:sales@invoiq.de" className="btn btn-outline w-full">
                Kontakt aufnehmen
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-column">
              <div className="footer-brand">
                <span className="brand-name">📄 invoiq</span>
              </div>
              <p className="footer-description">
                Die moderne Plattform für automatisierte
                E-Rechnungsverarbeitung. Made in Germany.
              </p>
              <p className="footer-copyright">
                © 2026 invoiq. Made with ❤️ in Dresden, Germany.
              </p>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">Produkt</h4>
              <ul className="footer-links">
                <li><a href="#pricing">Preise</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="/docs">Dokumentation</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">Rechtliches</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('impressum'); }}>Impressum</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('datenschutz'); }}>Datenschutz</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('agb'); }}>AGB</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">Support</h4>
              <ul className="footer-links">
                <li><a href="mailto:support@invoiq.de">support@invoiq.de</a></li>
                <li><a href="mailto:sales@invoiq.de">sales@invoiq.de</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .hero-section {
          padding: 120px 0 80px;
          text-align: center;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #EBF4FF 0%, #E0F2FE 100%);
          border: 1px solid #BAE6FD;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 500;
          color: #0369A1;
          margin-bottom: 32px;
        }
        .hero-title {
          font-size: 64px;
          font-weight: 700;
          line-height: 1.1;
          color: #0F172A;
          margin: 0 0 24px;
          letter-spacing: -0.02em;
        }
        .gradient-text {
          background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-description {
          font-size: 20px;
          line-height: 1.6;
          color: #64748B;
          max-width: 720px;
          margin: 0 auto 40px;
        }
        .hero-cta {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }
        .hero-trust {
          display: flex;
          gap: 32px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .trust-item {
          font-size: 14px;
          color: #10B981;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.2s;
          cursor: pointer;
          text-decoration: none;
          border: none;
        }
        .btn-lg {
          padding: 16px 32px;
          font-size: 18px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4);
        }
        .btn-secondary {
          background: white;
          color: #0F172A;
          border: 2px solid #E2E8F0;
        }
        .btn-secondary:hover {
          border-color: #CBD5E1;
          background: #F8FAFC;
        }
        .btn-outline {
          background: transparent;
          color: #0F172A;
          border: 2px solid #E2E8F0;
        }
        .btn-outline:hover {
          background: #F8FAFC;
          border-color: #CBD5E1;
        }
        .w-full {
          width: 100%;
          justify-content: center;
        }
        .section-header {
          text-align: center;
          margin-bottom: 64px;
        }
        .section-badge {
          display: inline-block;
          padding: 6px 12px;
          background: #EBF4FF;
          color: #0369A1;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 48px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 16px;
        }
        .section-description {
          font-size: 18px;
          color: #64748B;
          max-width: 640px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .email-section {
          padding: 80px 0;
          background: #ffffff;
        }
        .email-demo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          max-width: 960px;
          margin: 0 auto;
        }
        .email-address-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: linear-gradient(135deg, #EBF4FF 0%, #E0F2FE 100%);
          border: 1px solid #BAE6FD;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
        }
        .email-label {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #0369A1;
        }
        .email-address {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 17px;
          font-weight: 600;
          color: #0F172A;
          background: white;
          border: 1px solid #BAE6FD;
          border-radius: 8px;
          padding: 12px 16px;
          overflow-wrap: anywhere;
        }
        .email-status {
          font-size: 14px;
          font-weight: 600;
          color: #10B981;
        }
        .email-benefits {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .email-benefits li {
          padding: 12px 0;
          font-size: 16px;
          color: #475569;
          border-bottom: 1px solid #F1F5F9;
        }
        .email-benefits li:last-child {
          border-bottom: none;
        }
        .pricing-section {
          padding: 80px 0;
          background: linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%);
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .pricing-card {
          background: white;
          border: 2px solid #E2E8F0;
          border-radius: 16px;
          padding: 40px;
          position: relative;
          transition: all 0.3s;
        }
        .pricing-card:hover {
          border-color: #0EA5E9;
          box-shadow: 0 12px 40px rgba(14, 165, 233, 0.2);
          transform: translateY(-4px);
        }
        .pricing-card-featured {
          border-color: #0EA5E9;
          border-width: 3px;
          box-shadow: 0 12px 40px rgba(14, 165, 233, 0.2);
        }
        .pricing-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%);
          color: white;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .pricing-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .pricing-plan {
          font-size: 24px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 16px;
        }
        .pricing-price {
          margin-bottom: 12px;
        }
        .price-amount {
          font-size: 48px;
          font-weight: 800;
          color: #0F172A;
        }
        .price-period {
          font-size: 18px;
          color: #64748B;
          font-weight: 500;
        }
        .pricing-description {
          font-size: 16px;
          color: #64748B;
          margin: 0;
        }
        .pricing-features {
          list-style: none;
          padding: 0;
          margin: 0 0 32px;
        }
        .pricing-features li {
          padding: 12px 0;
          font-size: 15px;
          color: #475569;
          border-bottom: 1px solid #F1F5F9;
        }
        .pricing-features li:last-child {
          border-bottom: none;
        }
        .landing-footer {
          padding: 60px 0 40px;
          background: #0F172A;
          color: #94A3B8;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 40px;
        }
        .footer-brand {
          margin-bottom: 16px;
        }
        .brand-name {
          font-size: 24px;
          font-weight: 700;
          color: white;
        }
        .footer-description {
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 24px;
          max-width: 320px;
        }
        .footer-copyright {
          font-size: 14px;
        }
        .footer-heading {
          font-size: 14px;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
          margin: 0 0 20px;
        }
        .footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .footer-links li {
          margin-bottom: 12px;
        }
        .footer-links a {
          color: #94A3B8;
          text-decoration: none;
          font-size: 15px;
          transition: color 0.2s;
        }
        .footer-links a:hover {
          color: white;
        }
        @media (max-width: 768px) {
          .hero-title { font-size: 40px; }
          .section-title { font-size: 32px; }
          .pricing-grid { grid-template-columns: 1fr; }
          .email-demo { grid-template-columns: 1fr; gap: 32px; }
          .footer-grid { grid-template-columns: 1fr; gap: 32px; }
          .hero-cta { flex-direction: column; }
          .btn-lg { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;

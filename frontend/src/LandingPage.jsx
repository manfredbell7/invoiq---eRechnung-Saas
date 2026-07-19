import React from 'react';

import { 
  FileText, 
  Shield, 
  Zap, 
  Mail, 
  Download, 
  CheckCircle, 
  ArrowRight,
  Lock,
  Database,
  Clock,
  Users,
  Globe,
  FileCheck
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <Shield className="icon-xs" />
              <span>GoBD & eIDAS konform • Made in Germany 🇪🇺</span>
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
              <Link to="/register" className="btn btn-primary btn-lg">
                Kostenlos starten
                <ArrowRight className="icon-sm" />
              </Link>
              <a href="#features" className="btn btn-secondary btn-lg">
                Features entdecken
              </a>
            </div>
            
            <div className="hero-trust">
              <div className="trust-item">
                <CheckCircle className="icon-xs text-success" />
                <span>14 Tage kostenlos testen</span>
              </div>
              <div className="trust-item">
                <CheckCircle className="icon-xs text-success" />
                <span>Keine Kreditkarte erforderlich</span>
              </div>
              <div className="trust-item">
                <CheckCircle className="icon-xs text-success" />
                <span>DSGVO-konform</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Features</span>
            <h2 className="section-title">
              Alles für Ihre E-Rechnungsverarbeitung
            </h2>
            <p className="section-description">
              Automatisieren Sie Ihren gesamten Rechnungseingang – von der E-Mail
              bis zur DATEV-Integration.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Mail className="icon-md" />
              </div>
              <h3 className="feature-title">E-Mail Postfach</h3>
              <p className="feature-description">
                Dedizierte E-Mail-Adresse für Rechnungseingang.
                Automatische Erkennung und Verarbeitung aller Formate.
              </p>
              <ul className="feature-list">
                <li>XRechnung 3.0</li>
                <li>ZUGFeRD 2.3</li>
                <li>Factur-X</li>
                <li>PDF mit Texterkennung</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap className="icon-md" />
              </div>
              <h3 className="feature-title">KI-gestützte Datenextraktion</h3>
              <p className="feature-description">
                Intelligente OCR und maschinelles Lernen extrahieren
                alle relevanten Rechnungsdaten vollautomatisch.
              </p>
              <ul className="feature-list">
                <li>Rechnungsnummer & Datum</li>
                <li>Lieferant & Positionen</li>
                <li>Beträge & MwSt.</li>
                <li>Zahlungsinformationen</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Shield className="icon-md" />
              </div>
              <h3 className="feature-title">GoBD-Archivierung</h3>
              <p className="feature-description">
                Revisionssichere Langzeitarchivierung nach GoBD-Richtlinien
                mit eIDAS-qualifizierter Signatur.
              </p>
              <ul className="feature-list">
                <li>10 Jahre Aufbewahrung</li>
                <li>Unveränderbarkeit</li>
                <li>Vollständige Dokumentation</li>
                <li>Prüfungssicher</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <FileCheck className="icon-md" />
              </div>
              <h3 className="feature-title">DATEV-Export</h3>
              <p className="feature-description">
                Nahtlose Integration in Ihre Buchhaltung.
                Export im DATEV-Format mit allen Kontierungsinformationen.
              </p>
              <ul className="feature-list">
                <li>DATEV ASCII</li>
                <li>Automatische Kontierung</li>
                <li>SKR03 & SKR04</li>
                <li>Buchungsvorschläge</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Globe className="icon-md" />
              </div>
              <h3 className="feature-title">Peppol-Anbindung</h3>
              <p className="feature-description">
                Empfangen Sie Rechnungen direkt über das europäische
                Peppol-Netzwerk – sicher und standardisiert.
              </p>
              <ul className="feature-list">
                <li>Peppol Access Point</li>
                <li>EU-weiter Versand</li>
                <li>Automatischer Empfang</li>
                <li>Standardkonform</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Clock className="icon-md" />
              </div>
              <h3 className="feature-title">Workflow-Automation</h3>
              <p className="feature-description">
                Definieren Sie individuelle Freigabe-Workflows und
                Eskalationsprozesse für Ihre Organisation.
              </p>
              <ul className="feature-list">
                <li>Mehrstufige Freigaben</li>
                <li>Benachrichtigungen</li>
                <li>Eskalationsregeln</li>
                <li>Audit-Trail</li>
              </ul>
            </div>
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
            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan">Starter</h3>
                <div className="pricing-price">
                  <span className="price-amount">19€</span>
                  <span className="price-period">/Monat</span>
                </div>
                <p className="pricing-description">
                  Perfekt für Freelancer und Einzelunternehmer
                </p>
              </div>
              <ul className="pricing-features">
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Bis zu 50 Rechnungen/Monat</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>1 Postfach</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>KI-Datenextraktion</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>GoBD-Archivierung</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>DATEV-Export</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>E-Mail Support</span>
                </li>
              </ul>
              <Link to="/register?plan=starter" className="btn btn-outline w-full">
                Jetzt starten
              </Link>
            </div>

            <div className="pricing-card pricing-card-featured">
              <div className="pricing-badge">Beliebt</div>
              <div className="pricing-header">
                <h3 className="pricing-plan">Business</h3>
                <div className="pricing-price">
                  <span className="price-amount">79€</span>
                  <span className="price-period">/Monat</span>
                </div>
                <p className="pricing-description">
                  Für wachsende Unternehmen und Teams
                </p>
              </div>
              <ul className="pricing-features">
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Bis zu 500 Rechnungen/Monat</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>5 Postfächer</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Peppol-Anbindung</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Workflow-Automation</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Team-Kollaboration</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Prioritäts-Support</span>
                </li>
              </ul>
              <Link to="/register?plan=business" className="btn btn-primary w-full">
                Jetzt starten
              </Link>
            </div>

            <div className="pricing-card">
              <div className="pricing-header">
                <h3 className="pricing-plan">Enterprise</h3>
                <div className="pricing-price">
                  <span className="price-amount">Individuell</span>
                </div>
                <p className="pricing-description">
                  Maßgeschneidert für große Organisationen
                </p>
              </div>
              <ul className="pricing-features">
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Unbegrenzte Rechnungen</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Unbegrenzte Postfächer</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Dedizierter Account Manager</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>API-Zugang</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>Custom Integrationen</span>
                </li>
                <li>
                  <CheckCircle className="icon-xs" />
                  <span>24/7 Premium Support</span>
                </li>
              </ul>
              <a href="mailto:sales@invoiq.de" className="btn btn-outline w-full">
                Kontakt aufnehmen
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance Section */}
      <section className="security-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Sicherheit & Compliance</span>
            <h2 className="section-title">
              Höchste Sicherheitsstandards
            </h2>
            <p className="section-description">
              Ihre Daten sind bei uns sicher. Gehostet in Deutschland,
              DSGVO-konform und mit modernster Verschlüsselung.
            </p>
          </div>

          <div className="security-grid">
            <div className="security-card">
              <Lock className="icon-lg" />
              <h3>End-to-End Verschlüsselung</h3>
              <p>
                Alle Daten werden während der Übertragung und im Ruhezustand
                mit AES-256 verschlüsselt.
              </p>
            </div>

            <div className="security-card">
              <Database className="icon-lg" />
              <h3>ISO 27001 zertifiziert</h3>
              <p>
                Unsere Rechenzentren in Deutschland erfüllen höchste
                Sicherheitsstandards und sind ISO 27001 zertifiziert.
              </p>
            </div>

            <div className="security-card">
              <Shield className="icon-lg" />
              <h3>DSGVO-konform</h3>
              <p>
                Vollständige Einhaltung der EU-Datenschutz-Grundverordnung.
                Ihre Daten verlassen niemals die EU.
              </p>
            </div>

            <div className="security-card">
              <FileCheck className="icon-lg" />
              <h3>GoBD & eIDAS</h3>
              <p>
                Revisionssichere Archivierung nach GoBD mit eIDAS-qualifizierter
                elektronischer Signatur.
              </p>
            </div>
          </div>

          <div className="compliance-badges">
            <div className="badge-item">
              <div className="badge-icon">🇪🇺</div>
              <div className="badge-text">
                <strong>Made in EU</strong>
                <span>Entwickelt und gehostet in Deutschland</span>
              </div>
            </div>
            <div className="badge-item">
              <div className="badge-icon">🔒</div>
              <div className="badge-text">
                <strong>DSGVO</strong>
                <span>100% DSGVO-konform</span>
              </div>
            </div>
            <div className="badge-item">
              <div className="badge-icon">📋</div>
              <div className="badge-text">
                <strong>GoBD</strong>
                <span>Finanzamt-anerkannt</span>
              </div>
            </div>
            <div className="badge-item">
              <div className="badge-icon">✓</div>
              <div className="badge-text">
                <strong>eIDAS</strong>
                <span>Qualifizierte Signatur</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">
              Bereit für automatisierte E-Rechnungsverarbeitung?
            </h2>
            <p className="cta-description">
              Starten Sie noch heute und verarbeiten Sie Ihre erste Rechnung
              in weniger als 5 Minuten. Kostenlos und ohne Kreditkarte.
            </p>
            <div className="cta-actions">
              <Link to="/register" className="btn btn-primary btn-lg">
                Kostenlos starten
                <ArrowRight className="icon-sm" />
              </Link>
              <a href="mailto:sales@invoiq.de" className="btn btn-secondary btn-lg">
                Demo vereinbaren
              </a>
            </div>
            <p className="cta-note">
              14 Tage kostenlos testen • Keine Kreditkarte erforderlich • Jederzeit kündbar
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-column">
              <div className="footer-brand">
                <FileText className="brand-icon" />
                <span className="brand-name">invoiq</span>
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
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Preise</a></li>
                <li><a href="/docs">Dokumentation</a></li>
                <li><a href="/status">Status</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">Rechtliches</h4>
              <ul className="footer-links">
                <li><Link to="/impressum">Impressum</Link></li>
                <li><Link to="/datenschutz">Datenschutz</Link></li>
                <li><Link to="/agb">AGB</Link></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">Support</h4>
              <ul className="footer-links">
                <li><a href="mailto:support@invoiq.de">support@invoiq.de</a></li>
                <li><a href="mailto:sales@invoiq.de">sales@invoiq.de</a></li>
                <li><a href="/help">Hilfe-Center</a></li>
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

        /* Container */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Hero Section */
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
        }

        .hero-trust {
          display: flex;
          gap: 32px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #64748B;
        }

        .text-success {
          color: #10B981;
        }

        /* Buttons */
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

        /* Icons */
        .icon-xs {
          width: 16px;
          height: 16px;
        }

        .icon-sm {
          width: 20px;
          height: 20px;
        }

        .icon-md {
          width: 24px;
          height: 24px;
        }

        .icon-lg {
          width: 48px;
          height: 48px;
        }

        /* Section Headers */
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
          letter-spacing: -0.02em;
        }

        .section-description {
          font-size: 18px;
          color: #64748B;
          max-width: 640px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Features Section */
        .features-section {
          padding: 80px 0;
          background: white;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 32px;
        }

        .feature-card {
          padding: 32px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          transition: all 0.3s;
        }

        .feature-card:hover {
          border-color: #0EA5E9;
          box-shadow: 0 12px 32px rgba(14, 165, 233, 0.15);
          transform: translateY(-4px);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #EBF4FF 0%, #E0F2FE 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: #0369A1;
        }

        .feature-title {
          font-size: 20px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 12px;
        }

        .feature-description {
          font-size: 16px;
          color: #64748B;
          line-height: 1.6;
          margin: 0 0 20px;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-list li {
          font-size: 14px;
          color: #475569;
          padding: 8px 0;
          border-bottom: 1px solid #F1F5F9;
        }

        .feature-list li:last-child {
          border-bottom: none;
        }

        /* Pricing Section */
        .pricing-section {
          padding: 80px 0;
          background: linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%);
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
          max-width: 1100px;
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
          letter-spacing: 0.05em;
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
          letter-spacing: -0.02em;
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
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          font-size: 15px;
          color: #475569;
        }

        .pricing-features .icon-xs {
          color: #10B981;
          flex-shrink: 0;
        }

        /* Security Section */
        .security-section {
          padding: 80px 0;
          background: white;
        }

        .security-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 40px;
          margin-bottom: 64px;
        }

        .security-card {
          text-align: center;
        }

        .security-card .icon-lg {
          color: #0EA5E9;
          margin-bottom: 20px;
        }

        .security-card h3 {
          font-size: 20px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 12px;
        }

        .security-card p {
          font-size: 15px;
          color: #64748B;
          line-height: 1.6;
          margin: 0;
        }

        .compliance-badges {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          padding: 40px;
          background: #F8FAFC;
          border-radius: 12px;
        }

        .badge-item {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .badge-icon {
          font-size: 40px;
        }

        .badge-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .badge-text strong {
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
        }

        .badge-text span {
          font-size: 14px;
          color: #64748B;
        }

        /* CTA Section */
        .cta-section {
          padding: 100px 0;
          background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%);
          text-align: center;
        }

        .cta-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .cta-title {
          font-size: 48px;
          font-weight: 700;
          color: white;
          margin: 0 0 20px;
          letter-spacing: -0.02em;
        }

        .cta-description {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 40px;
          line-height: 1.6;
        }

        .cta-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .cta-actions .btn-primary {
          background: white;
          color: #0EA5E9;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .cta-actions .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .cta-actions .btn-secondary {
          background: transparent;
          color: white;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .cta-actions .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .cta-note {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
        }

        /* Footer */
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
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .brand-icon {
          width: 32px;
          height: 32px;
          color: #0EA5E9;
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
          margin: 0;
        }

        .footer-heading {
          font-size: 14px;
          font-weight: 700;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.05em;
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

        /* Responsive */
        @media (max-width: 768px) {
          .hero-title {
            font-size: 40px;
          }

          .section-title {
            font-size: 32px;
          }

          .cta-title {
            font-size: 32px;
          }

          .features-grid,
          .pricing-grid,
          .security-grid {
            grid-template-columns: 1fr;
          }

          .footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .hero-cta,
          .cta-actions {
            flex-direction: column;
          }

          .btn-lg {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;

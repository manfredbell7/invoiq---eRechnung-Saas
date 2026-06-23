import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('invoiq ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#F6F9FC', fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#0A2540', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Etwas ist schiefgelaufen
            </h2>
            <p style={{ color: '#697386', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
              Die App hat einen unerwarteten Fehler festgestellt. Bitte laden Sie die Seite neu.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              style={{
                background: '#635BFF', color: '#fff', border: 'none',
                borderRadius: 8, padding: '12px 24px', fontSize: 15,
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

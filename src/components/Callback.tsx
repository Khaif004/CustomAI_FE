// Callback page for OAuth redirect
// This component is intentionally minimal - it just exists as a landing page
// The main window polls this page's URL to extract the authorization code

export function Callback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      color: '#666'
    }}>
      <div>
        <p>Completing sign in...</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          You can close this window if it doesn't close automatically.
        </p>
      </div>
    </div>
  );
}

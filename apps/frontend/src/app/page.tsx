export default function HomePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>✅ CityBites Frontend is WORKING!</h1>
      <p>Next.js deployment successful</p>
      <p>Timestamp: {new Date().toISOString()}</p>
      <p>If you see this, the frontend is properly deployed!</p>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>🔧 Debug Info:</h3>
        <p>Environment: {process.env.NODE_ENV || 'unknown'}</p>
      </div>
    </div>
  );
}

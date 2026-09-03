async function test() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ododarlington@yahoo.com',
        password: 'Darlington2026@.'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;
    console.log("Logged in!");
    
    // 2. Get profile to get propertyId
    const profileRes = await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    const propertyId = profileData.data.authorization.properties[0].id;
    console.log("Property ID:", propertyId);
    
    // 3. Call night-audit status
    const statusRes = await fetch(`http://localhost:3000/api/v1/night-audit/status?propertyId=${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const statusData = await statusRes.json();
    if (statusRes.ok) {
      console.log("Status response keys:", Object.keys(statusData.data));
      console.log("Property name:", statusData.data.property.name);
    } else {
      console.error("Error:", statusRes.status, statusData);
    }
  } catch (err) {
    console.error(err);
  }
}
test();

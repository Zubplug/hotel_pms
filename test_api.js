async function test() {
  try {
    // 1. Login
    const loginRes = await fetch('https://lodgecore.vercel.app/api/manager/auth/login', {
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
    const profileRes = await fetch('https://lodgecore.vercel.app/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    const propertyId = profileData.data?.authorization?.properties?.[0]?.id;
    console.log("Property ID:", propertyId);
    
    if (!propertyId) {
       console.log("Profile data:", profileData);
       return;
    }

    // 3. Call night-audit status
    const statusRes = await fetch(`https://lodgecore.vercel.app/api/v1/night-audit/status?propertyId=${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const statusText = await statusRes.text();
    console.log("Status response:", statusRes.status, statusText.substring(0, 500));
  } catch (err) {
    console.error(err);
  }
}
test();

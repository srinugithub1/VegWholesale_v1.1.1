import { apiRequest } from "../client/src/lib/queryClient";
// mocking apiRequest won't work easily in node without polyfills.
// Instead, I'll use simple fetch.

async function testAuth() {
    const baseUrl = "http://localhost:5000";
    const username = `testuser_${Date.now()}`;
    const password = "password123";
    let cookie = "";

    console.log("1. Registering user...");
    const regRes = await fetch(`${baseUrl}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role: "user" }),
    });

    if (regRes.status !== 201) {
        console.error("Registration failed:", await regRes.text());
        return;
    }
    console.log("Registration success:", await regRes.json());

    // Capture cookie
    const setCookie = regRes.headers.get("set-cookie");
    if (setCookie) cookie = setCookie;

    console.log("2. Logging in...");
    const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    if (loginRes.status !== 200) {
        console.error("Login failed:", await loginRes.text());
        return;
    }
    console.log("Login success:", await loginRes.json());
    if (loginRes.headers.get("set-cookie")) cookie = loginRes.headers.get("set-cookie") || cookie;

    console.log("3. Getting current user...");
    const userRes = await fetch(`${baseUrl}/api/user`, {
        headers: { cookie }
    });
    if (userRes.status !== 200) {
        console.error("Get user failed:", userRes.status);
    } else {
        console.log("Get user success:", await userRes.json());
    }

    console.log("4. Logging out...");
    const logoutRes = await fetch(`${baseUrl}/api/logout`, {
        method: "POST",
        headers: { cookie }
    });
    if (logoutRes.status !== 200) {
        console.error("Logout failed");
    } else {
        console.log("Logout success");
    }

    console.log("5. Verifying logout (Get user should fail)...");
    const userRes2 = await fetch(`${baseUrl}/api/user`, {
        headers: { cookie } // Send old cookie?
    });
    if (userRes2.status === 401) {
        console.log("Verification success: User is logged out (401)");
    } else {
        console.error("Verification failed: User still logged in", userRes2.status);
    }
}

testAuth().catch(console.error);

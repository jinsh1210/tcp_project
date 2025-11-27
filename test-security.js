const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let cookie = '';

async function login(email, password) {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
        cookie = response.headers['set-cookie'][0];
        console.log(`Login successful for ${email}`);
        return true;
    } catch (error) {
        console.error(`Login failed for ${email}:`, error.response ? error.response.data : error.message);
        return false;
    }
}

async function testAuthBypass() {
    console.log('\n--- Testing Auth Bypass ---');
    if (!await login('buyer1@example.com', 'password123')) return;

    try {
        // Try to delete an item owned by another user (seller1, id 2)
        // We are logged in as buyer1 (id 1)
        // We will try to delete item 1 (owned by seller1)
        // In the fixed version, the server should ignore the userId in the body and use the session userId
        // Since buyer1 doesn't own item 1, it should fail with 403 or 404 (if not found for that user)
        
        const response = await axios.delete(`${BASE_URL}/api/items/1`, {
            headers: { Cookie: cookie },
            data: { userId: 2 } // Trying to impersonate seller1
        });
        
        console.log('Auth Bypass Test Failed: Request succeeded unexpectedly', response.data);
    } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
            console.log('Auth Bypass Test Passed: Request failed as expected with status', error.response.status);
        } else {
            console.error('Auth Bypass Test Error:', error.response ? error.response.data : error.message);
        }
    }
}

async function testXSS() {
    console.log('\n--- Testing XSS Prevention ---');
    // We can't easily test client-side XSS with a node script, but we can check if the server accepts the input
    // and if we were using a browser, the client-side code would escape it.
    // Here we will just verify that we can post content with special characters
    
    if (!await login('buyer1@example.com', 'password123')) return;

    try {
        const xssContent = '<script>alert("XSS")</script>';
        const response = await axios.post(`${BASE_URL}/api/community/posts`, {
            title: 'XSS Test',
            content: xssContent,
            isAnonymous: false
        }, {
            headers: { Cookie: cookie }
        });

        if (response.data.success) {
            console.log('XSS Content Posted Successfully (Server should accept it, Client should escape it)');
        }
    } catch (error) {
        console.error('XSS Test Error:', error.response ? error.response.data : error.message);
    }
}

async function runTests() {
    await testAuthBypass();
    await testXSS();
}

runTests();

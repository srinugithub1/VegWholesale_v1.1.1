
const fs = require('fs');
const content = `DATABASE_URL="postgresql://vegwholesale_user:MieuGdPlutnP1L3vQVnJ82Op4r0K6fdE@dpg-d540vfi4d50c738nkmb0-a.oregon-postgres.render.com/vegwholesale_prod?ssl=true"
SESSION_SECRET="super_secret_session_key_12345"`;

try {
    fs.writeFileSync('.env', content, { encoding: 'utf8' });
    console.log(".env file updated successfully.");
} catch (err) {
    console.error("Error writing .env file:", err);
    process.exit(1);
}

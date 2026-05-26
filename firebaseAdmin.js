const admin = require("firebase-admin");

// Parse the JSON from env
let serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);

// Fix newlines in private_key
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
module.exports = { admin, db };

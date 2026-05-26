// firebaseAdmin.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "bhms-storage",
});

// Export Firebase services
const messaging = admin.messaging();
const bucket = admin.storage().bucket();

module.exports = { messaging, bucket };
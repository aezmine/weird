// Firebase & Cloudinary Configuration
// Dynamically initialized from runtime environment endpoint (/api/config)
// Keeps all API keys, project IDs, and upload presets out of GitHub source code
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let firebaseConfig = {};
let cloudinaryConfig = {};

try {
  const res = await fetch("/api/config");
  if (res.ok) {
    const data = await res.json();
    firebaseConfig = data.firebase || {};
    cloudinaryConfig = data.cloudinary || {};
  }
} catch (err) {
  console.error("Could not fetch environment config from /api/config:", err);
}

// Initialize Firebase App & Firestore
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { firebaseConfig, cloudinaryConfig };

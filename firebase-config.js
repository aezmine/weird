// Firebase & Cloudinary Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration provided
export const firebaseConfig = {
  apiKey: "AIzaSyApsxiawCVgyo5f4osZvZ1-k4Ah2iigE8U",
  authDomain: "stupids-13d9b.firebaseapp.com",
  projectId: "stupids-13d9b",
  storageBucket: "stupids-13d9b.firebasestorage.app",
  messagingSenderId: "372326748542",
  appId: "1:372326748542:web:6868541737f3f5d5fa232f"
};

// Initialize Firebase App & Firestore
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Cloudinary Configuration
// Note: If you have your Cloud Name, replace "YOUR_CLOUD_NAME" below.
export const cloudinaryConfig = {
  cloudName: "xwb8t4vr", // Verified Cloudinary Cloud Name
  uploadPreset: "stuods"  // Active unsigned upload preset
};

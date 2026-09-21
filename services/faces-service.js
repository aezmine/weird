// Firestore CRUD Service for Faces
import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLECTION_NAME = "faces";

// Sample starter data from original wireframe
export const INITIAL_FACES = [
  {
    name: "Surprised Bob",
    expression: "Jaw-Drop",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    caption: "When you realize tomorrow is Monday.",
    backstory: "Bob thought it was Saturday morning until his 8:00 AM alarm went off with the company ringtone.",
    funnyScore: "9.2"
  },
  {
    name: "Sneaky Steve",
    expression: "Side-Eye Smirk",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80",
    caption: "Knowing who ate the last donut (it was him).",
    backstory: "Steve perfected this face over 10 years of eating snacks out of the office fridge without getting caught.",
    funnyScore: "8.7"
  },
  {
    name: "Confused Carla",
    expression: "System Reboot",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80",
    caption: "Trying to understand math at 2 AM.",
    backstory: "Carla read the sentence 'If you have 4 apples and eat 2' and stared into the void for 45 minutes.",
    funnyScore: "9.5"
  },
  {
    name: "Dramatic Dave",
    expression: "Over-the-Top Gasp",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80",
    caption: "Someone just opened a bag of chips across the room.",
    backstory: "Dave's hearing is specifically attuned to snack packaging sounds within a 5-mile radius.",
    funnyScore: "8.9"
  }
];

/**
 * Subscribes to real-time changes in the faces collection.
 * @param {Function} onUpdate - Called with array of face items whenever data changes
 * @param {Function} onError - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeToFaces(onUpdate, onError) {
  const facesRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    facesRef,
    (snapshot) => {
      const faces = [];
      snapshot.forEach((docSnap) => {
        faces.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // Sort client-side by createdAt descending (newest first)
      faces.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });

      onUpdate(faces);
    },
    (err) => {
      console.error("Firestore subscription error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Creates a new funny face document in Firestore.
 */
export async function createFace(faceData) {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...faceData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Updates an existing face document.
 */
export async function updateFace(id, faceData) {
  const faceDoc = doc(db, COLLECTION_NAME, id);
  await updateDoc(faceDoc, {
    ...faceData,
    updatedAt: serverTimestamp()
  });
}

/**
 * Deletes a face document by ID.
 */
export async function deleteFace(id) {
  const faceDoc = doc(db, COLLECTION_NAME, id);
  await deleteDoc(faceDoc);
}

/**
 * Seeds initial demo faces into Firestore if the collection is empty.
 */
export async function seedInitialFaces() {
  const batch = writeBatch(db);
  const facesRef = collection(db, COLLECTION_NAME);

  INITIAL_FACES.forEach((face) => {
    const newDoc = doc(facesRef);
    batch.set(newDoc, {
      ...face,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

/**
 * Creates multiple face documents in Firestore using writeBatch.
 * @param {Array<Object>} facesArray - Array of face objects
 * @returns {Promise<number>} Number of faces saved
 */
export async function bulkCreateFaces(facesArray) {
  if (!facesArray || facesArray.length === 0) return 0;

  const BATCH_SIZE = 400; // Under Firestore limit of 500
  const facesRef = collection(db, COLLECTION_NAME);

  for (let i = 0; i < facesArray.length; i += BATCH_SIZE) {
    const chunk = facesArray.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((face) => {
      const newDoc = doc(facesRef);
      batch.set(newDoc, {
        ...face,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }

  return facesArray.length;
}

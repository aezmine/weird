// Firestore Real-Time Live Chat, Comments & Likes Service
import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CHAT_COLLECTION = "chat_messages";
const COMMENTS_COLLECTION = "face_comments";
const FACES_COLLECTION = "faces";

// Storage keys for user state & likes
export const STORAGE_KEY_USER = "funny_faces_chat_user";
export const STORAGE_KEY_LIKED_FACES = "funny_faces_liked_faces";
export const STORAGE_KEY_LIKED_MSGS = "funny_faces_liked_msgs";
export const STORAGE_KEY_SOUND = "funny_faces_chat_sound_enabled";

// Predefined vector avatar keys
export const FUNNY_AVATARS = ["alien", "ghost", "bot", "skull", "zap", "flame", "laugh", "crown", "swords", "cat", "spark", "smile"];

const FUNNY_ADJECTIVES = ["Sneaky", "Quirky", "Witty", "Rogue", "Spicy", "Cosmic", "Chill", "Hyper", "Slick", "Wild"];
const FUNNY_NOUNS = ["Bob", "Nova", "Glitch", "Byte", "Pixel", "Fox", "Viper", "Echo", "Shadow", "Rider"];

/**
 * Get or initialize persistent user identity for chat & comments.
 */
export function getCurrentChatUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.name && parsed.avatar) {
        // If saved avatar was an old emoji, migrate it to a modern avatar key
        if (!FUNNY_AVATARS.includes(parsed.avatar)) {
          parsed.avatar = "alien";
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch {}

  const randomAdj = FUNNY_ADJECTIVES[Math.floor(Math.random() * FUNNY_ADJECTIVES.length)];
  const randomNoun = FUNNY_NOUNS[Math.floor(Math.random() * FUNNY_NOUNS.length)];
  const randomNum = Math.floor(100 + Math.random() * 900);
  const randomAvatar = FUNNY_AVATARS[Math.floor(Math.random() * FUNNY_AVATARS.length)];

  const newUser = {
    name: `${randomAdj}${randomNoun}${randomNum}`,
    avatar: randomAvatar
  };

  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  } catch {}

  return newUser;
}

/**
 * Save updated user identity.
 */
export function saveCurrentChatUser(name, avatar) {
  const user = {
    name: (name || "Anonymous").trim().slice(0, 25),
    avatar: avatar || "alien"
  };
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch {}
  return user;
}

/**
 * Check if the current user has liked a specific face.
 */
export function isFaceLiked(faceId) {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_LIKED_FACES) || "[]");
    return Array.isArray(list) && list.includes(faceId);
  } catch {
    return false;
  }
}

/**
 * Toggle like for a face: updates Firestore with atomic increment and tracks in localStorage.
 * @returns {Promise<boolean>} True if newly liked, false if unliked
 */
export async function toggleFaceLike(faceId) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEY_LIKED_FACES) || "[]");
  } catch {
    list = [];
  }

  const alreadyLiked = list.includes(faceId);
  const delta = alreadyLiked ? -1 : 1;

  if (alreadyLiked) {
    list = list.filter((id) => id !== faceId);
  } else {
    list.push(faceId);
  }

  try {
    localStorage.setItem(STORAGE_KEY_LIKED_FACES, JSON.stringify(list));
  } catch {}

  const faceDoc = doc(db, FACES_COLLECTION, faceId);
  await updateDoc(faceDoc, {
    likesCount: increment(delta)
  });

  return !alreadyLiked;
}

/**
 * Check if a chat message has been liked by the user.
 */
export function isMessageLiked(messageId) {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_LIKED_MSGS) || "[]");
    return Array.isArray(list) && list.includes(messageId);
  } catch {
    return false;
  }
}

/**
 * Toggle like on a chat message.
 */
export async function toggleMessageLike(messageId) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEY_LIKED_MSGS) || "[]");
  } catch {
    list = [];
  }

  const alreadyLiked = list.includes(messageId);
  const delta = alreadyLiked ? -1 : 1;

  if (alreadyLiked) {
    list = list.filter((id) => id !== messageId);
  } else {
    list.push(messageId);
  }

  try {
    localStorage.setItem(STORAGE_KEY_LIKED_MSGS, JSON.stringify(list));
  } catch {}

  const msgDoc = doc(db, CHAT_COLLECTION, messageId);
  await updateDoc(msgDoc, {
    likes: increment(delta)
  });

  return !alreadyLiked;
}

/**
 * Real-time subscription to Live Chat messages from Firestore.
 * Sorted client-side by createdAt ascending (oldest first for chat scroll).
 */
export function subscribeToLiveChat(onUpdate, onError) {
  const chatRef = collection(db, CHAT_COLLECTION);

  return onSnapshot(
    chatRef,
    (snapshot) => {
      const messages = [];
      snapshot.forEach((docSnap) => {
        messages.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // Sort client-side by createdAt ascending (chronological chat feed)
      messages.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeA - timeB;
      });

      // Cap at most recent 120 messages for top performance
      const trimmed = messages.slice(-120);
      onUpdate(trimmed);
    },
    (err) => {
      console.error("Live chat Firestore subscription error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Send a new live chat message to Firestore.
 */
export async function sendChatMessage({ text, faceId = null, faceName = null }) {
  const user = getCurrentChatUser();
  const trimmedText = (text || "").trim();
  if (!trimmedText) return null;

  const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
    text: trimmedText,
    sender: user.name,
    avatar: user.avatar,
    faceId: faceId || null,
    faceName: faceName || null,
    likes: 0,
    createdAt: serverTimestamp()
  });

  return docRef.id;
}

/**
 * Real-time subscription to comments for a specific face.
 */
export function subscribeToFaceComments(faceId, onUpdate, onError) {
  const commentsRef = collection(db, COMMENTS_COLLECTION);

  return onSnapshot(
    commentsRef,
    (snapshot) => {
      const comments = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.faceId === faceId) {
          comments.push({
            id: docSnap.id,
            ...data
          });
        }
      });

      // Sort newest comments first
      comments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });

      onUpdate(comments);
    },
    (err) => {
      console.error("Face comments Firestore error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Post a comment on a specific face.
 * Also broadcasts to live chat so visitors see lively activity!
 */
export async function addFaceComment(faceId, faceName, text) {
  const user = getCurrentChatUser();
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  // 1. Add to face_comments collection
  const commentRef = await addDoc(collection(db, COMMENTS_COLLECTION), {
    faceId,
    faceName: faceName || "Funny Face",
    text: trimmed,
    sender: user.name,
    avatar: user.avatar,
    createdAt: serverTimestamp()
  });

  // 2. Increment comment count on face doc
  try {
    const faceDoc = doc(db, FACES_COLLECTION, faceId);
    await updateDoc(faceDoc, {
      commentsCount: increment(1)
    });
  } catch (err) {
    console.warn("Could not increment face commentsCount:", err);
  }

  // 3. Post to Live Chat feed as a face-tagged comment
  try {
    await addDoc(collection(db, CHAT_COLLECTION), {
      text: trimmed,
      sender: user.name,
      avatar: user.avatar,
      faceId,
      faceName: faceName || "Funny Face",
      isFaceComment: true,
      likes: 0,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("Could not cross-post to live chat:", err);
  }

  return commentRef.id;
}

/**
 * Pleasant Web Audio ping for incoming chat messages (no external audio files required)
 */
let audioCtx = null;
export function playNotificationSound() {
  try {
    const enabled = localStorage.getItem(STORAGE_KEY_SOUND) !== "false";
    if (!enabled) return;

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
}

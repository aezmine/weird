// Main Application Logic - Modern Dark Edition
import { cloudinaryConfig } from "./firebase-config.js";
import { uploadToCloudinary, uploadMultipleToCloudinary, getOptimizedImageUrl, getFullImageUrl } from "./services/cloudinary.js";
import {
  subscribeToFaces,
  createFace,
  updateFace,
  deleteFace,
  bulkCreateFaces
} from "./services/faces-service.js";

// Admin Auth State & Config
const ADMIN_ACCESS_CODE = "minmin321";
const AUTH_STORAGE_KEY = "funny_faces_admin_auth";
let isAdmin = false;
try {
  isAdmin = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
} catch {}

// Global State
let allFaces = [];
let activeFaceForDetails = null;
let activeFaceForDelete = null;
let selectedImageFile = null;
let bulkSelectedFiles = [];

// DOM Elements
const facesContainer = document.getElementById("faces-container");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const facesCounter = document.getElementById("faces-counter");
const searchInput = document.getElementById("search-input");
const configNotice = document.getElementById("config-notice");
const themeBtn = document.getElementById("themebtn");
const toastDock = document.getElementById("toastdock");

// Action Buttons
const addFaceBtn = document.getElementById("add-face-btn");
const emptyAddBtn = document.getElementById("empty-add-btn");
const bulkUploadBtn = document.getElementById("bulk-upload-btn");
const emptyBulkBtn = document.getElementById("empty-bulk-btn");

// Admin Auth Elements
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminStatusPill = document.getElementById("admin-status-pill");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminLoginDialog = document.getElementById("admin-login-dialog");
const closeAdminDialogBtn = document.getElementById("close-admin-dialog-btn");
const cancelAdminDialogBtn = document.getElementById("cancel-admin-dialog-btn");
const adminLoginForm = document.getElementById("admin-login-form");
const adminCodeInput = document.getElementById("admin-code-input");
const adminLoginError = document.getElementById("admin-login-error");

// Bulk Upload Dialog Elements
const bulkUploadDialog = document.getElementById("bulk-upload-dialog");
const closeBulkDialogBtn = document.getElementById("close-bulk-dialog-btn");
const cancelBulkBtn = document.getElementById("cancel-bulk-btn");
const bulkFileInput = document.getElementById("bulk-file-input");
const bulkUploadDropzone = document.getElementById("bulk-upload-dropzone");
const bulkFilesSummary = document.getElementById("bulk-files-summary");
const bulkThumbnailsContainer = document.getElementById("bulk-thumbnails-container");
const bulkDefaultExpression = document.getElementById("bulk-default-expression");
const bulkDefaultCaption = document.getElementById("bulk-default-caption");
const bulkProgressArea = document.getElementById("bulk-progress-area");
const bulkProgressLabel = document.getElementById("bulk-progress-label");
const bulkProgressPercent = document.getElementById("bulk-progress-percent");
const bulkProgressBar = document.getElementById("bulk-progress-bar");
const bulkProgressFilename = document.getElementById("bulk-progress-filename");
const bulkErrorMsg = document.getElementById("bulk-error-msg");
const startBulkUploadBtn = document.getElementById("start-bulk-upload-btn");
const bulkSpinner = document.getElementById("bulk-spinner");
const bulkBtnText = document.getElementById("bulk-btn-text");

// Detail Dialog
const detailsDialog = document.getElementById("details-dialog");
const detailTitle = document.getElementById("detail-title");
const dialogBody = document.getElementById("dialog-body");
const closeDialogBtn = document.getElementById("close-dialog-btn");
const detailCloseBtn = document.getElementById("detail-close-btn");
const detailEditBtn = document.getElementById("detail-edit-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");

// Form Dialog
const faceFormDialog = document.getElementById("face-form-dialog");
const formDialogTitle = document.getElementById("form-dialog-title");
const closeFormBtn = document.getElementById("close-form-btn");
const cancelFormBtn = document.getElementById("cancel-form-btn");
const faceForm = document.getElementById("face-form");
const formFaceId = document.getElementById("form-face-id");
const formExistingImage = document.getElementById("form-existing-image");
const faceNameInput = document.getElementById("face-name");
const faceExpressionInput = document.getElementById("face-expression");
const faceScoreInput = document.getElementById("face-score");
const scoreDisplay = document.getElementById("score-display");
const faceCaptionInput = document.getElementById("face-caption");
const faceBackstoryInput = document.getElementById("face-backstory");
const imageUrlInput = document.getElementById("image-url-input");
const formErrorMsg = document.getElementById("form-error-msg");
const submitFormBtn = document.getElementById("submit-form-btn");
const submitSpinner = document.getElementById("submit-spinner");
const submitBtnText = document.getElementById("submit-btn-text");

// Upload Dropzone
const uploadDropzone = document.getElementById("upload-dropzone");
const imageFileInput = document.getElementById("image-file-input");
const dropzonePrompt = document.getElementById("dropzone-prompt");
const dropzonePreviewContainer = document.getElementById("dropzone-preview-container");
const imagePreview = document.getElementById("image-preview");
const imageFilename = document.getElementById("image-filename");
const changeImageBtn = document.getElementById("change-image-btn");

// Delete Dialog
const deleteConfirmDialog = document.getElementById("delete-confirm-dialog");
const deleteFaceName = document.getElementById("delete-face-name");
const closeDeleteDialogBtn = document.getElementById("close-delete-dialog-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const deleteSpinner = document.getElementById("delete-spinner");
const deleteBtnText = document.getElementById("delete-btn-text");

// Theme management
function initTheme() {
  const root = document.documentElement;
  
  function applyTheme(mode) {
    if (mode === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    const isDark = root.getAttribute("data-theme") !== "light";
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", String(isDark));
    }
  }

  try {
    const saved = localStorage.getItem("funny-faces-theme");
    applyTheme(saved || "dark");
  } catch {
    applyTheme("dark");
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        localStorage.setItem("funny-faces-theme", next);
      } catch {}
    });
  }
}

// Check configuration
function checkConfiguration() {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === "YOUR_CLOUD_NAME") {
    configNotice.querySelector(".notice-content").innerHTML = `
      <strong>Cloudinary Setup Needed:</strong> 
      Please set your Cloudinary <code>cloudName</code> inside <code>firebase-config.js</code>.
    `;
    configNotice.style.display = "block";
  } else if (!cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset === "YOUR_UPLOAD_PRESET") {
    configNotice.querySelector(".notice-content").innerHTML = `
      <strong>Cloudinary Upload Preset Needed:</strong> 
      Please set your unsigned <code>uploadPreset</code> in <code>firebase-config.js</code>.
    `;
    configNotice.style.display = "block";
  } else {
    configNotice.style.display = "none";
  }
}

// Restrained Toast Notification Helper
function showToast(message, type = "info") {
  const toastEl = document.createElement("div");
  toastEl.className = "toast";

  const iconSvg = type === "success"
    ? `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>`
    : type === "error"
    ? `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  const title = type === "success" ? "Success" : type === "error" ? "Error" : "Notice";

  toastEl.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <strong>${title}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  toastDock.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(6px)";
    toastEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toastEl.remove(), 200);
  }, 3500);
}

// Safe HTML escaping
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Render Face Cards with Clean Modern Aesthetic & Thumbnail Optimization
function renderCards(facesToRender) {
  facesContainer.innerHTML = "";

  if (facesToRender.length === 0) {
    if (allFaces.length === 0) {
      emptyState.style.display = "block";
    } else {
      facesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <p style="font-size: 14px; margin: 0;">No funny faces matched your search.</p>
        </div>
      `;
    }
    facesCounter.textContent = `${allFaces.length} face${allFaces.length === 1 ? "" : "s"}`;
    return;
  }

  emptyState.style.display = "none";
  const query = (searchInput.value || "").trim();
  if (query) {
    facesCounter.textContent = `${facesToRender.length} of ${allFaces.length} face${allFaces.length === 1 ? "" : "s"}`;
  } else {
    facesCounter.textContent = `${facesToRender.length} face${facesToRender.length === 1 ? "" : "s"}`;
  }

  facesToRender.forEach((face) => {
    const card = document.createElement("article");
    card.className = "face-card";

    // Deliver optimized thumbnail size for cards
    const thumbUrl = getOptimizedImageUrl(face.image, { width: 560, height: 420, fit: "fill" });

    const actionButtons = isAdmin
      ? `
        <button type="button" class="btn btn--secondary btn--sm btn-detail">Inspect</button>
        <button type="button" class="btn-icon btn-edit" title="Edit face" aria-label="Edit ${escapeHtml(face.name)}">✏️</button>
        <button type="button" class="btn-icon btn-delete" title="Delete face" aria-label="Delete ${escapeHtml(face.name)}">🗑️</button>
      `
      : `
        <button type="button" class="btn btn--secondary btn--sm btn-detail" style="width: 100%;">Inspect</button>
      `;

    card.innerHTML = `
      <div class="card-img-wrapper" title="Click to view details">
        <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(face.name)}" loading="lazy" width="280" height="210">
        <div class="card-badges">
          <span class="badge badge-category" title="${escapeHtml(face.expression || 'Funny')}">${escapeHtml(face.expression || 'Funny')}</span>
          <span class="badge badge-score" title="Rating">★ ${escapeHtml(face.funnyScore || '0')}</span>
        </div>
      </div>
      <div class="card-content">
        <h3 class="card-title" title="Click to view details">${escapeHtml(face.name)}</h3>
        <p class="card-caption">${escapeHtml(face.caption ? `"${face.caption}"` : "")}</p>
        <div class="card-actions">
          ${actionButtons}
        </div>
      </div>
    `;

    // Click on image or title or Inspect button -> Open Detail
    const openDetailTrigger = () => openDetails(face);
    card.querySelector(".card-img-wrapper").addEventListener("click", openDetailTrigger);
    card.querySelector(".card-title").addEventListener("click", openDetailTrigger);
    card.querySelector(".btn-detail").addEventListener("click", openDetailTrigger);

    // Edit button click (Admin only)
    const editBtn = card.querySelector(".btn-edit");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdmin) {
          showToast("Admin authentication required to edit faces.", "error");
          return;
        }
        openFormModal("edit", face);
      });
    }

    // Delete button click (Admin only)
    const deleteBtn = card.querySelector(".btn-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdmin) {
          showToast("Admin authentication required to delete faces.", "error");
          return;
        }
        promptDelete(face);
      });
    }

    facesContainer.appendChild(card);
  });
}

// Filter faces based on search
function filterFaces() {
  const query = (searchInput.value || "").toLowerCase().trim();
  if (!query) {
    renderCards(allFaces);
    return;
  }

  const filtered = allFaces.filter((face) => {
    const nameMatch = (face.name || "").toLowerCase().includes(query);
    const exprMatch = (face.expression || "").toLowerCase().includes(query);
    const capMatch = (face.caption || "").toLowerCase().includes(query);
    const storyMatch = (face.backstory || "").toLowerCase().includes(query);
    return nameMatch || exprMatch || capMatch || storyMatch;
  });

  renderCards(filtered);
}

// Format created date
function formatFaceDate(createdAt) {
  if (!createdAt) return "Recently added";
  try {
    const date = createdAt.toMillis ? new Date(createdAt.toMillis()) : new Date(createdAt);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  } catch {
    return "Recently added";
  }
  return "Recently added";
}

// Open Details Dialog
function openDetails(face) {
  activeFaceForDetails = face;
  detailTitle.textContent = face.name;

  // Use full uncropped image URL
  const fullImageUrl = getFullImageUrl(face.image);
  const dateString = formatFaceDate(face.createdAt);

  dialogBody.innerHTML = `
    <div class="inspect-container">
      <div class="inspect-img-stage" id="inspect-img-stage">
        <div class="inspect-loading" id="inspect-loading">
          <span class="spinner"></span>
          <span style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Loading full image...</span>
        </div>
        <img
          id="inspect-full-img"
          class="inspect-full-img"
          alt="${escapeHtml(face.name)}"
          style="display: none;"
        >
        <div class="inspect-img-error" id="inspect-error" style="display: none;">
          <span style="font-size: 22px;" aria-hidden="true">⚠️</span>
          <p style="margin: 4px 0 10px; font-size: 13px; color: var(--text-muted);">Unable to load image</p>
          <button type="button" class="btn btn--secondary btn--sm" id="inspect-retry-btn">Retry</button>
        </div>
      </div>
      <div class="inspect-meta">
        <div class="inspect-badges">
          <span class="badge badge-category">${escapeHtml(face.expression || "Funny")}</span>
          <span class="badge badge-score">★ ${escapeHtml(face.funnyScore || "0")} / 10</span>
        </div>
        ${face.caption ? `<div class="inspect-quote">"${escapeHtml(face.caption)}"</div>` : ""}
        ${face.backstory ? `
          <div class="inspect-backstory-box">
            <span class="inspect-section-title">Backstory</span>
            <div class="inspect-backstory">${escapeHtml(face.backstory)}</div>
          </div>
        ` : ""}
        <div class="inspect-date-row">
          <span>Added on ${escapeHtml(dateString)}</span>
        </div>
      </div>
    </div>
  `;

  const imgEl = dialogBody.querySelector("#inspect-full-img");
  const loadingEl = dialogBody.querySelector("#inspect-loading");
  const errorEl = dialogBody.querySelector("#inspect-error");
  const retryBtn = dialogBody.querySelector("#inspect-retry-btn");

  function loadImage(url) {
    loadingEl.style.display = "flex";
    errorEl.style.display = "none";
    imgEl.style.display = "none";

    imgEl.onload = () => {
      loadingEl.style.display = "none";
      errorEl.style.display = "none";
      imgEl.style.display = "block";
    };

    imgEl.onerror = () => {
      loadingEl.style.display = "none";
      errorEl.style.display = "flex";
      imgEl.style.display = "none";
    };

    imgEl.src = url;
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const retryUrl = fullImageUrl.includes("?")
        ? `${fullImageUrl}&_r=${Date.now()}`
        : `${fullImageUrl}?_r=${Date.now()}`;
      loadImage(retryUrl);
    });
  }

  loadImage(fullImageUrl);

  // Configure Inspect modal actions based on admin role
  if (detailEditBtn) detailEditBtn.style.display = isAdmin ? "inline-flex" : "none";
  if (detailDeleteBtn) detailDeleteBtn.style.display = isAdmin ? "inline-flex" : "none";

  detailsDialog.showModal();
}

function closeDetails() {
  detailsDialog.close();
  activeFaceForDetails = null;
}

// Open Form Dialog (Create or Edit)
function openFormModal(mode, face = null) {
  if (mode === "edit" && !isAdmin) {
    showToast("Admin authentication required to edit faces.", "error");
    return;
  }

  formErrorMsg.style.display = "none";
  formErrorMsg.textContent = "";
  faceForm.reset();
  selectedImageFile = null;
  if (imageFilename) imageFilename.textContent = "";

  if (mode === "edit" && face) {
    formDialogTitle.textContent = "Edit Funny Face";
    formFaceId.value = face.id;
    formExistingImage.value = face.image || "";
    faceNameInput.value = face.name || "";
    faceExpressionInput.value = face.expression || "";
    faceScoreInput.value = face.funnyScore || "9.0";
    scoreDisplay.textContent = `${face.funnyScore || "9.0"} / 10`;
    faceCaptionInput.value = face.caption || "";
    faceBackstoryInput.value = face.backstory || "";
    imageUrlInput.value = "";

    // Show existing image in preview
    if (face.image) {
      imagePreview.src = face.image;
      dropzonePrompt.style.display = "none";
      dropzonePreviewContainer.style.display = "flex";
      if (imageFilename) imageFilename.textContent = "Current image retained unless changed";
    }
    submitBtnText.textContent = "Update Face";
  } else {
    formDialogTitle.textContent = "Add Funny Face";
    formFaceId.value = "";
    formExistingImage.value = "";
    faceScoreInput.value = "9.0";
    scoreDisplay.textContent = "9.0 / 10";
    dropzonePrompt.style.display = "block";
    dropzonePreviewContainer.style.display = "none";
    imagePreview.src = "";
    if (imageFileInput) imageFileInput.value = "";
    imageUrlInput.value = "";
    submitBtnText.textContent = "Save Face";
  }

  faceFormDialog.showModal();
}

function closeFormModal() {
  faceFormDialog.close();
  faceForm.reset();
  if (imageFileInput) imageFileInput.value = "";
  selectedImageFile = null;
  if (imageFilename) imageFilename.textContent = "";
}

// Prompt Delete Modal
function promptDelete(face) {
  if (!isAdmin) {
    showToast("Admin authentication required to delete faces.", "error");
    return;
  }
  activeFaceForDelete = face;
  deleteFaceName.textContent = `"${face.name}"`;
  deleteConfirmDialog.showModal();
}

function closeDeleteModal() {
  deleteConfirmDialog.close();
  activeFaceForDelete = null;
}

// Setup Upload Dropzone
function setupUploadDropzone() {
  changeImageBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageFileInput.click();
  });

  imageFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove("dragover");
    });
  });

  uploadDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });
}

function handleFileSelected(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file (PNG, JPG, WEBP, GIF)", "error");
    return;
  }

  selectedImageFile = file;
  const objectUrl = URL.createObjectURL(file);
  imagePreview.src = objectUrl;
  
  if (imageFilename) {
    imageFilename.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }

  dropzonePrompt.style.display = "none";
  dropzonePreviewContainer.style.display = "flex";
  formErrorMsg.style.display = "none";
}

// Handle Form Submission (Create or Update)
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = formFaceId.value;
  const isEditing = Boolean(id);
  const name = faceNameInput.value.trim();
  const expression = faceExpressionInput.value.trim();
  const funnyScore = faceScoreInput.value;
  const caption = faceCaptionInput.value.trim();
  const backstory = faceBackstoryInput.value.trim();
  const directUrl = imageUrlInput.value.trim();
  const existingImage = formExistingImage.value;

  formErrorMsg.style.display = "none";
  let finalImageUrl = "";

  submitFormBtn.disabled = true;
  submitSpinner.style.display = "inline-block";

  try {
    if (selectedImageFile) {
      submitBtnText.textContent = "Uploading image...";
      finalImageUrl = await uploadToCloudinary(selectedImageFile);
    } else if (directUrl) {
      finalImageUrl = directUrl;
    } else if (isEditing && existingImage) {
      finalImageUrl = existingImage;
    } else {
      throw new Error("Please select an image file or provide an image link.");
    }

    submitBtnText.textContent = "Saving to database...";

    const facePayload = {
      name,
      expression,
      funnyScore,
      caption,
      backstory,
      image: finalImageUrl
    };

    if (isEditing) {
      await updateFace(id, facePayload);
      showToast(`Updated "${name}"`, "success");
    } else {
      await createFace(facePayload);
      showToast(`Added "${name}" to gallery`, "success");
    }

    closeFormModal();
  } catch (error) {
    console.error("Submission error:", error);
    formErrorMsg.textContent = error.message || "Failed to save face.";
    formErrorMsg.style.display = "block";
    showToast(error.message || "Save failed", "error");
  } finally {
    submitFormBtn.disabled = false;
    submitSpinner.style.display = "none";
    submitBtnText.textContent = isEditing ? "Update Face" : "Save Face";
  }
}

// Handle Delete Confirmation
async function handleDeleteConfirm() {
  if (!activeFaceForDelete) return;

  confirmDeleteBtn.disabled = true;
  deleteSpinner.style.display = "inline-block";
  deleteBtnText.textContent = "Deleting...";

  try {
    await deleteFace(activeFaceForDelete.id);
    showToast(`Deleted "${activeFaceForDelete.name}"`, "info");
    closeDeleteModal();
    if (activeFaceForDetails && activeFaceForDetails.id === activeFaceForDelete.id) {
      closeDetails();
    }
  } catch (error) {
    console.error("Delete failed:", error);
    showToast(`Failed to delete: ${error.message}`, "error");
  } finally {
    confirmDeleteBtn.disabled = false;
    deleteSpinner.style.display = "none";
    deleteBtnText.textContent = "Delete";
  }
}

// Bulk Upload Operations
function openBulkModal() {
  bulkSelectedFiles = [];
  bulkErrorMsg.style.display = "none";
  bulkErrorMsg.textContent = "";
  if (bulkFileInput) bulkFileInput.value = "";
  bulkFilesSummary.style.display = "none";
  bulkThumbnailsContainer.style.display = "none";
  bulkThumbnailsContainer.innerHTML = "";
  bulkProgressArea.style.display = "none";
  bulkProgressBar.style.width = "0%";
  bulkProgressPercent.textContent = "0%";
  startBulkUploadBtn.disabled = true;
  bulkBtnText.textContent = "Upload 0 Photos";
  bulkUploadDialog.showModal();
}

function closeBulkModal() {
  bulkUploadDialog.close();
  bulkSelectedFiles = [];
  if (bulkFileInput) bulkFileInput.value = "";
}

function cleanNameFromFileName(filename) {
  if (!filename) return "Funny Face";
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const withSpaces = withoutExt.replace(/[_\-.]+/g, " ");
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Funny Face";
}

function handleBulkFilesSelected(files) {
  const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
  if (validFiles.length === 0) {
    showToast("Please select valid image files", "error");
    return;
  }

  bulkSelectedFiles = validFiles;
  bulkFilesSummary.textContent = `Selected ${validFiles.length} photo${validFiles.length === 1 ? "" : "s"} ready for upload:`;
  bulkFilesSummary.style.display = "block";

  bulkThumbnailsContainer.innerHTML = "";
  validFiles.slice(0, 30).forEach((file) => {
    const chip = document.createElement("div");
    chip.className = "bulk-thumb-chip";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.title = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    chip.appendChild(img);
    bulkThumbnailsContainer.appendChild(chip);
  });

  if (validFiles.length > 30) {
    const moreChip = document.createElement("div");
    moreChip.className = "bulk-thumb-chip more-chip";
    moreChip.textContent = `+${validFiles.length - 30}`;
    bulkThumbnailsContainer.appendChild(moreChip);
  }

  bulkThumbnailsContainer.style.display = "flex";
  startBulkUploadBtn.disabled = false;
  bulkBtnText.textContent = `Upload ${validFiles.length} Photos`;
  bulkErrorMsg.style.display = "none";
}

async function handleStartBulkUpload() {
  if (bulkSelectedFiles.length === 0) return;

  const defaultExpr = (bulkDefaultExpression.value || "").trim() || "Goofy Mood";
  const defaultCap = (bulkDefaultCaption.value || "").trim() || "Caught on camera!";

  startBulkUploadBtn.disabled = true;
  cancelBulkBtn.disabled = true;
  closeBulkDialogBtn.disabled = true;
  bulkSpinner.style.display = "inline-block";
  bulkBtnText.textContent = "Uploading...";
  bulkProgressArea.style.display = "block";
  bulkErrorMsg.style.display = "none";

  try {
    const uploadedImages = await uploadMultipleToCloudinary(
      bulkSelectedFiles,
      ({ current, total, percent, fileName }) => {
        bulkProgressBar.style.width = `${percent}%`;
        bulkProgressPercent.textContent = `${percent}%`;
        bulkProgressLabel.textContent = `Uploading photo ${current} of ${total}...`;
        bulkProgressFilename.textContent = `Current: ${fileName}`;
      }
    );

    bulkProgressLabel.textContent = "Saving all faces to Firestore...";
    bulkProgressBar.style.width = "99%";
    bulkProgressPercent.textContent = "99%";

    const facesPayload = uploadedImages.map(({ file, secureUrl }) => {
      const generatedScore = (8.0 + Math.random() * 1.9).toFixed(1);
      return {
        name: cleanNameFromFileName(file.name),
        expression: defaultExpr,
        funnyScore: generatedScore,
        caption: defaultCap,
        backstory: `Bulk uploaded from file "${file.name}".`,
        image: secureUrl
      };
    });

    const savedCount = await bulkCreateFaces(facesPayload);

    showToast(`Successfully uploaded ${savedCount} funny faces!`, "success");
    closeBulkModal();
  } catch (err) {
    console.error("Bulk upload error:", err);
    bulkErrorMsg.textContent = err.message || "Failed to upload some photos.";
    bulkErrorMsg.style.display = "block";
    showToast(`Bulk upload error: ${err.message}`, "error");
  } finally {
    startBulkUploadBtn.disabled = false;
    cancelBulkBtn.disabled = false;
    closeBulkDialogBtn.disabled = false;
    bulkSpinner.style.display = "none";
    bulkBtnText.textContent = `Upload ${bulkSelectedFiles.length} Photos`;
  }
}

// Admin Authentication Operations
function updateAuthUI() {
  if (isAdmin) {
    if (adminLoginBtn) adminLoginBtn.style.display = "none";
    if (adminStatusPill) adminStatusPill.style.display = "inline-flex";
    if (detailEditBtn) detailEditBtn.style.display = "inline-flex";
    if (detailDeleteBtn) detailDeleteBtn.style.display = "inline-flex";
  } else {
    if (adminLoginBtn) adminLoginBtn.style.display = "inline-flex";
    if (adminStatusPill) adminStatusPill.style.display = "none";
    if (detailEditBtn) detailEditBtn.style.display = "none";
    if (detailDeleteBtn) detailDeleteBtn.style.display = "none";
  }
  filterFaces();
}

function openAdminModal() {
  if (adminLoginError) {
    adminLoginError.style.display = "none";
    adminLoginError.textContent = "";
  }
  if (adminCodeInput) {
    adminCodeInput.value = "";
  }
  if (adminLoginDialog) {
    adminLoginDialog.showModal();
    setTimeout(() => adminCodeInput?.focus(), 50);
  }
}

function closeAdminModal() {
  if (adminLoginDialog) adminLoginDialog.close();
  if (adminCodeInput) adminCodeInput.value = "";
  if (adminLoginError) {
    adminLoginError.style.display = "none";
    adminLoginError.textContent = "";
  }
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const enteredCode = (adminCodeInput.value || "").trim();

  if (enteredCode === ADMIN_ACCESS_CODE) {
    isAdmin = true;
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    } catch {}
    closeAdminModal();
    updateAuthUI();
    showToast("Authenticated as Admin", "success");
  } else {
    if (adminLoginError) {
      adminLoginError.textContent = "Invalid access code";
      adminLoginError.style.display = "block";
    }
  }
}

function handleAdminLogout() {
  isAdmin = false;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
  updateAuthUI();
  showToast("Logged out of Admin Mode", "info");
}

// Register all Event Listeners
function setupEventListeners() {
  addFaceBtn.addEventListener("click", () => openFormModal("create"));
  emptyAddBtn.addEventListener("click", () => openFormModal("create"));

  // Admin Auth Listeners
  if (adminLoginBtn) adminLoginBtn.addEventListener("click", openAdminModal);
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", handleAdminLogout);
  if (closeAdminDialogBtn) closeAdminDialogBtn.addEventListener("click", closeAdminModal);
  if (cancelAdminDialogBtn) cancelAdminDialogBtn.addEventListener("click", closeAdminModal);
  if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);

  // Bulk upload listeners
  if (bulkUploadBtn) bulkUploadBtn.addEventListener("click", openBulkModal);
  if (emptyBulkBtn) emptyBulkBtn.addEventListener("click", openBulkModal);
  if (closeBulkDialogBtn) closeBulkDialogBtn.addEventListener("click", closeBulkModal);
  if (cancelBulkBtn) cancelBulkBtn.addEventListener("click", closeBulkModal);
  if (startBulkUploadBtn) startBulkUploadBtn.addEventListener("click", handleStartBulkUpload);

  if (bulkFileInput) {
    bulkFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleBulkFilesSelected(e.target.files);
      }
    });
  }

  if (bulkUploadDropzone) {
    ["dragenter", "dragover"].forEach((eventName) => {
      bulkUploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkUploadDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      bulkUploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkUploadDropzone.classList.remove("dragover");
      });
    });

    bulkUploadDropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleBulkFilesSelected(e.dataTransfer.files);
      }
    });
  }

  searchInput.addEventListener("input", filterFaces);

  faceScoreInput.addEventListener("input", (e) => {
    scoreDisplay.textContent = `${e.target.value} / 10`;
  });

  faceForm.addEventListener("submit", handleFormSubmit);
  closeFormBtn.addEventListener("click", closeFormModal);
  cancelFormBtn.addEventListener("click", closeFormModal);

  closeDialogBtn.addEventListener("click", closeDetails);
  detailCloseBtn.addEventListener("click", closeDetails);
  detailEditBtn.addEventListener("click", () => {
    if (!isAdmin) {
      showToast("Admin authentication required to edit faces.", "error");
      return;
    }
    const face = activeFaceForDetails;
    closeDetails();
    if (face) openFormModal("edit", face);
  });
  detailDeleteBtn.addEventListener("click", () => {
    if (!isAdmin) {
      showToast("Admin authentication required to delete faces.", "error");
      return;
    }
    const face = activeFaceForDetails;
    if (face) promptDelete(face);
  });

  closeDeleteDialogBtn.addEventListener("click", closeDeleteModal);
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  confirmDeleteBtn.addEventListener("click", handleDeleteConfirm);

  // Close dialog on backdrop click
  [detailsDialog, faceFormDialog, deleteConfirmDialog, bulkUploadDialog, adminLoginDialog].forEach((dialog) => {
    if (!dialog) return;
    dialog.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!inDialog) {
        dialog.close();
      }
    });
  });

  setupUploadDropzone();
}

// Initialize Application
function initApp() {
  initTheme();
  checkConfiguration();
  setupEventListeners();
  updateAuthUI();

  subscribeToFaces(
    (faces) => {
      allFaces = faces;
      loadingState.style.display = "none";
      filterFaces();
    },
    (err) => {
      loadingState.style.display = "none";
      facesCounter.textContent = "Failed to load faces";
      showToast(`Firestore error: ${err.message}`, "error");
    }
  );
}

// Start
initApp();

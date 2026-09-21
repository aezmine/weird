// Cloudinary Direct Unsigned Upload Service
import { cloudinaryConfig } from "../firebase-config.js";

/**
 * Uploads an image file directly to Cloudinary using an unsigned upload preset.
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The secure HTTPS URL of the uploaded image
 */
export async function uploadToCloudinary(file) {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === "YOUR_CLOUD_NAME") {
    throw new Error(
      "Cloudinary Cloud Name is not configured yet! Please update 'cloudName' in firebase-config.js."
    );
  }

  if (!cloudinaryConfig.uploadPreset || cloudinaryConfig.uploadPreset === "YOUR_UPLOAD_PRESET") {
    throw new Error(
      "Cloudinary Upload Preset is missing! Please create an Unsigned Upload Preset in Cloudinary and set it in firebase-config.js."
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || "Failed to upload image to Cloudinary.";
      throw new Error(errorMsg);
    }

    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw error;
  }
}

/**
 * Uploads multiple image files to Cloudinary with progress tracking.
 * @param {Array<File>} files - The list of image files to upload
 * @param {Function} onProgress - Callback with { current, total, percent, fileName }
 * @returns {Promise<Array<{ file: File, secureUrl: string }>>}
 */
export async function uploadMultipleToCloudinary(files, onProgress) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round((i / total) * 100),
        fileName: file.name
      });
    }

    const secureUrl = await uploadToCloudinary(file);
    results.push({ file, secureUrl });

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        fileName: file.name
      });
    }
  }

  return results;
}

/**
 * Generates an optimized image URL for cards, thumbnails, or modals.
 * Supports Cloudinary dynamic transformations and Unsplash parameters, with fallback to original URL.
 * @param {string} url - The original image URL
 * @param {Object} [options] - Transformation options { width, height, fit, quality }
 * @returns {string} Optimized image URL
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== "string") return "";

  const { width = 600, height = 450, fit = "fill", quality = "auto" } = options;

  // Cloudinary URL transformation
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    const parts = url.split("/upload/");
    if (parts.length === 2) {
      if (/c_[a-z]+|w_[0-9]+|f_[a-z]+/.test(parts[1])) {
        return url;
      }
      const transformParams = [
        `c_${fit}`,
        `w_${width}`,
        ...(height ? [`h_${height}`] : []),
        `f_auto`,
        `q_${quality}`
      ].join(",");
      return `${parts[0]}/upload/${transformParams}/${parts[1]}`;
    }
  }

  // Unsplash URL optimization
  if (url.includes("images.unsplash.com")) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set("w", String(width));
      parsedUrl.searchParams.set("auto", "format");
      parsedUrl.searchParams.set("fit", "crop");
      parsedUrl.searchParams.set("q", "80");
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/**
 * Returns the full original image URL for the Inspect modal,
 * preserving natural aspect ratio without any cropping transformations.
 * @param {string} url - The original image URL
 * @returns {string} Full image URL
 */
export function getFullImageUrl(url) {
  if (!url || typeof url !== "string") return "";

  // Cloudinary: deliver with automatic format/quality, NO cropping
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    const parts = url.split("/upload/");
    if (parts.length === 2) {
      if (/c_[a-z]+|w_[0-9]+|h_[0-9]+/.test(parts[1])) {
        const cleanPath = parts[1]
          .replace(/c_[^/,]+,*/g, "")
          .replace(/w_[0-9]+,*/g, "")
          .replace(/h_[0-9]+,*/g, "")
          .replace(/,+(?=\/)/g, "")
          .replace(/^\/+/, "");
        return `${parts[0]}/upload/f_auto,q_auto/${cleanPath}`;
      }
      if (!/f_auto/.test(parts[1])) {
        return `${parts[0]}/upload/f_auto,q_auto/${parts[1]}`;
      }
    }
  }

  // Unsplash: remove crop & fixed dimensions to preserve natural aspect ratio
  if (url.includes("images.unsplash.com")) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.delete("fit");
      parsedUrl.searchParams.delete("crop");
      parsedUrl.searchParams.delete("w");
      parsedUrl.searchParams.delete("h");
      parsedUrl.searchParams.set("auto", "format");
      parsedUrl.searchParams.set("q", "85");
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

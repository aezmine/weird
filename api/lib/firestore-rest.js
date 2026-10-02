// Firestore REST API Client for Serverless & Dev Environments
// Direct HTTP/REST client using Firebase Project configuration without heavy SDK overhead

function getFirebaseConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    projectId: process.env.FIREBASE_PROJECT_ID || ""
  };
}

function getBaseUrl() {
  const { projectId } = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

/**
 * Converts JS value to Firestore REST Field format
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: "NULL_VALUE" };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      return { nullValue: "NULL_VALUE" };
    }
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === "object") {
    // Check if it represents a Firestore server timestamp placeholder
    if (val._serverTimestamp) {
      return { timestampValue: new Date().toISOString() };
    }
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Converts Firestore REST Field format to normal JS value
 */
function fromFirestoreValue(field) {
  if (!field || typeof field !== "object") return null;
  if ("nullValue" in field) return null;
  if ("booleanValue" in field) return Boolean(field.booleanValue);
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return parseFloat(field.doubleValue);
  if ("stringValue" in field) return field.stringValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in field) {
    const obj = {};
    const fields = field.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

/**
 * Converts JS Object to Firestore Fields dictionary
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "id") continue;
    if (val !== undefined) {
      fields[key] = toFirestoreValue(val);
    }
  }
  return fields;
}

/**
 * Converts Firestore Document to JS Object
 */
function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const id = doc.name ? doc.name.split("/").pop() : null;
  const result = { id };
  for (const [k, v] of Object.entries(doc.fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

/**
 * Get single document by collection and ID
 */
async function getDocument(collectionName, docId) {
  const { apiKey } = getFirebaseConfig();
  const url = `${getBaseUrl()}/${collectionName}/${encodeURIComponent(docId)}?key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore GET ${collectionName}/${docId} error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return fromFirestoreDoc(data);
}

/**
 * Create or overwrite a document
 */
async function setDocument(collectionName, docId, data, merge = false) {
  const fields = toFirestoreFields({
    ...data,
    updatedAt: new Date().toISOString()
  });

  const { apiKey } = getFirebaseConfig();
  const baseUrl = getBaseUrl();

  if (merge) {
    // Use patch with updateMask
    const fieldMasks = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const url = `${baseUrl}/${collectionName}/${encodeURIComponent(docId)}?key=${apiKey}${fieldMasks ? `&${fieldMasks}` : ""}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firestore PATCH ${collectionName}/${docId} error: ${err}`);
    }
    const resData = await res.json();
    return fromFirestoreDoc(resData);
  } else {
    // Direct create or overwrite
    const url = `${baseUrl}/${collectionName}/${encodeURIComponent(docId)}?key=${apiKey}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firestore SET ${collectionName}/${docId} error: ${err}`);
    }
    const resData = await res.json();
    return fromFirestoreDoc(resData);
  }
}

/**
 * Add a new document with an auto-generated ID
 */
async function addDocument(collectionName, data) {
  const fields = toFirestoreFields({
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const { apiKey } = getFirebaseConfig();
  const url = `${getBaseUrl()}/${collectionName}?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore POST ${collectionName} error: ${err}`);
  }

  const resData = await res.json();
  return fromFirestoreDoc(resData);
}

/**
 * Update specific fields in a document
 */
async function updateDocument(collectionName, docId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return null;

  const { apiKey } = getFirebaseConfig();
  const maskQuery = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const fields = toFirestoreFields(updates);

  const url = `${getBaseUrl()}/${collectionName}/${encodeURIComponent(docId)}?key=${apiKey}&${maskQuery}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore UPDATE ${collectionName}/${docId} error: ${err}`);
  }

  const resData = await res.json();
  return fromFirestoreDoc(resData);
}

/**
 * Delete a document
 */
async function deleteDocument(collectionName, docId) {
  const { apiKey } = getFirebaseConfig();
  const url = `${getBaseUrl()}/${collectionName}/${encodeURIComponent(docId)}?key=${apiKey}`;
  const res = await fetch(url, { method: "DELETE" });
  return res.ok;
}

/**
 * Query documents in a collection
 */
async function listDocuments(collectionName, pageSize = 50) {
  const { apiKey } = getFirebaseConfig();
  const url = `${getBaseUrl()}/${collectionName}?pageSize=${pageSize}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore LIST ${collectionName} error: ${err}`);
  }
  const data = await res.json();
  return (data.documents || []).map(fromFirestoreDoc);
}

/**
 * Run structured query on Firestore
 */
async function queryCollection(collectionName, { whereEqual = [], limit = 30 } = {}) {
  const { apiKey, projectId } = getFirebaseConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;

  const filters = whereEqual.map(([field, value]) => ({
    fieldFilter: {
      field: { fieldPath: field },
      op: "EQUAL",
      value: toFirestoreValue(value)
    }
  }));

  let whereClause = undefined;
  if (filters.length === 1) {
    whereClause = filters[0];
  } else if (filters.length > 1) {
    whereClause = {
      compositeFilter: {
        op: "AND",
        filters
      }
    };
  }

  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: collectionName }],
      where: whereClause,
      limit
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryBody)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore runQuery error: ${err}`);
  }

  const results = await res.json();
  return (results || [])
    .filter(item => item.document)
    .map(item => fromFirestoreDoc(item.document));
}

module.exports = {
  getDocument,
  setDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  queryCollection,
  toFirestoreValue,
  fromFirestoreValue,
  fromFirestoreDoc,
  toFirestoreFields
};

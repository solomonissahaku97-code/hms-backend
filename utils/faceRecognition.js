// utils/faceRecognition.js
const path = require('path');
const fs = require('fs');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const { createCanvas, loadImage } = canvas;

// Patch node-canvas into face-api
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

const MODELS_DIR =
  process.env.FACE_MODELS_DIR ||
  path.join(__dirname, '..', 'train_models');

const DISTANCE_THRESHOLD = 0.6;

/** Call this once on server bootstrap */
async function loadModels() {
  if (modelsLoaded) return;
  if (!fs.existsSync(MODELS_DIR)) {
    throw new Error(`Face models directory not found: ${MODELS_DIR}`);
  }
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODELS_DIR, "ssd_mobilenetv1"));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODELS_DIR, "face_landmark_68"));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODELS_DIR, "face_recognition"));
  modelsLoaded = true;
  console.log('✅ face-api models loaded from:', MODELS_DIR);
}

/** Convert base64 string to buffer */
function base64ToBuffer(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/** Convert blob to buffer (for multer file handling) */
function blobToBuffer(blob) {
  return Buffer.from(blob.buffer);
}

/** Load image from various sources (file path, base64, buffer) */
async function loadImageFromSource(imageSource) {
  try {
    // Handle file path
    if (typeof imageSource === 'string' && !imageSource.startsWith('data:')) {
      if (!fs.existsSync(imageSource)) {
        throw new Error(`Image not found: ${imageSource}`);
      }
      return await loadImage(imageSource);
    }
    
    // Handle base64 string
    if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
      const buffer = base64ToBuffer(imageSource);
      return await loadImage(buffer);
    }
    
    // Handle buffer
    if (Buffer.isBuffer(imageSource)) {
      return await loadImage(imageSource);
    }
    
    // Handle multer file object
    if (imageSource && imageSource.buffer) {
      const buffer = blobToBuffer(imageSource);
      return await loadImage(buffer);
    }
    
    throw new Error('Unsupported image source type');
  } catch (error) {
    throw new Error(`Failed to load image: ${error.message}`);
  }
}

/**
 * Extract a single 128-d embedding from an image source
 * imageSource can be: file path, base64 string, buffer, or multer file object
 */
async function getFaceEmbedding(imageSource) {
  const img = await loadImageFromSource(imageSource);

  const result = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    throw new Error('No face detected in the provided image');
  }

  // Convert Float32Array to plain array for JSON/DB storage
  return Array.from(result.descriptor);
}

/**
 * Extract embeddings from multiple image sources
 */
async function getEmbeddingsFromSources(imageSources = []) {
  const out = [];
  for (const source of imageSources) {
    try {
      const emb = await getFaceEmbedding(source);
      out.push({ source, embedding: emb });
    } catch (e) {
      console.warn(`⚠️ ${e.message}`);
    }
  }
  if (out.length === 0) {
    throw new Error('No valid faces detected in the provided images');
  }
  return out;
}

/** Extract embedding from file path (backward compatibility) */
async function getFaceEmbeddingFromFile(imagePath) {
  return getFaceEmbedding(imagePath);
}

/** Extract embeddings from file paths (backward compatibility) */
async function getEmbeddingsFromFiles(imagePaths = []) {
  return getEmbeddingsFromSources(imagePaths);
}

/** Average multiple embeddings into a single template vector */
function averageEmbeddings(embeddings = []) {
  if (embeddings.length === 0) return [];
  const len = embeddings[0].length;
  const sum = new Array(len).fill(0);
  embeddings.forEach(vec => {
    for (let i = 0; i < len; i++) sum[i] += vec[i];
  });
  return sum.map(v => v / embeddings.length);
}

/** Euclidean distance between two embeddings */
function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Compare a live embedding to a stored embedding */
function compareEmbeddings(liveEmbedding, storedEmbedding, threshold = DISTANCE_THRESHOLD) {
  const dist = euclidean(liveEmbedding, storedEmbedding);
  return { match: dist < threshold, distance: dist };
}

/** Find best match from multiple candidates */
function findBestMatch(liveEmbedding, candidates = [], threshold = DISTANCE_THRESHOLD) {
  let best = null;
  const distances = [];

  for (const c of candidates) {
    const dist = euclidean(liveEmbedding, c.embedding);
    distances.push({ staffId: c.staffId, distance: dist });
    if (!best || dist < best.distance) best = { staffId: c.staffId, distance: dist };
  }

  return {
    matched: !!best && best.distance < threshold,
    best,
    distances: distances.sort((a, b) => a.distance - b.distance),
  };
}

module.exports = {
  loadModels,
  getFaceEmbedding,
  getFaceEmbeddingFromFile, // backward compatibility
  getEmbeddingsFromSources,
  getEmbeddingsFromFiles, // backward compatibility
  averageEmbeddings,
  compareEmbeddings,
  findBestMatch,
  DISTANCE_THRESHOLD,
};
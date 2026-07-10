/**
 * Upload d'images vers le bucket Supabase Storage `product-images`.
 *
 * L'upload est précédé d'une compression client (Blob JPEG) pour éviter
 * d'envoyer des photos de plusieurs Mo, même en fibres rapides :
 * - le temps d'upload reste instantané
 * - on ne paie pas / ne stocke pas d'octets inutiles
 * - les visiteurs téléchargent plus vite les pages du shop
 *
 * Si les credentials Supabase sont absents (dev local sans .env) ou si
 * le bucket n'est pas encore configuré, on retourne un data URL en
 * fallback pour ne pas bloquer le panel pendant la migration.
 */
import { supabase } from './supabase';
import { compressImageToBlob } from '../utils/compressImage';

const BUCKET = 'product-images';

function storageAvailable(): boolean {
  // Vérifie que le client Supabase est bien initialisé (URL + key présentes).
  // Supabase JS crée un client même avec des chaînes vides mais les appels
  // échoueront ; on teste explicitement les variables d'env.
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function extFromMime(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

/**
 * Construit un chemin de fichier unique et ordonnable dans le bucket :
 *   <prefix>/YYYY-MM/<timestamp>-<random>.<ext>
 */
function buildObjectPath(prefix: 'products' | 'drops', mime: string): string {
  const now = new Date();
  const monthFolder =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = extFromMime(mime);
  return `${prefix}/${monthFolder}/${Date.now()}-${rand}.${ext}`;
}

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export type UploadedImage = {
  url: string;
  path: string;
  width: number;
  height: number;
  size: number;
  hasAlpha?: boolean;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture impossible'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresse un File puis l'upload sur Supabase Storage.
 * Retourne l'URL publique du fichier et son chemin dans le bucket.
 *
 * Fallback : si Supabase n'est pas configuré, retourne un data URL.
 */
export async function uploadProductImage(
  file: File,
  maxSize = 800,
  quality = 0.75,
): Promise<UploadedImage> {
  const compressed = await compressImageToBlob(file, maxSize, quality);

  if (!storageAvailable()) {
    const dataUrl = await blobToDataUrl(compressed.blob);
    console.warn('[storage] Supabase non configuré, fallback data URL.');
    return {
      url: dataUrl,
      path: '',
      width: compressed.width,
      height: compressed.height,
      size: compressed.blob.size,
      hasAlpha: compressed.hasAlpha,
    };
  }

  const path = buildObjectPath('products', compressed.blob.type);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed.blob, {
      contentType: compressed.blob.type,
      cacheControl: '31536000', // 1 an : les URLs sont uniques (nom random)
      upsert: false,
    });

  if (error) {
    console.error('[storage] upload failed', error);
    throw error;
  }

  return {
    url: publicUrl(path),
    path,
    width: compressed.width,
    height: compressed.height,
    size: compressed.blob.size,
    hasAlpha: compressed.hasAlpha,
  };
}

/** Upload l'image du drop de la semaine. */
export async function uploadDropImage(
  file: File,
  maxSize = 1200,
  quality = 0.8,
): Promise<UploadedImage> {
  const compressed = await compressImageToBlob(file, maxSize, quality);

  if (!storageAvailable()) {
    const dataUrl = await blobToDataUrl(compressed.blob);
    return {
      url: dataUrl,
      path: '',
      width: compressed.width,
      height: compressed.height,
      size: compressed.blob.size,
      hasAlpha: compressed.hasAlpha,
    };
  }

  const path = buildObjectPath('drops', compressed.blob.type);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed.blob, {
      contentType: compressed.blob.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('[storage] drop upload failed', error);
    throw error;
  }

  return {
    url: publicUrl(path),
    path,
    width: compressed.width,
    height: compressed.height,
    size: compressed.blob.size,
    hasAlpha: compressed.hasAlpha,
  };
}

/** Supprime un ou plusieurs fichiers du bucket (non bloquant si échec). */
export async function deleteProductImages(paths: string[]) {
  if (!storageAvailable() || paths.length === 0) return;
  const toDelete = paths.filter(Boolean);
  if (toDelete.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(toDelete);
  if (error) {
    console.error('[storage] delete failed', error);
  }
}

/**
 * Détecte si une URL est une URL Supabase Storage du bucket product-images
 * (vs un data URL base64 ou une URL externe).
 */
export function isStorageUrl(url: string): boolean {
  if (!url) return false;
  if (!storageAvailable()) return false;
  if (url.startsWith('data:')) return false;
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl('');
    return url.startsWith(data.publicUrl);
  } catch {
    return false;
  }
}

/** Extrait le chemin objet depuis une URL publique du bucket. */
export function pathFromStorageUrl(url: string): string {
  if (!isStorageUrl(url)) return '';
  const { data } = supabase.storage.from(BUCKET).getPublicUrl('');
  return url.slice(data.publicUrl.length).replace(/^\//, '');
}

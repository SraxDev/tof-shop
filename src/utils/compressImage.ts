/**
 * Compression d'image côté navigateur.
 *
 * Stratégie :
 * - Redimensionne pour que le plus grand côté ne dépasse pas `maxSize` px
 * - Si l'image source a de la transparence (PNG/WebP), on garde le PNG pour
 *   conserver l'alpha (sinon les remove.bg auraient un fond blanc).
 *   ⚠️ On ne bascule JAMAIS en JPEG si l'alpha a été détecté — le PNG est
 *   toujours prioritaire, même s'il est plus lourd (un fond transparent
 *   n'a pas de prix).
 * - Sinon on encode en JPEG avec la qualité demandée (plus léger).
 */

export type CompressedBlob = {
  blob: Blob;
  width: number;
  height: number;
  hasAlpha: boolean;
};

/**
 * Détecte si un canvas contient des pixels non-opaques (transparence).
 *
 * On vérifie en priorité les bords (1 colonne large sur le pourtour) car
 * c'est là que remove.bg / les découpes placent la zone transparente.
 * Puis un sampling léger à l'intérieur. On ne fait plus de "step 16"
 * global qui pouvait louper une bordure fine.
 */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    // Helper : alpha du pixel (x,y)
    const a = (x: number, y: number) => data[(y * w + x) * 4 + 3];

    // 1) Vérifier TOUS les pixels des 4 bords sur 4px de largeur — c'est là
    //    que remove.bg place la transparence. Pas d'échantillonnage ici.
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < w; x++) if (a(x, y) < 254) return true;
    }
    for (let y = h - 4; y < h; y++) {
      for (let x = 0; x < w; x++) if (a(x, y) < 254) return true;
    }
    for (let y = 4; y < h - 4; y++) {
      if (a(0, y) < 254 || a(w - 1, y) < 254) return true;
      if (w > 1 && (a(1, y) < 254 || a(w - 2, y) < 254)) return true;
      if (w > 2 && (a(2, y) < 254 || a(w - 3, y) < 254)) return true;
      if (w > 3 && (a(3, y) < 254 || a(w - 4, y) < 254)) return true;
    }

    // 2) Vérifier les 4 coins (zone 8×8) — c'est souvent là que la
    //    découpe laisse le plus de transparence visible.
    const corner = 8;
    for (let y = 0; y < corner; y++) {
      for (let x = 0; x < corner; x++) if (a(x, y) < 254) return true;
      for (let x = w - corner; x < w; x++) if (a(x, y) < 254) return true;
    }
    for (let y = h - corner; y < h; y++) {
      for (let x = 0; x < corner; x++) if (a(x, y) < 254) return true;
      for (let x = w - corner; x < w; x++) if (a(x, y) < 254) return true;
    }

    // 3) Sampling léger à l'intérieur au cas où il y aurait du vide au
    //    milieu (ex: produit découpé en anneau).
    for (let y = 8; y < h - 8; y += 16) {
      for (let x = 8; x < w - 8; x += 16) {
        if (a(x, y) < 250) return true;
      }
    }
    return false;
  } catch {
    // Si getImageData est bloqué (tainted canvas), on joue la sécurité = PNG
    return true;
  }
}

export function compressImageToBlob(
  file: File,
  maxSize = 1000,
  quality = 0.75,
): Promise<CompressedBlob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
          } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
          }
        }

        // Détection préliminaire sur le type MIME (un JPEG ne peut jamais
        // avoir d'alpha). Utile aussi en fallback si le contexte 2D plante.
        const mimeAllowsAlpha = file.type === 'image/png' || file.type === 'image/webp';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, width: img.naturalWidth, height: img.naturalHeight, hasAlpha: mimeAllowsAlpha });
          return;
        }

        // Dessiner sans fond blanc d'abord pour tester la transparence
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Détection : d'abord sur le canvas (réel), puis sur le type MIME.
        // Un JPEG ne peut jamais avoir d'alpha ; un PNG/webp peut en avoir.
        const canvasHasAlpha = hasTransparency(ctx, width, height);
        const sourceHasAlpha = canvasHasAlpha || mimeAllowsAlpha;

        let mime: string;
        if (sourceHasAlpha) {
          mime = 'image/png';
        } else {
          // JPEG + fond blanc seulement quand aucune transparence
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'source-over';
          mime = 'image/jpeg';
        }

        // Log de debug (visible dans la console de l'admin)
        if (typeof window !== 'undefined') {
          console.log(
            `[compress] ${file.name} (${file.type}, ${file.size}o) → ${mime}`,
            canvasHasAlpha ? '✓ alpha détecté' : 'pas d\'alpha',
          );
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression impossible'));
              return;
            }
            if (mime === 'image/png' && sourceHasAlpha) {
              // ⚠️ Alpha détectée = on garde coûte que coûte le PNG, même si
              // c'est plus gros. Pas de fallback JPEG (ça collerait un fond
              // blanc sur les images remove.bg).
              resolve({ blob, width, height, hasAlpha: true });
              return;
            }
            // Seulement si on a choisi PNG "par défaut" (fichier PNG/webp
            // mais SANS alpha détecté) : on bascule JPEG si le PNG est
            // plus de 1.5× le JPEG équivalent (ex: photo plate en PNG).
            if (mime === 'image/png' && file.size > 0 && blob.size > file.size * 1.5) {
              ctx.globalCompositeOperation = 'destination-over';
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob) {
                    resolve({ blob: jpegBlob, width, height, hasAlpha: false });
                  } else {
                    resolve({ blob, width, height, hasAlpha: false });
                  }
                },
                'image/jpeg',
                quality,
              );
              return;
            }
            resolve({ blob, width, height, hasAlpha: false });
          },
          mime,
          mime === 'image/jpeg' ? quality : undefined,
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressImage(file: File, maxSize = 1000, quality = 0.75): Promise<string> {
  return compressImageToBlob(file, maxSize, quality).then(
    ({ blob }) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Conversion data URL impossible'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      }),
  );
}

export function compressImages(
  files: File[],
  maxSize = 1000,
  quality = 0.75,
): Promise<string[]> {
  return Promise.all(files.map((file) => compressImage(file, maxSize, quality)));
}

export function compressImagesToBlob(
  files: File[],
  maxSize = 1000,
  quality = 0.75,
): Promise<CompressedBlob[]> {
  return Promise.all(files.map((file) => compressImageToBlob(file, maxSize, quality)));
}

/**
 * Détecte si une image (par URL) a de la transparence.
 * Retourne `true` si un pixel non-opaque est trouvé, `false` si l'image est
 * pleinement opaque (et donc probablement JPEG ou PNG sans alpha).
 *
 * Utile dans l'admin pour prévenir "cette image a un fond uni" après upload.
 */
export async function imageHasTransparency(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Downscale pour la perf
        const max = 64;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(false);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(hasTransparency(ctx, w, h));
      } catch {
        // tainted canvas (CORS cross-origin) : inconnu
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
    // Timeout de sécurité
    setTimeout(() => resolve(false), 5000);
  });
}

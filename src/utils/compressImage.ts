/**
 * Compression d'image côté navigateur.
 *
 * Deux versions :
 *  - `compressImage`       → data URL base64 (utilisée historiquement / fallback)
 *  - `compressImageToBlob` → Blob (recommandée pour l'upload vers Storage,
 *                            évite une double conversion base64↔binaire)
 *
 * Stratégie :
 * - Redimensionne pour que le plus grand côté ne dépasse pas `maxSize` px
 * - Ré-encode en JPEG Web avec la qualité donnée (PNG avec alpha si besoin ->
 *   on force JPEG pour la légèreté, c'est acceptable pour des photos produit)
 * - Retourne les dimensions finales utiles pour l'audit / le stockage.
 */

export type CompressedBlob = {
  blob: Blob;
  width: number;
  height: number;
};

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

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback si pas de canvas (très rare) : on renvoie le fichier
          // original sous forme de blob sans compression.
          resolve({ blob: file, width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
        // Remplissage d'un fond blanc pour éviter les artefacts noirs sur les
        // JPEG issus de PNG avec transparence.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const mime = 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression impossible'));
              return;
            }
            resolve({ blob, width, height });
          },
          mime,
          quality,
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresse et retourne un data URL (compat historique). Privilégier
 * `compressImageToBlob` pour les uploads.
 */
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

/** Compresse plusieurs fichiers en parallèle. */
export function compressImages(
  files: File[],
  maxSize = 1000,
  quality = 0.75,
): Promise<string[]> {
  return Promise.all(files.map((file) => compressImage(file, maxSize, quality)));
}

/** Compresse plusieurs fichiers en Blob en parallèle. */
export function compressImagesToBlob(
  files: File[],
  maxSize = 1000,
  quality = 0.75,
): Promise<CompressedBlob[]> {
  return Promise.all(files.map((file) => compressImageToBlob(file, maxSize, quality)));
}

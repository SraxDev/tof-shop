/**
 * Compresse et redimensionne une image côté navigateur avant de la stocker
 * en base64. Évite de garder des photos de 3-5 Mo en mémoire / en DB, ce qui
 * ralentit énormément le rendu (React diff + décodage d'image par le navigateur).
 *
 * - Redimensionne pour que le plus grand côté ne dépasse pas `maxSize` px
 * - Ré-encode en JPEG avec la qualité donnée
 * - Retourne un data URL prêt à stocker (généralement 20-60x plus léger)
 */
export function compressImage(file: File, maxSize = 1000, quality = 0.75): Promise<string> {
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
          // Fallback : pas de canvas dispo, on renvoie l'original
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Compresse plusieurs fichiers en parallèle. */
export function compressImages(files: File[], maxSize = 1000, quality = 0.75): Promise<string[]> {
  return Promise.all(files.map((file) => compressImage(file, maxSize, quality)));
}

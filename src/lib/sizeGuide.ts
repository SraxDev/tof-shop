/**
 * Guide des tailles détaillé.
 * - Sneakers : correspondances EU / US / UK / longueur du pied en cm
 * - Vêtements : S/M/L avec poitrine, taille, longueur
 */

export type SneakerRow = { eu: string; us: string; uk: string; cm: string };
export type ClothingRow = { size: string; chest: string; waist: string; length: string };

export const sneakerSizes: SneakerRow[] = [
  { eu: '38', us: '5.5', uk: '5', cm: '24,0' },
  { eu: '38.5', us: '6', uk: '5.5', cm: '24,5' },
  { eu: '39', us: '6.5', uk: '6', cm: '25,0' },
  { eu: '40', us: '7', uk: '6', cm: '25,5' },
  { eu: '40.5', us: '7.5', uk: '6.5', cm: '25,5' },
  { eu: '41', us: '8', uk: '7', cm: '26,0' },
  { eu: '42', us: '8.5', uk: '7.5', cm: '26,5' },
  { eu: '42.5', us: '9', uk: '8', cm: '27,0' },
  { eu: '43', us: '9.5', uk: '8.5', cm: '27,5' },
  { eu: '44', us: '10', uk: '9', cm: '28,0' },
  { eu: '44.5', us: '10.5', uk: '9.5', cm: '28,5' },
  { eu: '45', us: '11', uk: '10', cm: '29,0' },
  { eu: '45.5', us: '11.5', uk: '10.5', cm: '29,5' },
  { eu: '46', us: '12', uk: '11', cm: '30,0' },
  { eu: '47', us: '12.5', uk: '11.5', cm: '30,5' },
  { eu: '47.5', us: '13', uk: '12', cm: '31,0' },
];

export const clothingSizes: ClothingRow[] = [
  { size: 'XS', chest: '86-90 cm', waist: '70-74 cm', length: '65 cm' },
  { size: 'S', chest: '90-96 cm', waist: '74-80 cm', length: '68 cm' },
  { size: 'M', chest: '96-102 cm', waist: '80-86 cm', length: '71 cm' },
  { size: 'L', chest: '102-108 cm', waist: '86-92 cm', length: '74 cm' },
  { size: 'XL', chest: '108-114 cm', waist: '92-98 cm', length: '77 cm' },
  { size: 'XXL', chest: '114-120 cm', waist: '98-104 cm', length: '80 cm' },
];

export const pantsSizes: ClothingRow[] = [
  { size: '28 (S)', chest: '—', waist: '71-74 cm', length: '100 cm' },
  { size: '30 (S/M)', chest: '—', waist: '76-79 cm', length: '102 cm' },
  { size: '32 (M)', chest: '—', waist: '81-84 cm', length: '104 cm' },
  { size: '34 (L)', chest: '—', waist: '86-89 cm', length: '106 cm' },
  { size: '36 (XL)', chest: '—', waist: '91-94 cm', length: '108 cm' },
  { size: '38 (XXL)', chest: '—', waist: '96-99 cm', length: '110 cm' },
];

export type SizeGuideKind = 'sneakers' | 'clothing' | 'pants' | 'accessory';

export function guideKindForCategory(category: string): SizeGuideKind {
  const c = (category || '').toLowerCase();
  if (['sneaker', 'chaussure', 'claquette', 'basket', 'botte'].some((w) => c.includes(w))) return 'sneakers';
  if (['jean', 'pantalon', 'short', 'jogging'].some((w) => c.includes(w))) return 'pants';
  if (['casquette', 'bonnet', 'ceinture', 'lunettes', 'bijoux', 'montre', 'écharpe', 'parfum', 'sac', 'sacoche', 'portefeuille'].some((w) => c.includes(w)))
    return 'accessory';
  return 'clothing';
}

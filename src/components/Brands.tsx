import { useInView } from '../hooks/useInView';

type Brand = {
  name: string;
  main: string;
  sub?: string;
  family: 'serif' | 'sans' | 'display';
  size?: number;
  spacing?: number;
  italic?: boolean;
};

const brands: Brand[] = [
  { name: 'Gucci', main: 'GUCCI', sub: 'ITALIA', family: 'serif', spacing: 8, size: 34 },
  { name: 'Louis Vuitton', main: 'LV', sub: 'LOUIS VUITTON', family: 'serif', spacing: -3, size: 40 },
  { name: 'Prada', main: 'PRADA', sub: 'MILANO', family: 'serif', spacing: 10, size: 34 },
  { name: 'Balenciaga', main: 'BALENCIAGA', sub: 'PARIS', family: 'sans', spacing: 6, size: 25 },
  { name: 'Dior', main: 'DIOR', sub: 'PARIS', family: 'serif', spacing: 6, size: 40 },
  { name: 'Nike', main: 'NIKE', sub: 'SPORTSWEAR', family: 'sans', spacing: 5, size: 35, italic: true },
  { name: 'Jordan', main: 'JORDAN', sub: 'JUMPMAN', family: 'display', spacing: 7, size: 29 },
  { name: 'Off-White', main: 'OFF-WHITE', sub: 'STREETWEAR', family: 'sans', spacing: 5, size: 27 },
  { name: 'Versace', main: 'VERSACE', sub: 'MILANO', family: 'serif', spacing: 7, size: 30 },
  { name: 'Burberry', main: 'BURBERRY', sub: 'LONDON', family: 'serif', spacing: 7, size: 28 },
  { name: 'Stone Island', main: 'STONE', sub: 'ISLAND', family: 'display', spacing: 6, size: 28 },
  { name: 'Moncler', main: 'MONCLER', sub: 'GRENOBLE', family: 'sans', spacing: 8, size: 28 },
  { name: 'Amiri', main: 'AMIRI', sub: 'LOS ANGELES', family: 'serif', spacing: 9, size: 35 },
  { name: 'Saint Laurent', main: 'YSL', sub: 'SAINT LAURENT', family: 'serif', spacing: -3, size: 40 },
  { name: 'Givenchy', main: 'GIVENCHY', sub: 'PARIS', family: 'sans', spacing: 7, size: 27 },
  { name: 'Palm Angels', main: 'PALM', sub: 'ANGELS', family: 'display', spacing: 7, size: 29 },
];

function fontFamily(family: Brand['family']) {
  if (family === 'serif') return 'Georgia, Times New Roman, serif';
  if (family === 'display') return 'Syne, Arial Black, Arial, sans-serif';
  return 'Arial Black, Arial, sans-serif';
}

function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <svg viewBox="0 0 260 90" role="img" aria-label={`${brand.name} logo`} className="h-16 w-full">
      <text
        x="130"
        y={brand.sub ? 48 : 56}
        textAnchor="middle"
        fontFamily={fontFamily(brand.family)}
        fontSize={brand.size || 30}
        fontWeight="800"
        fontStyle={brand.italic ? 'italic' : 'normal'}
        letterSpacing={brand.spacing || 0}
        className="fill-dark transition-colors duration-300 group-hover:fill-white"
      >
        {brand.main}
      </text>
      {brand.sub && (
        <text
          x="130"
          y="68"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="9"
          fontWeight="800"
          letterSpacing="4"
          className="fill-dark/30 transition-colors duration-300 group-hover:fill-white/35"
        >
          {brand.sub}
        </text>
      )}
    </svg>
  );
}

export default function Brands() {
  const { ref, isInView } = useInView(0.05);

  return (
    <section id="marques" className="py-14 sm:py-20 lg:py-28 bg-white" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark">
            les marques
          </h2>
          <p className="mt-3 text-dark/40">les logos des marques les plus demandées</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {brands.map((brand, i) => (
            <div
              key={brand.name}
              className={`group relative min-h-24 sm:min-h-32 overflow-hidden rounded-2xl bg-bg border border-dark/5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:bg-dark hover:shadow-xl hover:shadow-dark/10 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(232,77,26,0.12),transparent_45%)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full min-h-24 sm:min-h-32 flex items-center justify-center px-3 sm:px-5 py-4 sm:py-6 text-center">
                <BrandLogo brand={brand} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
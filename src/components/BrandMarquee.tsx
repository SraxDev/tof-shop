const brands = [
  'GUCCI', 'LOUIS VUITTON', 'PRADA', 'BALENCIAGA', 'DIOR',
  'NIKE', 'JORDAN', 'VERSACE', 'BURBERRY', 'OFF-WHITE',
  'SAINT LAURENT', 'GIVENCHY', 'STONE ISLAND', 'MONCLER', 'AMIRI',
];

export default function BrandMarquee() {
  return (
    <div className="py-6 bg-dark overflow-hidden">
      <div className="flex anim-marquee whitespace-nowrap">
        {[...brands, ...brands].map((b, i) => (
          <span key={i} className="mx-6 text-xs font-semibold tracking-[0.2em] text-white/30 flex-shrink-0">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

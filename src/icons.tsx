type Name = 'home' | 'play' | 'pause' | 'plus' | 'minus' | 'plant' | 'lamp' | 'art' | 'cube' | 'link' | 'close' | 'fullscreen' | 'window' | 'left' | 'right' | 'up' | 'down' | 'rotate-left' | 'rotate-right' | 'move' | 'help' | 'weather' | 'desktop';

/** Locally bundled Phosphor icons, tinted by the current control colour. */
export function Icon({ name }: { name: Name }) {
  return <span className="ui-icon" aria-hidden="true" style={{ maskImage: `url(/icons/${name}.svg)`, WebkitMaskImage: `url(/icons/${name}.svg)` }} />;
}

// Light-stroke inline icons (24px grid); decorative, so hidden from screen readers
const paths = {
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
  rounds: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  plus: 'M12 5v14M5 12h14',
};

export type IconName = keyof typeof paths;

const Icon = ({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={paths[name]} />
  </svg>
);

export default Icon;

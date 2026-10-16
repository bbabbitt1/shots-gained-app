import { NavLink, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from './Icons';

const items: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/rounds', label: 'Rounds', icon: 'rounds' },
  { to: '/analysis', label: 'Analysis', icon: 'chart' },
];

// Floating glass pill; blur is fine here because the element is fixed, not scrolling content
const NavIsland = () => {
  const navigate = useNavigate();
  const link = (it: (typeof items)[number]) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.to === '/home'}
      className={({ isActive }) =>
        `flex h-12 min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-medium transition-colors duration-200 ease-spring ${
          isActive ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
        }`
      }
    >
      <Icon name={it.icon} />
      {it.label}
    </NavLink>
  );

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-bg-surface/75 p-1.5 ring-1 ring-white/10 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-16px_rgba(0,0,0,0.8)]"
    >
      {items.slice(0, 2).map(link)}
      <button
        onClick={() => navigate('/round/setup')}
        className="group mx-1 flex h-12 items-center gap-2 rounded-full bg-accent-hover pl-4 pr-1.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-transform duration-300 ease-spring active:scale-[0.97]"
      >
        Log
        <span className="btn-icon h-9 w-9"><Icon name="plus" /></span>
      </button>
      {items.slice(2).map(link)}
    </nav>
  );
};

export default NavIsland;

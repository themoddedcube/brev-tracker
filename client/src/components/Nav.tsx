import { NavLink } from "react-router-dom";

const linkBase =
  "text-body text-olive hover:text-nearblack transition-colors px-2 py-1";
const linkActive = "text-nearblack";

export default function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-parchment/90 backdrop-blur border-b border-bordercream">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <NavLink to="/" className="flex items-baseline gap-2 text-nearblack">
          <span className="font-serif text-feature">Brev</span>
          <span className="text-terracotta font-serif text-feature">·</span>
          <span className="font-serif text-feature">Index</span>
          <span className="hidden md:inline text-overline uppercase tracking-widest text-stone ml-1">
            Price Index
          </span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
            GPUs
          </NavLink>
          <NavLink to="/api" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
            API
          </NavLink>
          <a
            href="https://brev.nvidia.com"
            target="_blank"
            rel="noreferrer"
            className="ml-4 inline-flex items-center bg-terracotta text-ivory rounded-xl px-4 py-2 text-bodysm shadow-[0_0_0_1px_#c96442] hover:bg-coral transition-colors"
          >
            Open Brev →
          </a>
        </nav>
      </div>
    </header>
  );
}

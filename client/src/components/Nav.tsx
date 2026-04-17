import { NavLink } from "react-router-dom";

const linkBase =
  "text-body text-olive hover:text-nearblack transition-colors px-2 py-1";
const linkActive = "text-nearblack";

export default function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-parchment/90 backdrop-blur border-b border-bordercream">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <NavLink to="/" className="font-serif text-feature text-nearblack">
          Brev<span className="text-terracotta">·</span>Tracker
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
            GPUs
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

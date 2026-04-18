import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Home from "./routes/Home";
import GpuDetail from "./routes/GpuDetail";
import Api from "./routes/Api";

export default function App() {
  return (
    <div className="min-h-screen bg-parchment">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gpu/:name" element={<GpuDetail />} />
          <Route path="/api" element={<Api />} />
        </Routes>
      </main>
      <footer className="border-t border-bordercream py-10 mt-20">
        <div className="max-w-container mx-auto px-6 text-caption text-stone flex justify-between">
          <span>Brev Price Index · an integration for <a className="underline decoration-bordercream hover:text-terracotta" href="https://brev.nvidia.com" target="_blank" rel="noreferrer">brev.nvidia.com</a></span>
          <span className="font-mono">v0.1 · uPlot · SQLite</span>
        </div>
      </footer>
    </div>
  );
}

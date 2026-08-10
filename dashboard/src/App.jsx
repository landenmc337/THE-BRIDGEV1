import { useState } from "react";

import {
  Palette,
  Plug,
  Shield,
  Bell,
} from "lucide-react";

import logo from "./assets/4k.png";

export default function App() {
  const [fontFamily, setFontFamily] = useState("Segoe UI");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-zinc-800 p-6">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-1">
          <img
            src={logo}
            alt="The Bridge Logo"
            className="h-24 w-24 object-contain"
          />

          <div className="leading-tight">
            <h1 className="text-xl font-semibold">
              The Bridge
            </h1>

            <p className="text-xs text-zinc-500">
              v0.1 Alpha
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          <button className="flex w-full items-center gap-3 rounded-lg bg-zinc-900 px-4 py-3 text-left transition hover:bg-zinc-800">
            <Palette size={18} />
            <span>Appearance</span>
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-zinc-900">
            <Plug size={18} />
            <span>Platforms</span>
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-zinc-900">
            <Shield size={18} />
            <span>Moderation</span>
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-zinc-900">
            <Bell size={18} />
            <span>Alerts</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            Appearance
          </h2>

          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>

            <span className="text-sm text-zinc-400">
              Overlay Connected
            </span>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 p-8">
          <div className="grid grid-cols-[380px_1fr] gap-6 h-full">
            {/* Settings */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-6 text-xl font-semibold">
                Appearance Settings
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Font Family
                  </label>

                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
                  >
                    <option value="Segoe UI">Segoe UI (Default)</option>
<option value="Inter">Inter</option>
<option value="Poppins">Poppins</option>
<option value="Outfit">Outfit</option>
<option value="Geist Sans">Geist Sans</option>
<option value="Space Grotesk">Space Grotesk</option>
<option value="JetBrains Mono">JetBrains Mono</option>
<option value="Arial">Arial</option>
<option value="Verdana">Verdana</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
  <p className="mb-4 text-sm text-zinc-500">
    Current Font: {fontFamily}
  </p>

 <div
  style={{
    fontFamily,
    fontWeight: 800,
  }}
>
    <div className="mb-2">
      <span className="font-bold text-cyan-400">
        Streamer:
      </span>{" "}
      <span>Hello everyone 👋</span>
    </div>

    <div>
      <span className="font-bold text-red-400">
        AnotherUser:
      </span>{" "}
      <span>This overlay is sick!</span>
    </div>
  </div>
</div>
          </div>
        </div>
      </main>
    </div>
  );
}
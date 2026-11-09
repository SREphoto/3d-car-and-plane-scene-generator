# APEX // AERO — 3D Car & Plane Cinema Studio

An interactive, high-fidelity 3D Cinema Studio web application built with **React**, **Three.js**, **Vite**, and the **Web Audio API**.

Live Web View: [https://SREphoto.github.io/3d-car-and-plane-scene-generator/](https://SREphoto.github.io/3d-car-and-plane-scene-generator/)

---

## Features

### 🏎️ 16 High-Detail Cars
- **Formula 1**: 2026 Aston Martin AMR26, 2025 BWT Alpine A525
- **GT3 & Endurance**: Ferrari 296 GT3, 2024 Porsche 911 GT3 R, 2026 BMW M4 GT3 EVO (#31), 2025 BMW M4 GT3 EVO (G82), 2020 McLaren 720S GT3, 2018 Lexus RC F GT3, Toyota GR Supra GT300
- **Legends & Classics**: 1989 Ferrari F40 Competizione, 1980 BMW M1 AHG Studie, BMW M3 GTR (E46 GT2)
- **Hypercars & Tuners**: McLaren P1, LB-Works Ferrari F40 Widebody, BMW M4 Knitro Widebody, BMW M5 Competition

### ✈️ 2 Widebody Airliners
- **British Airways Boeing 747-400** (Quad-Jet Rolls-Royce RB211-524G)
- **Delta Air Lines Airbus A350-900** (Twin-Engine Rolls-Royce Trent XWB)

### ⛅ Dynamic Outdoor World with Weather & 24-Hour Time-of-Day
- **24-Hour Solar/Lunar Arc**: Real-time slider (`00:00` to `24:00`) computing solar azimuth and elevation with atmospheric scattering from Dawn to Noon, Golden Hour, and Starry Night.
- **6 Weather States**: `Sunny`, `Cloudy`, `Drizzle` (rain streaks & wet asphalt ripples), `Thunderstorm` (lightning flashes, wind squalls & thunder audio), `Snow`, and `Blizzard`.
- **Progressive Snow Accumulation Shader**: Coats terrain, road shoulders, and upward-facing ($+Y$ normal) surfaces of the vehicle or plane.

### 🎬 10 Studio & Real-World Environments
- **Alpine Highway & Tarmac** (Dynamic Weather + 24h Time-of-Day)
- **Underground Performance Garage** (`car_garage.glb`)
- **Aero Wind Tunnel Facility** (`wind_tunnel.glb` with live aerodynamic smoke streamlines)
- **Abandoned Concrete VR Gallery** (`abandoned_vr_gallery.glb`)
- **Industrial Catwalk Hangar** (`catwalk.glb`)
- **Architectural Loft Hall (Interior 7)** (`interior_7.glb`)
- **Wet Asphalt Dark Studio** (Obsidian reflective floor with neon rim bars)
- **Cyberpunk Neon Speed Tunnel** (Infinite animated speed tunnel)
- **High-Altitude Volumetric Cloud Deck** (Cruising at 38,000 ft)
- **International Airport Runway** (Sequential approach strobes & wet tarmac)

### 🎥 Cinematography Camera Director & Social Media Video Exporter
- **10 Camera Moves**: 360° Hero Showcase, Low-Angle Wide Pan, Hitchcock Vertigo Dolly Zoom, Parallel Profile Slider, High Crane Reveal, Telephoto Aero Sweep, Dynamic Speed Chase, Belly Underpass Flyby, Wingtip-to-Nose Sweep, Runway Takeoff Chase.
- **Multi-Shot Reel Sequencer**: Build custom multi-angle timelines with custom shot durations or click **Auto-Reel** for viral edits.
- **Social Media Aspect Ratios**: `9:16` Reels/TikTok, `16:9` YouTube/X, `4:5` IG Portrait, and `1:1` Square with live safe-frame crop guides.
- **Direct Video Export**: Records 60 FPS video with the live playing MP3 soundtrack muxed into the downloaded `.mp4`/`.webm` video.

### 🎵 40-Track Soundtrack Deck & Beat-Sync
- Complete 40-track soundtrack library with transport controls, scrubbing timeline, live Web Audio API 32-bar frequency spectrum visualizer, and **Beat-Sync** (audio-reactive rim lights and beat-matched camera cuts).

---

## Local Development

```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Build for production
npm run build
```

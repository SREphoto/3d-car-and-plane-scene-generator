import React from 'react';
import {
  Car,
  Plane,
  Wrench,
  Camera,
  Music,
  Sliders,
  Layers,
  Sparkles,
  Sun,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  Snowflake,
  Wind,
  Square,
  Maximize2,
  Move,
  RotateCw,
  Gamepad2,
  RefreshCw,
  MousePointer2,
} from 'lucide-react';
import { ASPECT_RATIOS } from '../recorder/VideoExporter';
import { CARS_CATALOG, PLANES_CATALOG, PARTS_CATALOG } from '../data/catalog';

const WEATHER_ICONS = {
  sunny: Sun,
  cloudy: Cloud,
  drizzle: CloudDrizzle,
  thunderstorm: CloudLightning,
  snow: Snowflake,
  blizzard: Wind,
};

export function TopBar({
  mode,
  setMode,
  aspectRatio,
  setAspectRatio,
  safeFrameVisible,
  setSafeFrameVisible,
  activeWeather,
  timeOfDay,
  beatSyncEnabled,
  setBeatSyncEnabled,
  isRecording,
  recordingProgress,
  onStartRecording,
  onStopRecording,
  leftOpen,
  setLeftOpen,
  rightOpen,
  setRightOpen,
  musicOpen,
  setMusicOpen,
  transformMode = 'orbit',
  onChangeTransformMode,
  onResetVehiclePose,
}) {
  const WeatherIcon = WEATHER_ICONS[activeWeather] || Sun;

  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'rgba(6, 9, 15, 0.82)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 40,
      }}
    >
      {/* Left: Brand + Catalog Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              boxShadow: '0 0 8px var(--accent-cyan)',
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: '#ffffff',
            }}
          >
            STUDIO 4K
          </span>
        </div>

        <div style={{ height: '18px', width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Drawer Toggle */}
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 11px',
            background: leftOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${leftOpen ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 'var(--radius-sm)',
            color: leftOpen ? '#ffffff' : 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Toggle Model & Scene Catalog"
        >
          <Layers size={14} />
          <span>CATALOG</span>
        </button>

        {/* Mode Selector Segmented Pill */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            onClick={() => setMode('cars')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              background: mode === 'cars' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: mode === 'cars' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <Car size={13} />
            <span>CARS ({CARS_CATALOG.length})</span>
          </button>
          <button
            onClick={() => setMode('planes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              background: mode === 'planes' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: mode === 'planes' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <Plane size={13} />
            <span>PLANES ({PLANES_CATALOG.length})</span>
          </button>
          <button
            onClick={() => setMode('parts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              background: mode === 'parts' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: mode === 'parts' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <Wrench size={13} />
            <span>PARTS ({PARTS_CATALOG.length})</span>
          </button>
        </div>
      </div>

      {/* Center: Vehicle Move / Drive Controls + Environment Info + Aspect Ratio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Vehicle Placement & Live Drive Segmented Control */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
          }}
        >
          {[
            { id: 'orbit', label: 'ORBIT', icon: MousePointer2, tip: 'Camera Orbit (Esc) • Shift+Click road to place vehicle' },
            { id: 'translate', label: 'MOVE', icon: Move, tip: '3D Move Vehicle Gizmo (W) • Auto-snaps to street/floor' },
            { id: 'rotate', label: 'ROTATE', icon: RotateCw, tip: 'Rotate Vehicle Heading (E)' },
            { id: 'drive', label: 'DRIVE', icon: Gamepad2, tip: 'Live Drive / Fly Mode (G) • Use WASD or Arrow Keys!' },
          ].map((tool) => {
            const Icon = tool.icon;
            const active = transformMode === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => onChangeTransformMode && onChangeTransformMode(tool.id)}
                title={tool.tip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  background: active
                    ? tool.id === 'drive'
                      ? 'rgba(16, 185, 129, 0.24)'
                      : 'rgba(56, 189, 248, 0.22)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: active
                    ? tool.id === 'drive'
                      ? '#34d399'
                      : 'var(--accent-cyan)'
                    : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <Icon size={12} />
                <span>{tool.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => onResetVehiclePose && onResetVehiclePose()}
            title="Reset Vehicle to Scene Hero Spawn"
            style={{
              padding: '4px 6px',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={11} />
          </button>
        </div>

        {/* Environment Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 'var(--radius-full)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          <WeatherIcon size={12} color="var(--accent-amber)" />
          <span style={{ textTransform: 'capitalize', fontWeight: 500, color: '#e2e8f0' }}>{activeWeather}</span>
          <span style={{ opacity: 0.3 }}>•</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#ffffff' }}>{timeFormatted}</span>
        </div>

        {/* Aspect Ratio Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {ASPECT_RATIOS.map((item) => {
            const isSelected = aspectRatio === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setAspectRatio(item.id)}
                style={{
                  padding: '4px 8px',
                  background: isSelected ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                title={item.label}
              >
                {item.id}
              </button>
            );
          })}

          <button
            onClick={() => setSafeFrameVisible(!safeFrameVisible)}
            style={{
              padding: '4px 6px',
              background: safeFrameVisible ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              color: safeFrameVisible ? 'var(--accent-amber)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Toggle Framing Guide Lines"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>

      {/* Right: Audio + Record + Studio Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Beat Sync Toggle */}
        <button
          onClick={() => setBeatSyncEnabled(!beatSyncEnabled)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            background: beatSyncEnabled ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${beatSyncEnabled ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 'var(--radius-sm)',
            color: beatSyncEnabled ? '#c084fc' : 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Sync lighting and cuts to music beat"
        >
          <Sparkles size={13} />
          <span>BEAT-SYNC</span>
        </button>

        {/* Music Player Toggle */}
        <button
          onClick={() => setMusicOpen(!musicOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            background: musicOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${musicOpen ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 'var(--radius-sm)',
            color: musicOpen ? '#ffffff' : 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Toggle Soundtrack Player"
        >
          <Music size={13} />
          <span>AUDIO</span>
        </button>

        {/* Record Video Button */}
        {isRecording ? (
          <button
            onClick={onStopRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 13px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Square size={12} className="animate-recording" />
            <span>STOP {recordingProgress ? `${recordingProgress.elapsedSec.toFixed(1)}s` : ''}</span>
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 13px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fb7185',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            title="Record 4K Reel Video"
          >
            <Camera size={13} />
            <span>RECORD REEL</span>
          </button>
        )}

        {/* Studio Controls Drawer Toggle */}
        <button
          onClick={() => setRightOpen(!rightOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: rightOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${rightOpen ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: 'var(--radius-sm)',
            color: rightOpen ? 'var(--accent-cyan)' : '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Toggle Studio Lighting & Camera Controls"
        >
          <Sliders size={13} />
          <span>STUDIO CONTROLS</span>
        </button>
      </div>
    </header>
  );
}

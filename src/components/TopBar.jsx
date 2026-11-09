import React from 'react';
import {
  Car,
  Plane,
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
  Maximize2
} from 'lucide-react';
import { ASPECT_RATIOS } from '../recorder/VideoExporter';

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
}) {
  const WeatherIcon = WEATHER_ICONS[activeWeather] || Sun;

  // Format 24-hour time e.g. 16:30
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <header style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '62px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'rgba(9, 12, 19, 0.78)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      zIndex: 40,
    }}>
      {/* Left section: Drawer Toggle + Brand + Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            background: leftOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${leftOpen ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            color: leftOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Models & Scenes Drawer"
        >
          <Layers size={16} />
          <span>GARAGE & SCENES</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px' }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '1.5px',
            background: 'linear-gradient(135deg, #ffffff 40%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            APEX // AERO
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            STUDIO 4K
          </span>
        </div>

        {/* Cars Mode vs Planes Mode Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            onClick={() => setMode('cars')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: mode === 'cars' ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'transparent',
              color: mode === 'cars' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: mode === 'cars' ? '0 2px 10px rgba(56, 189, 248, 0.35)' : 'none',
            }}
          >
            <Car size={15} />
            <span>CARS (16)</span>
          </button>
          <button
            onClick={() => setMode('planes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: mode === 'planes' ? 'linear-gradient(135deg, #f43f5e, #fb7185)' : 'transparent',
              color: mode === 'planes' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: mode === 'planes' ? '0 2px 10px rgba(244, 63, 94, 0.35)' : 'none',
            }}
          >
            <Plane size={15} />
            <span>PLANES (2)</span>
          </button>
        </div>
      </div>

      {/* Center: Weather & Time Pill + Aspect Ratio Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Weather & Time Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '999px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <WeatherIcon size={14} color="var(--accent-amber)" />
          <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#f1f5f9' }}>{activeWeather}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>{timeFormatted}</span>
        </div>

        {/* Aspect Ratio Selector for Social Media Videos */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          {ASPECT_RATIOS.map((item) => {
            const isSelected = aspectRatio === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setAspectRatio(item.id)}
                style={{
                  padding: '5px 10px',
                  background: isSelected ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  borderRadius: '6px',
                  color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
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
              padding: '5px 8px',
              background: safeFrameVisible ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: safeFrameVisible ? '1px solid var(--accent-amber)' : '1px solid transparent',
              borderRadius: '6px',
              color: safeFrameVisible ? 'var(--accent-amber)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Toggle Social Media Safe-Frame Crop Lines"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Right section: Beat-Sync + Video Record + Drawers Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Beat-Sync Toggle */}
        <button
          onClick={() => setBeatSyncEnabled(!beatSyncEnabled)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 11px',
            background: beatSyncEnabled ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${beatSyncEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            color: beatSyncEnabled ? '#c084fc' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Sync camera cuts & neon lights to music beat"
        >
          <Sparkles size={14} />
          <span>BEAT-SYNC</span>
        </button>

        {/* Music Player Toggle */}
        <button
          onClick={() => setMusicOpen(!musicOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: musicOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${musicOpen ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            color: musicOpen ? 'var(--accent-emerald)' : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Soundtrack Deck"
        >
          <Music size={15} />
          <span>TRACKS (40)</span>
        </button>

        {/* Record Video / Reel Button */}
        {isRecording ? (
          <button
            onClick={onStopRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 16px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.65)',
            }}
          >
            <Square size={14} className="animate-recording" />
            <span>REC {recordingProgress ? `${recordingProgress.elapsedSec.toFixed(1)}s` : ''} • STOP</span>
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 16px',
              background: 'linear-gradient(135deg, #e11d48, #f43f5e)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 14px rgba(244, 63, 94, 0.45)',
              transition: 'transform 0.1s ease',
            }}
            title="Film and export video with music for social media"
          >
            <Camera size={15} />
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
            padding: '7px 12px',
            background: rightOpen ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${rightOpen ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            color: rightOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Studio Controls & Director"
        >
          <Sliders size={16} />
          <span>STUDIO CONTROLS</span>
        </button>
      </div>
    </header>
  );
}

import React, { useState } from 'react';
import {
  CloudSun,
  Sun,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  Snowflake,
  Wind,
  Sliders,
  Video,
  Play,
  Square,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  RotateCw,
  Eye,
  Camera,
  X,
  RefreshCw
} from 'lucide-react';
import { WEATHER_PRESETS, LIGHTING_PRESETS, CAMERA_SHOTS } from '../data/catalog';

const WEATHER_ICONS = {
  sunny: Sun,
  cloudy: Cloud,
  drizzle: CloudDrizzle,
  thunderstorm: CloudLightning,
  snow: Snowflake,
  blizzard: Wind,
};

export function StudioControlsDrawer({
  isOpen,
  onClose,
  mode,
  // Weather & Time
  weatherId,
  onSelectWeather,
  timeOfDay,
  onChangeTimeOfDay,
  autoTimeLapse,
  onToggleTimeLapse,
  snowAccumulation,
  onChangeSnowAccumulation,
  autoAccumulateSnow,
  onToggleAutoSnow,
  onClearSnow,
  onTriggerLightning,
  windSpeed,
  onChangeWindSpeed,
  // Lighting & Dynamics
  lightingState,
  onChangeLightingState,
  onApplyLightingPreset,
  dynamicsState,
  onChangeDynamicsState,
  // Camera & Sequencer
  activeShotId,
  onSelectShot,
  shotSpeed,
  onChangeShotSpeed,
  cameraFov,
  onChangeCameraFov,
  isPlayingSequence,
  onStartSequence,
  onStopSequence,
  sequenceClips,
  onChangeSequenceClips,
  beatSyncEnabled,
}) {
  const [activeTab, setActiveTab] = useState('weather'); // 'weather' | 'lighting' | 'camera'

  if (!isOpen) return null;

  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const availableShots = CAMERA_SHOTS.filter((s) => s.modes.includes(mode));

  const handleAddClip = () => {
    const nextShot = availableShots[Math.min(sequenceClips.length, availableShots.length - 1)] || availableShots[0];
    const newClip = {
      id: `clip-${Date.now()}`,
      shotId: nextShot.id,
      duration: 3.5,
    };
    onChangeSequenceClips([...sequenceClips, newClip]);
  };

  const handleRemoveClip = (idx) => {
    const updated = sequenceClips.filter((_, i) => i !== idx);
    onChangeSequenceClips(updated);
  };

  const handleClipChange = (idx, field, value) => {
    const updated = [...sequenceClips];
    updated[idx] = { ...updated[idx], [field]: value };
    onChangeSequenceClips(updated);
  };

  const handleAutoGenerateReel = () => {
    if (mode === 'cars') {
      onChangeSequenceClips([
        { id: `clip-${Date.now()}-1`, shotId: 'low_hero_pan', duration: 3.5 },
        { id: `clip-${Date.now()}-2`, shotId: 'vertigo_dolly_zoom', duration: 3.5 },
        { id: `clip-${Date.now()}-3`, shotId: 'crane_reveal', duration: 4.0 },
        { id: `clip-${Date.now()}-4`, shotId: 'orbit_360', duration: 4.5 },
      ]);
    } else {
      onChangeSequenceClips([
        { id: `clip-${Date.now()}-1`, shotId: 'plane_wingtip_to_nose', duration: 4.5 },
        { id: `clip-${Date.now()}-2`, shotId: 'plane_flyby_underpass', duration: 4.0 },
        { id: `clip-${Date.now()}-3`, shotId: 'vertigo_dolly_zoom', duration: 3.5 },
        { id: `clip-${Date.now()}-4`, shotId: 'plane_runway_takeoff', duration: 4.5 },
      ]);
    }
  };

  const totalDuration = sequenceClips.reduce((acc, c) => acc + (Number(c.duration) || 3.5), 0);

  return (
    <aside style={{
      position: 'absolute',
      top: '62px',
      right: 0,
      bottom: 0,
      width: '420px',
      background: 'rgba(10, 14, 23, 0.9)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 35,
      boxShadow: 'var(--shadow-panel)',
    }}>
      {/* Header Tabs */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('weather')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              background: activeTab === 'weather' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
              border: `1px solid ${activeTab === 'weather' ? 'var(--accent-amber)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'weather' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <CloudSun size={14} />
            <span>WEATHER & 24H</span>
          </button>

          <button
            onClick={() => setActiveTab('lighting')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              background: activeTab === 'lighting' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              border: `1px solid ${activeTab === 'lighting' ? 'var(--accent-cyan)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'lighting' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sliders size={14} />
            <span>LIGHTS & FX</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              background: activeTab === 'camera' ? 'rgba(244, 63, 94, 0.18)' : 'transparent',
              border: `1px solid ${activeTab === 'camera' ? 'var(--accent-rose)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'camera' ? 'var(--accent-rose)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Video size={14} />
            <span>DIRECTOR</span>
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ================= TAB 1: WEATHER & 24H TIME-OF-DAY ================= */}
        {activeTab === 'weather' && (
          <>
            {/* 6 Weather Presets Grid */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                OUTDOOR WEATHER STATES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {WEATHER_PRESETS.map((w) => {
                  const Icon = WEATHER_ICONS[w.id] || Sun;
                  const isSelected = weatherId === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => onSelectWeather(w.id)}
                      style={{
                        padding: '10px 8px',
                        background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <Icon size={20} color={isSelected ? 'var(--accent-amber)' : '#94a3b8'} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}>
                        {w.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 24-Hour Time-of-Day */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>24-HOUR SOLAR CYCLE</span>
                <span style={{
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  {timeFormatted}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="24"
                step="0.1"
                value={timeOfDay}
                onChange={(e) => onChangeTimeOfDay(parseFloat(e.target.value))}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>00:00 (NIGHT)</span>
                <span>06:00 (DAWN)</span>
                <span>12:00 (NOON)</span>
                <span>18:30 (SUNSET)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Auto Time-Lapse</span>
                <button
                  onClick={onToggleTimeLapse}
                  style={{
                    padding: '5px 12px',
                    background: autoTimeLapse ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${autoTimeLapse ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: autoTimeLapse ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {autoTimeLapse ? 'RUNNING' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Snow Accumulation on Ground & Vehicle (+Y Surfaces) */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Snowflake size={15} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>SNOW ACCUMULATION</span>
                </div>
                <span style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                }}>
                  {Math.round(snowAccumulation * 100)}%
                </span>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Real-time shader blends snow over the terrain, road shoulders, and top surfaces of the Car or Plane.
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={snowAccumulation}
                onChange={(e) => onChangeSnowAccumulation(parseFloat(e.target.value))}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onToggleAutoSnow}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    background: autoAccumulateSnow ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${autoAccumulateSnow ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: autoAccumulateSnow ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {autoAccumulateSnow ? 'Auto-Buildup ON' : 'Auto-Buildup OFF'}
                </button>
                <button
                  onClick={onClearSnow}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    borderRadius: '6px',
                    color: 'var(--accent-rose)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Melt / Clear
                </button>
              </div>
            </div>

            {/* Thunderstorm Lightning Strike Action */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>THUNDERSTORM FX</span>
                <button
                  onClick={onTriggerLightning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <Zap size={13} />
                  <span>STRIKE LIGHTNING</span>
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Wind Speed & Squall Turbulence</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(windSpeed * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={windSpeed}
                  onChange={(e) => onChangeWindSpeed(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: LIGHTING & DYNAMICS ================= */}
        {activeTab === 'lighting' && (
          <>
            {/* Lighting Presets */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                STUDIO LIGHTING PRESETS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {LIGHTING_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onApplyLightingPreset(p)}
                    style={{
                      padding: '10px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Key / Sun Light Sliders */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>KEY / SUN LIGHT</span>
                <input
                  type="color"
                  value={lightingState.keyColor}
                  onChange={(e) => onChangeLightingState({ keyColor: e.target.value })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Azimuth (360° Orbit)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{lightingState.keyAzimuth}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={lightingState.keyAzimuth}
                  onChange={(e) => onChangeLightingState({ keyAzimuth: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Elevation (Height)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{lightingState.keyElevation}°</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={lightingState.keyElevation}
                  onChange={(e) => onChangeLightingState({ keyElevation: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Key Intensity</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{lightingState.keyIntensity.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="6.0"
                  step="0.1"
                  value={lightingState.keyIntensity}
                  onChange={(e) => onChangeLightingState({ keyIntensity: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            {/* Fill & Rim Lights */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>FILL & RIM LIGHTS</span>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Fill Light</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={lightingState.fillColor}
                    onChange={(e) => onChangeLightingState({ fillColor: e.target.value })}
                  />
                  <input
                    type="range"
                    min="0"
                    max="4.0"
                    step="0.1"
                    style={{ width: '80px' }}
                    value={lightingState.fillIntensity}
                    onChange={(e) => onChangeLightingState({ fillIntensity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Rim Silhouette Light</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={lightingState.rimColor}
                    onChange={(e) => onChangeLightingState({ rimColor: e.target.value })}
                  />
                  <input
                    type="range"
                    min="0"
                    max="6.0"
                    step="0.1"
                    style={{ width: '80px' }}
                    value={lightingState.rimIntensity}
                    onChange={(e) => onChangeLightingState({ rimIntensity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Overhead Studio Light Sweep</span>
                <button
                  onClick={() => onChangeLightingState({ lightSweep: !lightingState.lightSweep })}
                  style={{
                    padding: '4px 10px',
                    background: lightingState.lightSweep ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${lightingState.lightSweep ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: lightingState.lightSweep ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {lightingState.lightSweep ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Vehicle & Plane Dynamics Toggles */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>LIVE VEHICLE & PLANE DYNAMICS</span>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Headlights & Spotlights</span>
                <button
                  onClick={() => onChangeDynamicsState({ headlightsOn: !dynamicsState.headlightsOn })}
                  style={{
                    padding: '4px 10px',
                    background: dynamicsState.headlightsOn ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${dynamicsState.headlightsOn ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: dynamicsState.headlightsOn ? 'var(--accent-amber)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {dynamicsState.headlightsOn ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Wheel Spin & Motion Speed</span>
                <button
                  onClick={() => onChangeDynamicsState({ wheelSpin: !dynamicsState.wheelSpin })}
                  style={{
                    padding: '4px 10px',
                    background: dynamicsState.wheelSpin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${dynamicsState.wheelSpin ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: dynamicsState.wheelSpin ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {dynamicsState.wheelSpin ? 'SPINNING' : 'STOPPED'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Aero Wind Tunnel Streamlines</span>
                <button
                  onClick={() => onChangeDynamicsState({ aeroStreamlines: !dynamicsState.aeroStreamlines })}
                  style={{
                    padding: '4px 10px',
                    background: dynamicsState.aeroStreamlines ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${dynamicsState.aeroStreamlines ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: dynamicsState.aeroStreamlines ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {dynamicsState.aeroStreamlines ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {mode === 'planes' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Flight Banking & Pitch</span>
                    <button
                      onClick={() => onChangeDynamicsState({ planeBanking: !dynamicsState.planeBanking })}
                      style={{
                        padding: '4px 10px',
                        background: dynamicsState.planeBanking ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${dynamicsState.planeBanking ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        color: dynamicsState.planeBanking ? 'var(--accent-rose)' : 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {dynamicsState.planeBanking ? 'BANKING' : 'OFF'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Jet Engine & Wing Contrails</span>
                    <button
                      onClick={() => onChangeDynamicsState({ planeContrails: !dynamicsState.planeContrails })}
                      style={{
                        padding: '4px 10px',
                        background: dynamicsState.planeContrails ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${dynamicsState.planeContrails ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        color: dynamicsState.planeContrails ? 'var(--accent-rose)' : 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {dynamicsState.planeContrails ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ================= TAB 3: CAMERA DIRECTOR & REEL SEQUENCER ================= */}
        {activeTab === 'camera' && (
          <>
            {/* Camera Moves Grid */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                SINGLE CAMERA SHOT PRESETS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableShots.map((shot) => {
                  const isSelected = activeShotId === shot.id;
                  return (
                    <button
                      key={shot.id}
                      onClick={() => onSelectShot(shot.id)}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? 'rgba(244, 63, 94, 0.16)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                          {shot.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {shot.description}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: isSelected ? 'var(--accent-rose)' : 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        {shot.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camera Speed & FOV */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Camera Movement Speed</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{shotSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={shotSpeed}
                  onChange={(e) => onChangeShotSpeed(parseFloat(e.target.value))}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Base Lens Field of View (FOV)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{cameraFov}°</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="75"
                  value={cameraFov}
                  onChange={(e) => onChangeCameraFov(parseInt(e.target.value))}
                />
              </div>
            </div>

            {/* Multi-Shot Auto-Director Timeline */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>MULTI-SHOT REEL SEQUENCER</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Total Runtime: {totalDuration.toFixed(1)}s
                  </div>
                </div>
                <button
                  onClick={handleAutoGenerateReel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    background: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: '6px',
                    color: '#c084fc',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={12} />
                  <span>Auto-Reel</span>
                </button>
              </div>

              {/* Clip List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sequenceClips.map((clip, idx) => (
                  <div
                    key={clip.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0, 0, 0, 0.45)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '18px' }}>
                      #{idx + 1}
                    </span>
                    <select
                      value={clip.shotId}
                      onChange={(e) => handleClipChange(idx, 'shotId', e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '11px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {availableShots.filter((s) => s.id !== 'free_orbit').map((s) => (
                        <option key={s.id} value={s.id} style={{ background: '#0f172a' }}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      max="15"
                      step="0.5"
                      value={clip.duration}
                      onChange={(e) => handleClipChange(idx, 'duration', parseFloat(e.target.value))}
                      style={{
                        width: '44px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'var(--accent-cyan)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        padding: '3px 4px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>s</span>

                    {sequenceClips.length > 1 && (
                      <button
                        onClick={() => handleRemoveClip(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAddClip}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} />
                  <span>Add Shot</span>
                </button>

                {isPlayingSequence ? (
                  <button
                    onClick={onStopSequence}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '7px',
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Square size={13} />
                    <span>Stop Sequence</span>
                  </button>
                ) : (
                  <button
                    onClick={onStartSequence}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '7px',
                      background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={13} />
                    <span>Preview Reel</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

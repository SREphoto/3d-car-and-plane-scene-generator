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
  RefreshCw,
  Palette,
  Moon,
  Droplets,
  Move,
  Gamepad2,
  MousePointer2,
} from 'lucide-react';
import {
  WEATHER_PRESETS,
  LIGHTING_PRESETS,
  SCENE_FILM_PRESETS,
  CAMERA_SHOTS,
  CAR_PAINT_COLORS,
  CAR_PAINT_FINISHES,
} from '../data/catalog';

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
  activeSceneId,
  onApplySceneFilmPreset,
  dynamicsState,
  onChangeDynamicsState,
  // Paint & Shading
  paintColor = '#b91c1c',
  onChangePaintColor,
  paintFinish = 'metallic',
  onChangePaintFinish,
  onResetFactoryPaint,
  underglowOn = false,
  onToggleUnderglow,
  underglowColor = '#00f5d4',
  onChangeUnderglowColor,
  // Vehicle Placement & Motion
  transformMode = 'orbit',
  onChangeTransformMode,
  vehiclePose = { x: 0, y: 0, z: 0, yawDeg: 0 },
  onChangeVehiclePose,
  snapToGround = true,
  onToggleSnapToGround,
  alignToSlope = false,
  onToggleAlignToSlope,
  onResetVehiclePose,
  // Post-FX
  postFx = { bloom: 0.16, vignette: 0.3, contrast: 1.08, blackLevel: 0.01 },
  onChangePostFx,
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
  const [activeTab, setActiveTab] = useState('lighting'); // 'weather' | 'lighting' | 'paint' | 'camera'

  if (!isOpen) return null;

  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const activeScenePresets =
    activeSceneId && SCENE_FILM_PRESETS[activeSceneId]
      ? SCENE_FILM_PRESETS[activeSceneId]
      : null;

  const isGarageScene =
    activeSceneId === 'car_garage' ||
    activeSceneId === 'red_bull_f1_garage' ||
    activeSceneId === 'f1_pit_garage' ||
    activeSceneId === 'desert_workshop_garage' ||
    activeSceneId === 'cyberpunk_garage';

  const availableShots = [...CAMERA_SHOTS]
    .filter((s) => s.modes.includes(mode))
    .sort((a, b) => {
      // Prioritize shots tailored to the active scene
      const aMatch =
        (activeSceneId === 'interior_7' && a.id.startsWith('loft_')) ||
        (isGarageScene && a.id.startsWith('garage_')) ||
        (activeSceneId === 'abandoned_vr_gallery' && a.id.startsWith('gallery_')) ||
        (activeSceneId === 'wind_tunnel' && a.id.startsWith('wind_'));
      const bMatch =
        (activeSceneId === 'interior_7' && b.id.startsWith('loft_')) ||
        (isGarageScene && b.id.startsWith('garage_')) ||
        (activeSceneId === 'abandoned_vr_gallery' && b.id.startsWith('gallery_')) ||
        (activeSceneId === 'wind_tunnel' && b.id.startsWith('wind_'));
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

  const handleAddClip = () => {
    const nextShot =
      availableShots[Math.min(sequenceClips.length, availableShots.length - 1)] ||
      availableShots[0];
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
    <aside
      style={{
        position: 'absolute',
        top: '62px',
        right: 0,
        bottom: 0,
        width: '430px',
        background: 'rgba(7, 10, 18, 0.94)',
        backdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 35,
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      {/* Header Tabs */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('lighting')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'lighting' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: `1px solid ${activeTab === 'lighting' ? 'var(--accent-cyan)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'lighting' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} />
            <span>LIGHTS & FX</span>
          </button>

          <button
            onClick={() => setActiveTab('paint')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'paint' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
              border: `1px solid ${activeTab === 'paint' ? '#c084fc' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'paint' ? '#c084fc' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Palette size={13} />
            <span>PAINT</span>
          </button>

          <button
            onClick={() => setActiveTab('move')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'move' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              border: `1px solid ${activeTab === 'move' ? '#34d399' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'move' ? '#34d399' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Move size={13} />
            <span>MOVE / DRIVE</span>
          </button>

          <button
            onClick={() => setActiveTab('weather')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'weather' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: `1px solid ${activeTab === 'weather' ? 'var(--accent-amber)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'weather' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <CloudSun size={13} />
            <span>WEATHER</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'camera' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
              border: `1px solid ${activeTab === 'camera' ? 'var(--accent-rose)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'camera' ? 'var(--accent-rose)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Video size={13} />
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
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* ================= TAB: LIGHTING & CINEMATIC FX ================= */}
        {activeTab === 'lighting' && (
          <>
            {/* Location-Specific Matched Film Moods */}
            {activeScenePresets && activeScenePresets.length > 0 && (
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.08), rgba(15, 23, 42, 0.4))',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#38bdf8',
                    marginBottom: '10px',
                    letterSpacing: '0.6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} color="#38bdf8" />
                  <span>LOCATION FILM MOODS (MATCHED LIGHTING)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeScenePresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onApplySceneFilmPreset && onApplySceneFilmPreset(p.id)}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{p.name}</span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            borderRadius: '4px',
                            letterSpacing: '0.4px',
                          }}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dark & Moody Presets */}
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Moon size={14} color="#38bdf8" />
                <span>CINEMATIC LIGHTING PRESETS</span>
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

            {/* Cinematic Post-Processing Controls */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  CINEMATIC POST-FX
                </span>
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  UNREAL BLOOM + GRADING
                </span>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Anamorphic Bloom Glow</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round(((postFx.bloom ?? 0.16) / 0.8) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.02"
                  value={postFx.bloom ?? 0.16}
                  onChange={(e) =>
                    onChangePostFx({ ...postFx, bloom: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Black Level Depth (Crush Blacks)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round((postFx.blackLevel || 0.04) * 500)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.12"
                  step="0.005"
                  value={postFx.blackLevel || 0.04}
                  onChange={(e) =>
                    onChangePostFx({ ...postFx, blackLevel: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Cinema Lens Vignette</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round((postFx.vignette || 0.45) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={postFx.vignette || 0.45}
                  onChange={(e) =>
                    onChangePostFx({ ...postFx, vignette: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Film Contrast Curve</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {(postFx.contrast || 1.22).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.9"
                  max="1.7"
                  step="0.02"
                  value={postFx.contrast || 1.22}
                  onChange={(e) =>
                    onChangePostFx({ ...postFx, contrast: parseFloat(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* Studio Floor & Environment Refinement */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  STUDIO STAGE & REFLECTIONS
                </span>
                <Droplets size={14} color="#38bdf8" />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Wet Obsidian Mirror Wetness</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round(lightingState.floorWetness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.02"
                  value={lightingState.floorWetness}
                  onChange={(e) =>
                    onChangeLightingState({ floorWetness: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Master Scene Exposure (Brightness)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {(lightingState.exposure ?? 1.0).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={lightingState.exposure ?? 1.0}
                  onChange={(e) =>
                    onChangeLightingState({ exposure: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Surrounding Scene Lighting (Ambient & IBL)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {(lightingState.ambientIntensity ?? 0.6).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={lightingState.ambientIntensity ?? 0.6}
                  onChange={(e) =>
                    onChangeLightingState({ ambientIntensity: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Overhead Softbox Intensity</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {lightingState.softboxIntensity || 2.5}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="6.0"
                  step="0.2"
                  value={lightingState.softboxIntensity || 2.5}
                  onChange={(e) =>
                    onChangeLightingState({ softboxIntensity: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Cinematic Light Sweep
                </span>
                <button
                  onClick={() =>
                    onChangeLightingState({ lightSweep: !lightingState.lightSweep })
                  }
                  style={{
                    padding: '4px 10px',
                    background: lightingState.lightSweep
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${lightingState.lightSweep ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: lightingState.lightSweep ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {lightingState.lightSweep ? 'SWEEPING' : 'STATIC'}
                </button>
              </div>
            </div>

            {/* Key / Rim Directional Light Controls */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  KEY SPOTLIGHT & SHADOW
                </span>
                <input
                  type="color"
                  value={lightingState.keyColor}
                  onChange={(e) => onChangeLightingState({ keyColor: e.target.value })}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Azimuth (360° Orbit)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{lightingState.keyAzimuth}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={lightingState.keyAzimuth}
                  onChange={(e) =>
                    onChangeLightingState({ keyAzimuth: parseInt(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Elevation (Height)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{lightingState.keyElevation}°</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="85"
                  value={lightingState.keyElevation}
                  onChange={(e) =>
                    onChangeLightingState({ keyElevation: parseInt(e.target.value) })
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Intensity</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {lightingState.keyIntensity.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.5"
                  step="0.1"
                  value={lightingState.keyIntensity}
                  onChange={(e) =>
                    onChangeLightingState({ keyIntensity: parseFloat(e.target.value) })
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* ================= TAB: VEHICLE PLACEMENT & LIVE DRIVE ================= */}
        {activeTab === 'move' && (
          <>
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.45))',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(52, 211, 153, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.5px' }}>
                INTERACTIVE VEHICLE MOVEMENT & DRIVING
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {[
                  { id: 'orbit', name: 'Orbit Camera (Esc)', icon: MousePointer2 },
                  { id: 'translate', name: '3D Move Gizmo (W)', icon: Move },
                  { id: 'rotate', name: 'Rotate Heading (E)', icon: RotateCw },
                  { id: 'drive', name: 'Live WASD Drive (G)', icon: Gamepad2 },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = transformMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onChangeTransformMode && onChangeTransformMode(m.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '10px',
                        background: active ? 'rgba(16, 185, 129, 0.22)' : 'rgba(15, 23, 42, 0.8)',
                        border: `1px solid ${active ? '#34d399' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        color: active ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={14} color={active ? '#34d399' : '#94a3b8'} />
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: '1.45', paddingTop: '2px' }}>
                • <strong>Shift + Click</strong> any street or floor surface to place the vehicle there immediately.<br />
                • In <strong>Live Drive (G)</strong> mode, use <strong>WASD</strong> or <strong>Arrow Keys</strong> to steer &amp; drive (<strong>Shift</strong> boost, <strong>Space / C</strong> plane altitude).<br />
                • Gizmo handles hide automatically during <strong>Record Reel</strong>.
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  FINE POSITION & HEADING
                </span>
                <button
                  onClick={() => onResetVehiclePose && onResetVehiclePose()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 9px',
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '5px',
                    color: 'var(--accent-cyan)',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} />
                  <span>Reset to Spawn</span>
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Lateral X Position</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{(vehiclePose.x || 0).toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="0.1"
                  value={vehiclePose.x || 0}
                  onChange={(e) => onChangeVehiclePose && onChangeVehiclePose({ x: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Forward / Back Z Position</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{(vehiclePose.z || 0).toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="0.1"
                  value={vehiclePose.z || 0}
                  onChange={(e) => onChangeVehiclePose && onChangeVehiclePose({ z: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Elevation Y / Altitude</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{(vehiclePose.y || 0).toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="25"
                  step="0.05"
                  value={vehiclePose.y || 0}
                  onChange={(e) => onChangeVehiclePose && onChangeVehiclePose({ y: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Heading Yaw Angle</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(vehiclePose.yawDeg || 0)}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={Math.round(vehiclePose.yawDeg || 0)}
                  onChange={(e) =>
                    onChangeVehiclePose &&
                    onChangeVehiclePose({ yaw: (parseFloat(e.target.value) * Math.PI) / 180 })
                  }
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Auto-Snap Tires to Road / Floor
                </span>
                <button
                  onClick={onToggleSnapToGround}
                  style={{
                    padding: '4px 10px',
                    background: snapToGround ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${snapToGround ? '#34d399' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: snapToGround ? '#34d399' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {snapToGround ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Align Pitch/Roll to Road Slope
                </span>
                <button
                  onClick={onToggleAlignToSlope}
                  style={{
                    padding: '4px 10px',
                    background: alignToSlope ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${alignToSlope ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: alignToSlope ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {alignToSlope ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB: PAINT & SHADING CUSTOMIZER ================= */}
        {activeTab === 'paint' && (
          <>
            {/* Restore Factory Livery / Original Paint */}
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(192, 132, 252, 0.1), rgba(15, 23, 42, 0.45))',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(192, 132, 252, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#e9d5ff' }}>
                  FACTORY RACING LIVERY &amp; OEM PAINT
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Sponsor decals &amp; multi-color liveries stay active until resprayed.
                </div>
              </div>
              <button
                onClick={() => onResetFactoryPaint && onResetFactoryPaint()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 11px',
                  background: 'rgba(192, 132, 252, 0.22)',
                  border: '1px solid #c084fc',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={12} />
                <span>Restore Livery</span>
              </button>
            </div>
            {/* Body Finish Selector */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                AUTOMOTIVE FINISH TYPE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {CAR_PAINT_FINISHES.map((f) => {
                  const isSel = paintFinish === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onChangePaintFinish(f.id)}
                      style={{
                        padding: '10px 8px',
                        background: isSel ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isSel ? '#c084fc' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        color: isSel ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paint Color Swatches */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  BODY PAINT COLOR
                </span>
                <input
                  type="color"
                  value={paintColor}
                  onChange={(e) => onChangePaintColor(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {CAR_PAINT_COLORS.map((c) => {
                  const isSel = paintColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      onClick={() => onChangePaintColor(c.hex)}
                      title={c.name}
                      style={{
                        height: '36px',
                        background: c.hex,
                        borderRadius: '6px',
                        border: isSel ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                        cursor: 'pointer',
                        transform: isSel ? 'scale(1.08)' : 'scale(1)',
                        boxShadow: isSel ? '0 0 12px rgba(255,255,255,0.45)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Headlights & Underglow */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                LIGHTING PROJECTORS & UNDERGLOW
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Forward Headlight Beams
                </span>
                <button
                  onClick={() =>
                    onChangeDynamicsState({ headlightsOn: !dynamicsState.headlightsOn })
                  }
                  style={{
                    padding: '4px 10px',
                    background: dynamicsState.headlightsOn
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${dynamicsState.headlightsOn ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: dynamicsState.headlightsOn ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {dynamicsState.headlightsOn ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Chassis Neon Underglow
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={underglowColor}
                    onChange={(e) => onChangeUnderglowColor(e.target.value)}
                  />
                  <button
                    onClick={onToggleUnderglow}
                    style={{
                      padding: '4px 10px',
                      background: underglowOn
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${underglowOn ? '#c084fc' : 'var(--border-subtle)'}`,
                      borderRadius: '6px',
                      color: underglowOn ? '#c084fc' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {underglowOn ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB: WEATHER & 24H TIME-OF-DAY ================= */}
        {activeTab === 'weather' && (
          <>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                  letterSpacing: '0.5px',
                }}
              >
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
                      }}
                    >
                      <Icon size={18} color={isSelected ? 'var(--accent-amber)' : 'var(--text-secondary)'} />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        {w.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 24h Time-of-Day Slider */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  24-HOUR SOLAR ARC
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--accent-amber)',
                    fontWeight: 700,
                  }}
                >
                  {timeFormatted}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="24"
                step="0.05"
                value={timeOfDay}
                onChange={(e) => onChangeTimeOfDay(parseFloat(e.target.value))}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Continuous Time-Lapse
                </span>
                <button
                  onClick={onToggleTimeLapse}
                  style={{
                    padding: '4px 10px',
                    background: autoTimeLapse
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${autoTimeLapse ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    color: autoTimeLapse ? 'var(--accent-amber)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {autoTimeLapse ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>
            </div>

            {/* Snow Accumulation Slider */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  SNOW ACCUMULATION SHADER
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                  }}
                >
                  {Math.round(snowAccumulation * 100)}%
                </span>
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
                    background: autoAccumulateSnow
                      ? 'rgba(56, 189, 248, 0.18)'
                      : 'rgba(255, 255, 255, 0.05)',
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

            {/* Lightning Strike Action */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                  THUNDERSTORM FX
                </span>
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
                  }}
                >
                  <Zap size={13} />
                  <span>STRIKE LIGHTNING</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB: CAMERA DIRECTOR & REEL SEQUENCER ================= */}
        {activeTab === 'camera' && (
          <>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                  letterSpacing: '0.5px',
                }}
              >
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
                        background: isSelected ? 'rgba(244, 63, 94, 0.2)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                          }}
                        >
                          {shot.name}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isSelected
                              ? 'var(--accent-rose)'
                              : 'rgba(255, 255, 255, 0.08)',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {shot.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                        {shot.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sequence Clips Manager */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                    MULTI-SHOT REEL SEQUENCER
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {sequenceClips.length} shots • {totalDuration.toFixed(1)}s runtime
                  </div>
                </div>

                <button
                  onClick={handleAutoGenerateReel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    borderRadius: '6px',
                    color: 'var(--accent-rose)',
                    fontSize: '11px',
                    fontWeight: 700,
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
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        width: '18px',
                      }}
                    >
                      #{idx + 1}
                    </span>

                    <select
                      value={clip.shotId}
                      onChange={(e) => handleClipChange(idx, 'shotId', e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontSize: '11px',
                        padding: '4px 6px',
                      }}
                    >
                      {availableShots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="0.5"
                      value={clip.duration}
                      onChange={(e) =>
                        handleClipChange(idx, 'duration', parseFloat(e.target.value))
                      }
                      style={{
                        width: '52px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontSize: '11px',
                        padding: '4px 6px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>s</span>

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
                    gap: '6px',
                    padding: '7px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} />
                  <span>Add Shot Clip</span>
                </button>

                <button
                  onClick={isPlayingSequence ? onStopSequence : onStartSequence}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '7px',
                    background: isPlayingSequence
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, #f43f5e, #be123c)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isPlayingSequence ? <Square size={13} /> : <Play size={13} />}
                  <span>{isPlayingSequence ? 'Stop Preview' : 'Play Sequence'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

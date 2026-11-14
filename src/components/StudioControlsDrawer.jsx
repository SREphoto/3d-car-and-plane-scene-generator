import React, { useState } from 'react';
import {
  Sliders,
  Video,
  Play,
  Square,
  Plus,
  Trash2,
  Sparkles,
  RotateCw,
  Eye,
  Camera,
  Aperture,
  Crosshair,
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
  LIGHTING_PRESETS,
  SCENE_FILM_PRESETS,
  CAMERA_SHOTS,
  CAMERA_LENSES,
  CAR_PAINT_COLORS,
  CAR_PAINT_FINISHES,
} from '../data/catalog';
import { STUDIO_LOOK_PRESETS, STUDIO_FLOOR_FINISHES } from '../engine/ProceduralStages';

export function StudioControlsDrawer({
  isOpen,
  onClose,
  activeTab: controlledTab,
  onChangeActiveTab,
  mode,
  // Pro Cyclorama Studio & Lenses/DoF
  proStudioState = {},
  onChangeProStudioState,
  onApplyProStudioPreset,
  lensState = {},
  onSelectLens,
  onChangeLensState,
  onJumpToScene,
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
  const [localTab, setLocalTab] = useState('lighting');
  const activeTab = controlledTab || localTab;
  const setActiveTab = (t) => {
    setLocalTab(t);
    if (onChangeActiveTab) onChangeActiveTab(t);
  };

  if (!isOpen) return null;

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
        width: 'min(430px, 100vw)',
        maxWidth: '100vw',
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
            onClick={() => setActiveTab('lenses')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 9px',
              background: activeTab === 'lenses' ? 'rgba(245, 158, 11, 0.22)' : 'transparent',
              border: `1px solid ${activeTab === 'lenses' ? 'var(--accent-amber)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === 'lenses' ? '#fbbf24' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Aperture size={13} />
            <span>LENSES / DOF</span>
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
        {/* ================= TAB: LENSES & LINEAR-HDR OPTICAL BOKEH ================= */}
        {activeTab === 'lenses' && (
          <>
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.55))',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Aperture size={15} color="#fbbf24" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>
                    CANON L-SERIES PRIME & TELEPHOTO KIT
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(245, 158, 11, 0.22)',
                    color: '#fde68a',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  AUTO-DOLLY
                </span>
              </div>

              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                Switching focal length automatically dollies the camera back on a 36×24mm full-frame sensor so your car stays framed while compressing the background.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px' }}>
                {CAMERA_LENSES.map((lens) => {
                  const selected = lensState.lensId === lens.id;
                  return (
                    <button
                      key={lens.id}
                      onClick={() => onSelectLens && onSelectLens(lens)}
                      style={{
                        padding: '9px 10px',
                        background: selected ? 'rgba(245, 158, 11, 0.24)' : 'rgba(15, 23, 42, 0.82)',
                        border: `1px solid ${selected ? '#fbbf24' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: selected ? '#ffffff' : '#e2e8f0' }}>
                          {lens.shortLabel}
                        </span>
                        <span
                          style={{
                            fontSize: '8px',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: selected ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                            color: selected ? '#090d16' : '#94a3b8',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {lens.badge}
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{lens.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optical Depth of Field & Focus Controls */}
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                    OPTICAL DEPTH OF FIELD (HDR BOKEH)
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    {lensState.focalLengthMm ? `${lensState.focalLengthMm}mm` : '31mm'} • f/{lensState.fStop ?? 2.8} • Focus {(lensState.currentFocusDistance ?? 5.5).toFixed(2)}m
                  </div>
                </div>
                <button
                  onClick={() =>
                    onChangeLensState &&
                    onChangeLensState({ dofEnabled: !lensState.dofEnabled })
                  }
                  style={{
                    padding: '6px 12px',
                    background: lensState.dofEnabled
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {lensState.dofEnabled ? 'DOF ACTIVE' : 'ENABLE DOF'}
                </button>
              </div>

              {/* Focus Mode Segmented Control */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Focus Tracking Mode
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    {
                      id: 'auto',
                      label: 'Auto Car AF',
                      active: lensState.focusMode === 'auto' && !lensState.clickFocusArmed,
                      onClick: () =>
                        onChangeLensState &&
                        onChangeLensState({ dofEnabled: true, focusMode: 'auto', clickFocusArmed: false }),
                    },
                    {
                      id: 'click',
                      label: 'Click-to-Focus',
                      active: Boolean(lensState.clickFocusArmed),
                      onClick: () =>
                        onChangeLensState &&
                        onChangeLensState({
                          dofEnabled: true,
                          clickFocusArmed: !lensState.clickFocusArmed,
                        }),
                    },
                    {
                      id: 'manual',
                      label: 'Manual Pull',
                      active: lensState.focusMode === 'manual' && !lensState.clickFocusArmed,
                      onClick: () =>
                        onChangeLensState &&
                        onChangeLensState({
                          dofEnabled: true,
                          focusMode: 'manual',
                          clickFocusArmed: false,
                          manualFocusDistance: lensState.currentFocusDistance || 5.5,
                        }),
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={m.onClick}
                      style={{
                        padding: '7px 8px',
                        background: m.active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${m.active ? '#fbbf24' : 'var(--border-subtle)'}`,
                        borderRadius: '5px',
                        color: m.active ? '#fde68a' : 'var(--text-secondary)',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>
                  Tip: Hold <strong style={{ color: '#e2e8f0' }}>Alt + Click</strong> anywhere on the 3D viewport at any time to rack focus onto a headlight, badge, or distant streetlamp.
                </div>
              </div>

              {/* Aperture Slider + Quick Stops */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Aperture Iris (Shallow ↔ Deep)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24', fontWeight: 700 }}>
                    f/{Number(lensState.fStop ?? 2.8).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="16"
                  step="0.1"
                  value={lensState.fStop ?? 2.8}
                  onChange={(e) =>
                    onChangeLensState &&
                    onChangeLensState({ dofEnabled: true, fStop: parseFloat(e.target.value) })
                  }
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {[1.2, 1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 16.0].map((stop) => (
                    <button
                      key={stop}
                      onClick={() =>
                        onChangeLensState && onChangeLensState({ dofEnabled: true, fStop: stop })
                      }
                      style={{
                        padding: '3px 7px',
                        background:
                          Math.abs((lensState.fStop ?? 2.8) - stop) < 0.08
                            ? 'rgba(245, 158, 11, 0.25)'
                            : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        color: '#e2e8f0',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                      }}
                    >
                      f/{stop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Focus Distance Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Focus Distance {lensState.focusMode === 'auto' ? '(Auto-Tracking Car)' : '(Manual Locked)'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {(lensState.focusMode === 'manual'
                      ? lensState.manualFocusDistance ?? 5.5
                      : lensState.currentFocusDistance ?? 5.5
                    ).toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="65.0"
                  step="0.1"
                  value={
                    lensState.focusMode === 'manual'
                      ? lensState.manualFocusDistance ?? 5.5
                      : lensState.currentFocusDistance ?? 5.5
                  }
                  onChange={(e) => {
                    const d = parseFloat(e.target.value);
                    if (onChangeLensState) {
                      onChangeLensState({
                        dofEnabled: true,
                        focusMode: 'manual',
                        manualFocusDistance: d,
                        currentFocusDistance: d,
                      });
                    }
                  }}
                />
              </div>

              {/* Night HDR Bokeh Specular Highlight Boost */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Night HDR Bokeh Disc Intensity</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {Number(lensState.bokehBoost ?? 1.55).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.5"
                  step="0.05"
                  value={lensState.bokehBoost ?? 1.55}
                  onChange={(e) =>
                    onChangeLensState &&
                    onChangeLensState({ bokehBoost: parseFloat(e.target.value) })
                  }
                />
              </div>

              {activeSceneId !== 'wet_night_bokeh_street' && (
                <button
                  onClick={() => {
                    if (onJumpToScene) onJumpToScene('wet_night_bokeh_street');
                    const tele85 = CAMERA_LENSES.find((l) => l.id === '85mm_f12');
                    if (tele85 && onSelectLens) onSelectLens(tele85);
                  }}
                  style={{
                    padding: '9px 12px',
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.22), rgba(236, 72, 153, 0.22))',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                  }}
                >
                  <Crosshair size={13} color="#38bdf8" />
                  <span>Test Wet-Night Neon Bokeh + Canon 85mm f/1.2L</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* ================= TAB: LIGHTING & CINEMATIC FX ================= */}
        {activeTab === 'lighting' && (
          <>
            {/* Interactive Pro Cyclorama Lighting Studio Rig */}
            {activeSceneId === 'pro_lighting_studio' ? (
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.6))',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#38bdf8" />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>
                      PRO CYCLORAMA LIGHTING STUDIO
                    </span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    LIVE CLEARCOAT IBL
                  </span>
                </div>

                {/* 1-Click Studio Looks */}
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    1-Click Commercial Studio Looks
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {Object.values(STUDIO_LOOK_PRESETS).map((look) => {
                      const active = proStudioState.presetId === look.id;
                      return (
                        <button
                          key={look.id}
                          onClick={() => onApplyProStudioPreset && onApplyProStudioPreset(look.id)}
                          style={{
                            padding: '8px 10px',
                            background: active ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.85)',
                            border: `1px solid ${active ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '5px',
                            color: active ? '#ffffff' : '#cbd5e1',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {look.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cyclorama Floor Finish Switcher */}
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Cyclorama Cove Floor Finish
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {STUDIO_FLOOR_FINISHES.map((fl) => {
                      const active = proStudioState.floorFinish === fl.id;
                      return (
                        <button
                          key={fl.id}
                          onClick={() =>
                            onChangeProStudioState && onChangeProStudioState({ floorFinish: fl.id })
                          }
                          style={{
                            padding: '7px 9px',
                            background: active ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${active ? '#c084fc' : 'rgba(255, 255, 255, 0.09)'}`,
                            borderRadius: '5px',
                            color: active ? '#f3e8ff' : '#94a3b8',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {fl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Individual Studio Fixtures */}
                {[
                  { label: 'Overhead Softbox Scrim', intKey: 'overheadIntensity', colKey: 'overheadColor', max: 4.0 },
                  { label: 'Left Strip Rim Bank', intKey: 'leftRimIntensity', colKey: 'leftRimColor', max: 4.0 },
                  { label: 'Right Strip Rim Bank', intKey: 'rightRimIntensity', colKey: 'rightRimColor', max: 4.0 },
                  { label: 'Macro Ring Light', intKey: 'ringLightIntensity', colKey: 'ringLightColor', max: 4.0 },
                  { label: 'Venetian Blind Gobo', intKey: 'goboIntensity', colKey: 'goboColor', max: 5.0 },
                ].map((fx) => (
                  <div key={fx.intKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#e2e8f0' }}>
                      <span>{fx.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="color"
                          value={proStudioState[fx.colKey] || '#ffffff'}
                          onChange={(e) =>
                            onChangeProStudioState &&
                            onChangeProStudioState({ [fx.colKey]: e.target.value })
                          }
                          style={{ width: '22px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', width: '34px', textAlign: 'right' }}>
                          {Number(proStudioState[fx.intKey] ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={fx.max}
                      step="0.05"
                      value={proStudioState[fx.intKey] ?? 0}
                      onChange={(e) =>
                        onChangeProStudioState &&
                        onChangeProStudioState({ [fx.intKey]: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                ))}

                {/* Backdrop Wall Tint & Motorized Turntable */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Cyc Backdrop</span>
                    <input
                      type="color"
                      value={proStudioState.cycWallColor || '#dcdfe6'}
                      onChange={(e) =>
                        onChangeProStudioState &&
                        onChangeProStudioState({ cycWallColor: e.target.value })
                      }
                      style={{ width: '24px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  </div>
                  <button
                    onClick={() =>
                      onChangeProStudioState &&
                      onChangeProStudioState({ turntableEnabled: !proStudioState.turntableEnabled })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      background: proStudioState.turntableEnabled
                        ? 'rgba(16, 185, 129, 0.22)'
                        : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${proStudioState.turntableEnabled ? '#34d399' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: '5px',
                      color: proStudioState.turntableEnabled ? '#34d399' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCw size={12} />
                    <span>{proStudioState.turntableEnabled ? 'Turntable ON' : 'Turntable OFF'}</span>
                  </button>
                </div>

                {proStudioState.turntableEnabled && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', marginBottom: '3px' }}>
                      <span>Turntable Rotation Speed</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {Number(proStudioState.turntableSpeed ?? 0.25).toFixed(2)} rad/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.2"
                      step="0.02"
                      value={proStudioState.turntableSpeed ?? 0.25}
                      onChange={(e) =>
                        onChangeProStudioState &&
                        onChangeProStudioState({ turntableSpeed: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onJumpToScene && onJumpToScene('pro_lighting_studio')}
                style={{
                  padding: '11px 14px',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(168, 85, 247, 0.16))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  color: '#f8fafc',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Switch to Pro Cyclorama Lighting Studio</span>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>5 RIGS →</span>
              </button>
            )}

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

import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './engine/SceneManager';
import { STUDIO_LOOK_PRESETS } from './engine/ProceduralStages';
import { MusicEngine } from './audio/MusicEngine';
import { VideoExporter, ASPECT_RATIOS } from './recorder/VideoExporter';
import {
  CARS_CATALOG,
  PLANES_CATALOG,
  PARTS_CATALOG,
  SCENES_CATALOG,
  MUSIC_CATALOG,
  CAMERA_LENSES,
} from './data/catalog';
import { TopBar } from './components/TopBar';
import { ModelBrowserDrawer } from './components/ModelBrowserDrawer';
import { StudioControlsDrawer } from './components/StudioControlsDrawer';
import { MusicDeck } from './components/MusicDeck';
import { VideoModal } from './components/VideoModal';

export default function App() {
  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const musicEngineRef = useRef(null);
  const videoExporterRef = useRef(null);

  // Studio Mode: 'cars' | 'planes'
  const [mode, setMode] = useState('cars');
  const [activeSubject, setActiveSubject] = useState(CARS_CATALOG[0]);
  const [activeScene, setActiveScene] = useState(SCENES_CATALOG[0]);

  // Loading state
  const [loadingState, setLoadingState] = useState({ loading: false, progress: 0, label: '' });

  // Drawers & Overlays
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [studioControlTab, setStudioControlTab] = useState('lighting');
  const [musicOpen, setMusicOpen] = useState(true);

  // Pro Cyclorama Lighting Studio Interactive Rig State
  const [proStudioState, setProStudioState] = useState({
    presetId: 'clean_commercial',
    ...STUDIO_LOOK_PRESETS.clean_commercial,
    turntableEnabled: true,
    turntableSpeed: 0.25,
  });

  // Physical Camera Lenses & Linear-HDR Optical Bokeh State
  const [lensState, setLensState] = useState({
    lensId: 'studio_wide',
    focalLengthMm: null,
    fStop: 2.8,
    dofEnabled: false,
    focusMode: 'auto',
    clickFocusArmed: false,
    manualFocusDistance: 5.5,
    bokehBoost: 1.55,
    currentFocusDistance: 5.5,
  });

  // Aspect Ratio & Safe Frame
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [safeFrameVisible, setSafeFrameVisible] = useState(true);

  // Weather & 24h Time-of-Day
  const [weatherId, setWeatherId] = useState('sunny');
  const [timeOfDay, setTimeOfDay] = useState(16.5); // 16:30
  const [autoTimeLapse, setAutoTimeLapse] = useState(false);
  const [snowAccumulation, setSnowAccumulation] = useState(0.0);
  const [autoAccumulateSnow, setAutoAccumulateSnow] = useState(true);
  const [windSpeed, setWindSpeed] = useState(0.35);

  // Lighting & Dynamics
  const [lightingState, setLightingState] = useState({
    keyColor: '#ffffff',
    keyIntensity: 1.8,
    keyAzimuth: 42,
    keyElevation: 48,
    fillColor: '#60a5fa',
    fillIntensity: 0.6,
    rimColor: '#f8fafc',
    rimIntensity: 1.4,
    ambientColor: '#1e293b',
    ambientIntensity: 0.6,
    exposure: 1.0,
    floorWetness: 0.55,
    fogDensity: 0.003,
    lightSweep: false,
    softboxIntensity: 2.5,
  });

  const [dynamicsState, setDynamicsState] = useState({
    headlightsOn: true,
    wheelSpin: true,
    aeroStreamlines: false,
    planeBanking: true,
    planeContrails: true,
    planeStrobes: true,
  });

  // Car Paint & Shading Customizer
  const [paintColor, setPaintColor] = useState('#b91c1c');
  const [paintFinish, setPaintFinish] = useState('metallic');
  const [underglowOn, setUnderglowOn] = useState(false);
  const [underglowColor, setUnderglowColor] = useState('#00f5d4');
  const [postFx, setPostFx] = useState({
    bloom: 0.16,
    vignette: 0.3,
    contrast: 1.08,
    blackLevel: 0.01,
  });

  // Interactive Vehicle Placement & Live Drive Mode
  const [transformMode, setTransformMode] = useState('orbit');
  const [vehiclePose, setVehiclePose] = useState({ x: 0, y: 0, z: 0, yaw: 0, yawDeg: 0 });
  const [snapToGround, setSnapToGround] = useState(true);
  const [alignToSlope, setAlignToSlope] = useState(false);

  // Cinematography & Reel Sequencer
  const [activeShotId, setActiveShotId] = useState('free_orbit');
  const [shotSpeed, setShotSpeed] = useState(1.0);
  const [cameraFov, setCameraFov] = useState(42);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sequenceClips, setSequenceClips] = useState([
    { id: 'clip-1', shotId: 'low_hero_pan', duration: 3.5 },
    { id: 'clip-2', shotId: 'vertigo_dolly_zoom', duration: 3.5 },
    { id: 'clip-3', shotId: 'crane_reveal', duration: 4.0 },
    { id: 'clip-4', shotId: 'orbit_360', duration: 4.5 },
  ]);

  // Music Player & Audio Spectrum
  const [currentTrack, setCurrentTrack] = useState(MUSIC_CATALOG[0]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [beatSyncEnabled, setBeatSyncEnabled] = useState(true);
  const [audioBars, setAudioBars] = useState(new Uint8Array(32));

  // Video Recording & Modal
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(null);
  const [videoResult, setVideoResult] = useState(null);

  // Initialize Three.js Scene, MusicEngine, and VideoExporter
  useEffect(() => {
    if (!canvasRef.current) return;

    const music = new MusicEngine();
    musicEngineRef.current = music;

    const exporter = new VideoExporter();
    videoExporterRef.current = exporter;

    const sm = new SceneManager(canvasRef.current, {
      onLoadingChange: (state) => setLoadingState(state),
      onShotChange: (shotId, isSeq) => {
        setActiveShotId(shotId);
        setIsPlayingSequence(isSeq);
      },
      onOutdoorTick: ({ timeOfDay: tod, snowAccumulation: sa }) => {
        setTimeOfDay(tod);
        setSnowAccumulation(sa);
      },
      onAudioFrame: ({ bars }) => {
        setAudioBars(bars);
      },
      onVehiclePoseChange: (pose) => {
        setVehiclePose(pose);
      },
      onTransformModeChange: (nextMode) => {
        setTransformMode(nextMode);
      },
      onSceneLightingSync: (synced) => {
        setLightingState((prev) => ({ ...prev, ...synced }));
      },
      onDofChange: (nextDof) => {
        setLensState((prev) => ({ ...prev, ...nextDof }));
      },
    });
    sm.musicEngine = music;
    sm.videoExporter = exporter;
    sm.beatCutEnabled = beatSyncEnabled;
    sceneManagerRef.current = sm;
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__sceneManager = sm;
    }

    music.onStateChange = (state) => {
      setIsPlayingAudio(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
    };
    music.onTrackEnded = () => {
      handleNextTrack();
    };

    // Load initial 3D car and outdoor world
    sm.loadSubject(CARS_CATALOG[0], 'cars');
    sm.setScene(SCENES_CATALOG[0]);

    // Pre-load first soundtrack (paused until user interacts)
    music.loadAndPlay(MUSIC_CATALOG[0].url, false);

    return () => {
      sm.dispose();
    };
  }, []);

  // Sync beatSyncEnabled with scene manager
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.beatCutEnabled = beatSyncEnabled;
    }
    if (musicEngineRef.current) {
      musicEngineRef.current.beatSyncEnabled = beatSyncEnabled;
    }
  }, [beatSyncEnabled]);

  // Handle Mode Switch
  const handleModeChange = (newMode) => {
    setMode(newMode);
    const catalog =
      newMode === 'cars'
        ? CARS_CATALOG
        : newMode === 'planes'
        ? PLANES_CATALOG
        : PARTS_CATALOG;
    const firstSubject = catalog[0];
    setActiveSubject(firstSubject);

    let targetScene = activeScene;
    if (!activeScene?.modes?.includes(newMode)) {
      targetScene =
        (newMode === 'planes' && SCENES_CATALOG.find((s) => s.id === 'outdoor_world')) ||
        SCENES_CATALOG.find((s) => s.modes?.includes(newMode)) ||
        activeScene;
      setActiveScene(targetScene);
    }

    if (sceneManagerRef.current) {
      if (targetScene && targetScene.id !== activeScene?.id) {
        sceneManagerRef.current.setScene(targetScene);
      }
      if (firstSubject) {
        sceneManagerRef.current.loadSubject(firstSubject, newMode);
      }
    }
  };

  // Select Subject
  const handleSelectSubject = (item) => {
    setActiveSubject(item);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.loadSubject(item, mode);
    }
  };

  // Select Scene
  const handleSelectScene = (scene) => {
    setActiveScene(scene);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setScene(scene);
    }
  };

  // Weather Controls
  const handleSelectWeather = (wId) => {
    setWeatherId(wId);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.weatherId = wId;
    }
  };

  const handleChangeTimeOfDay = (val) => {
    setTimeOfDay(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.timeOfDay = val;
    }
  };

  const handleToggleTimeLapse = () => {
    const next = !autoTimeLapse;
    setAutoTimeLapse(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.autoTimeLapse = next;
    }
  };

  const handleChangeSnowAccumulation = (val) => {
    setSnowAccumulation(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.snowAccumulation = val;
    }
  };

  const handleToggleAutoSnow = () => {
    const next = !autoAccumulateSnow;
    setAutoAccumulateSnow(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.autoAccumulateSnow = next;
    }
  };

  const handleClearSnow = () => {
    setSnowAccumulation(0);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.snowAccumulation = 0;
    }
  };

  const handleTriggerLightning = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.triggerLightningStrike();
      if (musicEngineRef.current) {
        musicEngineRef.current.playThunderRumble();
      }
    }
  };

  const handleChangeWindSpeed = (val) => {
    setWindSpeed(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.weatherSystem.windSpeed = val;
    }
  };

  // Lighting & Dynamics Controls
  const handleChangeLightingState = (partial) => {
    const updated = { ...lightingState, ...partial };
    setLightingState(updated);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.lightingRig.applyState(updated);
    }
  };

  const handleApplyLightingPreset = (preset) => {
    const updated = { ...lightingState, ...preset };
    setLightingState(updated);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.lightingRig.applyState(updated);
    }
  };

  const handleApplySceneFilmPreset = (presetId) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.applySceneFilmPreset(presetId);
    }
  };

  // Pro Cyclorama Studio & Physical Lens / DoF Controls
  const handleChangeProStudioState = (patch) => {
    if (sceneManagerRef.current) {
      const next = sceneManagerRef.current.setProStudioState(patch);
      setProStudioState(next);
    } else {
      setProStudioState((prev) => ({ ...prev, ...patch }));
    }
  };

  const handleApplyProStudioPreset = (presetId) => {
    if (sceneManagerRef.current) {
      const next = sceneManagerRef.current.applyProStudioPreset(presetId);
      setProStudioState(next);
    }
  };

  const handleSelectLens = (lensSpec) => {
    if (!lensSpec) return;
    const patch = {
      lensId: lensSpec.id,
      focalLengthMm: lensSpec.focalLengthMm,
      fStop: lensSpec.defaultFStop,
      dofEnabled: lensSpec.autoEnableDof ? true : false,
    };
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setLensAndDof(patch, { autoDolly: true });
    } else {
      setLensState((prev) => ({ ...prev, ...patch }));
    }
  };

  const handleChangeLensState = (patch) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setLensAndDof(patch, {
        autoDolly: Object.prototype.hasOwnProperty.call(patch, 'focalLengthMm'),
      });
    } else {
      setLensState((prev) => ({ ...prev, ...patch }));
    }
  };

  const handleJumpToScene = (sceneId) => {
    const target = SCENES_CATALOG.find((s) => s.id === sceneId);
    if (target) {
      handleSelectScene(target);
    }
  };

  const handleOpenOpticsDrawer = () => {
    setStudioControlTab('lenses');
    setRightOpen(true);
  };

  const handleChangeDynamicsState = (partial) => {
    const updated = { ...dynamicsState, ...partial };
    setDynamicsState(updated);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.vehicleDynamics.applyState(updated);
      if (partial.headlightsOn !== undefined) {
        sceneManagerRef.current.setHeadlights(partial.headlightsOn);
      }
    }
  };

  const handleChangePaintColor = (hex) => {
    setPaintColor(hex);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCarPaintColor(hex);
    }
  };

  const handleChangePaintFinish = (finish) => {
    setPaintFinish(finish);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCarPaintFinish(finish);
    }
  };

  const handleResetFactoryPaint = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.resetFactoryPaint();
    }
  };

  const handleChangeTransformMode = (nextMode) => {
    setTransformMode(nextMode);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setTransformMode(nextMode);
    }
  };

  const handleResetVehiclePose = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.resetVehiclePose();
    }
  };

  const handleChangeVehiclePose = (partial) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setVehiclePose(partial);
    }
  };

  const handleToggleSnapToGround = () => {
    const next = !snapToGround;
    setSnapToGround(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setSnapToGround(next);
    }
  };

  const handleToggleAlignToSlope = () => {
    const next = !alignToSlope;
    setAlignToSlope(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setAlignToSlope(next);
    }
  };

  const handleToggleUnderglow = () => {
    const next = !underglowOn;
    setUnderglowOn(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setUnderglow(next, underglowColor);
    }
  };

  const handleChangeUnderglowColor = (hex) => {
    setUnderglowColor(hex);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setUnderglow(underglowOn, hex);
    }
  };

  const handleChangePostFx = (fx) => {
    setPostFx(fx);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setPostProcessing(fx);
    }
  };

  // Camera & Sequencer Controls
  const handleSelectShot = (shotId) => {
    setActiveShotId(shotId);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cameraDirector.setShot(shotId);
    }
  };

  const handleChangeShotSpeed = (val) => {
    setShotSpeed(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cameraDirector.shotSpeed = val;
    }
  };

  const handleChangeCameraFov = (val) => {
    setCameraFov(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cameraDirector.baseFov = val;
      sceneManagerRef.current.camera.fov = val;
      sceneManagerRef.current.camera.updateProjectionMatrix();
    }
  };

  const handleStartSequence = () => {
    setIsPlayingSequence(true);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cameraDirector.startSequence(sequenceClips);
    }
  };

  const handleStopSequence = () => {
    setIsPlayingSequence(false);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cameraDirector.stopSequence();
    }
  };

  // Music Player Controls
  const handleSelectTrack = (track) => {
    setCurrentTrack(track);
    if (musicEngineRef.current) {
      musicEngineRef.current.loadAndPlay(track.url, true);
    }
  };

  const handleTogglePlay = () => {
    if (musicEngineRef.current) {
      musicEngineRef.current.togglePlay();
    }
  };

  const handlePrevTrack = () => {
    const idx = MUSIC_CATALOG.findIndex((t) => t.id === currentTrack.id);
    const prev = MUSIC_CATALOG[(idx - 1 + MUSIC_CATALOG.length) % MUSIC_CATALOG.length];
    handleSelectTrack(prev);
  };

  const handleNextTrack = () => {
    const idx = MUSIC_CATALOG.findIndex((t) => t.id === currentTrack.id);
    const next = MUSIC_CATALOG[(idx + 1) % MUSIC_CATALOG.length];
    handleSelectTrack(next);
  };

  const handleSeek = (timeSec) => {
    if (musicEngineRef.current) {
      musicEngineRef.current.seek(timeSec);
    }
  };

  const handleChangeVolume = (v) => {
    setVolume(v);
    if (musicEngineRef.current) {
      musicEngineRef.current.setVolume(v);
    }
  };

  // Video Recording for Social Media
  const handleStartRecording = () => {
    if (!sceneManagerRef.current || !videoExporterRef.current) return;

    // Start playback if audio is not already playing
    if (musicEngineRef.current && !isPlayingAudio) {
      musicEngineRef.current.audio.play().catch(() => {});
    }

    // Auto-trigger sequence if in free orbit
    if (activeShotId === 'free_orbit' && !isPlayingSequence) {
      handleStartSequence();
    }

    const durationSec = sequenceClips.reduce((acc, c) => acc + (Number(c.duration) || 3.5), 0);
    const audioTrack = musicEngineRef.current ? musicEngineRef.current.getAudioStreamTrack() : null;

    setIsRecording(true);
    setRecordingProgress({ elapsedSec: 0, totalSec: durationSec, progress: 0 });

    videoExporterRef.current.startRecording({
      sourceCanvas: canvasRef.current,
      aspectRatioId: aspectRatio,
      durationSec,
      audioTrack,
      overlayTitle: `${activeSubject?.name || 'Reel'} // APEX STUDIO`,
      onProgress: (prog) => setRecordingProgress(prog),
      onComplete: (res) => {
        setIsRecording(false);
        setRecordingProgress(null);
        setVideoResult(res);
      },
    });
  };

  const handleStopRecording = () => {
    if (videoExporterRef.current) {
      videoExporterRef.current.stopRecording();
    }
  };

  // Safe-Frame Crop Guides computation
  const activeAspect = ASPECT_RATIOS.find((a) => a.id === aspectRatio) || ASPECT_RATIOS[0];

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 3D WebGL Canvas Viewport */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: lensState.clickFocusArmed ? 'crosshair' : 'default',
          }}
        />
      </div>

      {/* Click-to-Focus Armed HUD Pill */}
      {!isRecording && lensState.clickFocusArmed && (
        <div
          style={{
            position: 'absolute',
            top: '68px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 34,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #f59e0b',
            borderRadius: '999px',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#f59e0b',
              boxShadow: '0 0 8px #f59e0b',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: '#fef3c7',
            }}
          >
            CLICK-TO-FOCUS ACTIVE ({lensState.currentFocusDistance?.toFixed(2) || '5.50'}m) • CLICK CAR OR BACKGROUND
          </span>
          <button
            onClick={() => handleChangeLensState({ clickFocusArmed: false, focusMode: 'auto' })}
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              color: '#fde68a',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            LOCK AF
          </button>
        </div>
      )}

      {/* Social Media Aspect Ratio Safe-Frame Overlay */}
      {safeFrameVisible && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            aspectRatio: activeAspect.ratio,
            height: '92%',
            maxHeight: '92%',
            maxWidth: '92%',
            border: '2px dashed rgba(56, 189, 248, 0.45)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.42)',
            position: 'relative',
          }}>
            {/* Aspect Ratio Badge */}
            <span style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
            }}>
              {activeAspect.label}
            </span>
          </div>
        </div>
      )}

      {/* Loading HUD Banner */}
      {loadingState.loading && (
        <div style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
        }}>
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid var(--accent-cyan)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spinSlow 1s linear infinite',
          }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
            Loading 3D Asset: {loadingState.label} ({loadingState.progress}%)
          </span>
        </div>
      )}

      {/* Live Drive / Gizmo HUD Banner (auto-hidden when recording!) */}
      {!isRecording && transformMode !== 'orbit' && (
        <div
          style={{
            position: 'absolute',
            bottom: musicOpen ? '92px' : '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 32,
            background: 'rgba(6, 10, 18, 0.88)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${transformMode === 'drive' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(56, 189, 248, 0.45)'}`,
            borderRadius: '999px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: transformMode === 'drive' ? '#34d399' : '#38bdf8',
              boxShadow: `0 0 8px ${transformMode === 'drive' ? '#34d399' : '#38bdf8'}`,
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f8fafc', letterSpacing: '0.4px' }}>
            {transformMode === 'drive'
              ? 'LIVE DRIVE ACTIVE • WASD / ARROWS TO DRIVE • SHIFT BOOST • SPACE/C ALTITUDE • ESC EXIT'
              : transformMode === 'translate'
              ? 'MOVE GIZMO (W) • DRAG ARROWS OR SHIFT+CLICK ROAD TO PLACE • ESC ORBIT'
              : 'ROTATE HEADING (E) • DRAG RING TO AIM VEHICLE • ESC ORBIT'}
          </span>
        </div>
      )}

      {/* Top Bar */}
      <TopBar
        mode={mode}
        setMode={handleModeChange}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        safeFrameVisible={safeFrameVisible}
        setSafeFrameVisible={setSafeFrameVisible}
        activeWeather={weatherId}
        timeOfDay={timeOfDay}
        beatSyncEnabled={beatSyncEnabled}
        setBeatSyncEnabled={setBeatSyncEnabled}
        isRecording={isRecording}
        recordingProgress={recordingProgress}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        leftOpen={leftOpen}
        setLeftOpen={setLeftOpen}
        rightOpen={rightOpen}
        setRightOpen={setRightOpen}
        musicOpen={musicOpen}
        setMusicOpen={setMusicOpen}
        transformMode={transformMode}
        onChangeTransformMode={handleChangeTransformMode}
        onResetVehiclePose={handleResetVehiclePose}
        lensState={lensState}
        cameraLenses={CAMERA_LENSES}
        onSelectLens={handleSelectLens}
        onOpenOptics={handleOpenOpticsDrawer}
      />

      {/* Left Drawer: Model & Scene Browser */}
      <ModelBrowserDrawer
        isOpen={leftOpen}
        onClose={() => setLeftOpen(false)}
        mode={mode}
        setMode={handleModeChange}
        activeSubject={activeSubject}
        onSelectSubject={handleSelectSubject}
        activeScene={activeScene}
        onSelectScene={handleSelectScene}
      />

      {/* Right Drawer: Studio Controls (Weather, Lighting, Lenses/DoF, Camera Director) */}
      <StudioControlsDrawer
        isOpen={rightOpen}
        onClose={() => setRightOpen(false)}
        activeTab={studioControlTab}
        onChangeActiveTab={setStudioControlTab}
        mode={mode}
        // Pro Cyclorama Studio & Lenses/DoF
        proStudioState={proStudioState}
        onChangeProStudioState={handleChangeProStudioState}
        onApplyProStudioPreset={handleApplyProStudioPreset}
        lensState={lensState}
        onSelectLens={handleSelectLens}
        onChangeLensState={handleChangeLensState}
        onJumpToScene={handleJumpToScene}
        // Weather
        weatherId={weatherId}
        onSelectWeather={handleSelectWeather}
        timeOfDay={timeOfDay}
        onChangeTimeOfDay={handleChangeTimeOfDay}
        autoTimeLapse={autoTimeLapse}
        onToggleTimeLapse={handleToggleTimeLapse}
        snowAccumulation={snowAccumulation}
        onChangeSnowAccumulation={handleChangeSnowAccumulation}
        autoAccumulateSnow={autoAccumulateSnow}
        onToggleAutoSnow={handleToggleAutoSnow}
        onClearSnow={handleClearSnow}
        onTriggerLightning={handleTriggerLightning}
        windSpeed={windSpeed}
        onChangeWindSpeed={handleChangeWindSpeed}
        // Lighting & Dynamics
        lightingState={lightingState}
        onChangeLightingState={handleChangeLightingState}
        onApplyLightingPreset={handleApplyLightingPreset}
        activeSceneId={activeScene?.id}
        onApplySceneFilmPreset={handleApplySceneFilmPreset}
        dynamicsState={dynamicsState}
        onChangeDynamicsState={handleChangeDynamicsState}
        // Paint & Shading
        paintColor={paintColor}
        onChangePaintColor={handleChangePaintColor}
        paintFinish={paintFinish}
        onChangePaintFinish={handleChangePaintFinish}
        onResetFactoryPaint={handleResetFactoryPaint}
        underglowOn={underglowOn}
        onToggleUnderglow={handleToggleUnderglow}
        underglowColor={underglowColor}
        onChangeUnderglowColor={handleChangeUnderglowColor}
        // Vehicle Placement & Motion
        transformMode={transformMode}
        onChangeTransformMode={handleChangeTransformMode}
        vehiclePose={vehiclePose}
        onChangeVehiclePose={handleChangeVehiclePose}
        snapToGround={snapToGround}
        onToggleSnapToGround={handleToggleSnapToGround}
        alignToSlope={alignToSlope}
        onToggleAlignToSlope={handleToggleAlignToSlope}
        onResetVehiclePose={handleResetVehiclePose}
        postFx={postFx}
        onChangePostFx={handleChangePostFx}
        // Camera & Sequencer
        activeShotId={activeShotId}
        onSelectShot={handleSelectShot}
        shotSpeed={shotSpeed}
        onChangeShotSpeed={handleChangeShotSpeed}
        cameraFov={cameraFov}
        onChangeCameraFov={handleChangeCameraFov}
        isPlayingSequence={isPlayingSequence}
        onStartSequence={handleStartSequence}
        onStopSequence={handleStopSequence}
        sequenceClips={sequenceClips}
        onChangeSequenceClips={setSequenceClips}
        beatSyncEnabled={beatSyncEnabled}
      />

      {/* Bottom Dock: 40-Track Soundtrack Deck */}
      <MusicDeck
        isOpen={musicOpen}
        onToggleOpen={() => setMusicOpen(!musicOpen)}
        currentTrack={currentTrack}
        onSelectTrack={handleSelectTrack}
        isPlaying={isPlayingAudio}
        onTogglePlay={handleTogglePlay}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onChangeVolume={handleChangeVolume}
        beatSyncEnabled={beatSyncEnabled}
        onToggleBeatSync={() => setBeatSyncEnabled(!beatSyncEnabled)}
        audioBars={audioBars}
      />

      {/* Completed Video Export Modal */}
      {videoResult && (
        <VideoModal
          videoResult={videoResult}
          subjectName={activeSubject?.name}
          onClose={() => setVideoResult(null)}
        />
      )}
    </div>
  );
}

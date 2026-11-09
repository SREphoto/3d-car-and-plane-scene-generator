import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Search,
  ListMusic
} from 'lucide-react';
import { MUSIC_CATALOG } from '../data/catalog';

export function MusicDeck({
  isOpen,
  onToggleOpen,
  currentTrack,
  onSelectTrack,
  isPlaying,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  currentTime,
  duration,
  onSeek,
  volume,
  onChangeVolume,
  beatSyncEnabled,
  onToggleBeatSync,
  audioBars,
}) {
  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const canvasRef = useRef(null);

  const formatTime = (sec) => {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Render frequency spectrum on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBars) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barCount = 32;
    const barWidth = (w / barCount) - 2;
    for (let i = 0; i < barCount; i++) {
      const val = audioBars[i] || 0;
      const barHeight = (val / 255) * h * 0.95;
      const x = i * (barWidth + 2);
      const y = h - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, h);
      if (i < 6 && beatSyncEnabled) {
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(1, '#a855f7');
      } else {
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [audioBars, beatSyncEnabled]);

  const filteredTracks = MUSIC_CATALOG.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      left: '16px',
      right: '16px',
      bottom: '16px',
      zIndex: 35,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {/* Expandable 40-Track Playlist Drawer */}
      {playlistDrawerOpen && (
        <div style={{
          pointerEvents: 'auto',
          width: '560px',
          maxHeight: '340px',
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-panel)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListMusic size={16} color="var(--accent-emerald)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                SOUNDTRACK LIBRARY ({MUSIC_CATALOG.length} TRACKS)
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px 8px',
              borderRadius: '6px',
              width: '180px',
            }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '11px',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredTracks.map((track, idx) => {
              const isSelected = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '22px' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--accent-emerald)' : '#e2e8f0' }}>
                      {track.title}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    {track.vibe}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Dock Music Player Bar */}
      <div style={{
        pointerEvents: 'auto',
        width: '740px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(12, 16, 26, 0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: 'var(--shadow-panel)',
      }}>
        {/* Track Title & Playlist Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px', maxWidth: '210px' }}>
          <button
            onClick={() => setPlaylistDrawerOpen(!playlistDrawerOpen)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
            }}
            title="Browse all 40 tracks"
          >
            <Music size={17} />
          </button>

          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {currentTrack?.title || 'No Track Selected'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
              {currentTrack?.vibe || 'SOUNDTRACK'}
            </div>
          </div>
        </div>

        {/* Transport Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onPrevTrack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
            }}
            title="Previous Track"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={onTogglePlay}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(56, 189, 248, 0.35)',
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: '2px' }} />}
          </button>

          <button
            onClick={onNextTrack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
            }}
            title="Next Track"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Scrubbing Timeline */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '32px' }}>
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />

          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '32px' }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Live Audio FFT Spectrum Canvas */}
        <canvas
          ref={canvasRef}
          width={90}
          height={32}
          style={{ width: '90px', height: '32px', flexShrink: 0 }}
        />

        {/* Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '90px' }}>
          {volume === 0 ? <VolumeX size={15} color="var(--text-muted)" /> : <Volume2 size={15} color="var(--text-secondary)" />}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

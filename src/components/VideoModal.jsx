import React from 'react';
import { Download, X, Film, CheckCircle } from 'lucide-react';

export function VideoModal({ videoResult, subjectName, onClose }) {
  if (!videoResult) return null;

  const { url, ext, aspectRatioId, durationSec } = videoResult;
  const fileName = `ApexAero_${(subjectName || 'Reel').replace(/\s+/g, '_')}_${aspectRatioId.replace(':', 'x')}.${ext}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px',
    }}>
      <div style={{
        background: 'rgba(15, 20, 31, 0.95)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
              SOCIAL REEL READY
            </span>
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
            <X size={20} />
          </button>
        </div>

        {/* Video Player Preview */}
        <div style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '100%',
            maxHeight: '440px',
            background: '#000000',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}>
            <video
              src={url}
              controls
              autoPlay
              loop
              playsInline
              style={{
                maxWidth: '100%',
                maxHeight: '440px',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Details Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={15} color="var(--accent-emerald)" />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{subjectName}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>{aspectRatioId}</span>
              <span>•</span>
              <span>{durationSec}s</span>
              <span>•</span>
              <span style={{ textTransform: 'uppercase' }}>{ext}</span>
            </div>
          </div>

          {/* Download Action */}
          <a
            href={url}
            download={fileName}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(56, 189, 248, 0.4)',
              cursor: 'pointer',
            }}
          >
            <Download size={17} />
            <span>DOWNLOAD VIDEO FOR SOCIAL MEDIA</span>
          </a>
        </div>
      </div>
    </div>
  );
}

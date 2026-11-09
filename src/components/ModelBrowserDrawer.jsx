import React, { useState } from 'react';
import {
  Car,
  Plane,
  MapPin,
  Search,
  Sparkles,
  ChevronRight,
  Sun,
  Warehouse,
  Wind,
  Layers,
  X
} from 'lucide-react';
import { CARS_CATALOG, PLANES_CATALOG, PARTS_CATALOG, SCENES_CATALOG } from '../data/catalog';

export function ModelBrowserDrawer({
  isOpen,
  onClose,
  mode,
  setMode,
  activeSubject,
  onSelectSubject,
  activeScene,
  onSelectScene,
}) {
  const [tab, setTab] = useState('models'); // 'models' | 'scenes'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const modelsList =
    mode === 'cars'
      ? CARS_CATALOG
      : mode === 'planes'
      ? PLANES_CATALOG
      : PARTS_CATALOG;

  // Extract unique categories for current mode
  const categories = ['ALL', ...new Set(modelsList.map((c) => c.category).filter(Boolean))];

  const filteredModels = modelsList.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.brand && m.brand.toLowerCase().includes(search.toLowerCase())) ||
      (m.specs && m.specs.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      categoryFilter === 'ALL' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <aside style={{
      position: 'absolute',
      top: '62px',
      left: 0,
      bottom: 0,
      width: '380px',
      background: 'rgba(10, 14, 23, 0.88)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 35,
      boxShadow: 'var(--shadow-panel)',
    }}>
      {/* Drawer Header & Tabs */}
      <div style={{
        padding: '16px 16px 12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setTab('models')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: tab === 'models' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                border: `1px solid ${tab === 'models' ? 'var(--accent-cyan)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: tab === 'models' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {mode === 'cars' ? <Car size={14} /> : mode === 'planes' ? <Plane size={14} /> : <Layers size={14} />}
              <span>{mode === 'cars' ? `CARS (${CARS_CATALOG.length})` : mode === 'planes' ? `PLANES (${PLANES_CATALOG.length})` : `PARTS (${PARTS_CATALOG.length})`}</span>
            </button>
            <button
              onClick={() => setTab('scenes')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: tab === 'scenes' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                border: `1px solid ${tab === 'scenes' ? 'var(--accent-cyan)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                color: tab === 'scenes' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <MapPin size={14} />
              <span>SCENES ({SCENES_CATALOG.length})</span>
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

        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder={tab === 'models' ? `Search ${mode}...` : 'Search scenes...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '13px',
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Category Pills (only in cars models tab) */}
        {tab === 'models' && mode === 'cars' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '4px 10px',
                  background: categoryFilter === cat ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${categoryFilter === cat ? 'rgba(255, 255, 255, 0.3)' : 'transparent'}`,
                  borderRadius: '999px',
                  color: categoryFilter === cat ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tab === 'models' ? (
          filteredModels.map((item) => {
            const isSelected = activeSubject?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectSubject(item)}
                style={{
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  borderLeft: `4px solid ${item.accent || 'var(--accent-cyan)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: item.accent, fontWeight: 700, letterSpacing: '0.5px' }}>
                    {item.brand.toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    {item.year || item.category}
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  {item.name}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {item.specs}
                </div>
              </div>
            );
          })
        ) : (
          SCENES_CATALOG.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).map((scene) => {
            const isSelected = activeScene?.id === scene.id;
            return (
              <div
                key={scene.id}
                onClick={() => onSelectScene(scene)}
                style={{
                  padding: '14px',
                  background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    color: scene.type === 'outdoor' ? 'var(--accent-amber)' : 'var(--accent-cyan)',
                    background: scene.type === 'outdoor' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                  }}>
                    {scene.badge}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      ● ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  {scene.name}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {scene.description}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

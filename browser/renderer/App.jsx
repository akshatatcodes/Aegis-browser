/**
 * ============================================================
 * AEGIS BROWSER — App.jsx (Root React Component)
 * ============================================================
 *
 * ROLE: Top-level component that owns the entire browser state.
 *       All other components receive data and callbacks as props.
 *
 * STATE OWNED HERE:
 *   tabs[]          → Array of tab objects (see TAB SCHEMA below)
 *   activeTabId     → UUID of the currently focused tab
 *   backendStatus   → 'connecting' | 'online' | 'offline'
 *   dashboardOpen   → Boolean: is the right-side dashboard visible
 *
 * TAB SCHEMA:
 *   {
 *     id:        string (UUID)    — unique tab identifier
 *     url:       string           — current URL (or empty if new tab)
 *     title:     string           — page title from webview
 *     loading:   boolean          — is page loading?
 *     identity:  object|null      — identity profile from backend
 *     circuit:   object|null      — circuit from backend {entry,relay,exit}
 *     webviewRef: React.ref       — ref to the <webview> DOM element
 *   }
 *
 * LIFECYCLE:
 *   1. App mounts → checks backend health via window.aegisAPI.getStatus()
 *   2. Creates initial tab
 *   3. Tab becomes active → fetches identity + circuit from backend
 *   4. Identity applied to webview's preload via webview.executeScript()
 *   5. User clicks New Tab → new tab added, new identity fetched
 *   6. User clicks Rotate → rotateIdentity() called, identity re-applied
 * ============================================================
 */

// NOTE: This file is loaded with Babel standalone for Phase 1 prototype.
// In production, compile with Webpack/Vite for React JSX support.

const { useState, useEffect, useRef, useCallback } = React;

// Import sub-components (relative paths, same renderer/ folder)
// For prototype: components defined inline below for single-file loading.
// In production: import TabBar from './components/TabBar.jsx'; etc.

// ─── Utility: Generate UUID ───────────────────────────────────
function generateId() {
  return 'tab_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

// ─── Utility: Create blank tab ───────────────────────────────
function createTab(url = '') {
  return {
    id:         generateId(),
    url:        url || 'aegis://new',
    displayUrl: url || '',
    title:      'New Tab',
    loading:    false,
    identity:   null,
    circuit:    null,
    webviewRef: React.createRef()
  };
}

// ─── Root App Component ───────────────────────────────────────
function App() {
  const [tabs,           setTabs]           = useState(() => [createTab()]);
  const [activeTabId,    setActiveTabId]    = useState(() => null);
  const [backendStatus,  setBackendStatus]  = useState('connecting');
  const [dashboardOpen,  setDashboardOpen]  = useState(true);
  const urlBarRef = useRef(null);

  // Set initial active tab
  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, []);

  // ── Backend health check on mount ────────────────────────
  useEffect(() => {
    async function checkBackend() {
      if (!window.aegisAPI) {
        setBackendStatus('offline');
        return;
      }
      try {
        const res = await window.aegisAPI.getStatus();
        setBackendStatus(res.success ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    }
    checkBackend();
    // Re-check every 30 seconds
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch identity + circuit for newly active tab ─────────
  useEffect(() => {
    if (!activeTabId || backendStatus !== 'online') return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.identity) return; // Already have identity

    async function loadTabData() {
      try {
        const [idRes, circuitRes] = await Promise.all([
          window.aegisAPI.getIdentity(activeTabId),
          window.aegisAPI.getCircuit(activeTabId)
        ]);

        const identity = idRes.success      ? idRes.data      : null;
        const circuit  = circuitRes.success ? circuitRes.data : null;

        // Update tab state
        setTabs(prev => prev.map(t =>
          t.id === activeTabId ? { ...t, identity, circuit } : t
        ));

        // Apply identity to the webview preload context
        if (identity && tab.webviewRef?.current) {
          applyIdentityToWebview(tab.webviewRef.current, identity);
        }
      } catch (err) {
        console.error('[Aegis App] Failed to load tab data:', err);
      }
    }

    loadTabData();
  }, [activeTabId, backendStatus]);

  // ── Apply identity to webview ──────────────────────────────
  const applyIdentityToWebview = useCallback((webviewEl, identity) => {
    if (!webviewEl) return;
    // executeJavaScript runs code in the webview's page context
    // This calls the overrideIdentity() function placed there by preload.js
    try {
      webviewEl.executeJavaScript(
        `if (window.__aegisApplyIdentity) window.__aegisApplyIdentity(${JSON.stringify(identity)})`
      );
    } catch (e) {
      // Webview may not be ready yet — ignore, identity will apply on next load
    }
  }, []);

  // ─── Tab Actions ──────────────────────────────────────────

  const addTab = useCallback((url = '') => {
    const newTab = createTab(url);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId);
      if (remaining.length === 0) {
        // Always keep at least one tab
        const fresh = createTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      // If closing active tab, switch to last one
      setActiveTabId(active => {
        if (active === tabId) return remaining[remaining.length - 1].id;
        return active;
      });
      return remaining;
    });
  }, []);

  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
    // Update window title
    const tab = tabs.find(t => t.id === tabId);
    if (tab && window.aegisAPI) {
      window.aegisAPI.setTitle(tab.title || 'New Tab');
    }
  }, [tabs]);

  const updateTabUrl = useCallback((tabId, url) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, url, loading: true } : t));
  }, []);

  const updateTabTitle = useCallback((tabId, title) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title } : t));
  }, []);

  const updateTabLoading = useCallback((tabId, loading) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, loading } : t));
  }, []);

  const navigateTo = useCallback((url) => {
    if (!activeTabId) return;
    let fullUrl = url.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('aegis://')) {
      // Treat as search if no protocol
      if (fullUrl.includes('.') && !fullUrl.includes(' ')) {
        fullUrl = `https://${fullUrl}`;
      } else {
        fullUrl = `https://www.google.com/search?q=${encodeURIComponent(fullUrl)}`;
      }
    }
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.webviewRef?.current) {
      tab.webviewRef.current.loadURL(fullUrl);
    }
    updateTabUrl(activeTabId, fullUrl);
  }, [activeTabId, tabs, updateTabUrl]);

  const rotateIdentity = useCallback(async (tabId) => {
    if (!window.aegisAPI) return;
    try {
      const res = await window.aegisAPI.rotateIdentity(tabId);
      if (res.success) {
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, identity: res.data } : t
        ));
        const tab = tabs.find(t => t.id === tabId);
        if (tab?.webviewRef?.current) {
          applyIdentityToWebview(tab.webviewRef.current, res.data);
        }
      }
    } catch (err) {
      console.error('[Aegis App] rotateIdentity failed:', err);
    }
  }, [tabs, applyIdentityToWebview]);

  const rotateRoute = useCallback(async (tabId) => {
    if (!window.aegisAPI) return;
    try {
      const res = await window.aegisAPI.rotateRoute(tabId);
      if (res.success) {
        setTabs(prev => prev.map(t =>
          t.id === tabId ? { ...t, circuit: res.data } : t
        ));
      }
    } catch (err) {
      console.error('[Aegis App] rotateRoute failed:', err);
    }
  }, [tabs]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  return (
    <div style={styles.appShell}>
      {/* ── Top Bar: Tab Strip + URL Bar ── */}
      <div style={styles.topBar}>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onNewTab={() => addTab()}
          onCloseTab={closeTab}
          onSwitchTab={switchTab}
          backendStatus={backendStatus}
          onToggleDashboard={() => setDashboardOpen(v => !v)}
          dashboardOpen={dashboardOpen}
        />
        <UrlBar
          activeTab={activeTab}
          onNavigate={navigateTo}
          urlBarRef={urlBarRef}
        />
      </div>

      {/* ── Main Content Area ── */}
      <div style={styles.contentArea}>
        {/* Webviews (all mounted, only active one visible) */}
        <div style={styles.webviewArea}>
          {tabs.map(tab => (
            <WebviewContainer
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onTitleChange={(title) => updateTabTitle(tab.id, title)}
              onLoadStart={() => updateTabLoading(tab.id, true)}
              onLoadStop={() => updateTabLoading(tab.id, false)}
              onUrlChange={(url) => updateTabUrl(tab.id, url)}
            />
          ))}
        </div>

        {/* Side Dashboard (collapsible) */}
        {dashboardOpen && (
          <Dashboard
            activeTab={activeTab}
            allTabs={tabs}
            backendStatus={backendStatus}
            onRotateIdentity={rotateIdentity}
            onRotateRoute={rotateRoute}
          />
        )}
      </div>
    </div>
  );
}

// ─── Inline Styles ────────────────────────────────────────────
const styles = {
  appShell: {
    display: 'flex', flexDirection: 'column',
    width: '100vw', height: '100vh',
    background: 'var(--bg-primary)',
    overflow: 'hidden'
  },
  topBar: {
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    WebkitAppRegion: 'drag' // Allow window dragging from top bar
  },
  contentArea: {
    display: 'flex', flex: 1, overflow: 'hidden'
  },
  webviewArea: {
    flex: 1, position: 'relative', overflow: 'hidden'
  }
};

// ─── Sub-Components (inline for Phase 1 prototype) ─────────────

function TabBar({ tabs, activeTabId, onNewTab, onCloseTab, onSwitchTab, backendStatus, onToggleDashboard, dashboardOpen }) {
  return (
    <div style={tabBarStyles.bar}>
      {/* Traffic light / window controls placeholder */}
      <div style={tabBarStyles.controls}>
        <div style={{...tabBarStyles.dot, background:'#ff5f57'}}/>
        <div style={{...tabBarStyles.dot, background:'#febc2e'}}/>
        <div style={{...tabBarStyles.dot, background:'#28c840'}}/>
      </div>

      {/* Tab Items */}
      <div style={tabBarStyles.tabs}>
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSwitch={() => onSwitchTab(tab.id)}
            onClose={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
          />
        ))}
      </div>

      {/* New Tab Button */}
      <button style={tabBarStyles.newTabBtn} onClick={onNewTab} title="New Tab">
        <span style={{fontSize:'16px', lineHeight:1}}>＋</span>
      </button>

      {/* Spacer */}
      <div style={{flex:1}} />

      {/* Backend Status Dot */}
      <div style={tabBarStyles.statusArea}>
        <div style={{...tabBarStyles.statusDot, background: {connecting:'#f59e0b', online:'#22c55e', offline:'#ef4444'}[backendStatus]}} />
        <span style={{fontSize:'10px', color:'var(--text-muted)', WebkitAppRegion:'no-drag'}}>
          {backendStatus === 'online' ? 'CORE ONLINE' : backendStatus === 'connecting' ? 'CONNECTING' : 'CORE OFFLINE'}
        </span>
      </div>

      {/* Dashboard Toggle */}
      <button style={tabBarStyles.dashBtn} onClick={onToggleDashboard} title="Toggle Dashboard">
        {dashboardOpen ? '◀' : '▶'}
      </button>
    </div>
  );
}

function TabItem({ tab, isActive, onSwitch, onClose }) {
  return (
    <div
      style={{...tabBarStyles.tab, ...(isActive ? tabBarStyles.tabActive : {})}}
      onClick={onSwitch}
    >
      <div style={tabBarStyles.faviconDot} />
      <span style={tabBarStyles.tabTitle}>{tab.title || 'New Tab'}</span>
      {tab.loading && <span style={tabBarStyles.loadingDot}>●</span>}
      <button style={tabBarStyles.closeBtn} onClick={onClose}>✕</button>
    </div>
  );
}

const tabBarStyles = {
  bar: {
    display:'flex', alignItems:'center',
    height:'var(--tab-height)', padding:'0 8px', gap:'4px',
    WebkitAppRegion:'drag', userSelect:'none'
  },
  controls: { display:'flex', gap:'6px', marginRight:'12px', WebkitAppRegion:'no-drag' },
  dot: { width:12, height:12, borderRadius:'50%' },
  tabs: {
    display:'flex', gap:'2px', flex:1, overflow:'hidden',
    alignItems:'center', WebkitAppRegion:'no-drag'
  },
  tab: {
    display:'flex', alignItems:'center', gap:'6px',
    padding:'6px 12px', borderRadius:'var(--radius-sm) var(--radius-sm) 0 0',
    background:'var(--bg-primary)', color:'var(--text-secondary)',
    fontSize:'12px', cursor:'pointer', maxWidth:'180px',
    transition:'all 0.15s ease', border:'1px solid transparent',
    borderBottom:'none', whiteSpace:'nowrap', overflow:'hidden',
    WebkitAppRegion:'no-drag'
  },
  tabActive: {
    background:'var(--bg-elevated)', color:'var(--text-primary)',
    borderColor:'var(--border)', boxShadow:'0 -2px 0 var(--accent) inset'
  },
  tabTitle: { flex:1, overflow:'hidden', textOverflow:'ellipsis' },
  faviconDot: { width:8, height:8, borderRadius:'50%', background:'var(--accent)', flexShrink:0 },
  loadingDot: { color:'var(--accent)', fontSize:'8px', animation:'pulse 1s infinite' },
  closeBtn: {
    background:'transparent', border:'none', color:'var(--text-muted)',
    cursor:'pointer', fontSize:'10px', padding:'0 2px',
    borderRadius:'3px', lineHeight:1,
    ':hover': { color:'var(--danger)' }
  },
  newTabBtn: {
    background:'transparent', border:'none', color:'var(--text-secondary)',
    cursor:'pointer', padding:'4px 8px', borderRadius:'var(--radius-sm)',
    WebkitAppRegion:'no-drag', fontSize:'14px'
  },
  statusArea: { display:'flex', alignItems:'center', gap:'6px', marginRight:'8px', WebkitAppRegion:'no-drag' },
  statusDot: { width:7, height:7, borderRadius:'50%' },
  dashBtn: {
    background:'transparent', border:'none', color:'var(--text-secondary)',
    cursor:'pointer', padding:'4px 8px', fontSize:'12px',
    WebkitAppRegion:'no-drag', borderRadius:'var(--radius-sm)'
  }
};

// ── URL Bar ───────────────────────────────────────────────────
function UrlBar({ activeTab, onNavigate, urlBarRef }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const url = activeTab?.url || '';
    setInputValue(url === 'aegis://new' ? '' : url);
  }, [activeTab?.id, activeTab?.url]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) onNavigate(inputValue.trim());
  };

  return (
    <form onSubmit={handleSubmit} style={urlBarStyles.form}>
      {/* Lock icon */}
      <span style={urlBarStyles.icon}>🔒</span>
      <input
        ref={urlBarRef}
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onFocus={e => e.target.select()}
        placeholder="Enter URL or search..."
        style={urlBarStyles.input}
      />
      {activeTab?.loading && <span style={urlBarStyles.loadingIndicator}>⟳</span>}
      <span style={urlBarStyles.aegisTag}>🛡️ AEGIS</span>
    </form>
  );
}

const urlBarStyles = {
  form: {
    display:'flex', alignItems:'center', gap:'8px',
    padding:'6px 12px', background:'var(--bg-elevated)',
    borderRadius:'var(--radius-md)', margin:'4px 12px',
    border:'1px solid var(--border)', WebkitAppRegion:'no-drag'
  },
  icon: { fontSize:'12px', flexShrink:0 },
  input: {
    flex:1, background:'transparent', border:'none', outline:'none',
    color:'var(--text-primary)', fontSize:'13px', fontFamily:'var(--font-ui)',
    minWidth:0
  },
  loadingIndicator: { color:'var(--accent)', fontSize:'14px', animation:'spin 1s linear infinite' },
  aegisTag: {
    fontSize:'10px', color:'var(--accent)',
    background:'var(--accent-dim)', padding:'2px 6px',
    borderRadius:'10px', fontWeight:600, flexShrink:0
  }
};

// ── WebviewContainer (defined separately) ─────────────────────
function WebviewContainer({ tab, isActive, onTitleChange, onLoadStart, onLoadStop, onUrlChange }) {
  const webviewRef = tab.webviewRef;

  useEffect(() => {
    const wv = webviewRef?.current;
    if (!wv) return;

    const onTitle = (e) => onTitleChange(e.title);
    const onStart = () => onLoadStart();
    const onStop  = () => onLoadStop();
    const onNav   = (e) => onUrlChange(e.url);

    wv.addEventListener('page-title-updated', onTitle);
    wv.addEventListener('did-start-loading', onStart);
    wv.addEventListener('did-stop-loading', onStop);
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);

    return () => {
      wv.removeEventListener('page-title-updated', onTitle);
      wv.removeEventListener('did-start-loading', onStart);
      wv.removeEventListener('did-stop-loading', onStop);
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [webviewRef]);

  const src = (tab.url && tab.url !== 'aegis://new') ? tab.url : 'about:blank';

  return (
    <div style={{
      position:'absolute', inset:0,
      display: isActive ? 'block' : 'none'
    }}>
      {tab.url === 'aegis://new' ? (
        <NewTabPage />
      ) : (
        <webview
          ref={webviewRef}
          src={src}
          style={{ width:'100%', height:'100%', border:'none' }}
          preload={`file://${window.location.pathname.replace('index.html','preload.js')}`}
          allowpopups="false"
          partition="persist:aegis"
        />
      )}
    </div>
  );
}

// ── New Tab Page ──────────────────────────────────────────────
function NewTabPage() {
  return (
    <div style={ntpStyles.page}>
      <div style={ntpStyles.logo}>🛡️</div>
      <h1 style={ntpStyles.title}>Aegis Browser</h1>
      <p style={ntpStyles.subtitle}>All traffic routed through onion network · Identity protected · WebRTC blocked</p>
      <div style={ntpStyles.statusGrid}>
        <StatusBadge icon="🔒" label="Onion Routing" value="Active" color="success" />
        <StatusBadge icon="👤" label="Identity" value="Protected" color="success" />
        <StatusBadge icon="📡" label="WebRTC" value="Blocked" color="danger" />
        <StatusBadge icon="🎭" label="Canvas" value="Spoofed" color="warning" />
      </div>
    </div>
  );
}

function StatusBadge({ icon, label, value, color }) {
  const colors = { success:'var(--success)', danger:'var(--danger)', warning:'var(--warning)' };
  return (
    <div style={ntpStyles.badge}>
      <span style={{fontSize:'20px'}}>{icon}</span>
      <div>
        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{label}</div>
        <div style={{fontSize:'13px', fontWeight:600, color: colors[color]}}>{value}</div>
      </div>
    </div>
  );
}

const ntpStyles = {
  page: {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    height:'100%', background:'var(--bg-primary)', color:'var(--text-primary)',
    gap:'16px', padding:'40px'
  },
  logo: { fontSize:'64px', filter:'drop-shadow(0 0 20px var(--accent-glow))' },
  title: { fontSize:'28px', fontWeight:700, letterSpacing:'-0.5px', color:'var(--text-primary)' },
  subtitle: { fontSize:'13px', color:'var(--text-secondary)', textAlign:'center', maxWidth:'400px', lineHeight:1.6 },
  statusGrid: { display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center', marginTop:'8px' },
  badge: {
    display:'flex', alignItems:'center', gap:'10px',
    padding:'12px 16px', background:'var(--bg-elevated)',
    borderRadius:'var(--radius-md)', border:'1px solid var(--border)',
    minWidth:'140px'
  }
};

// ── Dashboard Component ───────────────────────────────────────
function Dashboard({ activeTab, allTabs, backendStatus, onRotateIdentity, onRotateRoute }) {
  const { identity, circuit, id: tabId } = activeTab || {};

  return (
    <div style={dashStyles.panel}>
      {/* Header */}
      <div style={dashStyles.header}>
        <span style={dashStyles.headerTitle}>🛡️ Aegis Dashboard</span>
        <div style={{...dashStyles.statusPill, background: backendStatus === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: backendStatus === 'online' ? 'var(--success)' : 'var(--danger)'}}>
          {backendStatus === 'online' ? '● ONLINE' : '● OFFLINE'}
        </div>
      </div>

      {/* Identity Card */}
      <Section title="👤 Current Identity">
        {identity ? (
          <div style={dashStyles.infoGrid}>
            <InfoRow label="User-Agent" value={identity.userAgent?.slice(0, 40) + '…'} />
            <InfoRow label="Timezone" value={identity.timezone} />
            <InfoRow label="Screen" value={`${identity.screen?.width}×${identity.screen?.height}`} />
            <InfoRow label="WebGL" value={identity.webglVendor} />
            <InfoRow label="Canvas Seed" value={`#${identity.canvasSeed}`} mono />
            <InfoRow label="WebRTC" value="BLOCKED" danger />
          </div>
        ) : (
          <EmptyState msg={backendStatus === 'offline' ? 'Backend offline' : 'Loading identity…'} />
        )}
      </Section>

      {/* Circuit Card */}
      <Section title="🌐 Active Circuit">
        {circuit ? (
          <div style={dashStyles.circuit}>
            <CircuitHop role="ENTRY" node={circuit.entry} />
            <div style={dashStyles.hopArrow}>↓</div>
            <CircuitHop role="RELAY" node={circuit.relay} />
            <div style={dashStyles.hopArrow}>↓</div>
            <CircuitHop role="EXIT" node={circuit.exit} />
          </div>
        ) : (
          <EmptyState msg={backendStatus === 'offline' ? 'Backend offline' : 'Building circuit…'} />
        )}
      </Section>

      {/* Control Buttons */}
      <Section title="⚙️ Controls">
        <div style={dashStyles.btnGrid}>
          <ActionButton
            icon="🔄" label="New Identity"
            onClick={() => tabId && onRotateIdentity(tabId)}
            disabled={!tabId || backendStatus !== 'online'}
          />
          <ActionButton
            icon="🛤️" label="New Route"
            onClick={() => tabId && onRotateRoute(tabId)}
            disabled={!tabId || backendStatus !== 'online'}
          />
          <ActionButton
            icon="🧹" label="Clear Session"
            onClick={() => { /* Phase 2: clears identity store */ }}
            variant="warning"
          />
          <ActionButton
            icon="🔬" label="Run Test"
            onClick={() => { /* Phase 8: triggers detection test */ }}
            disabled={backendStatus !== 'online'}
          />
        </div>
      </Section>

      {/* Tab Overview */}
      <Section title={`📑 Open Tabs (${allTabs.length})`}>
        {allTabs.map(tab => (
          <div key={tab.id} style={{
            ...dashStyles.tabRow,
            ...(tab.id === activeTab?.id ? {borderColor:'var(--accent)', background:'var(--accent-dim)'} : {})
          }}>
            <span style={{fontSize:'11px', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {tab.title || 'New Tab'}
            </span>
            {tab.identity && <span style={{fontSize:'9px', color:'var(--success)'}}>●</span>}
          </div>
        ))}
      </Section>
    </div>
  );
}

// Dashboard sub-components
function Section({ title, children }) {
  return (
    <div style={dashStyles.section}>
      <div style={dashStyles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, danger }) {
  return (
    <div style={dashStyles.infoRow}>
      <span style={dashStyles.infoLabel}>{label}</span>
      <span style={{...dashStyles.infoValue, ...(mono?{fontFamily:'var(--font-mono)'}:{}), ...(danger?{color:'var(--danger)'}:{})}}>
        {value || '—'}
      </span>
    </div>
  );
}

function CircuitHop({ role, node }) {
  const roleColors = { ENTRY:'var(--warning)', RELAY:'var(--accent)', EXIT:'var(--success)' };
  return (
    <div style={dashStyles.hop}>
      <div style={{...dashStyles.hopRole, color:roleColors[role]}}>{role}</div>
      <div style={dashStyles.hopInfo}>
        <span style={{fontWeight:600}}>{node?.region || '???'}</span>
        <span style={{color:'var(--text-muted)', fontSize:'10px', fontFamily:'var(--font-mono)'}}>
          {node?.ip ? node.ip.replace(/\d+$/, '***') : 'xxxxxxxx'}
        </span>
        {node?.latencyMs && <span style={{fontSize:'10px', color:'var(--text-secondary)'}}>{node.latencyMs}ms</span>}
      </div>
      {node?.trustScore && (
        <div style={{fontSize:'10px', color: node.trustScore > 0.7 ? 'var(--success)' : 'var(--warning)'}}>
          ⚡{Math.round(node.trustScore * 100)}%
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, variant }) {
  return (
    <button
      style={{...dashStyles.actionBtn, ...(disabled?dashStyles.btnDisabled:{}), ...(variant==='warning'?{borderColor:'rgba(245,158,11,0.3)'}:{})}}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{icon}</span>
      <span style={{fontSize:'11px'}}>{label}</span>
    </button>
  );
}

function EmptyState({ msg }) {
  return <div style={{color:'var(--text-muted)', fontSize:'12px', padding:'8px 0', textAlign:'center'}}>{msg}</div>;
}

const dashStyles = {
  panel: {
    width:'var(--dash-width)', background:'var(--bg-secondary)',
    borderLeft:'1px solid var(--border)', overflowY:'auto',
    display:'flex', flexDirection:'column', gap:'0', flexShrink:0
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, background:'var(--bg-secondary)', zIndex:10
  },
  headerTitle: { fontWeight:700, fontSize:'13px', letterSpacing:'0.5px' },
  statusPill: { fontSize:'9px', fontWeight:700, padding:'3px 8px', borderRadius:'10px', letterSpacing:'0.5px' },
  section: { padding:'12px 16px', borderBottom:'1px solid var(--border)' },
  sectionTitle: { fontSize:'11px', fontWeight:600, color:'var(--text-secondary)', marginBottom:'10px', letterSpacing:'0.5px' },
  infoGrid: { display:'flex', flexDirection:'column', gap:'6px' },
  infoRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' },
  infoLabel: { fontSize:'11px', color:'var(--text-muted)', flexShrink:0 },
  infoValue: { fontSize:'11px', color:'var(--text-primary)', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'180px' },
  circuit: { display:'flex', flexDirection:'column', alignItems:'center', gap:0 },
  hop: {
    display:'flex', alignItems:'center', gap:'10px',
    padding:'8px 12px', background:'var(--bg-elevated)',
    borderRadius:'var(--radius-sm)', border:'1px solid var(--border)',
    width:'100%'
  },
  hopRole: { fontSize:'9px', fontWeight:700, letterSpacing:'1px', width:'38px', flexShrink:0 },
  hopInfo: { display:'flex', flexDirection:'column', flex:1, gap:'1px' },
  hopArrow: { color:'var(--text-muted)', fontSize:'12px', padding:'2px 0' },
  btnGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' },
  actionBtn: {
    display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
    padding:'10px 6px', background:'var(--bg-elevated)',
    border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
    color:'var(--text-primary)', cursor:'pointer', fontSize:'16px',
    transition:'all 0.15s'
  },
  btnDisabled: { opacity:0.4, cursor:'not-allowed' },
  tabRow: {
    display:'flex', alignItems:'center', gap:'8px',
    padding:'6px 10px', borderRadius:'var(--radius-sm)',
    border:'1px solid transparent', marginBottom:'4px',
    background:'var(--bg-elevated)'
  },
  infoGrid: { display:'flex', flexDirection:'column', gap:'6px' }
};

// ─── Mount React App ──────────────────────────────────────────
const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(App));

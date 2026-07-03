// src/theme.js — invoiq Designsystem (zentrale Theme-Datei)
//
// ── FARBEN ────────────────────────────────────────────────────
// Brand (Navy) für Sidebar/dunkle Flächen, Akzent (Violett-Blau) für
// Primäraktionen und aktive Zustände, ruhige violett-getönte Neutrals.
// Statusfarben je mit Flächen- und Border-Variante.
//
// ── TYPOGRAFIE ────────────────────────────────────────────────
// Outfit für UI & Display, JetBrains Mono für Zahlen/Belege
// (tabular-nums). Skala: Display 22/700, H2 16/700, Section-Label
// 11/700 uppercase, Body 13.5–14, Caption 11–12.
//
// ── SPACING ───────────────────────────────────────────────────
// 4er-Raster: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48.
//
// ── RADIUS & SCHATTEN ─────────────────────────────────────────
// Radius 6 (Controls), 8–9 (Panels), 14 (Cards); Schatten shadow1–3
// (Elevation) + shadowXl (Modals/Toasts).
//
// ── STATES ────────────────────────────────────────────────────
// hover (Fläche + translate), focus-visible (2px Akzent-Ring),
// active (scale .985), disabled (.55), loading (Spinner + Skeleton).

export const T = {
  // invoiq v3 — richer, more vivid SaaS palette (deep indigo brand, vivid violet accent)
  brand:     "#101B3D",   // deeper, richer navy-indigo
  brandMid:  "#1E2A57",
  brandLite: "#3D4A7A",
  accent:    "#6D5BFF",   // vivid violet-blue
  accentHover:"#5A45F0",
  accentLight:"#EFEBFF",
  accentPale: "#DCD4FF",

  bg:        "#FFFFFF",
  bgSubtle:  "#F7F8FF",   // soft violet-tinted off-white (was flat gray)
  bgGradient:"linear-gradient(180deg,#F7F8FF 0%,#F1F3FC 100%)", // for full-page backgrounds only
  bgMuted:   "#ECEEFA",
  bgBorder:  "#DBDDF0",

  textPrimary:  "#101B3D",
  textSecondary:"#3D4A7A",
  textMuted:    "#6B7399",
  textPlaceholder:"#9FA6C4",

  // Semantic — more saturated, more "alive"
  green:    "#0F9D58",  greenBg:"#E9FBF1",  greenBdr:"#B7EBCD",
  red:      "#E0392B",  redBg:  "#FEEDEC",  redBdr:  "#F8C4C0",
  amber:    "#D97706",  amberBg:"#FFF6E5",  amberBdr:"#FBDFA0",
  blue:     "#2D6BFF",  blueBg: "#EAF1FF",  blueBdr: "#BFD4FF",
  purple:   "#6D5BFF",  purpleBg:"#EFEBFF", purpleBdr:"#DCD4FF",
  gray:     "#6B7399",  grayBg: "#F7F8FF",  grayBdr: "#DBDDF0",

  // Deeper, more present shadows for visible elevation/depth
  shadow1: "0 1px 2px rgba(16,27,61,.06), 0 2px 6px rgba(35,30,110,.10)",
  shadow2: "0 3px 6px rgba(16,27,61,.07), 0 6px 16px rgba(35,30,110,.14)",
  shadow3: "0 6px 12px rgba(16,27,61,.08), 0 12px 32px rgba(35,30,110,.16)",
  shadowXl:"0 10px 22px rgba(16,27,61,.10), 0 28px 64px rgba(35,30,110,.20)",
};

// Schriften — Outfit (UI) + JetBrains Mono (Zahlen)
export const F={
  display:"'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ui:     "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  mono:   "'JetBrains Mono',ui-monospace,SFMono-Regular,monospace",
};

export const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
body{font-family:${F.ui};background:${T.bgGradient};color:${T.textPrimary};font-size:14px;line-height:1.5;letter-spacing:-.01em;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${T.bgBorder};border-radius:2px;}

/* Animations */
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

.fi{animation:fadeIn .25s ease both}
.fu{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both}
.fu2{animation:fadeUp .4s .06s cubic-bezier(.16,1,.3,1) both}
.fu3{animation:fadeUp .4s .12s cubic-bezier(.16,1,.3,1) both}
.fu4{animation:fadeUp .4s .18s cubic-bezier(.16,1,.3,1) both}
.fu5{animation:fadeUp .4s .24s cubic-bezier(.16,1,.3,1) both}
.sci{animation:scaleIn .2s cubic-bezier(.16,1,.3,1) both}

/* Skeleton */
.skeleton{
  background:linear-gradient(90deg,${T.bgMuted} 25%,${T.bgSubtle} 50%,${T.bgMuted} 75%);
  background-size:400px 100%;
  animation:shimmer 1.2s ease-in-out infinite;
  border-radius:4px;
}

/* ── Buttons — Stripe-precise ── */
.btn{
  font-family:${F.ui};font-size:13.5px;font-weight:500;
  cursor:pointer;border-radius:6px;border:none;
  display:inline-flex;align-items:center;gap:6px;
  transition:all .14s ease;white-space:nowrap;
  letter-spacing:-.01em;text-decoration:none;
}
.btn:active{transform:scale(.985)!important;filter:brightness(.96);}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important;}

/* Zugänglichkeit: sichtbarer Fokus-Ring auf allen Bedienelementen */
.btn:focus-visible,.input:focus-visible,.select:focus-visible,
.nav-item:focus-visible,.tab:focus-visible,.tr-hover:focus-visible{
  outline:2px solid ${T.accent};outline-offset:2px;
}

/* Menü-Einträge in hellen Dropdowns (User-Menü) */
.menu-item{
  display:flex;align-items:center;gap:9px;width:100%;
  padding:8px 10px;background:transparent;border:none;border-radius:7px;
  color:${T.textSecondary};font-size:13px;font-weight:500;font-family:${F.ui};
  cursor:pointer;text-align:left;transition:background .14s,color .14s;
}
.menu-item:hover{background:${T.bgSubtle};color:${T.textPrimary};}

/* ── Typografie-Utilities ── */
.h1{font-family:${F.ui};font-size:22px;font-weight:700;color:${T.textPrimary};letter-spacing:-.025em;line-height:1.25;}
.h2{font-family:${F.ui};font-size:16px;font-weight:700;color:${T.textPrimary};letter-spacing:-.02em;}
.section-label{font-size:11px;font-weight:700;color:${T.textMuted};letter-spacing:.5px;text-transform:uppercase;}
.caption{font-size:12px;color:${T.textMuted};}
.num{font-family:${F.mono};font-variant-numeric:tabular-nums;}

/* Primary — Stripe's indigo */
.btn-primary{
  background:${T.accent};color:#fff;
  padding:8px 16px;
  box-shadow:0 0 0 1px rgba(99,91,255,.2),0 1px 3px rgba(99,91,255,.25),inset 0 1px 0 rgba(255,255,255,.1);
}
.btn-primary:hover{background:${T.accentHover};box-shadow:0 0 0 1px rgba(79,70,229,.3),0 2px 6px rgba(79,70,229,.3),inset 0 1px 0 rgba(255,255,255,.1);}

/* Dark — Stripe's brand button */
.btn-dark{
  background:${T.brand};color:#fff;padding:8px 16px;
  box-shadow:0 0 0 1px rgba(10,37,64,.2),0 1px 3px rgba(10,37,64,.3),inset 0 1px 0 rgba(255,255,255,.06);
}
.btn-dark:hover{background:${T.brandMid};}

/* Ghost — subtle border */
.btn-ghost{
  background:${T.bg};color:${T.textSecondary};
  border:1px solid ${T.bgBorder};padding:7px 14px;
  box-shadow:0 1px 2px rgba(0,0,0,.05);
}
.btn-ghost:hover{background:${T.bgSubtle};border-color:${T.textPlaceholder};color:${T.textPrimary};}

.btn-outline{background:transparent;color:${T.accent};border:1px solid ${T.accentPale};padding:6px 13px;font-size:13px;}
.btn-outline:hover{background:${T.accentLight};}
.btn-danger{background:${T.bg};color:${T.red};border:1px solid ${T.redBdr};padding:6px 13px;font-size:12.5px;}
.btn-success{background:${T.bg};color:${T.green};border:1px solid ${T.greenBdr};padding:6px 13px;font-size:12.5px;}
.btn-lg{padding:10px 22px;font-size:15px;font-weight:600;border-radius:8px;}
.btn-sm{padding:5px 10px;font-size:12px;border-radius:5px;}
.btn-xl{padding:13px 32px;font-size:16px;font-weight:600;border-radius:8px;}

/* ── Inputs — Stripe-exact ── */
.input{
  width:100%;background:${T.bg};
  border:1px solid ${T.bgBorder};border-radius:6px;
  padding:8px 12px;font-family:${F.ui};font-size:14px;
  color:${T.textPrimary};outline:none;
  box-shadow:0 1px 1px rgba(0,0,0,.04),0 2px 4px rgba(10,37,64,.06);
  transition:border-color .14s,box-shadow .14s;
}
.input:focus{
  border-color:${T.accent};
  box-shadow:0 0 0 2px rgba(99,91,255,.15),0 1px 1px rgba(0,0,0,.04);
}
.input::placeholder{color:${T.textPlaceholder};}
.select{
  width:100%;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:6px;
  padding:8px 12px;font-family:${F.ui};font-size:14px;color:${T.textPrimary};
  outline:none;cursor:pointer;
  box-shadow:0 1px 1px rgba(0,0,0,.04);
  transition:border-color .14s;
}
.select:focus{border-color:${T.accent};}
.label{
  display:block;font-size:12px;font-weight:500;
  color:${T.textSecondary};margin-bottom:5px;
}

/* ── Cards — Stripe's layered approach ── */
.card{
  background:${T.bg};border:1px solid rgba(221,225,231,.6);
  border-radius:14px;
  box-shadow:0 16px 32px -20px rgba(10,37,64,.07);
  transition:box-shadow .3s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),border-color .2s;
}
.card-hover:hover,.card.tr-target:hover{
  border-color:rgba(99,91,255,.25);
  box-shadow:0 20px 40px -18px rgba(10,37,64,.13);
  transform:translateY(-2px);
}

/* ── Table ── */
.table{width:100%;border-collapse:collapse;}
.table th{
  text-align:left;padding:9px 14px;
  font-size:11px;color:${T.textMuted};font-weight:600;
  letter-spacing:.6px;text-transform:uppercase;
  border-bottom:1px solid ${T.bgBorder};
  background:${T.bgSubtle};
}
.table th:first-child{border-radius:8px 0 0 0;}
.table th:last-child{border-radius:0 8px 0 0;}
.table td{
  padding:11px 14px;font-size:13.5px;
  border-bottom:1px solid ${T.bgSubtle};
  vertical-align:middle;
  font-variant-numeric:tabular-nums;
}
.tr-hover{transition:background .15s;}
.tr-hover:hover{background:${T.accentLight};cursor:pointer;}

/* ── Badges — Stripe minimal ── */
.badge{
  display:inline-flex;align-items:center;gap:3px;
  border-radius:4px;padding:2px 7px;
  font-size:11px;font-weight:600;letter-spacing:.2px;
}
.badge-green {background:${T.greenBg};color:${T.green}; border:1px solid ${T.greenBdr};}
.badge-red   {background:${T.redBg};  color:${T.red};   border:1px solid ${T.redBdr};}
.badge-amber {background:${T.amberBg};color:${T.amber}; border:1px solid ${T.amberBdr};}
.badge-blue  {background:${T.blueBg}; color:${T.blue};  border:1px solid ${T.blueBdr};}
.badge-purple{background:${T.accentLight};color:${T.accent};border:1px solid ${T.accentPale};}
.badge-gray  {background:${T.bgMuted};color:${T.textSecondary};border:1px solid ${T.bgBorder};}

/* ── Navigation (dunkle Sidebar) ── */
.nav-item{
  display:flex;align-items:center;gap:10px;
  padding:8px 11px;background:transparent;
  color:rgba(255,255,255,.62);border:none;border-radius:8px;
  cursor:pointer;font-size:13px;font-weight:500;
  text-align:left;width:100%;font-family:${F.ui};
  transition:all .18s cubic-bezier(.16,1,.3,1);
  position:relative;
}
.nav-item svg{flex-shrink:0;opacity:.75;transition:opacity .18s;}
.nav-item:hover{color:#fff;background:rgba(255,255,255,.07);}
.nav-item:hover svg{opacity:1;}
.nav-item.active{color:#fff;background:rgba(109,91,255,.28);font-weight:600;}
.nav-item.active svg{opacity:1;}
.nav-item.active::before{
  content:'';position:absolute;left:-8px;top:50%;transform:translateY(-50%);
  width:3px;height:18px;border-radius:0 3px 3px 0;background:${T.accent};
}
.nav-item:active{transform:scale(.98);}
.nav-section{
  font-size:10px;font-weight:700;color:rgba(255,255,255,.36);
  letter-spacing:.9px;text-transform:uppercase;
  padding:14px 11px 5px;white-space:nowrap;overflow:hidden;
}

/* ── Layout ── */
.sidebar{
  width:224px;
  background:linear-gradient(180deg,#0D1630 0%,${T.brand} 55%,#15214B 100%);
  border-right:none;
  display:flex;flex-direction:column;flex-shrink:0;
  position:sticky;top:0;height:100vh;overflow-y:auto;overflow-x:hidden;
  transition:width .22s cubic-bezier(.16,1,.3,1);
}
.sidebar ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);}
/* Collapsed: nur Icons (Desktop) */
.sidebar.collapsed{width:66px;}
.sidebar.collapsed .nav-label,.sidebar.collapsed .nav-section,
.sidebar.collapsed .sb-hide{display:none!important;}
.sidebar.collapsed .nav-item{justify-content:center;padding:9px 0;}
.sidebar.collapsed .nav-item.active::before{left:-2px;}
.topbar{
  height:52px;border-bottom:1px solid ${T.bgBorder};
  display:flex;align-items:center;justify-content:space-between;
  padding:0 20px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);
  flex-shrink:0;position:sticky;top:0;z-index:50;gap:12px;
}

/* ── Misc ── */
.divider{height:1px;background:${T.bgBorder};}
.progress{height:3px;background:${T.bgMuted};border-radius:3px;overflow:hidden;}
.progress-fill{height:100%;background:linear-gradient(90deg,${T.accent},#8B7FFF);border-radius:3px;transition:width .5s cubic-bezier(.16,1,.3,1);}
.stat-num{
  font-family:${F.mono};font-size:27px;font-weight:700;
  color:${T.textPrimary};line-height:1;letter-spacing:-.04em;
  font-variant-numeric:tabular-nums;
}
.tab{
  padding:8px 14px;font-size:13px;font-weight:500;
  color:${T.textMuted};border:none;background:transparent;
  cursor:pointer;border-bottom:2px solid transparent;
  font-family:${F.ui};transition:all .12s;
  letter-spacing:-.01em;
}
.tab.active{color:${T.textPrimary};border-bottom-color:${T.accent};font-weight:600;}
.tab:hover{color:${T.textSecondary};}
.avatar{
  width:26px;height:26px;border-radius:50%;
  background:${T.accentLight};display:flex;
  align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:${T.accent};flex-shrink:0;
}
.modal-overlay{
  position:fixed;inset:0;background:rgba(10,37,64,.4);
  z-index:1000;display:flex;align-items:center;justify-content:center;
  padding:24px;backdrop-filter:blur(4px);
}
.modal{
  background:${T.bg};border-radius:8px;padding:24px;
  max-width:480px;width:100%;
  box-shadow:0 4px 8px rgba(0,0,0,.04),0 20px 48px rgba(10,37,64,.16);
}

/* ── Landing-specific ── */
.hero-pill{
  display:inline-flex;align-items:center;gap:6px;
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:20px;padding:4px 12px;
  font-size:12px;color:${T.textSecondary};font-weight:500;
  box-shadow:0 1px 2px rgba(0,0,0,.05);
}
.feature-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:22px;
  transition:all .15s;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 6px rgba(10,37,64,.05);
}
.feature-card:hover{
  border-color:${T.textPlaceholder};
  box-shadow:0 2px 4px rgba(0,0,0,.04),0 6px 16px rgba(10,37,64,.08);
  transform:translateY(-2px);
}
.pricing-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:28px;
  transition:all .15s;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 6px rgba(10,37,64,.05);
}
.pricing-card:hover{
  box-shadow:0 4px 8px rgba(0,0,0,.04),0 12px 32px rgba(10,37,64,.1);
  transform:translateY(-2px);
}
.pricing-card.featured{background:${T.brand};border-color:${T.brand};}
/* Integration logo pills — futuristic */
.integration-logo{
  display:inline-flex;align-items:center;gap:9px;
  padding:11px 20px;
  background:rgba(10,37,64,.04);
  border:1px solid rgba(99,91,255,.18);
  border-radius:10px;
  font-size:13px;font-weight:600;letter-spacing:-.01em;
  color:${T.textSecondary};
  white-space:nowrap;cursor:default;
  transition:border-color .2s,color .2s,background .2s,box-shadow .2s,transform .2s;
  user-select:none;flex-shrink:0;
  position:relative;
  overflow:hidden;
}
.integration-logo::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(99,91,255,.07) 0%,transparent 60%);
  pointer-events:none;
}
.integration-logo:hover{
  border-color:rgba(99,91,255,.55);
  color:${T.textPrimary};
  background:rgba(99,91,255,.07);
  box-shadow:0 0 0 1px rgba(99,91,255,.15),0 4px 20px rgba(99,91,255,.15);
  transform:translateY(-2px);
}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes shimmerX{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
@keyframes drawIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.bento-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;}
.bento-grid .bento-wide{grid-column:span 2;}
@media(max-width:768px){.bento-grid{grid-template-columns:1fr;}.bento-grid .bento-wide{grid-column:span 1;}}
.zg-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:16px;}
@media(max-width:768px){.zg-grid{grid-template-columns:1fr;}}
.btn:active{transform:translateY(1px) scale(.985);}
.bento-card{background:#fff;border:1px solid rgba(221,225,231,.55);border-radius:18px;padding:26px;position:relative;overflow:hidden;transition:box-shadow .3s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1);box-shadow:0 18px 38px -18px rgba(10,37,64,.06);}
.bento-card:hover{transform:translateY(-3px);box-shadow:0 24px 48px -16px rgba(10,37,64,.12);}
.live-dot{width:7px;height:7px;border-radius:50%;display:inline-block;animation:pulseDot 2.4s ease-in-out infinite;}
.shimmer-bar{background:linear-gradient(90deg,rgba(99,91,255,.07) 25%,rgba(99,91,255,.16) 50%,rgba(99,91,255,.07) 75%);background-size:200% 100%;animation:shimmerX 2.6s linear infinite;}
.marquee-track{
  display:flex;gap:10px;
  animation:marquee 32s linear infinite;
  width:max-content;
}
.marquee-track:hover{animation-play-state:paused;}
.marquee-wrap{
  overflow:hidden;
  mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
  -webkit-mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
}
.connector-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:8px;padding:16px;transition:all .14s;cursor:pointer;
  box-shadow:0 1px 1px rgba(0,0,0,.03),0 2px 4px rgba(10,37,64,.05);
}
.connector-card:hover{border-color:${T.accent};box-shadow:0 2px 4px rgba(0,0,0,.04),0 4px 12px rgba(10,37,64,.08);transform:translateY(-1px);}
.connector-card.connected{border-color:${T.greenBdr};background:${T.greenBg};}

/* Scroll reveal */
.reveal{opacity:0;transform:translateY(20px);transition:opacity .5s cubic-bezier(.16,1,.3,1),transform .5s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* Mobile-Navigation: Sidebar als Overlay-Drawer statt ersatzlos versteckt */
.mobile-menu-btn{display:none;}
.mobile-nav-overlay{display:none;}
@media(max-width:768px){
  .sidebar{display:none;}
  .sidebar.mobile-open{
    display:flex;position:fixed;top:0;left:0;bottom:0;z-index:1300;
    width:min(280px,82vw);height:100vh;
    box-shadow:0 0 0 100vmax rgba(10,37,64,.35),8px 0 32px rgba(10,37,64,.25);
    animation:drawerIn .22s cubic-bezier(.16,1,.3,1);
  }
  @keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  .mobile-menu-btn{
    display:flex;align-items:center;justify-content:center;
    width:34px;height:34px;border-radius:8px;flex-shrink:0;
    background:${T.bgSubtle};border:1px solid ${T.bgBorder};cursor:pointer;
  }
  .mobile-nav-overlay{display:block;position:fixed;inset:0;z-index:1299;}
  .topbar{padding:0 12px;gap:8px;}
  .topbar .sb-hide{display:none!important;}
  main{padding:16px 14px!important;}
}
`;

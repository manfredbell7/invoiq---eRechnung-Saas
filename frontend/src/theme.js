// src/theme.js — invoiq Designsystem (zentrale Theme-Datei)
//
// Leitbild: „ruhig wie eine Privatbank". Ruhe statt Lärm, Beweise zeigen,
// Zahlen zuerst. Referenz-Entwürfe: Design-Canvas „Invoiq Redesign".
//
// ── FARBEN ────────────────────────────────────────────────────
// Tinte (#0F1729) für Text und dunkle Flächen, Papier (#F7F6F2) als
// warmer Grund, genau EIN Akzent (Kobalt #2D4FD6) für Primäraktionen.
// Statusfarben je mit Flächen- und Border-Variante; keine Verläufe.
//
// ── TYPOGRAFIE ────────────────────────────────────────────────
// Newsreader (Serif) für Display-Überschriften, Geist für UI,
// Geist Mono für Belegnummern/Adressen. Beträge: tabular-nums.
// Skala: Display 36–40/400, Kennzahl 30/600, Titel 15/600,
// Body 13.5–14, Caption 12–12.5.
//
// ── SPACING ───────────────────────────────────────────────────
// 4er-Raster: 4 / 8 / 12 / 16 / 24 / 40.
//
// ── RADIUS & SCHATTEN ─────────────────────────────────────────
// Radius 6 (Tags), 10 (Controls), 14 (Karten), 28 (Bühnen).
// Schatten: 1px-Kante + weicher Tiefenschatten.
//
// ── STATES ────────────────────────────────────────────────────
// hover (Fläche), focus-visible (Kobalt-Ring), active (scale .985),
// disabled (.55), loading (Spinner + Skeleton).

export const T = {
  brand:     "#0F1729",   // Tinte
  brandMid:  "#1C2438",
  brandLite: "#3B4256",
  accent:    "#2D4FD6",   // Kobalt
  accentHover:"#1F3AAE",
  accentLight:"#EBEFFC",
  accentPale: "#D5DCF7",

  bg:        "#FFFFFF",
  bgSubtle:  "#F7F6F2",   // Papier
  bgGradient:"#F7F6F2",
  bgMuted:   "#EFEDE6",
  bgBorder:  "#E7E4DC",
  bgSide:    "#FBFAF7",   // Sidebar
  border:    "#E7E4DC",   // Alias für bgBorder

  textPrimary:  "#0F1729",
  textSecondary:"#3B4256",
  textMuted:    "#6B7080",
  textPlaceholder:"#9A9DA8",

  green:    "#1D7A4F",  greenBg:"#E8F3EC",  greenBdr:"#C9E3D3",  greenText:"#17603E",
  red:      "#C9372C",  redBg:  "#FBEAE8",  redBdr:  "#EBCFCB",  redText:"#A3241C",
  amber:    "#A15C07",  amberBg:"#FBF1E1",  amberBdr:"#EFD8B0",
  blue:     "#2D4FD6",  blueBg: "#EBEFFC",  blueBdr: "#D5DCF7",
  purple:   "#5B4BB8",  purpleBg:"#EFEDFA", purpleBdr:"#DAD5F2",
  gray:     "#6B7080",  grayBg: "#F1EFE9",  grayBdr: "#E7E4DC",

  shadow1: "0 1px 2px rgba(15,23,41,.05)",
  shadow2: "0 1px 2px rgba(15,23,41,.05), 0 8px 24px -12px rgba(15,23,41,.14)",
  shadow3: "0 1px 2px rgba(15,23,41,.06), 0 16px 40px -16px rgba(15,23,41,.22)",
  shadowXl:"0 2px 4px rgba(15,23,41,.06), 0 30px 60px -24px rgba(15,23,41,.35)",
};

// Schriften — Newsreader (Display) + Geist (UI) + Geist Mono (Belege)
export const F={
  display:"'Newsreader',Georgia,'Times New Roman',serif",
  ui:     "'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  mono:   "'Geist Mono',ui-monospace,SFMono-Regular,monospace",
};

export const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
body{font-family:${F.ui};background:${T.bgSubtle};color:${T.textPrimary};font-size:14px;line-height:1.5;letter-spacing:-.005em;font-variant-numeric:tabular-nums;}
::selection{background:${T.accentPale};}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${T.bgBorder};border-radius:3px;}

/* Animations */
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

.fi{animation:fadeIn .25s ease both}
.fu{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
.fu2{animation:fadeUp .45s .06s cubic-bezier(.16,1,.3,1) both}
.fu3{animation:fadeUp .45s .12s cubic-bezier(.16,1,.3,1) both}
.fu4{animation:fadeUp .45s .18s cubic-bezier(.16,1,.3,1) both}
.fu5{animation:fadeUp .45s .24s cubic-bezier(.16,1,.3,1) both}
.sci{animation:scaleIn .2s cubic-bezier(.16,1,.3,1) both}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}

/* Skeleton */
.skeleton{
  background:linear-gradient(90deg,${T.bgMuted} 25%,${T.bgSubtle} 50%,${T.bgMuted} 75%);
  background-size:400px 100%;
  animation:shimmer 1.2s ease-in-out infinite;
  border-radius:6px;
}

/* ── Buttons ── */
.btn{
  font-family:${F.ui};font-size:13.5px;font-weight:600;
  cursor:pointer;border-radius:10px;border:none;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  transition:background .14s,border-color .14s,color .14s,box-shadow .14s,transform .08s;
  white-space:nowrap;letter-spacing:-.01em;text-decoration:none;line-height:1.2;
}
.btn:active{transform:scale(.985);}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important;}

/* Zugänglichkeit: sichtbarer Fokus-Ring auf allen Bedienelementen */
.btn:focus-visible,.input:focus-visible,.select:focus-visible,
.nav-item:focus-visible,.tab:focus-visible,.tr-hover:focus-visible,.menu-item:focus-visible{
  outline:2px solid ${T.accent};outline-offset:2px;
}

.menu-item{
  display:flex;align-items:center;gap:9px;width:100%;
  padding:9px 10px;background:transparent;border:none;border-radius:8px;
  color:${T.textSecondary};font-size:13.5px;font-weight:500;font-family:${F.ui};
  cursor:pointer;text-align:left;transition:background .14s,color .14s;
}
.menu-item:hover{background:${T.bgSubtle};color:${T.textPrimary};}

/* ── Typografie-Utilities ── */
.display{font-family:${F.display};font-weight:400;letter-spacing:-.02em;line-height:1.05;color:${T.textPrimary};}
.h1{font-family:${F.display};font-size:34px;font-weight:400;color:${T.textPrimary};letter-spacing:-.02em;line-height:1.1;}
.h2{font-family:${F.ui};font-size:15px;font-weight:600;color:${T.textPrimary};letter-spacing:-.01em;}
.section-label{font-size:11px;font-weight:600;color:${T.textMuted};letter-spacing:.06em;text-transform:uppercase;}
.caption{font-size:12.5px;color:${T.textMuted};}
.num{font-variant-numeric:tabular-nums;}
.mono{font-family:${F.mono};}

.btn-primary{
  background:${T.accent};color:#fff;padding:9px 16px;
  box-shadow:0 1px 2px rgba(15,23,41,.18),inset 0 1px 0 rgba(255,255,255,.14);
}
.btn-primary:hover{background:${T.accentHover};}

.btn-dark{
  background:${T.brand};color:#fff;padding:9px 16px;
  box-shadow:0 1px 2px rgba(15,23,41,.2),inset 0 1px 0 rgba(255,255,255,.08);
}
.btn-dark:hover{background:${T.brandMid};}

.btn-ghost{
  background:${T.bg};color:${T.textPrimary};
  border:1px solid ${T.bgBorder};padding:8px 14px;
  box-shadow:0 1px 2px rgba(15,23,41,.04);
}
.btn-ghost:hover{background:${T.bgSubtle};border-color:#D6D2C6;}

.btn-outline{background:transparent;color:${T.accent};border:1px solid ${T.accentPale};padding:7px 13px;font-size:13px;}
.btn-outline:hover{background:${T.accentLight};}
.btn-danger{background:${T.bg};color:${T.redText};border:1px solid ${T.redBdr};padding:7px 13px;font-size:13px;}
.btn-danger:hover{background:${T.redBg};}
.btn-success{background:${T.bg};color:${T.greenText};border:1px solid ${T.greenBdr};padding:7px 13px;font-size:13px;}
.btn-success:hover{background:${T.greenBg};}
.btn-lg{padding:12px 22px;font-size:15px;border-radius:12px;}
.btn-sm{padding:6px 11px;font-size:12.5px;border-radius:8px;}
.btn-xl{padding:15px 28px;font-size:15.5px;border-radius:12px;}

/* ── Inputs ── */
.input{
  width:100%;background:${T.bg};
  border:1px solid ${T.bgBorder};border-radius:10px;
  padding:9px 12px;font-family:${F.ui};font-size:14px;
  color:${T.textPrimary};outline:none;
  box-shadow:0 1px 2px rgba(15,23,41,.04);
  transition:border-color .14s,box-shadow .14s;
}
.input:hover{border-color:#D6D2C6;}
.input:focus{border-color:${T.accent};box-shadow:0 0 0 4px rgba(45,79,214,.12);}
.input::placeholder{color:${T.textPlaceholder};}
.select{
  width:100%;background:${T.bg};border:1px solid ${T.bgBorder};border-radius:10px;
  padding:9px 12px;font-family:${F.ui};font-size:14px;color:${T.textPrimary};
  outline:none;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,41,.04);
  transition:border-color .14s,box-shadow .14s;
}
.select:focus{border-color:${T.accent};box-shadow:0 0 0 4px rgba(45,79,214,.12);}
.label{display:block;font-size:13px;font-weight:500;color:${T.textSecondary};margin-bottom:6px;}

/* ── Cards ── */
.card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:14px;box-shadow:0 1px 2px rgba(15,23,41,.04);
  transition:box-shadow .2s,border-color .2s,transform .2s;
}
.card-hover:hover,.card.tr-target:hover{border-color:#D6D2C6;box-shadow:${T.shadow2};}
.card-link{cursor:pointer;}
.card-link:hover{border-color:#D6D2C6;box-shadow:${T.shadow2};}

/* ── Table ── */
.table{width:100%;border-collapse:collapse;}
.table th{
  text-align:left;padding:10px 16px;
  font-size:12px;color:${T.textMuted};font-weight:500;
  border-bottom:1px solid ${T.bgMuted};background:#FAF9F6;
}
.table td{
  padding:13px 16px;font-size:13.5px;
  border-bottom:1px solid ${T.bgMuted};
  vertical-align:middle;font-variant-numeric:tabular-nums;
}
.table tbody tr:last-child td{border-bottom:none;}
.tr-hover{transition:background .12s;}
.tr-hover:hover{background:#FAF9F6;cursor:pointer;}

/* ── Badges (Pill mit Punkt) ── */
.badge{
  display:inline-flex;align-items:center;gap:6px;
  border-radius:999px;padding:3px 10px 3px 8px;
  font-size:12px;font-weight:500;white-space:nowrap;
}
.badge::before{content:'';width:6px;height:6px;border-radius:999px;background:currentColor;opacity:.85;flex-shrink:0;}
.badge-green {background:${T.greenBg};color:${T.greenText};}
.badge-red   {background:${T.redBg};  color:${T.redText};}
.badge-amber {background:${T.amberBg};color:#7A4405;}
.badge-blue  {background:${T.blueBg}; color:${T.accentHover};}
.badge-purple{background:${T.purpleBg};color:${T.purple};}
.badge-gray  {background:${T.grayBg};color:${T.textSecondary};}
.tag{display:inline-flex;align-items:center;font-size:12px;font-weight:500;color:${T.textSecondary};border:1px solid ${T.bgBorder};border-radius:6px;padding:2px 7px;background:${T.bg};}

/* ── Navigation (helle Sidebar) ── */
.nav-item{
  display:flex;align-items:center;gap:10px;
  height:36px;padding:0 11px;background:transparent;
  color:${T.textSecondary};border:1px solid transparent;border-radius:8px;
  cursor:pointer;font-size:13.5px;font-weight:500;
  text-align:left;width:100%;font-family:${F.ui};
  transition:background .14s,color .14s,border-color .14s;
  position:relative;
}
.nav-item svg{flex-shrink:0;opacity:.8;}
.nav-item:hover{color:${T.textPrimary};background:${T.bgMuted};}
.nav-item.active{color:${T.textPrimary};background:${T.bg};border-color:${T.bgBorder};font-weight:600;box-shadow:0 1px 2px rgba(15,23,41,.05);}
.nav-item.active svg{opacity:1;color:${T.accent};}
.nav-item:active{transform:scale(.985);}
.nav-section{
  font-size:11px;font-weight:600;color:#8A8E9A;
  letter-spacing:.06em;text-transform:uppercase;
  padding:18px 11px 6px;white-space:nowrap;overflow:hidden;
}

/* ── Layout ── */
.sidebar{
  width:248px;background:${T.bgSide};
  border-right:1px solid ${T.bgBorder};
  display:flex;flex-direction:column;flex-shrink:0;
  position:sticky;top:0;height:100vh;overflow-y:auto;overflow-x:hidden;
  transition:width .22s cubic-bezier(.16,1,.3,1);
}
.sidebar.collapsed{width:68px;}
.sidebar.collapsed .nav-label,.sidebar.collapsed .nav-section,
.sidebar.collapsed .sb-hide{display:none!important;}
.sidebar.collapsed .nav-item{justify-content:center;padding:0;}
.topbar{
  height:64px;border-bottom:1px solid ${T.bgBorder};
  display:flex;align-items:center;justify-content:space-between;
  padding:0 32px;background:rgba(247,246,242,.88);backdrop-filter:saturate(1.4) blur(10px);
  flex-shrink:0;position:sticky;top:0;z-index:50;gap:14px;
}

/* ── Misc ── */
.divider{height:1px;background:${T.bgBorder};}
.progress{height:6px;background:${T.bgMuted};border-radius:999px;overflow:hidden;}
.progress-fill{height:100%;background:${T.accent};border-radius:999px;transition:width .5s cubic-bezier(.16,1,.3,1);}
.stat-num{
  font-family:${F.ui};font-size:30px;font-weight:600;
  color:${T.textPrimary};line-height:1;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;
}
.tab{
  padding:9px 14px;font-size:13.5px;font-weight:500;
  color:${T.textMuted};border:none;background:transparent;
  cursor:pointer;border-bottom:2px solid transparent;
  font-family:${F.ui};transition:color .12s,border-color .12s;
}
.tab.active{color:${T.textPrimary};border-bottom-color:${T.textPrimary};font-weight:600;}
.tab:hover{color:${T.textPrimary};}
.avatar{
  width:30px;height:30px;border-radius:50%;
  background:${T.brand};display:flex;
  align-items:center;justify-content:center;
  font-size:12px;font-weight:600;color:#fff;flex-shrink:0;
}
.modal-overlay{
  position:fixed;inset:0;background:rgba(15,23,41,.45);
  z-index:1000;display:flex;align-items:center;justify-content:center;
  padding:24px;backdrop-filter:blur(3px);
}
.modal{
  background:${T.bg};border-radius:16px;padding:28px;
  max-width:480px;width:100%;border:1px solid ${T.bgBorder};
  box-shadow:${T.shadowXl};
}

/* ── Landing-specific ── */
.hero-pill{
  display:inline-flex;align-items:center;gap:8px;
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:999px;padding:5px 14px 5px 6px;
  font-size:13px;color:${T.textSecondary};font-weight:500;
}
.feature-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:16px;padding:26px;transition:border-color .2s,box-shadow .2s;
}
.feature-card:hover{border-color:#D6D2C6;box-shadow:${T.shadow2};}
.pricing-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:18px;padding:30px;transition:box-shadow .2s,border-color .2s;
}
.pricing-card:hover{box-shadow:${T.shadow3};border-color:#D6D2C6;}
.pricing-card.featured{background:${T.brand};border-color:${T.brand};}
.integration-logo{
  display:inline-flex;align-items:center;gap:9px;
  padding:10px 18px;background:${T.bg};
  border:1px solid ${T.bgBorder};border-radius:10px;
  font-size:13.5px;font-weight:600;letter-spacing:-.01em;
  color:${T.textSecondary};white-space:nowrap;cursor:default;
  transition:border-color .2s,color .2s;user-select:none;flex-shrink:0;
}
.integration-logo:hover{border-color:#D6D2C6;color:${T.textPrimary};}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes shimmerX{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
@keyframes drawIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.bento-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;}
.bento-grid .bento-wide{grid-column:span 2;}
@media(max-width:768px){.bento-grid{grid-template-columns:1fr;}.bento-grid .bento-wide{grid-column:span 1;}}
.zg-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:16px;}
@media(max-width:768px){.zg-grid{grid-template-columns:1fr;}}
.bento-card{background:#fff;border:1px solid ${T.bgBorder};border-radius:18px;padding:26px;position:relative;overflow:hidden;transition:box-shadow .2s,border-color .2s;}
.bento-card:hover{border-color:#D6D2C6;box-shadow:${T.shadow2};}
.live-dot{width:7px;height:7px;border-radius:50%;display:inline-block;animation:pulseDot 2.4s ease-in-out infinite;}
.shimmer-bar{background:linear-gradient(90deg,${T.bgMuted} 25%,${T.accentLight} 50%,${T.bgMuted} 75%);background-size:200% 100%;animation:shimmerX 2.6s linear infinite;}
.marquee-track{display:flex;gap:10px;animation:marquee 40s linear infinite;width:max-content;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-wrap{
  overflow:hidden;
  mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
  -webkit-mask-image:linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%);
}
.connector-card{
  background:${T.bg};border:1px solid ${T.bgBorder};
  border-radius:12px;padding:16px;transition:border-color .14s,box-shadow .14s;cursor:pointer;
}
.connector-card:hover{border-color:${T.accent};box-shadow:${T.shadow2};}
.connector-card.connected{border-color:${T.greenBdr};background:${T.greenBg};}

/* Scroll reveal */
.reveal{opacity:0;transform:translateY(16px);transition:opacity .5s cubic-bezier(.16,1,.3,1),transform .5s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* Responsive Hilfsklassen */
.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}
.split{display:flex;gap:16px;}
@media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.split{flex-direction:column;}.split>*{width:auto!important;}}
@media(max-width:520px){.kpi-grid{grid-template-columns:1fr 1fr;gap:10px;}}

/* Mobile-Navigation: Sidebar als Overlay-Drawer */
.mobile-menu-btn{display:none;}
.mobile-nav-overlay{display:none;}
@media(max-width:768px){
  .sidebar{display:none;}
  .sidebar.mobile-open{
    display:flex;position:fixed;top:0;left:0;bottom:0;z-index:1300;
    width:min(288px,84vw);height:100vh;
    box-shadow:0 0 0 100vmax rgba(15,23,41,.35),8px 0 32px rgba(15,23,41,.2);
    animation:drawerIn .22s cubic-bezier(.16,1,.3,1);
  }
  @keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  .mobile-menu-btn{
    display:flex;align-items:center;justify-content:center;
    width:40px;height:40px;border-radius:10px;flex-shrink:0;
    background:${T.bg};border:1px solid ${T.bgBorder};cursor:pointer;
  }
  .mobile-nav-overlay{display:block;position:fixed;inset:0;z-index:1299;}
  .topbar{padding:0 14px;gap:10px;}
  .hide-mobile{display:none!important;}
  .topbar .sb-hide{display:none!important;}
  main{padding:20px 16px!important;}
}
`;

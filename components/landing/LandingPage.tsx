'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CSS = `
/* ─── Reset & Base ─────────────────────────────────────── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; font-size: 16px; }
#pp-landing {
  font-family: 'Syne', system-ui, sans-serif;
  background: #090C14;
  color: rgba(255,255,255,0.88);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
#pp-landing a { text-decoration: none; color: inherit; }
#pp-landing button { font-family: 'Syne', sans-serif; cursor: pointer; border: none; }

/* ─── Scrollbar ────────────────────────────────────────── */
#pp-landing ::-webkit-scrollbar { width: 5px; }
#pp-landing ::-webkit-scrollbar-track { background: transparent; }
#pp-landing ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* ─── Tokens — Dark (default) ──────────────────────────── */
#pp-landing {
  --pp-cyan: oklch(0.82 0.19 200);
  --pp-cyan-dim: oklch(0.55 0.19 200);
  --pp-green: #00FF9D;
  --pp-yellow: #F59E0B;
  --pp-red: #FF3B5C;
  --pp-bg: #090C14;
  --pp-bg-2: #0D1117;
  --pp-bg-card: #111827;
  --pp-border: rgba(255,255,255,0.07);
  --pp-text-1: rgba(255,255,255,0.92);
  --pp-text-2: rgba(255,255,255,0.45);
  --pp-text-3: rgba(255,255,255,0.22);
}

/* ─── Tokens — Light ───────────────────────────────────── */
#pp-landing.pp-light {
  --pp-cyan: oklch(0.50 0.19 200);
  --pp-cyan-dim: oklch(0.50 0.19 200);
  --pp-green: #059669;
  --pp-yellow: #D97706;
  --pp-red: #DC2626;
  --pp-bg: #F8FAFC;
  --pp-bg-2: #F1F5F9;
  --pp-bg-card: #FFFFFF;
  --pp-border: rgba(0,0,0,0.08);
  --pp-text-1: rgba(0,0,0,0.88);
  --pp-text-2: rgba(0,0,0,0.50);
  --pp-text-3: rgba(0,0,0,0.28);
  background: #F8FAFC;
  color: rgba(0,0,0,0.88);
}
#pp-landing.pp-light ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
#pp-landing.pp-light .pp-nav { background: rgba(248,250,252,0.92) !important; border-bottom: 1px solid rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-stats-strip { background: #EEF2F7; }
#pp-landing.pp-light .pp-section-alt { background: #EEF2F7; }
#pp-landing.pp-light .pp-mockup { background: #E2E8F0; border-color: rgba(0,0,0,0.12); box-shadow: 0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-mockup-titlebar { background: #CBD5E1; border-bottom-color: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-m-sidebar { background: #E2E8F0; border-right-color: rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-m-logo-text { color: rgba(0,0,0,0.7); }
#pp-landing.pp-light .pp-m-item { color: rgba(0,0,0,0.38); }
#pp-landing.pp-light .pp-m-main { background: #F8FAFC; }
#pp-landing.pp-light .pp-m-coach-banner { background: oklch(0.50 0.19 200 / 0.07); border-color: oklch(0.50 0.19 200 / 0.18); }
#pp-landing.pp-light .pp-m-coach-text { color: rgba(0,0,0,0.6); }
#pp-landing.pp-light .pp-m-kpi { background: #FFFFFF; border-color: rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-m-kpi-label { color: rgba(0,0,0,0.35); }
#pp-landing.pp-light .pp-m-bar-track { background: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-m-table { background: #FFFFFF; border-color: rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-m-table-title { color: rgba(0,0,0,0.5); }
#pp-landing.pp-light .pp-m-row-label { color: rgba(0,0,0,0.4); }
#pp-landing.pp-light .pp-m-period .pp-m-chip:not(.active) { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.4); border-color: rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-problem-card { background: #FFFFFF; }
#pp-landing.pp-light .pp-how-card { background: #FFFFFF; }
#pp-landing.pp-light .pp-feature-card { background: #FFFFFF; }
#pp-landing.pp-light .pp-pricing-card { background: #FFFFFF; }
#pp-landing.pp-light .pp-pricing-card.featured { background: linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 100%); border-color: oklch(0.50 0.19 200 / 0.35); }
#pp-landing.pp-light .pp-screen-card { background: #FFFFFF; }
#pp-landing.pp-light .pp-screen-titlebar { background: #E2E8F0; border-bottom-color: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-mini-checkin, #pp-landing.pp-light .pp-mini-pipeline { background: #F1F5F9; border-color: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-mc-btn { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
#pp-landing.pp-light .pp-mc-bar { background: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-mp-bar { background: rgba(0,0,0,0.04); }
#pp-landing.pp-light .pp-sem-callout { background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%); }
#pp-landing.pp-light .pp-sem-item { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-sem-item-desc { color: rgba(0,0,0,0.38); }
#pp-landing.pp-light .pp-btn-nav-ghost { border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.5); }
#pp-landing.pp-light .pp-btn-nav-ghost:hover { border-color: rgba(0,0,0,0.2); color: rgba(0,0,0,0.8); }
#pp-landing.pp-light .pp-btn-hero-ghost { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.8); }
#pp-landing.pp-light .pp-btn-hero-ghost:hover { background: rgba(0,0,0,0.08); }
#pp-landing.pp-light .pp-hero-social-badge { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
#pp-landing.pp-light .pp-pricing-btn-default { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.8); border-color: rgba(0,0,0,0.1); }
#pp-landing.pp-light .pp-pricing-btn-default:hover { background: rgba(0,0,0,0.09); }
#pp-landing.pp-light .pp-nav-links a { color: rgba(0,0,0,0.5); }
#pp-landing.pp-light .pp-nav-links a:hover { color: rgba(0,0,0,0.85); }
#pp-landing.pp-light footer { background: #F1F5F9; border-top-color: rgba(0,0,0,0.07); }
#pp-landing.pp-light .pp-footer-name { color: rgba(0,0,0,0.45); }
#pp-landing.pp-light .pp-hero::after {
  background-image:
    linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
}
#pp-landing.pp-light .pp-cta-section { background: #EEF2F7; border-top-color: rgba(0,0,0,0.06); }
#pp-landing.pp-light .pp-cta-section::before { background: radial-gradient(ellipse, oklch(0.50 0.19 200 / 0.08) 0%, transparent 70%); }

/* ─── Animations ───────────────────────────────────────── */
@keyframes pp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.75)} }
@keyframes pp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes pp-scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
@keyframes pp-cyanPulse { 0%,100%{box-shadow:0 0 20px oklch(0.82 0.19 200/20%)} 50%{box-shadow:0 0 40px oklch(0.82 0.19 200/40%)} }
@keyframes pp-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pp-fadeIn { from{opacity:0} to{opacity:1} }

/* Scroll reveal */
#pp-landing .pp-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1); }
#pp-landing .pp-reveal.visible { opacity: 1; transform: translateY(0); }
#pp-landing .pp-reveal-delay-1 { transition-delay: 80ms; }
#pp-landing .pp-reveal-delay-2 { transition-delay: 160ms; }
#pp-landing .pp-reveal-delay-3 { transition-delay: 240ms; }
#pp-landing .pp-reveal-delay-4 { transition-delay: 320ms; }
#pp-landing .pp-reveal-delay-5 { transition-delay: 400ms; }

/* ─── NAV ──────────────────────────────────────────────── */
#pp-landing .pp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  height: 64px;
  background: rgba(9,12,20,0.85);
  border-bottom: 1px solid var(--pp-border);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px);
  transition: background 300ms;
}
#pp-landing .pp-nav-inner {
  max-width: 1160px; margin: 0 auto; padding: 0 32px;
  height: 100%; display: flex; align-items: center; gap: 0;
}
#pp-landing .pp-nav-logo { display: flex; align-items: center; gap: 10px; margin-right: 40px; }
#pp-landing .pp-nav-logo-box {
  width: 32px; height: 32px;
  background: var(--pp-cyan);
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  box-shadow: 0 0 16px oklch(0.82 0.19 200 / 35%);
  animation: pp-cyanPulse 4s ease-in-out infinite;
}
#pp-landing .pp-nav-logo-box svg { width: 16px; height: 16px; stroke: #090C14; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
#pp-landing .pp-pulse-dot { position: absolute; top: -3px; right: -3px; width: 7px; height: 7px; background: var(--pp-cyan); border-radius: 50%; border: 2px solid #090C14; animation: pp-pulse 2s ease-in-out infinite; }
#pp-landing .pp-nav-wordmark { font-size: 15px; font-weight: 700; color: var(--pp-text-1); letter-spacing: -0.01em; }
#pp-landing .pp-nav-links { display: flex; gap: 28px; flex: 1; }
#pp-landing .pp-nav-links a { font-size: 13px; font-weight: 500; color: var(--pp-text-2); transition: color 200ms; }
#pp-landing .pp-nav-links a:hover { color: var(--pp-text-1); }
#pp-landing .pp-nav-actions { display: flex; gap: 10px; align-items: center; }
#pp-landing .pp-btn-nav-ghost { background: transparent; color: var(--pp-text-2); font-size: 13px; font-weight: 600; padding: 7px 16px; border-radius: 8px; border: 1px solid var(--pp-border); transition: all 200ms; cursor: pointer; }
#pp-landing .pp-btn-nav-ghost:hover { border-color: rgba(255,255,255,0.15); color: var(--pp-text-1); }
#pp-landing .pp-btn-nav-primary {
  background: var(--pp-cyan); color: #090C14;
  font-size: 13px; font-weight: 700; padding: 8px 20px; border-radius: 8px;
  transition: all 200ms; cursor: pointer;
  box-shadow: 0 0 12px oklch(0.82 0.19 200 / 25%);
  text-decoration: none; display: inline-flex; align-items: center;
}
#pp-landing .pp-btn-nav-primary:hover { background: oklch(0.75 0.19 200); box-shadow: 0 0 20px oklch(0.82 0.19 200 / 40%); }

/* ─── HERO ─────────────────────────────────────────────── */
#pp-landing .pp-hero {
  min-height: 100vh; padding: 120px 0 80px;
  display: flex; align-items: center;
  position: relative; overflow: hidden;
}
#pp-landing .pp-hero::before {
  content: '';
  position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
  width: 900px; height: 700px;
  background: radial-gradient(ellipse at 50% 30%, oklch(0.82 0.19 200 / 0.08) 0%, transparent 65%);
  pointer-events: none;
}
#pp-landing .pp-hero::after {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 0%, transparent 100%);
  pointer-events: none;
}
#pp-landing .pp-hero-inner {
  max-width: 1160px; margin: 0 auto; padding: 0 32px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
  position: relative; z-index: 1;
}
#pp-landing .pp-hero-left { display: flex; flex-direction: column; gap: 0; }
#pp-landing .pp-hero-badge {
  display: inline-flex; align-items: center; gap: 7px;
  background: oklch(0.82 0.19 200 / 0.1);
  border: 1px solid oklch(0.82 0.19 200 / 0.25);
  border-radius: 9999px; padding: 5px 14px;
  font-size: 11px; font-weight: 700; color: var(--pp-cyan);
  letter-spacing: 0.1em; text-transform: uppercase;
  margin-bottom: 28px; width: fit-content;
  animation: pp-fadeUp 0.6s ease forwards 0.05s;
}
#pp-landing .pp-hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pp-cyan); animation: pp-pulse 2s ease-in-out infinite; }
#pp-landing .pp-hero-h1 {
  font-size: clamp(36px, 4.2vw, 58px); font-weight: 800;
  line-height: 1.04; letter-spacing: -0.03em; color: var(--pp-text-1);
  margin-bottom: 22px; animation: pp-fadeUp 0.6s ease forwards 0.15s;
}
#pp-landing .pp-hero-h1 em { font-style: normal; color: var(--pp-cyan); }
#pp-landing .pp-hero-sub {
  font-size: 17px; font-weight: 400; line-height: 1.65;
  color: var(--pp-text-2); max-width: 460px;
  margin-bottom: 40px; animation: pp-fadeUp 0.6s ease forwards 0.25s;
}
#pp-landing .pp-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; animation: pp-fadeUp 0.6s ease forwards 0.35s; }
#pp-landing .pp-btn-hero-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--pp-cyan); color: #090C14;
  font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px;
  transition: all 250ms cubic-bezier(0.22,1,0.36,1);
  box-shadow: 0 0 24px oklch(0.82 0.19 200 / 30%);
  text-decoration: none; cursor: pointer; border: none;
}
#pp-landing .pp-btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 32px oklch(0.82 0.19 200 / 50%); }
#pp-landing .pp-btn-hero-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05); color: var(--pp-text-1);
  font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 250ms; text-decoration: none; cursor: pointer;
}
#pp-landing .pp-btn-hero-ghost:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); }
#pp-landing .pp-hero-social { display: flex; align-items: center; gap: 12px; margin-top: 28px; animation: pp-fadeUp 0.6s ease forwards 0.45s; }
#pp-landing .pp-hero-social-text { font-size: 12px; color: var(--pp-text-3); }
#pp-landing .pp-hero-social-badges { display: flex; gap: 6px; }
#pp-landing .pp-hero-social-badge { background: rgba(255,255,255,0.05); border: 1px solid var(--pp-border); border-radius: 9999px; padding: 3px 10px; font-size: 11px; font-weight: 600; color: var(--pp-text-2); }

/* ─── Dashboard Mockup ─────────────────────────────────── */
#pp-landing .pp-hero-right { position: relative; }
#pp-landing .pp-mockup {
  background: #0C1117; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px oklch(0.82 0.19 200 / 0.08);
  animation: pp-float 6s ease-in-out infinite;
}
#pp-landing .pp-mockup::after {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 40px;
  background: linear-gradient(180deg, rgba(0,207,255,0.04) 0%, transparent 100%);
  animation: pp-scanline 5s linear infinite; pointer-events: none;
}
#pp-landing .pp-mockup-titlebar { height: 34px; background: #080C12; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 14px; gap: 6px; }
#pp-landing .pp-mtb-dot { width: 9px; height: 9px; border-radius: 50%; }
#pp-landing .pp-mtb-title { margin-left: 8px; font-size: 10px; color: rgba(255,255,255,0.2); }
#pp-landing .pp-mockup-body { display: flex; height: 340px; }
#pp-landing .pp-m-sidebar { width: 148px; background: #080B10; border-right: 1px solid rgba(255,255,255,0.05); padding: 12px 8px; flex-shrink: 0; position: relative; }
#pp-landing .pp-m-logo { display: flex; align-items: center; gap: 6px; padding: 0 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 8px; }
#pp-landing .pp-m-logo-box { width: 18px; height: 18px; background: var(--pp-cyan); border-radius: 4px; flex-shrink: 0; }
#pp-landing .pp-m-logo-text { font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.8); }
#pp-landing .pp-m-nav { display: flex; flex-direction: column; gap: 1px; }
#pp-landing .pp-m-item { display: flex; align-items: center; gap: 7px; padding: 5.5px 8px; border-radius: 5px; font-size: 9.5px; font-weight: 500; color: rgba(255,255,255,0.38); }
#pp-landing .pp-m-item.active { background: oklch(0.82 0.19 200 / 0.1); color: var(--pp-cyan); position: relative; }
#pp-landing .pp-m-item.active::before { content:''; position:absolute; left:0; top:50%; transform:translateY(-50%); width:2px; height:12px; background:var(--pp-cyan); border-radius:0 2px 2px 0; }
#pp-landing .pp-m-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.6; flex-shrink: 0; }
#pp-landing .pp-m-user { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px; }
#pp-landing .pp-m-avatar { width: 20px; height: 20px; border-radius: 50%; background: oklch(0.82 0.19 200 / 0.2); display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 700; color: var(--pp-cyan); flex-shrink: 0; }
#pp-landing .pp-m-main { flex: 1; padding: 12px 14px; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
#pp-landing .pp-m-topbar { display: flex; align-items: center; justify-content: space-between; }
#pp-landing .pp-m-page-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.85); }
#pp-landing .pp-m-period { display: flex; gap: 3px; }
#pp-landing .pp-m-chip { font-size: 8px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; }
#pp-landing .pp-m-chip.active { background: oklch(0.82 0.19 200 / 0.12); color: var(--pp-cyan); border: 1px solid oklch(0.82 0.19 200 / 0.2); }
#pp-landing .pp-m-chip:not(.active) { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.06); }
#pp-landing .pp-m-coach-banner { background: oklch(0.82 0.19 200 / 0.07); border: 1px solid oklch(0.82 0.19 200 / 0.18); border-radius: 5px; padding: 7px 10px; display: flex; align-items: center; gap: 7px; }
#pp-landing .pp-m-coach-icon { font-size: 11px; }
#pp-landing .pp-m-coach-text { font-size: 8.5px; color: rgba(255,255,255,0.65); line-height: 1.4; }
#pp-landing .pp-m-coach-text strong { color: var(--pp-cyan); font-weight: 700; }
#pp-landing .pp-m-coach-btn { margin-left: auto; flex-shrink: 0; font-size: 8px; font-weight: 700; color: var(--pp-cyan); background: oklch(0.82 0.19 200 / 0.12); border: 1px solid oklch(0.82 0.19 200 / 0.2); border-radius: 4px; padding: 3px 8px; cursor: pointer; white-space: nowrap; }
#pp-landing .pp-m-kpis { display: flex; gap: 7px; }
#pp-landing .pp-m-kpi { flex: 1; background: #0F1520; border: 1px solid rgba(255,255,255,0.07); border-radius: 5px; padding: 8px 9px; position: relative; overflow: hidden; }
#pp-landing .pp-m-kpi-glow { position: absolute; top: -16px; right: -16px; width: 40px; height: 40px; border-radius: 50%; opacity: 0.1; filter: blur(10px); }
#pp-landing .pp-m-kpi-label { font-size: 6.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 5px; }
#pp-landing .pp-m-kpi-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
#pp-landing .pp-m-kpi-sub { font-family: 'JetBrains Mono', monospace; font-size: 7px; color: rgba(255,255,255,0.25); margin-top: 2px; }
#pp-landing .pp-m-table { background: #0F1520; border: 1px solid rgba(255,255,255,0.07); border-radius: 5px; padding: 8px; flex: 1; overflow: hidden; }
#pp-landing .pp-m-table-title { font-size: 7.5px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
#pp-landing .pp-m-row { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
#pp-landing .pp-m-row-label { width: 56px; font-size: 8px; color: rgba(255,255,255,0.45); flex-shrink: 0; }
#pp-landing .pp-m-bar-track { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 9999px; overflow: hidden; }
#pp-landing .pp-m-bar-fill { height: 100%; border-radius: 9999px; }
#pp-landing .pp-m-pct { font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 700; width: 26px; text-align: right; flex-shrink: 0; }

/* ─── STATS STRIP ──────────────────────────────────────── */
#pp-landing .pp-stats-strip { background: #0D1117; border-top: 1px solid var(--pp-border); border-bottom: 1px solid var(--pp-border); padding: 36px 0; }
#pp-landing .pp-stats-inner { max-width: 1160px; margin: 0 auto; padding: 0 32px; display: flex; justify-content: space-around; gap: 24px; flex-wrap: wrap; }
#pp-landing .pp-stat-item { text-align: center; }
#pp-landing .pp-stat-num { font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: var(--pp-cyan); letter-spacing: -0.03em; line-height: 1; }
#pp-landing .pp-stat-label { font-size: 12px; color: var(--pp-text-2); margin-top: 6px; font-weight: 500; }

/* ─── SHARED SECTION ───────────────────────────────────── */
#pp-landing .pp-section { padding: 96px 0; }
#pp-landing .pp-section-alt { background: #0D1117; }
#pp-landing .pp-container { max-width: 1160px; margin: 0 auto; padding: 0 32px; }
#pp-landing .pp-section-tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--pp-cyan); margin-bottom: 14px; }
#pp-landing .pp-section-tag::before { content: '// '; opacity: 0.5; }
#pp-landing .pp-section-title { font-size: clamp(28px, 3.5vw, 42px); font-weight: 800; line-height: 1.1; letter-spacing: -0.025em; color: var(--pp-text-1); margin-bottom: 16px; }
#pp-landing .pp-section-sub { font-size: 16px; color: var(--pp-text-2); line-height: 1.65; max-width: 520px; }
#pp-landing .pp-section-header { margin-bottom: 56px; }

/* ─── PROBLEM ──────────────────────────────────────────── */
#pp-landing .pp-problem-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
#pp-landing .pp-problem-card { background: #0D1117; border: 1px solid var(--pp-border); border-radius: 12px; padding: 32px; position: relative; overflow: hidden; transition: border-color 300ms, box-shadow 300ms; }
#pp-landing .pp-problem-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--pp-red), transparent); opacity: 0; transition: opacity 300ms; }
#pp-landing .pp-problem-card:hover { border-color: rgba(255,59,92,0.2); }
#pp-landing .pp-problem-card:hover::before { opacity: 1; }
#pp-landing .pp-problem-number { font-family: 'JetBrains Mono', monospace; font-size: 48px; font-weight: 700; color: rgba(255,255,255,0.04); line-height: 1; margin-bottom: 20px; letter-spacing: -0.04em; }
#pp-landing .pp-problem-title { font-size: 16px; font-weight: 700; color: var(--pp-text-1); margin-bottom: 10px; }
#pp-landing .pp-problem-text { font-size: 13.5px; color: var(--pp-text-2); line-height: 1.65; }
#pp-landing .pp-problem-tag { display: inline-block; margin-top: 14px; font-size: 11px; font-weight: 700; color: var(--pp-red); background: rgba(255,59,92,0.1); border: 1px solid rgba(255,59,92,0.2); border-radius: 9999px; padding: 3px 10px; }

/* ─── HOW IT WORKS ─────────────────────────────────────── */
#pp-landing .pp-how-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 28px; position: relative; }
#pp-landing .pp-how-grid::before { content: ''; position: absolute; top: 36px; left: 18%; right: 18%; height: 1px; background: linear-gradient(90deg, transparent, var(--pp-cyan), transparent); opacity: 0.3; }
#pp-landing .pp-how-card { background: #111827; border: 1px solid var(--pp-border); border-radius: 12px; padding: 32px 28px; text-align: center; transition: border-color 300ms, transform 300ms; }
#pp-landing .pp-how-card:hover { border-color: oklch(0.82 0.19 200 / 0.2); transform: translateY(-4px); }
#pp-landing .pp-how-num { width: 48px; height: 48px; border-radius: 50%; background: oklch(0.82 0.19 200 / 0.1); border: 1px solid oklch(0.82 0.19 200 / 0.25); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: var(--pp-cyan); }
#pp-landing .pp-how-icon { font-size: 24px; margin-bottom: 6px; }
#pp-landing .pp-how-title { font-size: 16px; font-weight: 700; color: var(--pp-text-1); margin-bottom: 10px; }
#pp-landing .pp-how-text { font-size: 13.5px; color: var(--pp-text-2); line-height: 1.65; }

/* ─── FEATURES ─────────────────────────────────────────── */
#pp-landing .pp-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
#pp-landing .pp-feature-card { background: #111827; border: 1px solid var(--pp-border); border-radius: 12px; padding: 28px; transition: border-color 300ms, box-shadow 300ms, transform 300ms; }
#pp-landing .pp-feature-card:hover { border-color: oklch(0.82 0.19 200 / 0.2); box-shadow: 0 0 24px oklch(0.82 0.19 200 / 0.06); transform: translateY(-3px); }
#pp-landing .pp-feature-icon { width: 42px; height: 42px; border-radius: 10px; background: oklch(0.82 0.19 200 / 0.1); border: 1px solid oklch(0.82 0.19 200 / 0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 16px; }
#pp-landing .pp-feature-title { font-size: 15px; font-weight: 700; color: var(--pp-text-1); margin-bottom: 8px; }
#pp-landing .pp-feature-text { font-size: 13px; color: var(--pp-text-2); line-height: 1.6; }
#pp-landing .pp-feature-tag { display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 10px; font-weight: 700; color: var(--pp-cyan); background: oklch(0.82 0.19 200 / 0.08); border: 1px solid oklch(0.82 0.19 200 / 0.15); border-radius: 9999px; padding: 3px 9px; }

/* ─── SCREENSHOT SECTION ───────────────────────────────── */
#pp-landing .pp-screen-showcase { background: #0D1117; padding: 96px 0; }
#pp-landing .pp-screens-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
#pp-landing .pp-screen-card { background: #111827; border: 1px solid var(--pp-border); border-radius: 12px; overflow: hidden; transition: border-color 300ms, box-shadow 300ms; }
#pp-landing .pp-screen-card:hover { border-color: oklch(0.82 0.19 200 / 0.2); box-shadow: 0 0 30px oklch(0.82 0.19 200 / 0.07); }
#pp-landing .pp-screen-titlebar { height: 28px; background: #0C1117; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 10px; gap: 5px; }
#pp-landing .pp-stb-dot { width: 7px; height: 7px; border-radius: 50%; }
#pp-landing .pp-screen-body { padding: 14px; }
#pp-landing .pp-screen-label-tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pp-cyan); margin-bottom: 10px; }
#pp-landing .pp-screen-title { font-size: 14px; font-weight: 700; color: var(--pp-text-1); margin-bottom: 6px; }
#pp-landing .pp-screen-desc { font-size: 12px; color: var(--pp-text-2); line-height: 1.5; }
#pp-landing .pp-mini-checkin { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: #0C1117; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); margin-top: 10px; }
#pp-landing .pp-mc-row { display: flex; align-items: center; gap: 8px; }
#pp-landing .pp-mc-emoji { font-size: 12px; }
#pp-landing .pp-mc-name { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.55); flex: 1; }
#pp-landing .pp-mc-counter { display: flex; align-items: center; gap: 4px; }
#pp-landing .pp-mc-btn { width: 18px; height: 18px; border-radius: 3px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; cursor: pointer; }
#pp-landing .pp-mc-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; width: 20px; text-align: center; }
#pp-landing .pp-mc-bar { flex: 1; height: 3px; background: rgba(255,255,255,0.06); border-radius: 9999px; overflow: hidden; }
#pp-landing .pp-mc-fill { height: 100%; border-radius: 9999px; }
#pp-landing .pp-mini-pipeline { padding: 10px; background: #0C1117; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); margin-top: 10px; }
#pp-landing .pp-mp-row { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
#pp-landing .pp-mp-label { font-size: 9px; color: rgba(255,255,255,0.4); width: 70px; flex-shrink: 0; text-align: right; }
#pp-landing .pp-mp-bar { flex: 1; height: 18px; background: rgba(255,255,255,0.04); border-radius: 3px; overflow: hidden; }
#pp-landing .pp-mp-fill { height: 100%; border-radius: 3px; display: flex; align-items: center; padding: 0 6px; }
#pp-landing .pp-mp-count { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; color: #090C14; }
#pp-landing .pp-mp-value { width: 60px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: rgba(255,255,255,0.3); text-align: right; flex-shrink: 0; }

/* ─── SEMAPHORE CALLOUT ────────────────────────────────── */
#pp-landing .pp-sem-callout { background: linear-gradient(135deg, #0F1520 0%, #111827 100%); border: 1px solid var(--pp-border); border-radius: 14px; padding: 40px 48px; display: flex; gap: 48px; align-items: center; margin-top: 56px; }
#pp-landing .pp-sem-left { flex: 1; }
#pp-landing .pp-sem-left h3 { font-size: 22px; font-weight: 800; color: var(--pp-text-1); margin-bottom: 10px; letter-spacing: -0.02em; }
#pp-landing .pp-sem-left p { font-size: 14px; color: var(--pp-text-2); line-height: 1.6; }
#pp-landing .pp-sem-items { display: flex; flex-direction: column; gap: 10px; min-width: 260px; }
#pp-landing .pp-sem-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 16px; }
#pp-landing .pp-sem-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
#pp-landing .pp-sem-item-text { display: flex; flex-direction: column; gap: 1px; }
#pp-landing .pp-sem-item-label { font-size: 12px; font-weight: 700; }
#pp-landing .pp-sem-item-desc { font-size: 11px; color: var(--pp-text-3); }

/* ─── PRICING ──────────────────────────────────────────── */
#pp-landing .pp-pricing-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; max-width: 780px; margin: 0 auto; }
/* ─── WHATSAPP FLOAT ────────────────────────────────────── */
#pp-landing .pp-wa-float { position: fixed; bottom: 28px; right: 28px; z-index: 9999; display: flex; align-items: center; gap: 10px; text-decoration: none; }
#pp-landing .pp-wa-btn { width: 56px; height: 56px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(37,211,102,0.45); transition: transform 200ms, box-shadow 200ms; flex-shrink: 0; }
#pp-landing .pp-wa-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(37,211,102,0.6); }
#pp-landing .pp-wa-label { background: rgba(9,12,20,0.92); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); font-size: 12.5px; font-weight: 600; padding: 7px 13px; border-radius: 8px; white-space: nowrap; backdrop-filter: blur(8px); opacity: 0; transform: translateX(8px); transition: opacity 200ms, transform 200ms; pointer-events: none; }
#pp-landing .pp-wa-float:hover .pp-wa-label { opacity: 1; transform: translateX(0); }
#pp-landing .pp-pricing-card { background: #111827; border: 1px solid var(--pp-border); border-radius: 14px; padding: 32px; position: relative; transition: all 300ms; }
#pp-landing .pp-pricing-card.featured { border-color: oklch(0.82 0.19 200 / 0.35); box-shadow: 0 0 40px oklch(0.82 0.19 200 / 0.08); background: linear-gradient(160deg, #111827 0%, #0F1821 100%); }
#pp-landing .pp-pricing-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--pp-cyan); color: #090C14; font-size: 10px; font-weight: 700; padding: 3px 14px; border-radius: 9999px; white-space: nowrap; }
#pp-landing .pp-pricing-role { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pp-cyan); margin-bottom: 10px; }
#pp-landing .pp-pricing-price { font-family: 'JetBrains Mono', monospace; font-size: 38px; font-weight: 700; color: var(--pp-text-1); line-height: 1; margin-bottom: 4px; letter-spacing: -0.03em; }
#pp-landing .pp-pricing-price span { font-size: 14px; color: var(--pp-text-2); font-weight: 400; font-family: 'Syne', sans-serif; }
#pp-landing .pp-pricing-desc { font-size: 12px; color: var(--pp-text-3); margin-bottom: 20px; line-height: 1.5; }
#pp-landing .pp-pricing-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 20px 0; }
#pp-landing .pp-pricing-feature { font-size: 12.5px; color: var(--pp-text-2); display: flex; align-items: flex-start; gap: 9px; margin-bottom: 10px; line-height: 1.45; }
#pp-landing .pp-pricing-feature::before { content: '✓'; color: var(--pp-cyan); font-weight: 700; font-size: 11px; flex-shrink: 0; margin-top: 1px; }
#pp-landing .pp-pricing-tiers { display: flex; flex-direction: column; gap: 5px; margin-bottom: 4px; }
#pp-landing .pp-pricing-tier { display: flex; justify-content: space-between; font-size: 11.5px; }
#pp-landing .pp-pricing-tier-label { color: var(--pp-text-2); }
#pp-landing .pp-pricing-tier-value { color: var(--pp-cyan); font-weight: 600; font-family: 'JetBrains Mono', monospace; }
#pp-landing .pp-pricing-footnote { text-align: center; font-size: 12px; color: var(--pp-text-3); margin-top: 20px; }
#pp-landing .pp-pricing-btn { width: 100%; padding: 11px; border-radius: 9px; font-size: 13.5px; font-weight: 700; margin-top: 20px; transition: all 250ms; cursor: pointer; border: none; display: block; text-align: center; text-decoration: none; }
#pp-landing .pp-pricing-btn-default { background: rgba(255,255,255,0.06); color: var(--pp-text-1); border: 1px solid rgba(255,255,255,0.1) !important; }
#pp-landing .pp-pricing-btn-default:hover { background: rgba(255,255,255,0.1); }
#pp-landing .pp-pricing-btn-featured { background: var(--pp-cyan); color: #090C14; box-shadow: 0 0 20px oklch(0.82 0.19 200 / 25%); }
#pp-landing .pp-pricing-btn-featured:hover { background: oklch(0.75 0.19 200); box-shadow: 0 0 30px oklch(0.82 0.19 200 / 40%); }

/* ─── CTA ──────────────────────────────────────────────── */
#pp-landing .pp-cta-section { padding: 112px 0; text-align: center; position: relative; overflow: hidden; }
#pp-landing .pp-cta-section::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 700px; height: 400px; background: radial-gradient(ellipse, oklch(0.82 0.19 200 / 0.07) 0%, transparent 70%); pointer-events: none; }
#pp-landing .pp-cta-eyebrow { display: inline-flex; align-items: center; gap: 6px; background: oklch(0.82 0.19 200 / 0.08); border: 1px solid oklch(0.82 0.19 200 / 0.2); border-radius: 9999px; padding: 5px 16px; font-size: 11px; font-weight: 700; color: var(--pp-cyan); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 28px; }
#pp-landing .pp-cta-h2 { font-size: clamp(30px, 4vw, 52px); font-weight: 800; color: var(--pp-text-1); letter-spacing: -0.03em; margin-bottom: 16px; }
#pp-landing .pp-cta-h2 em { font-style: normal; color: var(--pp-cyan); }
#pp-landing .pp-cta-sub { font-size: 17px; color: var(--pp-text-2); max-width: 500px; margin: 0 auto 40px; line-height: 1.6; }
#pp-landing .pp-cta-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
#pp-landing .pp-cta-fine { font-size: 12px; color: var(--pp-text-3); margin-top: 18px; }

/* ─── FOOTER ───────────────────────────────────────────── */
#pp-landing footer { background: #090C14; border-top: 1px solid var(--pp-border); padding: 40px 0; }
#pp-landing .pp-footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
#pp-landing .pp-footer-brand { display: flex; align-items: center; gap: 10px; }
#pp-landing .pp-footer-logo { width: 26px; height: 26px; background: var(--pp-cyan); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
#pp-landing .pp-footer-logo svg { width: 13px; height: 13px; stroke: #090C14; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
#pp-landing .pp-footer-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.5); }
#pp-landing .pp-footer-links { display: flex; gap: 24px; }
#pp-landing .pp-footer-links a { font-size: 12px; color: var(--pp-text-3); transition: color 200ms; }
#pp-landing .pp-footer-links a:hover { color: var(--pp-text-2); }
#pp-landing .pp-footer-copy { font-size: 11px; color: var(--pp-text-3); }

/* ─── Responsive ───────────────────────────────────────── */
@media (max-width: 900px) {
  #pp-landing .pp-hero-inner { grid-template-columns: 1fr; gap: 48px; }
  #pp-landing .pp-hero-right { display: none; }
  #pp-landing .pp-problem-grid, #pp-landing .pp-how-grid, #pp-landing .pp-features-grid, #pp-landing .pp-pricing-grid, #pp-landing .pp-screens-grid { grid-template-columns: 1fr; }
  #pp-landing .pp-sem-callout { flex-direction: column; gap: 28px; }
  #pp-landing .pp-nav .pp-nav-links { display: none; }
  #pp-landing .pp-stats-inner { flex-direction: column; gap: 32px; align-items: center; }
  #pp-landing .pp-footer-inner { flex-direction: column; gap: 20px; text-align: center; }
  #pp-landing .pp-footer-links { flex-wrap: wrap; justify-content: center; }
}
@media (max-width: 600px) {
  #pp-landing .pp-nav-inner { padding: 0 16px; }
  #pp-landing .pp-btn-nav-ghost { display: none; }
  #pp-landing .pp-btn-nav-primary { font-size: 12px; padding: 7px 14px; }
  #pp-landing .pp-container { padding: 0 20px; }
  #pp-landing .pp-section { padding: 64px 0; }
  #pp-landing .pp-hero { padding: 100px 0 60px; }
  #pp-landing .pp-hero-h1 { font-size: clamp(32px, 9vw, 56px); }
  #pp-landing .pp-hero-sub { font-size: 15px; }
  #pp-landing .pp-cta-h2 { font-size: clamp(28px, 8vw, 48px); }
  #pp-landing .pp-pricing-grid { grid-template-columns: 1fr; }
  #pp-landing .pp-wa-float { bottom: 18px; right: 18px; }
  #pp-landing .pp-wa-btn { width: 48px; height: 48px; }
}
`

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const root = document.getElementById('pp-landing')
    if (!root) return

    /* ─── Theme toggle ─────────────────────────────── */
    const toggle = document.getElementById('pp-theme-toggle')
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pp-theme') : null
    if (saved === 'light' && root) root.classList.add('pp-light')
    if (toggle) {
      toggle.textContent = saved === 'light' ? '☀️' : '🌙'
      toggle.addEventListener('click', () => {
        const isLight = root?.classList.contains('pp-light')
        if (isLight) {
          root?.classList.remove('pp-light')
          toggle.textContent = '🌙'
          localStorage.setItem('pp-theme', 'dark')
        } else {
          root?.classList.add('pp-light')
          toggle.textContent = '☀️'
          localStorage.setItem('pp-theme', 'light')
        }
      })
    }

    /* ─── CTA navigation ───────────────────────────── */
    root.querySelectorAll('[data-href]').forEach((el) => {
      el.addEventListener('click', () => {
        const href = (el as HTMLElement).dataset.href
        if (href) router.push(href)
      })
    })

    /* ─── Hero visibility fallback ─────────────────── */
    const heroEls = root.querySelectorAll('.pp-hero-badge, .pp-hero-h1, .pp-hero-sub, .pp-hero-actions, .pp-hero-social, .pp-hero-right')
    heroEls.forEach(el => {
      const t = setTimeout(() => {
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none'
      }, 1200)
      el.addEventListener('animationend', () => {
        clearTimeout(t);
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
        (el as HTMLElement).style.animation = 'none'
      }, { once: true })
    })

    /* ─── Scroll reveal ────────────────────────────── */
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    root.querySelectorAll('.pp-reveal').forEach(el => observer.observe(el))

    /* ─── Count-up ─────────────────────────────────── */
    function countUp(el: Element, target: number, suffix: string, duration = 1400) {
      const start = performance.now()
      const isFloat = String(target).includes('.')
      function step(now: number) {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        const val = isFloat ? (target * eased).toFixed(1) : Math.round(target * eased)
        el.textContent = val + suffix
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          const target = parseFloat(el.dataset.count ?? '0')
          const suffix = el.dataset.suffix ?? ''
          countUp(e.target, target, suffix)
          countObserver.unobserve(e.target)
        }
      })
    }, { threshold: 0.5 })
    root.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el))

    /* ─── Nav scroll shrink ────────────────────────── */
    const navbar = document.getElementById('pp-navbar')
    const handleScroll = () => {
      if (!navbar || !root) return
      const isLight = root.classList.contains('pp-light')
      navbar.style.background = window.scrollY > 40
        ? (isLight ? 'rgba(248,250,252,0.97)' : 'rgba(9,12,20,0.97)')
        : (isLight ? 'rgba(248,250,252,0.92)' : 'rgba(9,12,20,0.85)')
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    /* ─── Bar animations on scroll ─────────────────── */
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.pp-m-bar-fill, .pp-mc-fill').forEach((bar, i) => {
            const b = bar as HTMLElement
            const w = b.style.width
            b.style.width = '0%'
            setTimeout(() => {
              b.style.transition = `width 700ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`
              b.style.width = w
            }, 100)
          })
          barObserver.unobserve(e.target)
        }
      })
    }, { threshold: 0.3 })
    root.querySelectorAll('.pp-mockup, .pp-mini-checkin, .pp-mini-pipeline, .pp-m-table').forEach(el => barObserver.observe(el))

    return () => {
      observer.disconnect()
      countObserver.disconnect()
      barObserver.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [router])

  return (
    <div id="pp-landing">
      <style>{CSS}</style>

      {/* NAV */}
      <nav id="pp-navbar" className="pp-nav">
        <div className="pp-nav-inner">
          <a href="#" className="pp-nav-logo">
            <div className="pp-nav-logo-box">
              <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
              <span className="pp-pulse-dot"></span>
            </div>
            <span className="pp-nav-wordmark">ProspectPro</span>
          </a>
          <div className="pp-nav-links">
            <a href="#pp-como-funciona">Cómo funciona</a>
            <a href="#pp-caracteristicas">Características</a>
            <a href="#pp-precios">Precios</a>
          </div>
          <div className="pp-nav-actions">
            <button id="pp-theme-toggle" aria-label="Cambiar modo" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms', fontSize: 16, lineHeight: 1, flexShrink: 0, cursor: 'pointer' }}>🌙</button>
            <a href="/login" className="pp-btn-nav-ghost">Iniciar sesión</a>
            <a href="/register" className="pp-btn-nav-primary">Empezar gratis</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pp-hero">
        <div className="pp-hero-inner">
          <div className="pp-hero-left">
            <div className="pp-hero-badge"><span className="pp-hero-badge-dot"></span>IA para ventas B2B · LATAM</div>
            <h1 className="pp-hero-h1">Tu equipo de ventas<br />con <em>superpoderes</em><br />de IA</h1>
            <p className="pp-hero-sub">ProspectPro convierte tus actividades de prospección en un sistema predecible. Cada vendedor sabe exactamente qué hacer hoy. Cada gerente ve el equipo en tiempo real.</p>
            <div className="pp-hero-actions">
              <a href="/register" className="pp-btn-hero-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                Empezar gratis
              </a>
            </div>
            <div className="pp-hero-social">
              <span className="pp-hero-social-text">Para equipos de</span>
              <div className="pp-hero-social-badges">
                <span className="pp-hero-social-badge">Vendedores B2B</span>
                <span className="pp-hero-social-badge">Gerentes</span>
                <span className="pp-hero-social-badge">Directores</span>
              </div>
            </div>
          </div>
          <div className="pp-hero-right" style={{ animation: 'pp-fadeUp 0.7s ease forwards 0.3s' }}>
            <div className="pp-mockup">
              <div className="pp-mockup-titlebar">
                <div className="pp-mtb-dot" style={{ background: '#FF5F57' }}></div>
                <div className="pp-mtb-dot" style={{ background: '#FFBD2E' }}></div>
                <div className="pp-mtb-dot" style={{ background: '#28C840' }}></div>
                <span className="pp-mtb-title">ProspectPro — Dashboard</span>
              </div>
              <div className="pp-mockup-body">
                <div className="pp-m-sidebar">
                  <div className="pp-m-logo">
                    <div className="pp-m-logo-box"></div>
                    <span className="pp-m-logo-text">ProspectPro</span>
                  </div>
                  <div className="pp-m-nav">
                    <div className="pp-m-item active"><span className="pp-m-dot"></span>Dashboard</div>
                    <div className="pp-m-item"><span className="pp-m-dot"></span>Check-in</div>
                    <div className="pp-m-item"><span className="pp-m-dot"></span>Pipeline</div>
                    <div className="pp-m-item"><span className="pp-m-dot"></span>Coach IA</div>
                    <div className="pp-m-item"><span className="pp-m-dot"></span>Actividades</div>
                    <div className="pp-m-item"><span className="pp-m-dot"></span>Recetario</div>
                  </div>
                  <div className="pp-m-user">
                    <div className="pp-m-avatar">JR</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ fontSize: '8.5px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Juan R.</div>
                      <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>Vendedor</div>
                    </div>
                  </div>
                </div>
                <div className="pp-m-main">
                  <div className="pp-m-topbar">
                    <div className="pp-m-page-title">Dashboard</div>
                    <div className="pp-m-period">
                      <div className="pp-m-chip active">Semana</div>
                      <div className="pp-m-chip">Mes</div>
                      <div className="pp-m-chip">Trim.</div>
                    </div>
                  </div>
                  <div className="pp-m-coach-banner">
                    <span className="pp-m-coach-icon">🤖</span>
                    <div className="pp-m-coach-text"><strong>Coach Pro · Hoy</strong> — Prioriza llamadas esta tarde. 3 prospectos en seguimiento activo.</div>
                    <button className="pp-m-coach-btn">Ver análisis →</button>
                  </div>
                  <div className="pp-m-kpis">
                    <div className="pp-m-kpi" style={{ borderTop: '2px solid #F59E0B' }}>
                      <div className="pp-m-kpi-glow" style={{ background: '#F59E0B' }}></div>
                      <div className="pp-m-kpi-label">Cumplimiento</div>
                      <div className="pp-m-kpi-val" style={{ color: '#F59E0B' }}>74.2%</div>
                      <div className="pp-m-kpi-sub">Semana actual</div>
                    </div>
                    <div className="pp-m-kpi" style={{ borderTop: '2px solid #F59E0B' }}>
                      <div className="pp-m-kpi-glow" style={{ background: '#F59E0B' }}></div>
                      <div className="pp-m-kpi-label">Actividades</div>
                      <div className="pp-m-kpi-val" style={{ color: '#F59E0B' }}>53<span style={{ fontSize: '11px', opacity: 0.4 }}> /72</span></div>
                      <div className="pp-m-kpi-sub">Meta: 72</div>
                    </div>
                    <div className="pp-m-kpi" style={{ borderTop: '2px solid #FF3B5C' }}>
                      <div className="pp-m-kpi-glow" style={{ background: '#FF3B5C' }}></div>
                      <div className="pp-m-kpi-label">Desviación</div>
                      <div className="pp-m-kpi-val" style={{ color: '#FF3B5C' }}>−19</div>
                      <div className="pp-m-kpi-sub">vs plan</div>
                    </div>
                    <div className="pp-m-kpi" style={{ borderTop: '2px solid oklch(0.82 0.19 200)' }}>
                      <div className="pp-m-kpi-glow" style={{ background: 'oklch(0.82 0.19 200)' }}></div>
                      <div className="pp-m-kpi-label">Proyección</div>
                      <div className="pp-m-kpi-val" style={{ color: 'oklch(0.82 0.19 200)' }}>89.3%</div>
                      <div className="pp-m-kpi-sub">Fin de mes</div>
                    </div>
                  </div>
                  <div className="pp-m-table">
                    <div className="pp-m-table-title">Actividades por canal · esta semana</div>
                    <div className="pp-m-row"><div className="pp-m-row-label">Llamadas</div><div className="pp-m-bar-track"><div className="pp-m-bar-fill" style={{ width: '45%', background: '#FF3B5C' }}></div></div><div className="pp-m-pct" style={{ color: '#FF3B5C' }}>45%</div></div>
                    <div className="pp-m-row"><div className="pp-m-row-label">DM LinkedIn</div><div className="pp-m-bar-track"><div className="pp-m-bar-fill" style={{ width: '100%', background: '#00FF9D' }}></div></div><div className="pp-m-pct" style={{ color: '#00FF9D' }}>100%</div></div>
                    <div className="pp-m-row"><div className="pp-m-row-label">Emails</div><div className="pp-m-bar-track"><div className="pp-m-bar-fill" style={{ width: '80%', background: '#F59E0B' }}></div></div><div className="pp-m-pct" style={{ color: '#F59E0B' }}>80%</div></div>
                    <div className="pp-m-row"><div className="pp-m-row-label">Networking</div><div className="pp-m-bar-track"><div className="pp-m-bar-fill" style={{ width: '75%', background: '#F59E0B' }}></div></div><div className="pp-m-pct" style={{ color: '#F59E0B' }}>75%</div></div>
                    <div className="pp-m-row"><div className="pp-m-row-label">VSL</div><div className="pp-m-bar-track"><div className="pp-m-bar-fill" style={{ width: '30%', background: '#FF3B5C' }}></div></div><div className="pp-m-pct" style={{ color: '#FF3B5C' }}>30%</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <div className="pp-stats-strip">
        <div className="pp-stats-inner">
          <div className="pp-stat-item pp-reveal"><div className="pp-stat-num" data-count="74" data-suffix="%">0%</div><div className="pp-stat-label">Cumplimiento promedio de equipos activos</div></div>
          <div className="pp-stat-item pp-reveal pp-reveal-delay-1"><div className="pp-stat-num" data-count="2" data-suffix=" min">0 min</div><div className="pp-stat-label">Check-in diario completo</div></div>
          <div className="pp-stat-item pp-reveal pp-reveal-delay-2"><div className="pp-stat-num" data-count="3" data-suffix="x">0x</div><div className="pp-stat-label">Más reuniones reservadas vs sin sistema</div></div>
          <div className="pp-stat-item pp-reveal pp-reveal-delay-3"><div className="pp-stat-num" data-count="100" data-suffix="%">0%</div><div className="pp-stat-label">En español, para LATAM</div></div>
        </div>
      </div>

      {/* PROBLEM */}
      <section className="pp-section" id="pp-problema">
        <div className="pp-container">
          <div className="pp-section-header">
            <div className="pp-section-tag pp-reveal">El problema</div>
            <h2 className="pp-section-title pp-reveal pp-reveal-delay-1">Los vendedores B2B<br />prospectan a ciegas</h2>
            <p className="pp-section-sub pp-reveal pp-reveal-delay-2">Sin un sistema claro, dependes de la intuición. Y eso tiene un costo directo en tus ingresos. Solo lo descubres cuando ya es tarde.</p>
          </div>
          <div className="pp-problem-grid">
            <div className="pp-problem-card pp-reveal">
              <div className="pp-problem-number">01</div>
              <div className="pp-problem-title">"¿Cuántas llamadas hiciste hoy?"</div>
              <div className="pp-problem-text">No sabes si hiciste suficiente prospección para cumplir el mes. La intuición no es un sistema — y los meses malos no tienen explicación clara.</div>
              <div className="pp-problem-tag">Sin visibilidad</div>
            </div>
            <div className="pp-problem-card pp-reveal pp-reveal-delay-1">
              <div className="pp-problem-number">02</div>
              <div className="pp-problem-title">Tu Excel no predice si vas a cerrar</div>
              <div className="pp-problem-text">Registras actividades pero nadie analiza si van a convertirse en ingresos. Los datos están. El insight, no.</div>
              <div className="pp-problem-tag">Sin análisis</div>
            </div>
            <div className="pp-problem-card pp-reveal pp-reveal-delay-2">
              <div className="pp-problem-number">03</div>
              <div className="pp-problem-title">El equipo no recibe coaching en tiempo real</div>
              <div className="pp-problem-text">Los buenos vendedores lo son por sistema, no por talento. Sin coaching diario personalizado, cada vendedor improvisa.</div>
              <div className="pp-problem-tag">Sin coaching</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="pp-section pp-section-alt" id="pp-como-funciona">
        <div className="pp-container">
          <div className="pp-section-header" style={{ textAlign: 'center' }}>
            <div className="pp-section-tag pp-reveal" style={{ display: 'block', textAlign: 'center' }}>Cómo funciona</div>
            <h2 className="pp-section-title pp-reveal pp-reveal-delay-1" style={{ textAlign: 'center' }}>Tres pasos para un equipo<br />que prospecta con sistema</h2>
          </div>
          <div className="pp-how-grid">
            <div className="pp-how-card pp-reveal">
              <div className="pp-how-num">01</div>
              <div className="pp-how-icon">🎯</div>
              <div className="pp-how-title">Define tu Recetario con IA</div>
              <div className="pp-how-text">En una conversación de 5 minutos, el Coach IA calcula cuántas actividades por canal necesitas cada semana para cerrar tu cuota. Tu plan es tuyo — no un template genérico.</div>
            </div>
            <div className="pp-how-card pp-reveal pp-reveal-delay-1">
              <div className="pp-how-num">02</div>
              <div className="pp-how-icon">📋</div>
              <div className="pp-how-title">Check-in diario en 2 minutos</div>
              <div className="pp-how-text">Cada día registras cuántas llamadas hiciste, cuántos DMs enviaste, cuántas visitas agendaste. En 2 minutos el sistema sabe si vas en camino.</div>
            </div>
            <div className="pp-how-card pp-reveal pp-reveal-delay-2">
              <div className="pp-how-num">03</div>
              <div className="pp-how-icon">🤖</div>
              <div className="pp-how-title">Coach IA te dice qué hacer hoy</div>
              <div className="pp-how-text">Cada mañana recibes una recomendación concreta basada en tu comportamiento real. No datos fríos — acción específica con contexto.</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="pp-section" id="pp-caracteristicas">
        <div className="pp-container">
          <div className="pp-section-header">
            <div className="pp-section-tag pp-reveal">Características</div>
            <h2 className="pp-section-title pp-reveal pp-reveal-delay-1">Todo lo que un equipo<br />de ventas B2B necesita</h2>
            <p className="pp-section-sub pp-reveal pp-reveal-delay-2">Diseñado para la venta consultiva en LATAM — no un CRM americano traducido.</p>
          </div>
          <div className="pp-features-grid">
            <div className="pp-feature-card pp-reveal"><div className="pp-feature-icon">🤖</div><div className="pp-feature-title">Coach IA diario personalizado</div><div className="pp-feature-text">Cada vendedor recibe un análisis y recomendación específica cada mañana — basada en su historial, no en un script genérico.</div><div className="pp-feature-tag">✦ IA generativa</div></div>
            <div className="pp-feature-card pp-reveal pp-reveal-delay-1"><div className="pp-feature-icon">👥</div><div className="pp-feature-title">Panel Gerente con IA</div><div className="pp-feature-text">Ve el pipeline de todo el equipo en tiempo real. Los agentes IA generan reportes semanales automáticos por email.</div><div className="pp-feature-tag">✦ Vista de equipo</div></div>
            <div className="pp-feature-card pp-reveal pp-reveal-delay-2"><div className="pp-feature-icon">📊</div><div className="pp-feature-title">Semáforo de cumplimiento</div><div className="pp-feature-text">Verde ≥100%, amarillo 70–99%, rojo &lt;70%. Un vistazo al dashboard y sabes exactamente quién está en riesgo.</div><div className="pp-feature-tag">✦ Visibilidad total</div></div>
            <div className="pp-feature-card pp-reveal pp-reveal-delay-1"><div className="pp-feature-icon">🔮</div><div className="pp-feature-title">Proyecciones de cierre</div><div className="pp-feature-text">Momentum score por vendedor y equipo. Proyecta si vas a cerrar el mes antes de que termine la semana.</div><div className="pp-feature-tag">✦ Predictivo</div></div>
            <div className="pp-feature-card pp-reveal pp-reveal-delay-2"><div className="pp-feature-icon">📈</div><div className="pp-feature-title">Pipeline con tasas reales</div><div className="pp-feature-text">Monitorea cada etapa del funnel. Compara tasas reales vs tu recetario planificado.</div><div className="pp-feature-tag">✦ Funnel live</div></div>
            <div className="pp-feature-card pp-reveal pp-reveal-delay-3"><div className="pp-feature-icon">📧</div><div className="pp-feature-title">Reportes semanales automáticos</div><div className="pp-feature-text">Cada lunes, el equipo recibe un análisis de la semana con fortalezas, brechas y plan para la semana nueva.</div><div className="pp-feature-tag">✦ Automatizado</div></div>
          </div>
          <div className="pp-sem-callout pp-reveal">
            <div className="pp-sem-left">
              <h3>El sistema semáforo: sabes sin preguntar</h3>
              <p>Cada actividad, cada vendedor, cada período tiene un color. Tu war room comercial funciona como un tablero de control — no como un reporte de Excel que nadie lee.</p>
            </div>
            <div className="pp-sem-items">
              <div className="pp-sem-item"><div className="pp-sem-dot" style={{ background: '#00FF9D', boxShadow: '0 0 8px #00FF9D44' }}></div><div className="pp-sem-item-text"><span className="pp-sem-item-label" style={{ color: '#00FF9D' }}>Verde · ≥100%</span><span className="pp-sem-item-desc">En o por encima de meta. Mantén el ritmo.</span></div></div>
              <div className="pp-sem-item"><div className="pp-sem-dot" style={{ background: '#F59E0B', boxShadow: '0 0 8px #F59E0B44' }}></div><div className="pp-sem-item-text"><span className="pp-sem-item-label" style={{ color: '#F59E0B' }}>Amarillo · 70–99%</span><span className="pp-sem-item-desc">Cerca de la meta, hay brecha recuperable.</span></div></div>
              <div className="pp-sem-item"><div className="pp-sem-dot" style={{ background: '#FF3B5C', boxShadow: '0 0 8px #FF3B5C44' }}></div><div className="pp-sem-item-text"><span className="pp-sem-item-label" style={{ color: '#FF3B5C' }}>Rojo · &lt;70%</span><span className="pp-sem-item-desc">Alerta. El Coach IA actúa de inmediato.</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="pp-screen-showcase" id="pp-producto">
        <div className="pp-container">
          <div className="pp-section-header">
            <div className="pp-section-tag pp-reveal">El producto</div>
            <h2 className="pp-section-title pp-reveal pp-reveal-delay-1">Tu war room comercial,<br />listo en minutos</h2>
            <p className="pp-section-sub pp-reveal pp-reveal-delay-2">Diseñado para el vendedor de campo y el gerente que necesita ver el equipo sin interrumpirlo.</p>
          </div>
          <div className="pp-screens-grid">
            <div className="pp-screen-card pp-reveal">
              <div className="pp-screen-titlebar"><div className="pp-stb-dot" style={{ background: '#FF5F57' }}></div><div className="pp-stb-dot" style={{ background: '#FFBD2E' }}></div><div className="pp-stb-dot" style={{ background: '#28C840' }}></div></div>
              <div className="pp-screen-body">
                <div className="pp-screen-label-tag">Check-in Diario</div>
                <div className="pp-screen-title">2 minutos. Cada día. Sin excusas.</div>
                <div className="pp-screen-desc">El vendedor registra cuántas actividades completó. El semáforo se actualiza al instante y el Coach IA ajusta la recomendación de mañana.</div>
                <div className="pp-mini-checkin">
                  <div className="pp-mc-row"><span className="pp-mc-emoji">📞</span><span className="pp-mc-name">Llamadas en frío</span><div className="pp-mc-counter"><div className="pp-mc-btn">−</div><div className="pp-mc-val" style={{ color: '#FF3B5C' }}>3</div><div className="pp-mc-btn">+</div></div><div className="pp-mc-bar"><div className="pp-mc-fill" style={{ width: '50%', background: '#FF3B5C' }}></div></div><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: '#FF3B5C', fontWeight: 700, width: '22px', textAlign: 'right' }}>50%</span></div>
                  <div className="pp-mc-row"><span className="pp-mc-emoji">💬</span><span className="pp-mc-name">DM LinkedIn</span><div className="pp-mc-counter"><div className="pp-mc-btn">−</div><div className="pp-mc-val" style={{ color: '#00FF9D' }}>5</div><div className="pp-mc-btn">+</div></div><div className="pp-mc-bar"><div className="pp-mc-fill" style={{ width: '100%', background: '#00FF9D' }}></div></div><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: '#00FF9D', fontWeight: 700, width: '22px', textAlign: 'right' }}>100%</span></div>
                  <div className="pp-mc-row"><span className="pp-mc-emoji">📧</span><span className="pp-mc-name">Emails apertura</span><div className="pp-mc-counter"><div className="pp-mc-btn">−</div><div className="pp-mc-val" style={{ color: '#F59E0B' }}>2</div><div className="pp-mc-btn">+</div></div><div className="pp-mc-bar"><div className="pp-mc-fill" style={{ width: '50%', background: '#F59E0B' }}></div></div><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: '#F59E0B', fontWeight: 700, width: '22px', textAlign: 'right' }}>50%</span></div>
                </div>
              </div>
            </div>
            <div className="pp-screen-card pp-reveal pp-reveal-delay-1">
              <div className="pp-screen-titlebar"><div className="pp-stb-dot" style={{ background: '#FF5F57' }}></div><div className="pp-stb-dot" style={{ background: '#FFBD2E' }}></div><div className="pp-stb-dot" style={{ background: '#28C840' }}></div></div>
              <div className="pp-screen-body">
                <div className="pp-screen-label-tag">Mi Pipeline</div>
                <div className="pp-screen-title">Tu funnel en tiempo real</div>
                <div className="pp-screen-desc">Visualiza dónde están tus negocios, compara tasas de conversión reales vs tu recetario y detecta dónde se rompe el proceso.</div>
                <div className="pp-mini-pipeline">
                  <div className="pp-mp-row"><div className="pp-mp-label">Prospecto</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '100%', background: 'rgba(255,255,255,0.25)' }}><span className="pp-mp-count" style={{ color: 'rgba(255,255,255,0.7)' }}>18</span></div></div><div className="pp-mp-value">$0</div></div>
                  <div className="pp-mp-row"><div className="pp-mp-label">Contactado</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '80%', background: 'oklch(0.82 0.19 200 / 0.7)' }}><span className="pp-mp-count">11</span></div></div><div className="pp-mp-value">$0</div></div>
                  <div className="pp-mp-row"><div className="pp-mp-label">Reunión agd.</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '60%', background: '#F59E0B' }}><span className="pp-mp-count">6</span></div></div><div className="pp-mp-value">$120k</div></div>
                  <div className="pp-mp-row"><div className="pp-mp-label">Propuesta</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '45%', background: '#F59E0B' }}><span className="pp-mp-count">4</span></div></div><div className="pp-mp-value">$280k</div></div>
                  <div className="pp-mp-row"><div className="pp-mp-label">Negociación</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '28%', background: '#00FF9D' }}><span className="pp-mp-count">2</span></div></div><div className="pp-mp-value">$180k</div></div>
                  <div className="pp-mp-row"><div className="pp-mp-label">Cerrado ✓</div><div className="pp-mp-bar"><div className="pp-mp-fill" style={{ width: '14%', background: '#00FF9D' }}><span className="pp-mp-count">1</span></div></div><div className="pp-mp-value" style={{ color: '#00FF9D' }}>$95k</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pp-section" id="pp-precios">
        <div className="pp-container">
          <div className="pp-section-header" style={{ textAlign: 'center' }}>
            <div className="pp-section-tag pp-reveal" style={{ display: 'block', textAlign: 'center' }}>Precios</div>
            <h2 className="pp-section-title pp-reveal pp-reveal-delay-1" style={{ textAlign: 'center' }}>Paga solo por el rol<br />que usas</h2>
            <p className="pp-section-sub pp-reveal pp-reveal-delay-2" style={{ maxWidth: '440px', margin: '0 auto' }}>Sin planes fijos. Sin límite de actividades. 14 días gratis sin tarjeta de crédito.</p>
          </div>
          <div className="pp-pricing-grid" style={{ marginTop: '56px' }}>
            <div className="pp-pricing-card pp-reveal">
              <div className="pp-pricing-role">Vendedor</div>
              <div className="pp-pricing-price">$19<span>/mes</span></div>
              <div className="pp-pricing-desc">Por vendedor activo. Volumen con descuento.</div>
              <div className="pp-pricing-tiers">
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">1 vendedor</span><span className="pp-pricing-tier-value">$19/mes</span></div>
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">2–5 vendedores</span><span className="pp-pricing-tier-value">$15/mes c/u</span></div>
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">6–15 vendedores</span><span className="pp-pricing-tier-value">$12/mes c/u</span></div>
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">16+ vendedores</span><span className="pp-pricing-tier-value">$10/mes c/u</span></div>
              </div>
              <div className="pp-pricing-divider"></div>
              <div className="pp-pricing-feature">Dashboard personal con semáforo</div>
              <div className="pp-pricing-feature">Recetario comercial con IA</div>
              <div className="pp-pricing-feature">Check-in diario en 2 min</div>
              <div className="pp-pricing-feature">Coach IA diario y semanal</div>
              <div className="pp-pricing-feature">Pipeline de negocios</div>
              <a href="/register" className="pp-pricing-btn pp-pricing-btn-default">Empezar prueba gratis</a>
            </div>
            <div className="pp-pricing-card featured pp-reveal pp-reveal-delay-1">
              <div className="pp-pricing-badge">Más valor por equipo</div>
              <div className="pp-pricing-role">Manager</div>
              <div className="pp-pricing-price">$29<span>/mes</span></div>
              <div className="pp-pricing-desc">Por manager. Incluye vista de equipo completa.</div>
              <div className="pp-pricing-tiers">
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">1 manager</span><span className="pp-pricing-tier-value">$29/mes</span></div>
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">2–5 managers</span><span className="pp-pricing-tier-value">$22/mes c/u</span></div>
                <div className="pp-pricing-tier"><span className="pp-pricing-tier-label">6+ managers</span><span className="pp-pricing-tier-value">$17/mes c/u</span></div>
              </div>
              <div className="pp-pricing-divider"></div>
              <div className="pp-pricing-feature">Todo lo del Vendedor incluido</div>
              <div className="pp-pricing-feature">Vista del equipo en tiempo real</div>
              <div className="pp-pricing-feature">3 agentes IA de análisis de pipeline</div>
              <div className="pp-pricing-feature">Reportes automáticos semanales</div>
              <div className="pp-pricing-feature">Proyecciones y momentum score</div>
              <div className="pp-pricing-feature">Alertas de riesgo por vendedor</div>
              <a href="/register" className="pp-pricing-btn pp-pricing-btn-featured">Empezar prueba gratis</a>
            </div>
          </div>
          <div className="pp-pricing-footnote pp-reveal">Toda empresa requiere al menos un Manager que supervise al equipo de vendedores.</div>
        </div>
      </section>

      {/* CTA */}
      <section className="pp-cta-section">
        <div className="pp-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="pp-cta-eyebrow">⚡ Vendedores B2B · LATAM · IA</div>
          <h2 className="pp-cta-h2 pp-reveal">Empieza a prospectar<br />con <em>sistema</em> hoy</h2>
          <p className="pp-cta-sub pp-reveal pp-reveal-delay-1">Los equipos que usan ProspectPro cierran más — porque saben exactamente qué hacer cada día para cumplir su cuota.</p>
          <div className="pp-cta-actions pp-reveal pp-reveal-delay-2">
            <a href="/register" className="pp-btn-hero-primary" style={{ fontSize: '16px', padding: '16px 36px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              Crear mi cuenta gratis →
            </a>
          </div>
          <div className="pp-cta-fine pp-reveal pp-reveal-delay-3">Sin tarjeta de crédito · 14 días gratis · Cancela cuando quieras · Soporte en español</div>
        </div>
      </section>

      {/* WHATSAPP FLOAT */}
      <a href="https://wa.me/573164283749" target="_blank" rel="noopener noreferrer" className="pp-wa-float" aria-label="Contactar por WhatsApp">
        <span className="pp-wa-label">¿Tienes dudas? Escríbenos</span>
        <div className="pp-wa-btn">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </div>
      </a>

      {/* FOOTER */}
      <footer>
        <div className="pp-container">
          <div className="pp-footer-inner">
            <div className="pp-footer-brand">
              <div className="pp-footer-logo">
                <svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
              </div>
              <span className="pp-footer-name">ProspectPro</span>
            </div>
            <div className="pp-footer-links">
              <a href="#">Producto</a>
              <a href="#pp-precios">Precios</a>
              <a href="#">Privacidad</a>
              <a href="#">Términos</a>
            </div>
            <div className="pp-footer-copy">© 2026 ProspectPro · Prospección consultiva B2B para LATAM</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

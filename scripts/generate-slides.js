#!/usr/bin/env node
/**
 * generate-slides.js
 * Reads prepare-digest.js JSON from stdin, writes a self-contained
 * slide-deck HTML to ~/.follow-builders/digest-latest.html
 * Prints the output file path to stdout.
 */

import fs   from 'fs';
import path from 'path';
import os   from 'os';

let raw = '';
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { process.stderr.write('generate-slides: invalid JSON\n'); process.exit(1); }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Build slide data ──────────────────────────────────────────────
  const slides = [{ type: 'title', date: today }];

  const xBuilders = data.x || [];
  xBuilders.forEach((builder, i) => {
    const tweets = (builder.tweets || []).filter(t => t.text && t.text.trim().length > 15);
    if (!tweets.length) return;

    const bio = (builder.bio || '').split('\n')[0].replace(/\s+/g, ' ').trim();

    // Clean tweet text: strip t.co links, @ mentions at end, trim
    const cleanText = t =>
      t.text
        .replace(/https?:\/\/t\.co\/\S+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const parts = tweets.slice(0, 3).map(cleanText).filter(s => s.length > 10);
    const summary = parts.join(' — ');

    slides.push({
      type:    'x',
      name:    builder.name || builder.handle,
      role:    bio,
      summary: summary || 'Active on X today.',
      url:     tweets[0].url || '',
      index:   i + 1
    });
  });

  (data.podcasts || []).forEach((pod, i) => {
    const snippet = pod.transcript
      ? pod.transcript.replace(/\s+/g, ' ').trim().slice(0, 280) + '…'
      : '';
    slides.push({
      type:    'podcast',
      show:    pod.name,
      episode: pod.title,
      snippet,
      url:     pod.url,
      index:   xBuilders.length + i + 1
    });
  });

  // ── Render HTML ───────────────────────────────────────────────────
  const html = renderHTML(slides, today);

  const dir = path.join(os.homedir(), '.follow-builders');
  fs.mkdirSync(dir, { recursive: true });

  const outPath = path.join(dir, 'digest-latest.html');
  fs.writeFileSync(outPath, html, 'utf8');

  process.stdout.write(outPath + '\n');
});

// ── HTML template ─────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSlide(s, idx) {
  if (s.type === 'title') {
    return `<div class="slide${idx === 0 ? ' active' : ''}" data-i="${idx}">
      <div class="slide-title">
        <div class="eyebrow">Morning Briefing</div>
        <div class="headline">AI <em>Builders</em><br>Digest</div>
        <div class="date-line">${esc(s.date)}</div>
        <div class="tagline">Follow builders, not influencers — researchers, founders, and engineers actually shipping in AI.</div>
      </div>
    </div>`;
  }
  if (s.type === 'x') {
    return `<div class="slide" data-i="${idx}">
      <div class="slide-content">
        <div class="index-num">0${s.index}</div>
        <span class="tag tag-x">X / Twitter</span>
        <div class="name">${esc(s.name)}</div>
        <div class="role">${esc(s.role)}</div>
        <div class="divider"></div>
        <div class="summary">${esc(s.summary)}</div>
        ${s.url ? `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace('https://', ''))}</a>` : ''}
      </div>
    </div>`;
  }
  if (s.type === 'podcast') {
    return `<div class="slide" data-i="${idx}">
      <div class="slide-content">
        <div class="index-num">0${s.index}</div>
        <span class="tag tag-podcast">Podcast</span>
        <div class="name">${esc(s.show)}</div>
        <div class="episode-title">${esc(s.episode)}</div>
        ${s.snippet ? `<div class="summary">${esc(s.snippet)}</div>` : ''}
        ${s.url ? `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace('https://', ''))}</a>` : ''}
      </div>
    </div>`;
  }
  return '';
}

function renderHTML(slides, today) {
  const total = slides.length;
  const slidesHTML = slides.map((s, i) => renderSlide(s, i)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Builders Digest — ${esc(today)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080808; --surface: #0f0f0f; --border: #1e1e1e;
    --text: #e8e4dc; --muted: #5a5650; --accent: #c8a84b;
    --accent-dim: rgba(200,168,75,0.12);
    --tag-x: #1d9bf0; --tag-pod: #a855f7;
  }
  html, body { height: 100%; width: 100%; background: var(--bg); color: var(--text);
    font-family: 'IBM Plex Sans', sans-serif; overflow: hidden; cursor: none; }
  .cursor { position: fixed; width: 8px; height: 8px; background: var(--accent);
    border-radius: 50%; pointer-events: none; z-index: 9999;
    transition: transform .15s ease, opacity .15s ease; transform: translate(-50%,-50%); }
  .cursor.clicking { transform: translate(-50%,-50%) scale(2); opacity: .5; }
  body::before { content: ''; position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: .35; pointer-events: none; z-index: 1; }
  #deck { position: relative; width: 100vw; height: 100vh; z-index: 2; }
  .slide { position: absolute; inset: 0; display: flex; flex-direction: column;
    justify-content: center; padding: 7vh 8vw; opacity: 0; pointer-events: none;
    transition: opacity .55s cubic-bezier(.4,0,.2,1); }
  .slide.active { opacity: 1; pointer-events: all; }
  .slide-title { align-items: flex-start; }
  .slide-title .eyebrow { font-family: 'IBM Plex Mono', monospace;
    font-size: clamp(10px,1.1vw,13px); letter-spacing: .3em; color: var(--accent);
    text-transform: uppercase; margin-bottom: 3vh;
    opacity: 0; transform: translateY(8px); transition: opacity .5s .1s ease, transform .5s .1s ease; }
  .slide-title .headline { font-family: 'Fraunces', serif; font-size: clamp(52px,9vw,110px);
    font-weight: 300; line-height: .95; letter-spacing: -.02em; color: var(--text);
    margin-bottom: 4vh;
    opacity: 0; transform: translateY(16px); transition: opacity .6s .2s ease, transform .6s .2s ease; }
  .slide-title .headline em { font-style: italic; color: var(--accent); }
  .slide-title .date-line { font-family: 'IBM Plex Mono', monospace;
    font-size: clamp(11px,1.2vw,14px); color: var(--muted); letter-spacing: .15em;
    opacity: 0; transform: translateY(8px); transition: opacity .5s .4s ease, transform .5s .4s ease; }
  .slide-title .tagline { font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(13px,1.4vw,16px); font-weight: 300; color: var(--muted); margin-top: 5vh;
    border-top: 1px solid var(--border); padding-top: 2.5vh; max-width: 420px; line-height: 1.6;
    opacity: 0; transform: translateY(8px); transition: opacity .5s .55s ease, transform .5s .55s ease; }
  .slide.active .eyebrow, .slide.active .headline, .slide.active .date-line,
  .slide.active .tagline { opacity: 1; transform: translateY(0); }
  .slide-content { position: relative; }
  .slide-content .tag { font-family: 'IBM Plex Mono', monospace; font-size: clamp(9px,.9vw,11px);
    letter-spacing: .35em; text-transform: uppercase; padding: 4px 10px; border: 1px solid;
    display: inline-block; margin-bottom: 3.5vh;
    opacity: 0; transform: translateY(6px); transition: opacity .4s .05s ease, transform .4s .05s ease; }
  .tag-x { color: var(--tag-x); border-color: rgba(29,155,240,.3); }
  .tag-podcast { color: var(--tag-pod); border-color: rgba(168,85,247,.3); }
  .slide-content .name { font-family: 'Fraunces', serif; font-size: clamp(36px,6.5vw,80px);
    font-weight: 400; line-height: 1; letter-spacing: -.025em; color: var(--text); margin-bottom: 1.2vh;
    opacity: 0; transform: translateY(14px); transition: opacity .55s .15s ease, transform .55s .15s ease; }
  .slide-content .role { font-family: 'IBM Plex Mono', monospace; font-size: clamp(10px,1.1vw,13px);
    color: var(--accent); letter-spacing: .08em; margin-bottom: 4.5vh;
    opacity: 0; transform: translateY(8px); transition: opacity .45s .25s ease, transform .45s .25s ease; }
  .slide-content .episode-title { font-family: 'Fraunces', serif; font-style: italic;
    font-size: clamp(13px,1.5vw,18px); font-weight: 300; color: var(--muted); margin-bottom: 4vh;
    max-width: 580px; line-height: 1.4;
    opacity: 0; transform: translateY(8px); transition: opacity .45s .25s ease, transform .45s .25s ease; }
  .slide-content .divider { width: 48px; height: 1px; background: var(--accent); margin-bottom: 4vh;
    opacity: 0; transition: opacity .4s .3s ease; }
  .slide-content .summary { font-family: 'IBM Plex Sans', sans-serif; font-size: clamp(15px,1.8vw,22px);
    font-weight: 300; line-height: 1.65; color: var(--text); max-width: 640px;
    opacity: 0; transform: translateY(10px); transition: opacity .55s .35s ease, transform .55s .35s ease; }
  .slide-content .source-link { display: inline-block; margin-top: 4.5vh;
    font-family: 'IBM Plex Mono', monospace; font-size: clamp(10px,1vw,12px); color: var(--muted);
    text-decoration: none; letter-spacing: .05em; border-bottom: 1px solid var(--border); padding-bottom: 2px;
    opacity: 0; transition: opacity .4s .5s ease, color .2s ease, border-color .2s ease; }
  .slide-content .source-link:hover { color: var(--text); border-color: var(--muted); }
  .slide.active .tag, .slide.active .name, .slide.active .role, .slide.active .episode-title,
  .slide.active .divider, .slide.active .summary, .slide.active .source-link
    { opacity: 1; transform: translateY(0); }
  .slide-content .index-num { position: absolute; right: 0; top: 50%; transform: translateY(-50%);
    font-family: 'Fraunces', serif; font-size: clamp(80px,14vw,180px); font-weight: 700;
    color: rgba(255,255,255,.025); line-height: 1; user-select: none; pointer-events: none; }
  #progress-bar { position: fixed; bottom: 0; left: 0; height: 2px; background: var(--accent);
    transition: width .5s cubic-bezier(.4,0,.2,1); z-index: 100; }
  #nav { position: fixed; bottom: 32px; right: 40px; display: flex; align-items: center;
    gap: 20px; z-index: 100; }
  #counter { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted);
    letter-spacing: .1em; min-width: 48px; text-align: center; }
  .nav-btn { width: 36px; height: 36px; border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: none; display: flex; align-items: center; justify-content: center;
    transition: border-color .2s, color .2s, background .2s; }
  .nav-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
  .nav-btn svg { width: 14px; height: 14px; }
  #topbar { position: fixed; top: 28px; left: 40px; right: 40px;
    display: flex; justify-content: space-between; align-items: center; z-index: 100; }
  #logo { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .25em;
    color: var(--muted); text-transform: uppercase; }
  #logo span { color: var(--accent); }
  #hint { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--border); letter-spacing: .1em; }
  .v-line { position: fixed; left: 5vw; top: 0; bottom: 0; width: 1px;
    background: linear-gradient(to bottom, transparent, var(--border) 20%, var(--border) 80%, transparent);
    z-index: 2; pointer-events: none; }
</style>
</head>
<body>
<div class="cursor" id="cursor"></div>
<div class="v-line"></div>
<div id="progress-bar"></div>
<div id="topbar">
  <div id="logo">AI<span>·</span>DIGEST</div>
  <div id="hint">← → to navigate</div>
</div>
<div id="deck">
${slidesHTML}
</div>
<div id="nav">
  <button class="nav-btn" id="prev" aria-label="Previous">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <div id="counter">1 / ${total}</div>
  <button class="nav-btn" id="next" aria-label="Next">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>
  </button>
</div>
<script>
const total = ${total};
let current = 0;
const els = () => document.querySelectorAll('.slide');
const counter = document.getElementById('counter');
const bar = document.getElementById('progress-bar');
function goTo(n) {
  els()[current].classList.remove('active');
  current = Math.max(0, Math.min(n, total - 1));
  els()[current].classList.add('active');
  counter.textContent = (current + 1) + ' / ' + total;
  bar.style.width = ((current + 1) / total * 100) + '%';
}
document.getElementById('next').addEventListener('click', () => goTo(current + 1));
document.getElementById('prev').addEventListener('click', () => goTo(current - 1));
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(current + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
});
let tx = 0;
document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const d = tx - e.changedTouches[0].clientX;
  if (Math.abs(d) > 50) d > 0 ? goTo(current + 1) : goTo(current - 1);
});
const cursor = document.getElementById('cursor');
document.addEventListener('mousemove', e => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; });
document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
bar.style.width = (1 / total * 100) + '%';
</script>
</body>
</html>`;
}

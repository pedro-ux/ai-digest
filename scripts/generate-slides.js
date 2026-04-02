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

    const cleanText = t =>
      t.text
        .replace(/https?:\/\/t\.co\/\S+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const parts = tweets.slice(0, 3).map(cleanText).filter(s => s.length > 10);
    const summary = parts.join(' — ');
    const tweetUrl = tweets[0].url || '';
    const handle = (tweetUrl.match(/x\.com\/([^/]+)\/status/) || [])[1] || '';

    slides.push({
      type:    'x',
      name:    builder.name || builder.handle,
      role:    bio,
      summary: summary || 'Active on X today.',
      url:     tweetUrl,
      handle,
      index:   i + 1
    });
  });

  (data.podcasts || []).forEach((pod, i) => {
    const videoId = (pod.url || '').match(/(?:v=|watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1] || '';
    slides.push({
      type:    'podcast',
      show:    pod.name,
      episode: pod.title,
      url:     pod.url,
      videoId,
      index:   xBuilders.length + i + 1
    });
  });

  const html = renderHTML(slides, today);

  const dir = path.join(os.homedir(), '.follow-builders');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'digest-latest.html');
  fs.writeFileSync(outPath, html, 'utf8');
  process.stdout.write(outPath + '\n');
});

// ── Helpers ───────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function screenshotUrl(url) {
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
}

function ytThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function avatarUrl(handle) {
  return handle ? `https://unavatar.io/twitter/${handle}` : '';
}

// ── Slide renderers ───────────────────────────────────────────────
function renderTitleSlide(s) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `
  <div class="slide active" data-i="0">
    <div class="title-card">
      <div class="title-top">
        <div class="title-badge">Daily Briefing</div>
      </div>
      <div class="title-body">
        <div class="title-greeting">${greeting} ☀️</div>
        <h1 class="title-headline">AI Builders<br><em>Digest</em></h1>
        <p class="title-date">${esc(s.date)}</p>
      </div>
      <div class="title-footer">
        <span class="title-tagline">Follow builders, not influencers</span>
        <span class="title-hint">Use ← → to navigate</span>
      </div>
    </div>
  </div>`;
}

function renderXSlide(s, idx) {
  const avatar = avatarUrl(s.handle);
  const screenshot = s.url ? screenshotUrl(s.url) : '';
  return `
  <div class="slide" data-i="${idx}">
    <div class="content-card">
      <div class="card-left">
        <div class="card-tag tag-x">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          From X
        </div>
        <div class="card-author">
          ${avatar ? `<img class="author-avatar" src="${esc(avatar)}" alt="${esc(s.name)}" onerror="this.style.display='none'">` : ''}
          <div class="author-info">
            <div class="author-name">${esc(s.name)}</div>
            <div class="author-role">${esc(s.role)}</div>
          </div>
        </div>
        <blockquote class="card-summary">${esc(s.summary)}</blockquote>
        ${s.url ? `<a class="card-link" href="${esc(s.url)}" target="_blank" rel="noopener">Read on X →</a>` : ''}
        <div class="card-index">${String(s.index).padStart(2,'0')}</div>
      </div>
      <div class="card-right">
        ${screenshot ? `
        <div class="screenshot-wrap">
          <img class="screenshot-img" src="${esc(screenshot)}" alt="Tweet screenshot" loading="lazy"
               onerror="this.closest('.screenshot-wrap').classList.add('screenshot-error')">
          <div class="screenshot-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span>Loading preview…</span>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function renderPodcastSlide(s, idx) {
  const thumb = s.videoId ? ytThumb(s.videoId) : '';
  return `
  <div class="slide" data-i="${idx}">
    <div class="content-card podcast-card">
      <div class="card-left">
        <div class="card-tag tag-podcast">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          Podcast
        </div>
        <div class="podcast-show">${esc(s.show)}</div>
        <h2 class="podcast-episode">${esc(s.episode)}</h2>
        ${s.url ? `<a class="card-link" href="${esc(s.url)}" target="_blank" rel="noopener">Listen now →</a>` : ''}
        <div class="card-index">${String(s.index).padStart(2,'0')}</div>
      </div>
      <div class="card-right">
        ${thumb ? `
        <div class="screenshot-wrap yt-wrap">
          <img class="screenshot-img yt-thumb" src="${esc(thumb)}" alt="Episode thumbnail" loading="lazy">
          <div class="yt-play">
            <svg viewBox="0 0 24 24" fill="white" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

// ── Full HTML page ────────────────────────────────────────────────
function renderHTML(slides, today) {
  const total = slides.length;
  const slidesHTML = slides.map((s, i) => {
    if (s.type === 'title')   return renderTitleSlide(s);
    if (s.type === 'x')       return renderXSlide(s, i);
    if (s.type === 'podcast') return renderPodcastSlide(s, i);
    return '';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Builders Digest — ${esc(today)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #FDF8F2;
  --surface:    #FFFFFF;
  --border:     #EDE5D8;
  --text:       #1C1712;
  --muted:      #8C7E6B;
  --x-color:    #D97706;
  --x-bg:       #FEF3C7;
  --pod-color:  #7C3AED;
  --pod-bg:     #EDE9FE;
  --link:       #2563EB;
  --shadow:     0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
  --shadow-lg:  0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
}

html, body {
  height: 100%; width: 100%;
  background: var(--bg);
  font-family: 'Plus Jakarta Sans', sans-serif;
  overflow: hidden;
}

/* ── Deck ── */
#deck { position: relative; width: 100vw; height: 100vh; }

/* ── Slides ── */
.slide {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  opacity: 0; pointer-events: none;
  transform: translateX(40px);
  transition: opacity 0.45s cubic-bezier(0.4,0,0.2,1), transform 0.45s cubic-bezier(0.4,0,0.2,1);
}
.slide.active  { opacity: 1; pointer-events: all; transform: translateX(0); }
.slide.leaving { opacity: 0; transform: translateX(-40px); transition-duration: 0.3s; }

/* ── Title card ── */
.title-card {
  width: 100%; max-width: 680px;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow-lg);
  padding: 52px 56px;
  display: flex; flex-direction: column; gap: 0;
  border: 1px solid var(--border);
  position: relative; overflow: hidden;
}
.title-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #F59E0B, #EC4899, #8B5CF6, #3B82F6);
}
.title-top { margin-bottom: 40px; }
.title-badge {
  display: inline-block;
  font-family: 'DM Mono', monospace;
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted);
  background: var(--bg); border: 1px solid var(--border);
  padding: 5px 12px; border-radius: 100px;
}
.title-body { margin-bottom: 48px; }
.title-greeting {
  font-size: 18px; font-weight: 500; color: var(--muted);
  margin-bottom: 16px;
}
.title-headline {
  font-family: 'Lora', serif;
  font-size: clamp(40px, 6vw, 64px);
  font-weight: 400; line-height: 1.1; letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 20px;
}
.title-headline em { font-style: italic; color: var(--x-color); }
.title-date {
  font-family: 'DM Mono', monospace;
  font-size: 13px; color: var(--muted); letter-spacing: 0.05em;
}
.title-footer {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--border); padding-top: 20px;
}
.title-tagline { font-size: 13px; color: var(--muted); font-style: italic; }
.title-hint {
  font-family: 'DM Mono', monospace;
  font-size: 11px; color: var(--border); letter-spacing: 0.08em;
}

/* ── Content card ── */
.content-card {
  width: 100%; max-width: 1000px; height: min(620px, 85vh);
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border);
  display: grid; grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

/* Card left */
.card-left {
  padding: 40px 44px;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--border);
  position: relative; overflow: hidden;
}
.card-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
  padding: 5px 12px; border-radius: 100px; border: 1px solid;
  width: fit-content; margin-bottom: 28px;
}
.tag-x       { color: var(--x-color);   background: var(--x-bg);   border-color: #FDE68A; }
.tag-podcast { color: var(--pod-color); background: var(--pod-bg); border-color: #DDD6FE; }

/* Author */
.card-author {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 24px;
}
.author-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  object-fit: cover; border: 2px solid var(--border);
  flex-shrink: 0;
}
.author-name {
  font-family: 'Lora', serif;
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 600; color: var(--text); line-height: 1.1;
}
.author-role {
  font-size: 12px; color: var(--muted); margin-top: 3px;
  line-height: 1.4;
}

/* Summary */
.card-summary {
  font-size: clamp(14px, 1.5vw, 17px);
  font-weight: 400; line-height: 1.7; color: var(--text);
  flex: 1;
  display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Link */
.card-link {
  display: inline-block; margin-top: 24px;
  font-size: 13px; font-weight: 600;
  color: var(--link); text-decoration: none;
  transition: gap 0.2s;
}
.card-link:hover { text-decoration: underline; }

/* Ghost index number */
.card-index {
  position: absolute; bottom: -10px; right: 20px;
  font-family: 'Lora', serif;
  font-size: 96px; font-weight: 600;
  color: rgba(0,0,0,0.04);
  line-height: 1; user-select: none; pointer-events: none;
}

/* Card right — screenshot */
.card-right {
  position: relative; background: #F5F0E8;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.screenshot-wrap {
  width: 100%; height: 100%;
  position: relative;
  display: flex; align-items: center; justify-content: center;
}
.screenshot-img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top;
  display: block;
}
.screenshot-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  color: var(--muted); font-size: 12px;
  font-family: 'DM Mono', monospace;
  background: var(--bg);
  transition: opacity 0.3s;
}
.screenshot-wrap:has(.screenshot-img[src]) .screenshot-placeholder {
  opacity: 0; pointer-events: none;
}
.screenshot-error .screenshot-placeholder { opacity: 1 !important; }
.screenshot-error .screenshot-placeholder::after { content: 'Preview unavailable'; }
.screenshot-error .screenshot-img { display: none; }

/* YouTube */
.yt-wrap { cursor: pointer; }
.yt-thumb { object-position: center; }
.yt-play {
  position: absolute;
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s, background 0.2s;
}
.yt-wrap:hover .yt-play { background: #FF0000; transform: scale(1.1); }

/* Podcast card */
.podcast-card .card-left { justify-content: center; }
.podcast-show {
  font-family: 'DM Mono', monospace;
  font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--pod-color); margin-bottom: 14px;
}
.podcast-episode {
  font-family: 'Lora', serif;
  font-size: clamp(18px, 2.2vw, 26px);
  font-weight: 400; line-height: 1.3; color: var(--text);
  margin-bottom: 28px;
}

/* ── Nav ── */
#nav {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; z-index: 100;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 100px; padding: 8px 16px;
  box-shadow: var(--shadow);
}
.nav-btn {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--bg);
  color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.nav-btn:hover { background: var(--text); color: white; border-color: var(--text); }
.nav-btn svg { width: 14px; height: 14px; }
#counter {
  font-family: 'DM Mono', monospace;
  font-size: 12px; color: var(--muted); min-width: 40px; text-align: center;
}

/* ── Dots ── */
#dots {
  position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px; z-index: 100;
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--border); transition: background 0.3s, transform 0.3s;
  cursor: pointer;
}
.dot.active { background: var(--text); transform: scale(1.3); }

/* ── Progress bar ── */
#progress {
  position: fixed; top: 0; left: 0; height: 3px;
  background: linear-gradient(90deg, #F59E0B, #EC4899);
  transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
  z-index: 200;
}

@media (max-width: 700px) {
  .content-card { grid-template-columns: 1fr; grid-template-rows: auto 240px; }
  .card-left { border-right: none; border-bottom: 1px solid var(--border); padding: 28px; }
  .card-right { min-height: 200px; }
}
</style>
</head>
<body>

<div id="progress"></div>
<div id="dots"></div>
<div id="deck">
${slidesHTML}
</div>
<div id="nav">
  <button class="nav-btn" id="prev" aria-label="Previous">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <div id="counter">1 / ${total}</div>
  <button class="nav-btn" id="next" aria-label="Next">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </button>
</div>

<script>
const TOTAL = ${total};
let current = 0;
const slides = () => [...document.querySelectorAll('.slide')];
const dots   = () => [...document.querySelectorAll('.dot')];

// Build dots
const dotsEl = document.getElementById('dots');
for (let i = 0; i < TOTAL; i++) {
  const d = document.createElement('div');
  d.className = 'dot' + (i === 0 ? ' active' : '');
  d.addEventListener('click', () => goTo(i));
  dotsEl.appendChild(d);
}

function goTo(n, dir) {
  if (n === current) return;
  const els = slides();
  const ds  = dots();
  els[current].classList.remove('active');
  els[current].classList.add('leaving');
  setTimeout(() => els[current < n ? current : n + (n < current ? 0 : 0)].classList.remove('leaving'), 350);
  ds[current].classList.remove('active');
  current = Math.max(0, Math.min(n, TOTAL - 1));
  // small delay to allow leaving animation to start
  requestAnimationFrame(() => {
    els[current].classList.add('active');
    ds[current].classList.add('active');
  });
  document.getElementById('counter').textContent = (current + 1) + ' / ' + TOTAL;
  document.getElementById('progress').style.width = ((current + 1) / TOTAL * 100) + '%';
  // clean up leaving after transition
  setTimeout(() => {
    slides().forEach(s => { if (!s.classList.contains('active')) s.classList.remove('leaving'); });
  }, 500);
}

function next() { if (current < TOTAL - 1) goTo(current + 1); }
function prev() { if (current > 0) goTo(current - 1); }

document.getElementById('next').addEventListener('click', next);
document.getElementById('prev').addEventListener('click', prev);
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft')                    { e.preventDefault(); prev(); }
});
let tx = 0;
document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; });
document.addEventListener('touchend',   e => {
  const d = tx - e.changedTouches[0].clientX;
  if (Math.abs(d) > 50) d > 0 ? next() : prev();
});

// Init progress
document.getElementById('progress').style.width = (1 / TOTAL * 100) + '%';

// YouTube thumbnail click → open video
document.querySelectorAll('.yt-wrap').forEach(el => {
  el.addEventListener('click', () => {
    const link = el.closest('.slide').querySelector('.card-link');
    if (link) window.open(link.href, '_blank');
  });
});
</script>
</body>
</html>`;
}

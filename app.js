/**
 * PipelineIQ – app.js
 *
 * Architecture: Vanilla JS, localStorage persistence,
 * append-only audit trail, NLP intent parser + Levenshtein fuzzy search.
 */

/* ─── Constants ──────────────────────────────────────────── */
const STAGES     = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const ALL_STAGES = [...STAGES, 'Rejected'];
const STORAGE    = 'pipelineiq_v2';

const COLORS = [
  '#7c7cff','#3b9eff','#1fc98e','#f5a623',
  '#e879f9','#fb923c','#38bdf8','#a3e635',
];

/* ─── State ──────────────────────────────────────────────── */
let S = { candidates: [] };

/* ─── Persistence ────────────────────────────────────────── */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) S = JSON.parse(raw);
  } catch (_) {}
  if (!S.candidates?.length) seed();
}

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(S)); } catch (_) {}
}

function seed() {
  const now  = Date.now();
  const DAY  = 86_400_000;

  const data = [
    { name:'Priya Sharma',   role:'Senior Frontend Dev',    email:'priya@example.com',   stage:'Interview', ago:9  },
    { name:'Arjun Mehta',    role:'Backend Engineer',       email:'arjun@example.com',   stage:'Screening', ago:10 },
    { name:'Kavya Reddy',    role:'Product Designer',       email:'kavya@example.com',   stage:'Offer',     ago:3  },
    { name:'Rohit Kumar',    role:'Data Scientist',         email:'rohit@example.com',   stage:'Applied',   ago:1  },
    { name:'Sneha Patel',    role:'DevOps Engineer',        email:'sneha@example.com',   stage:'Applied',   ago:2  },
    { name:'Vikram Singh',   role:'Backend Engineer',       email:'vikram@example.com',  stage:'Hired',     ago:5  },
    { name:'Ananya Joshi',   role:'UX Researcher',          email:'ananya@example.com',  stage:'Rejected',  ago:6  },
    { name:'Dev Nair',       role:'Full Stack Developer',   email:'dev@example.com',     stage:'Screening', ago:8  },
    { name:'Meera Iyer',     role:'ML Engineer',            email:'meera@example.com',   stage:'Interview', ago:4  },
    { name:'Rajan Verma',    role:'Frontend Developer',     email:'rajan@example.com',   stage:'Applied',   ago:0  },
    { name:'Lakshmi Rao',    role:'Backend Engineer',       email:'lakshmi@example.com', stage:'Offer',     ago:7  },
    { name:'Aarav Shah',     role:'Cloud Architect',        email:'aarav@example.com',   stage:'Screening', ago:12 },
    { name:'Pooja Gupta',    role:'QA Engineer',            email:'pooja@example.com',   stage:'Hired',     ago:14 },
    { name:'Nikhil Desai',   role:'Mobile Developer',       email:'nikhil@example.com',  stage:'Rejected',  ago:9  },
    { name:'Tanya Kapoor',   role:'Product Manager',        email:'tanya@example.com',   stage:'Applied',   ago:3  },
  ];

  data.forEach(d => {
    const stageIdx = ALL_STAGES.indexOf(d.stage);
    const created  = new Date(now - (d.ago + stageIdx) * DAY).toISOString();
    const hist     = [];

    hist.push({ action:'Added to pipeline', stage:'Applied', timestamp:created });

    const path = d.stage === 'Rejected'
      ? STAGES.slice(0, Math.floor(Math.random() * 3) + 1)
      : STAGES.slice(0, stageIdx + 1);

    for (let i = 1; i < path.length; i++) {
      hist.push({
        action: `Moved to ${path[i]}`,
        stage:  path[i],
        timestamp: new Date(now - (d.ago + (stageIdx - i)) * DAY).toISOString(),
      });
    }

    if (d.stage === 'Rejected') {
      hist.push({
        action: 'Rejected',
        stage:  'Rejected',
        timestamp: new Date(now - d.ago * DAY).toISOString(),
        note: 'Skills not aligned with current needs.',
      });
    }

    S.candidates.push({
      id:          uid(),
      name:        d.name,
      role:        d.role,
      email:       d.email,
      stage:       d.stage,
      color:       COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt:   created,
      history:     hist,
    });
  });

  save();
}

/* ─── Utilities ──────────────────────────────────────────── */
const uid  = () => '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const esc  = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const slug = s  => s.toLowerCase();

function initials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() || '').join('');
}

function relativeTime(iso) {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  const hrs  = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day:'numeric', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}

function daysInStage(c) {
  const last = [...c.history].reverse()
    .find(h => h.stage === c.stage && (h.action.startsWith('Moved') || h.action.startsWith('Added')));
  if (!last) return 0;
  return Math.floor((Date.now() - new Date(last.timestamp).getTime()) / 86_400_000);
}

function stageColor(stage) {
  const m = {
    applied:'#7c7cff', screening:'#3b9eff', interview:'#1fc98e',
    offer:'#f5a623',   hired:'#22c55e',     rejected:'#f43f5e',
  };
  return m[slug(stage)] || '#a0a0ab';
}

function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return (i === -1 || i === STAGES.length - 1) ? null : STAGES[i + 1];
}

/* ─── Actions ────────────────────────────────────────────── */
function addCandidate({ name, role, email, notes }) {
  const now = new Date().toISOString();
  const c = {
    id:        uid(),
    name:      name.trim(),
    role:      role.trim(),
    email:     email.trim(),
    stage:     'Applied',
    color:     COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: now,
    history:   [{ action:'Added to pipeline', stage:'Applied', timestamp:now,
                  note: notes?.trim() || undefined }],
  };
  S.candidates.unshift(c);
  save();
  return c;
}

function advance(id) {
  const c = S.candidates.find(c => c.id === id);
  if (!c) return null;
  const next = nextStage(c.stage);
  if (!next || c.stage === 'Rejected') return null;
  const now = new Date().toISOString();
  c.history = [...c.history, { action:`Moved to ${next}`, stage:next, timestamp:now }];
  c.stage   = next;
  save();
  return c;
}

function reject(id, reason) {
  const c = S.candidates.find(c => c.id === id);
  if (!c || c.stage === 'Hired' || c.stage === 'Rejected') return null;
  const now = new Date().toISOString();
  c.history = [...c.history, {
    action:'Rejected', stage:'Rejected', timestamp:now,
    note: reason?.trim() || undefined,
  }];
  c.stage = 'Rejected';
  save();
  return c;
}

/* ─── Search parser ──────────────────────────────────────── */
const STAGE_ALIASES = {
  applied:'Applied', applying:'Applied',
  screen:'Screening', screening:'Screening', screened:'Screening',
  interview:'Interview', interviews:'Interview', interviewed:'Interview',
  offer:'Offer', offered:'Offer',
  hire:'Hired', hired:'Hired',
  reject:'Rejected', rejected:'Rejected', rejection:'Rejected',
};

function resolveStage(tok) { return STAGE_ALIASES[tok?.toLowerCase()] || null; }

function parseDayOffset(str) {
  const s = str.toLowerCase();
  const n = s.match(/(\d+)\s*(day|days|week|weeks)/);
  if (n) return parseInt(n[1]) * (n[2].startsWith('week') ? 7 : 1);
  if (/\ba\s+week\b/.test(s)) return 7;
  if (/two\s+weeks/.test(s))  return 14;
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = new Date().getDay();
  for (let i = 0; i < 7; i++) {
    if (s.startsWith(days[i])) return ((today - i + 7) % 7) || 7;
  }
  if (s.startsWith('yesterday')) return 1;
  if (s.startsWith('today'))     return 0;
  return null;
}

function parseQuery(raw) {
  const q      = raw.trim();
  const lower  = q.toLowerCase();
  const intents = [];
  const errors  = [];
  let nameQ     = '';

  if (!q) return { intents:[], nameQ:'', errors:[] };

  // offer not hired
  if (/(offer.*not\s+hired|reached offer.*not hired|offer.*didn.t get hired)/i.test(q)) {
    intents.push({ type:'not_hired_after_offer' });
  }

  // moved to <stage> since <time>
  const m1 = q.match(/moved?\s+to\s+(\w+)\s+since\s+(.+)/i);
  if (m1) {
    const stage = resolveStage(m1[1]);
    if (stage) {
      const d = parseDayOffset(m1[2]);
      if (d !== null) intents.push({ type:'moved_since', stage, sinceDays:d });
      else errors.push(`Couldn't parse the time "${m1[2]}". Try "since Monday" or "since 7 days".`);
    } else {
      errors.push(`"${m1[1]}" is not a known stage. Valid stages: ${ALL_STAGES.join(', ')}.`);
    }
  }

  // stuck in <stage> / in <stage> for more than <time>
  const m2 = q.match(/stuck\s+in\s+(\w+)|in\s+(\w+)\s+for\s+(?:more\s+than\s+)?(.+)/i);
  if (m2 && !m1) {
    const sName = m2[1] || m2[2];
    const stage = resolveStage(sName);
    if (stage) {
      if (m2[3]) {
        const d = parseDayOffset(m2[3]);
        if (d !== null) intents.push({ type:'stuck', stage, minDays:d });
        else errors.push(`Couldn't parse the duration "${m2[3]}". Try "more than 7 days" or "a week".`);
      } else {
        intents.push({ type:'stage', stage });
      }
    }
  }

  // in <stage>
  const m3 = q.match(/(?:in|at|currently\s+in|who(?:'s|\s+is)\s+in)\s+(\w+)/i);
  if (m3 && !m2 && !m1) {
    const stage = resolveStage(m3[1]);
    if (stage) intents.push({ type:'stage', stage });
    else errors.push(`"${m3[1]}" isn't a known stage. Try: ${ALL_STAGES.join(', ')}.`);
  }

  // except / exclude
  const m4 = q.match(/(?:except|excluding|exclude|without|not)\s+(\w+)/i);
  if (m4) {
    const stage = resolveStage(m4[1]);
    if (stage) intents.push({ type:'exclude_stage', stage });
  }

  // Name fallback
  const hasStructural = intents.some(i =>
    ['stage','stuck','moved_since','not_hired_after_offer','exclude_stage'].includes(i.type)
  );
  if (!hasStructural) {
    nameQ = q;
  } else {
    // Try to extract a name fragment after stripping structural parts
    const stripped = q
      .replace(/moved?\s+to\s+\w+\s+since\s+.+/i, '')
      .replace(/stuck\s+in\s+\w+/i, '')
      .replace(/in\s+\w+\s+for\s+(?:more\s+than\s+)?.+/i, '')
      .replace(/(?:in|at|currently\s+in|who(?:'s|\s+is)\s+in)\s+\w+/i, '')
      .replace(/(?:except|excluding|exclude|without|not)\s+\w+/i, '')
      .replace(/offer.*not\s+hired/i, '')
      .replace(/(?:who|who's|find|show|everyone|candidates?|right\s+now|since|and|but)/gi, '')
      .trim();
    if (stripped.length > 1) nameQ = stripped;
  }

  return { intents, nameQ, errors };
}

/* ─── Levenshtein fuzzy score ────────────────────────────── */
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, (_,i) => [i]);
  for (let j=0; j<=n; j++) dp[0][j] = j;
  for (let i=1; i<=m; i++)
    for (let j=1; j<=n; j++)
      dp[i][j] = a[i-1]===b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzy(query, target) {
  const q = query.toLowerCase(), t = target.toLowerCase();
  if (t.includes(q)) return 1;
  const qw = q.split(/\s+/), tw = t.split(/\s+/);
  let score = 0;
  for (const w of qw) {
    const best = Math.min(...tw.map(x => lev(w, x)));
    score += Math.max(0, 1 - best / Math.max(w.length, 1));
  }
  return score / qw.length;
}

/* ─── Search execution ───────────────────────────────────── */
function search(parsed) {
  let pool = [...S.candidates];

  for (const intent of parsed.intents) {
    if (intent.type === 'stage') {
      pool = pool.filter(c => c.stage === intent.stage);
    }
    if (intent.type === 'stuck') {
      pool = pool.filter(c => c.stage === intent.stage && daysInStage(c) >= intent.minDays);
    }
    if (intent.type === 'moved_since') {
      const cutoff = Date.now() - intent.sinceDays * 86_400_000;
      pool = pool.filter(c => {
        const e = c.history.find(h => h.stage === intent.stage && h.action.includes('Moved'));
        return e && new Date(e.timestamp).getTime() >= cutoff;
      });
    }
    if (intent.type === 'not_hired_after_offer') {
      pool = pool.filter(c => c.history.some(h => h.stage === 'Offer') && c.stage !== 'Hired');
    }
    if (intent.type === 'exclude_stage') {
      pool = pool.filter(c => c.stage !== intent.stage);
    }
  }

  const results = pool.map(c => {
    let score = 0.5;
    if (parsed.nameQ) {
      const ns = fuzzy(parsed.nameQ, c.name);
      const rs = fuzzy(parsed.nameQ, c.role) * 0.5;
      score    = Math.max(ns, rs);
    }
    return { c, score };
  });

  if (parsed.nameQ && !parsed.intents.length) {
    return results.filter(r => r.score > 0.25).sort((a, b) => b.score - a.score);
  }

  return results.sort((a, b) =>
    parsed.nameQ
      ? b.score - a.score
      : daysInStage(b.c) - daysInStage(a.c)
  );
}

function intentLabel(parsed) {
  const parts = [];
  for (const i of parsed.intents) {
    if (i.type === 'stage')              parts.push(`In ${i.stage}`);
    if (i.type === 'stuck')              parts.push(`Stuck in ${i.stage} ≥ ${i.minDays}d`);
    if (i.type === 'moved_since')        parts.push(`Entered ${i.stage} in last ${i.sinceDays}d`);
    if (i.type === 'not_hired_after_offer') parts.push('Reached Offer but not Hired');
    if (i.type === 'exclude_stage')      parts.push(`Excluding ${i.stage}`);
  }
  if (parsed.nameQ) parts.push(`"${parsed.nameQ}"`);
  return parts.join(' · ');
}

/* ─── Rendering ──────────────────────────────────────────── */
function renderBoard() {
  const board = document.getElementById('pipeline-board');
  board.innerHTML = '';

  ALL_STAGES.forEach(stage => {
    const cands = S.candidates.filter(c => c.stage === stage);
    board.appendChild(buildCol(stage, cands));
  });

  renderNavStats();
}

function renderNavStats() {
  const el = document.getElementById('nav-stats');
  const total   = S.candidates.length;
  const active  = S.candidates.filter(c => !['Hired','Rejected'].includes(c.stage)).length;
  const hired   = S.candidates.filter(c => c.stage === 'Hired').length;

  el.innerHTML = `
    <div class="stat-pill"><span>${total}</span>total</div>
    <div class="stat-pill"><span>${active}</span>active</div>
    <div class="stat-pill"><span>${hired}</span>hired</div>
  `;
}

function buildCol(stage, cands) {
  const col  = document.createElement('div');
  col.className = 'stage-col';

  const color = stageColor(stage);
  const sl    = slug(stage);

  col.innerHTML = `
    <div class="col-accent-line" style="background:${color}"></div>
    <div class="col-head">
      <div class="col-head-left">
        <div class="col-pip" style="background:${color}"></div>
        <span class="col-label">${esc(stage)}</span>
      </div>
      <span class="col-count">${cands.length}</span>
    </div>
    <div class="col-body" id="col-${sl}">
      ${cands.length === 0 ? '<div class="col-empty">No candidates</div>' : ''}
    </div>
  `;

  const body = col.querySelector(`#col-${sl}`);
  cands.forEach((c, i) => {
    const card = buildCard(c);
    card.style.animationDelay = `${i * 0.03}s`;
    card.classList.add('fade-up');
    body.appendChild(card);
  });

  return col;
}

function buildCard(c) {
  const card = document.createElement('div');
  card.className = 'cand-card';
  card.id = `card-${c.id}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  const days    = daysInStage(c);
  const daysCls = days >= 14 ? 'c-days alert' : days >= 7 ? 'c-days warn' : 'c-days';
  const daysLbl = days === 0 ? 'today' : `${days}d`;

  card.innerHTML = `
    <div class="card-row-1">
      <div class="c-avatar" style="background:${c.color}">${initials(c.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="c-name">${esc(c.name)}</div>
        <div class="c-role">${esc(c.role)}</div>
      </div>
    </div>
    <div class="card-row-2">
      <span class="${daysCls}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 6v6l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        ${daysLbl}
      </span>
      ${c.email ? `<span class="c-email">${esc(c.email.split('@')[0])}</span>` : ''}
    </div>
  `;

  card.addEventListener('click', () => openDetail(c.id));
  card.addEventListener('keydown', e => (e.key==='Enter'||e.key===' ') && openDetail(c.id));
  return card;
}

/* ─── Detail modal ───────────────────────────────────────── */
let _rejectId = null;

function openDetail(id) {
  const c = S.candidates.find(x => x.id === id);
  if (!c) return;

  const days  = daysInStage(c);
  const sl    = slug(c.stage);
  const col   = stageColor(c.stage);
  const nxt   = nextStage(c.stage);

  // Header
  document.getElementById('detail-title').textContent = c.name;
  document.getElementById('d-role').textContent = c.role;
  const av = document.getElementById('d-avatar');
  av.textContent  = initials(c.name);
  av.style.background = c.color;

  // Stage chip
  const chip = document.getElementById('d-stage-chip');
  chip.textContent  = c.stage;
  chip.className    = `stage-chip-lg chip-${sl}`;
  document.getElementById('d-stage-dur').textContent =
    days === 0 ? 'Entered today' : `${days} day${days!==1?'s':''} in this stage`;

  // Actions
  const acts = document.getElementById('d-actions');
  acts.innerHTML = '';

  if (c.stage !== 'Hired' && c.stage !== 'Rejected') {
    if (nxt) {
      const btn = document.createElement('button');
      btn.className = 'btn-advance-sm';
      btn.id = `adv-${c.id}`;
      btn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Move to ${nxt}
      `;
      btn.onclick = () => {
        advance(c.id);
        renderBoard();
        closeModal('detail-modal');
        toast(`${c.name} → ${nxt}`, 'success');
      };
      acts.appendChild(btn);
    }

    const rbtn = document.createElement('button');
    rbtn.className = 'btn-reject-sm';
    rbtn.id = `rej-${c.id}`;
    rbtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Reject
    `;
    rbtn.onclick = () => { closeModal('detail-modal'); openReject(c.id); };
    acts.appendChild(rbtn);
  }

  // Timeline (append-only, newest first in display)
  const tl = document.getElementById('d-timeline');
  tl.innerHTML = '';
  [...c.history].reverse().forEach((e, i) => {
    const col2 = stageColor(e.stage);
    const entry = document.createElement('div');
    entry.className = 'tl-entry';
    entry.innerHTML = `
      <div class="tl-dot" style="background:${col2}18;border:1.5px solid ${col2}40">
        <div class="tl-inner" style="color:${col2}"></div>
      </div>
      <div class="tl-content">
        <div class="tl-action">${esc(e.action)}</div>
        <div class="tl-time">${fmtDate(e.timestamp)}${i===0?' · <strong style="color:var(--t2)">latest</strong>':''}</div>
        ${e.note ? `<div class="tl-note">${esc(e.note)}</div>` : ''}
      </div>
    `;
    tl.appendChild(entry);
  });

  // Info panel
  document.getElementById('d-info').innerHTML = `
    <div class="info-item">
      <div class="info-key">Email</div>
      <div class="info-val">${c.email ? esc(c.email) : '—'}</div>
    </div>
    <div class="info-item">
      <div class="info-key">Applied</div>
      <div class="info-val">${fmtDate(c.createdAt)}</div>
    </div>
    <div class="info-item">
      <div class="info-key">Days in stage</div>
      <div class="info-val">${days}</div>
    </div>
    <div class="info-item">
      <div class="info-key">History events</div>
      <div class="info-val">${c.history.length}</div>
    </div>
  `;

  openModal('detail-modal');
}

function openReject(id) {
  _rejectId = id;
  const c = S.candidates.find(x => x.id === id);
  document.getElementById('reject-title').textContent = `Reject — ${c?.name || ''}`;
  document.getElementById('reject-reason').value = '';
  openModal('reject-modal');
}

/* ─── Add modal ──────────────────────────────────────────── */
function setupAddModal() {
  $('open-add-modal').addEventListener('click', () => openModal('add-modal'));
  $('close-add-modal').addEventListener('click', () => closeModal('add-modal'));
  $('cancel-add').addEventListener('click', () => closeModal('add-modal'));

  $('add-form').addEventListener('submit', e => {
    e.preventDefault();
    const name  = $('f-name').value.trim();
    const role  = $('f-role').value.trim();
    const email = $('f-email').value.trim();
    const notes = $('f-notes').value.trim();

    let ok = true;
    if (!name) { $('err-name').textContent = 'Required'; $('f-name').classList.add('err'); ok=false; }
    else        { $('err-name').textContent = ''; $('f-name').classList.remove('err'); }
    if (!role) { $('err-role').textContent = 'Required'; $('f-role').classList.add('err'); ok=false; }
    else        { $('err-role').textContent = ''; $('f-role').classList.remove('err'); }
    if (!ok) return;

    addCandidate({ name, role, email, notes });
    closeModal('add-modal');
    e.target.reset();
    renderBoard();
    const q = $('search-input').value.trim();
    if (q) runSearch(q);
    toast(`${name} added to pipeline`, 'success');
  });
}

/* ─── Reject modal ───────────────────────────────────────── */
function setupRejectModal() {
  $('close-reject-modal').addEventListener('click', () => { closeModal('reject-modal'); _rejectId=null; });
  $('cancel-reject').addEventListener('click',       () => { closeModal('reject-modal'); _rejectId=null; });
  $('confirm-reject').addEventListener('click', () => {
    if (!_rejectId) return;
    const reason = $('reject-reason').value.trim();
    const c = reject(_rejectId, reason);
    closeModal('reject-modal');
    _rejectId = null;
    renderBoard();
    const q = $('search-input').value.trim();
    if (q) runSearch(q);
    if (c) toast(`${c.name} rejected`, 'info');
  });
}

/* ─── Search ─────────────────────────────────────────────── */
let _timer = null;

function setupSearch() {
  const input = $('search-input');
  const clear = $('search-clear');

  input.addEventListener('input', () => {
    clear.style.display = input.value ? 'flex' : 'none';
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      input.value.trim() ? runSearch(input.value.trim()) : clearSearch();
    }, 260);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    clearSearch();
    input.focus();
  });
}

function runSearch(q) {
  const parsed  = parseQuery(q);
  const results = search(parsed);
  const { errors } = parsed;

  const board   = $('pipeline-board');
  const view    = $('results-view');
  const fbEl    = $('search-feedback');

  // Feedback
  if (errors.length) {
    fbEl.className   = 'search-feedback error';
    fbEl.innerHTML   = errorIcon() + ' ' + esc(errors.join(' '));
    fbEl.style.display = 'flex';
  } else if (!results.length) {
    fbEl.className   = 'search-feedback error';
    fbEl.innerHTML   = errorIcon() + ` No candidates match that search. Check stage names (${ALL_STAGES.join(', ')}) or try a simpler query.`;
    fbEl.style.display = 'flex';
  } else {
    fbEl.style.display = 'none';
  }

  // Label
  const label = intentLabel(parsed) || `Results for "${q}"`;
  $('results-label').textContent = label;
  $('results-badge').textContent = `${results.length} candidate${results.length!==1?'s':''}`;

  // Grid
  const grid = $('results-grid');
  grid.innerHTML = '';
  results.forEach(({ c, score }, idx) => {
    const sl   = slug(c.stage);
    const days = daysInStage(c);
    const card = document.createElement('div');
    card.className = 'r-card fade-up';
    card.style.animationDelay = `${idx * 0.03}s`;
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');

    const displayName = parsed.nameQ ? hlMatch(c.name, parsed.nameQ) : esc(c.name);

    card.innerHTML = `
      <div class="r-card-top">
        <div class="r-avatar" style="background:${c.color}">${initials(c.name)}</div>
        <div>
          <div class="r-name">${displayName}</div>
          <div class="r-role">${esc(c.role)}</div>
        </div>
      </div>
      <div class="r-card-foot">
        <span class="r-stage chip-${sl}">${esc(c.stage)}</span>
        <span class="r-days">${days}d in stage</span>
      </div>
      ${parsed.nameQ ? `<div class="r-score"><div class="r-score-fill" style="width:${Math.round(score*100)}%"></div></div>` : ''}
    `;
    card.addEventListener('click',   () => openDetail(c.id));
    card.addEventListener('keydown', e => (e.key==='Enter'||e.key===' ') && openDetail(c.id));
    grid.appendChild(card);
  });

  board.style.display = 'none';
  view.style.display  = 'block';
}

function clearSearch() {
  $('pipeline-board').style.display  = 'flex';
  $('results-view').style.display    = 'none';
  $('search-feedback').style.display = 'none';
}

function errorIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:1px">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
    <path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function hlMatch(text, q) {
  const tl = text.toLowerCase(), ql = q.toLowerCase();
  const i  = tl.indexOf(ql);
  if (i !== -1) {
    return esc(text.slice(0,i)) + `<mark>${esc(text.slice(i, i+q.length))}</mark>` + esc(text.slice(i+q.length));
  }
  let r = esc(text);
  q.split(/\s+/).filter(w => w.length > 2).forEach(w => {
    r = r.replace(new RegExp(`(${w})`, 'gi'), '<mark>$1</mark>');
  });
  return r;
}

/* ─── Modal helpers ──────────────────────────────────────── */
function openModal(id) {
  const el = $(id);
  el.style.display = 'flex';
  el.addEventListener('click', e => { if (e.target === el) closeModal(id); }, { once:true });
  setTimeout(() => {
    el.querySelector('input,textarea,[role=button]')?.focus();
  }, 40);
}

function closeModal(id) { $(id).style.display = 'none'; }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['add-modal','detail-modal','reject-modal'].forEach(closeModal);
});

/* ─── Toast ──────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = {
    success: `<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    info:    `<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"/></svg>`,
    error:   `<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  };
  const wrap = $('toast-wrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-icon">${icons[type]||''}</div>${esc(msg)}`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(12px)';
    setTimeout(() => t.remove(), 260);
  }, 3000);
}

/* ─── Init ───────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function setupDetailClose() {
  $('close-detail-modal').addEventListener('click', () => closeModal('detail-modal'));
}

function init() {
  load();
  renderBoard();
  setupAddModal();
  setupRejectModal();
  setupDetailClose();
  setupSearch();
}

document.addEventListener('DOMContentLoaded', init);

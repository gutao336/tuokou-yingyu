/* 脱口英语 v0.6 — 生词本 + 每日复习 + 跟读，数据只存在本机 localStorage */
'use strict';

var LS_WORDS = 'huaci-ji-words-v1';
var LS_TODAY = 'huaci-ji-today-v1';
var LS_AI_SETTINGS = 'huaci-ji-ai-settings-v1';
var LS_SOUND = 'huaci-ji-sound-v1';
var LS_FIRST_SAVE = 'huaci-ji-first-save-v1';
var REVIEW_SIZE = 10;

function loadAiSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(LS_AI_SETTINGS) || '{}');
    return {
      endpoint: typeof s.endpoint === 'string' ? s.endpoint : '',
      key: typeof s.key === 'string' ? s.key : ''
    };
  } catch (e) { return { endpoint: '', key: '' }; }
}

function saveAiSettings(endpoint, key) {
  try { localStorage.setItem(LS_AI_SETTINGS, JSON.stringify({ endpoint: endpoint, key: key })); } catch (e) {}
}

/* ---------- 数据 ---------- */
function loadWords() {
  try {
    var raw = localStorage.getItem(LS_WORDS);
    if (!raw) return null;
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    return null;
  }
}

function saveWords(words) {
  try { localStorage.setItem(LS_WORDS, JSON.stringify(words)); } catch (e) {}
}

/* ---------- v0.6：零门槛开局（词包）—— 条件放宽 ---------- */
/* v0.5 的问题：自动加词只在生词本完全是空的时候才触发（words.length === 0），
   但 Haze 之前测试时已经手动加过词，生词本不是空的，10 个日常词永远不会自动出现。
   这是设计问题，不是他操作错了：手动加过词的老用户反而被挡在门外。
   v0.6 改法：只要还没加过日常包就加，不管生词本里已经有几个词
   （starterSeedPending = !starterSeeded()，words.length 的条件删掉）。
   去重逻辑不动（按词去重，已有的不重复加），加成功才弹提示，加了 0 个不弹；
   标记还是只做一次，之前已经加过的不会再塞一遍。词包卡片保持原样。
   词包数据在 starter-words.json 里，用 fetch 取；取不到就用下面内嵌的
   “日常开口”10 个词当兜底（内容和 starter-words.json 里那包一样），
   保证打开一定有词可学。 */
/* ---------- v0.7：标记 key 换代（v1 → v2） ---------- */
/* 原因：Haze 的 iPhone 上一直跑的是 v0.4 旧代码（旧 service worker 缓存赖着不走），
   设置和生词本的问题在 v0.5/v0.6 里其实早修好了，但他手机上一次都没见到。
   v0.7 除了让外壳文件走网络优先（见 sw.js），还把自动加词的标记 key 从 v1 换成 v2：
   有些手机在 v0.5 时就把 v1 标记记下了，却没真正加上日常包，换 key 后这些手机
   能重新自动加一次。去重逻辑不动（按单词去重），重加不会重复；其他 localStorage
   key 名一律不动。 */
/* ---------- v0.8：受众定案 ---------- */
/* 受众是刚学英语、想开口的人，不是托福雅思考生。理由：产品叫脱口英语，卖点是敢开口；
   托福雅思是考试市场，大厂已经占了；actually/anyway/of course 这类简单的日常口语词，
   才是开口时真正用得上的。词包保持简单日常口语词，不加难词；托福雅思词包以后用户
   要了再说。口语训练是产品主线：首页主标语、生词卡片第一个按钮是“听一遍”
   （只听不录）、第二个按钮“跟读”才是练口语（跳到跟读 tab 录自己的声音）、复习先
   大声读出来再看中文，都往“先开口”上靠。v0.8.1：第一个按钮原来也叫“跟读”，
   和第二个按钮同名分不清，改成“听一遍”，点的还是朗读逻辑，没动功能。
   v0.9：卡片一行只留听一遍和跟读两个大按钮，例句改成小字链接，
   删除改成右上角小 ×（点一下就删，不再弹窗确认）。 */
var LS_STARTER_SEEDED = 'huaci-ji-starter-seeded-v2';
var STARTER_URL = 'starter-words.json';

/* 内嵌兜底：日常开口 10 个词（和 starter-words.json 里 daily 那包内容一致） */
var FALLBACK_DAILY_PACK = {
  id: 'daily',
  title: '日常开口',
  words: [
    { word: 'actually', zh: '实际上；其实', ex: "Actually, I don't like coffee.", exZh: '其实，我不喜欢咖啡。' },
    { word: 'anyway', zh: '不管怎样；反正', ex: "Anyway, let's start.", exZh: '反正，我们开始吧。' },
    { word: 'basically', zh: '基本上', ex: 'Basically, we just need more time.', exZh: '基本上，我们只是需要更多时间。' },
    { word: 'exactly', zh: '正是；完全正确', ex: "Exactly! That's what I mean.", exZh: '没错！我就是这个意思。' },
    { word: 'probably', zh: '可能；大概', ex: "I'll probably be late.", exZh: '我可能要迟到了。' },
    { word: 'definitely', zh: '肯定；一定', ex: "I'll definitely be there.", exZh: '我肯定会去。' },
    { word: 'honestly', zh: '老实说', ex: "Honestly, I don't know.", exZh: '老实说，我不知道。' },
    { word: 'seriously', zh: '说真的', ex: 'Seriously, you have to try it.', exZh: '说真的，你一定要试试。' },
    { word: 'maybe', zh: '也许', ex: 'Maybe we can go tomorrow.', exZh: '也许我们明天可以去。' },
    { word: 'of course', zh: '当然', ex: 'Of course, you can come with us.', exZh: '当然，你可以跟我们一起来。' }
  ]
};

var starterPacks = null;       /* 取到的词包数据（数组），取不到就是 null */
var starterLoadFailed = false;  /* 取词包失败过（网络问题），卡片区会显示提示 */
var starterSeedPending = false; /* 还没加过日常包，等着自动加（不管生词本里已经有几个词） */

function starterSeeded() {
  try { return localStorage.getItem(LS_STARTER_SEEDED) === 'yes'; } catch (e) { return false; }
}
function markStarterSeeded() {
  try { localStorage.setItem(LS_STARTER_SEEDED, 'yes'); } catch (e) {}
}

function packWordToEntry(item, packTitle) {
  var entry = {
    id: uid(),
    word: String(item.word).trim(),
    translation: typeof item.zh === 'string' ? item.zh : '',
    source: '词包·' + packTitle,
    known: 0, unknown: 0, addedAt: Date.now(), lastReviewedAt: null
  };
  if (item.ex) {
    entry.examples = [{ en: item.ex, zh: typeof item.exZh === 'string' ? item.exZh : '', source: 'api' }];
    entry.examplesFetched = true;
  }
  return entry;
}

/* 整包加入：按单词去重，已有的不重复加。返回 { added, skipped } */
function addPackWords(pack) {
  var added = 0, skipped = 0;
  (pack.words || []).forEach(function (item) {
    if (!item || typeof item.word !== 'string' || !item.word.trim()) { skipped++; return; }
    var exists = words.some(function (w) { return w.word.toLowerCase() === String(item.word).trim().toLowerCase(); });
    if (exists) { skipped++; return; }
    words.unshift(packWordToEntry(item, pack.title));
    added++;
  });
  saveWords(words);
  renderWordbook();
  renderPracticeSelect();
  renderPackCards();
  return { added: added, skipped: skipped };
}

function seedDailyPack(packs) {
  if (starterSeeded()) return;
  var daily = null;
  (packs || []).forEach(function (p) { if (p.id === 'daily') daily = p; });
  if (!daily) daily = FALLBACK_DAILY_PACK;
  var res = addPackWords(daily);
  markStarterSeeded();
  if (res.added > 0) toast('已给你准备好 10 个日常词，直接点“复习”开始吧');
}

function fetchStarterPacks() {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch(STARTER_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('starter ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!data || !Array.isArray(data.packs) || !data.packs.length) return null;
      return data.packs.filter(function (p) { return p && p.id && p.title && Array.isArray(p.words); });
    })
    .catch(function () { return null; });
}

function renderPackCards() {
  var list = document.getElementById('pack-list');
  var status = document.getElementById('pack-status');
  if (!list) return;
  list.innerHTML = '';
  status.hidden = true;
  if (starterPacks === null && !starterLoadFailed) {
    status.hidden = false;
    status.textContent = '词包正在准备……';
    return;
  }
  if (starterLoadFailed) {
    status.hidden = false;
    status.textContent = '词包暂时取不到（网络问题），“日常开口”那包已经给你备好了；其他词包检查网络后刷新页面再试。';
    return;
  }
  starterPacks.forEach(function (pack) {
    var card = document.createElement('button');
    card.className = 'pack-card';
    card.type = 'button';
    card.dataset.packId = pack.id;
    var total = (pack.words || []).length;
    var have = (pack.words || []).filter(function (item) {
      return words.some(function (w) { return w.word.toLowerCase() === String(item.word).trim().toLowerCase(); });
    }).length;
    var done = total > 0 && have >= total;
    card.disabled = done;
    card.innerHTML =
      '<span class="pack-card-title">' + esc(pack.title) + '</span>' +
      '<span class="pack-card-desc">' + total + ' 个词 · 带中文翻译和例句</span>' +
      '<span class="pack-card-meta">' + (done ? '已加入 ✓' : '点一下，整包加入') + '</span>';
    if (!done) {
      card.addEventListener('click', function () {
        var res = addPackWords(pack);
        if (res.added > 0) toast('「' + pack.title + '」已加入 ' + res.added + ' 个新词' + (res.skipped ? '（' + res.skipped + ' 个已在生词本里）' : ''));
        else toast('「' + pack.title + '」的词已经都在生词本里了');
      });
    }
    list.appendChild(card);
  });
}

var words = loadWords();
if (!words) words = [];
/* v0.6：只要还没加过日常包就自动加，不看生词本是不是空的 */
starterSeedPending = !starterSeeded();

function uid() {
  return 'w-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function getTodayCount() {
  try {
    var t = JSON.parse(localStorage.getItem(LS_TODAY) || '{}');
    return t.date === todayKey() ? (t.count || 0) : 0;
  } catch (e) { return 0; }
}

function bumpTodayCount() {
  var t = { date: todayKey(), count: getTodayCount() + 1 };
  try { localStorage.setItem(LS_TODAY, JSON.stringify(t)); } catch (e) {}
  renderTodayCount();
}

function renderTodayCount() {
  document.getElementById('today-count').textContent = String(getTodayCount());
}

/* ---------- 小工具 ---------- */
var toastTimer = null;
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- v0.4：朗读声音（自己挑 + 一次读完） ---------- */
/* 之前的问题：一是默认女声本身难听，二是几段朗读叠在队列里、听着断断续续。
   改法：① 设置里可以挑本机英文语音，选好就记住；默认挑评分最高的
   （Enhanced / Natural / Google US English / Samantha / Alex 优先）；
   ② 每句话只建一个 utterance，一次读完，不拆段；读之前先取消排队里没读完的旧内容，
   再等 80 毫秒才读（iOS 上 cancel 后立刻 speak 有时会被吞掉）。
   ③ 微软 Edge 的免费在线神经网络声音实测过，从网页里调不通（见 README v0.4），没硬上。 */
var LS_VOICE = 'huaci-ji-voice-v1';
var VOICE_TEST_TEXT = 'Hello, nice to meet you. Let us practice English together.';
var speakTimer = null;

function scoreVoice(v) {
  var name = (v.name || '').toLowerCase();
  var score = 0;
  if (name.indexOf('enhanced') >= 0) score += 3;
  if (name.indexOf('natural') >= 0) score += 3;
  if (name.indexOf('google us english') >= 0) score += 3;
  if (name.indexOf('samantha') >= 0) score += 2;
  if (name.indexOf('alex') >= 0) score += 2;
  if ((v.lang || '').toLowerCase() === 'en-us') score += 1;
  if (name.indexOf('google') >= 0) score += 1;
  return score;
}

function listEnglishVoices() {
  if (!('speechSynthesis' in window)) return [];
  var all = [];
  try { all = window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  var seen = {};
  var out = [];
  all.forEach(function (v) {
    if (!v.lang || v.lang.toLowerCase().indexOf('en') !== 0) return;
    var key = (v.voiceURI || '') + '|' + (v.name || '');
    if (seen[key]) return;
    seen[key] = true;
    out.push(v);
  });
  out.sort(function (a, b) { return scoreVoice(b) - scoreVoice(a); });
  return out;
}

function loadSavedVoiceURI() {
  try { return localStorage.getItem(LS_VOICE) || ''; } catch (e) { return ''; }
}

function saveVoiceURI(uri) {
  try { localStorage.setItem(LS_VOICE, uri); } catch (e) {}
}

function getChosenVoice() {
  var voices = listEnglishVoices();
  if (!voices.length) return null;
  var saved = loadSavedVoiceURI();
  if (saved) {
    var found = voices.find(function (v) { return v.voiceURI === saved; });
    if (found) return found;
  }
  return voices[0];
}

function stopSpeaking() {
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
}

function speak(text, voiceURI) {
  if (!text) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    toast('这台设备不支持语音朗读');
    return;
  }
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.95;
  u.pitch = 1.0;
  var v = null;
  if (voiceURI) {
    v = listEnglishVoices().find(function (x) { return x.voiceURI === voiceURI; });
  }
  if (!v) v = getChosenVoice();
  if (v) u.voice = v;
  speakTimer = setTimeout(function () {
    speakTimer = null;
    window.speechSynthesis.speak(u);
  }, 80);
}

function refreshVoiceSelect() {
  var sel = document.getElementById('voice-select');
  if (!sel) return;
  var voices = listEnglishVoices();
  var saved = loadSavedVoiceURI();
  sel.innerHTML = '';
  if (!voices.length) {
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '点一下重新加载声音';
    sel.appendChild(opt0);
    return;
  }
  voices.forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = v.name + '（' + v.lang + '）';
    sel.appendChild(opt);
  });
  var chosen = getChosenVoice();
  sel.value = chosen ? chosen.voiceURI : voices[0].voiceURI;
  if (saved && sel.value !== saved) {
    /* 保存的声音这台手机上没有了（比如换了手机），就改存默认的 */
    saveVoiceURI(sel.value);
  }
}

/* ---------- v0.4：每次点按都看得见（涟漪 + 重按下） ---------- */
/* v0.3 的 :active 在 iPhone Safari 上基本看不出来（iOS 对 :active 支持很弱，0.08 秒、0.97 缩放太轻）。
   所以点按反馈改由 JS 做：pointerdown 时在触点处扩开一个涟漪圆圈（约 0.35 秒），
   同时给元素加 .pressing（缩放 0.94 + 明显变深）；:active 只留着当兜底。
   烟花还是只留给完成时刻，不会每点一下都放。 */
var pressingEl = null;
function rippleTargetFromEvent(e) {
  var t = e.target;
  if (!t || !t.closest) return null;
  return t.closest('button, .review-card, .scenario-card, label.file-btn');
}
function spawnRipple(el, x, y) {
  var rect = el.getBoundingClientRect();
  var d = Math.max(rect.width, rect.height) * 2.2;
  if (!d || d < 40) d = 120;
  if (d > 340) d = 340;
  var s = document.createElement('span');
  s.className = 'ripple' + (el.classList.contains('btn-primary') || el.classList.contains('btn-record') ? ' ripple-light' : '');
  s.style.width = d + 'px';
  s.style.height = d + 'px';
  s.style.left = (x - rect.left - d / 2) + 'px';
  s.style.top = (y - rect.top - d / 2) + 'px';
  el.appendChild(s);
  s.addEventListener('animationend', function () { s.remove(); });
  setTimeout(function () { if (s.parentNode) s.remove(); }, 600);
}
document.addEventListener('pointerdown', function (e) {
  var el = rippleTargetFromEvent(e);
  if (!el) return;
  pressingEl = el;
  el.classList.add('pressing');
  spawnRipple(el, e.clientX, e.clientY);
}, true);
['pointerup', 'pointercancel'].forEach(function (evt) {
  document.addEventListener(evt, function () {
    if (pressingEl) { pressingEl.classList.remove('pressing'); pressingEl = null; }
  }, true);
});

/* ---------- v0.3：成就感反馈（烟花 + 鼓励语 + 叮 + 震动） ---------- */
var CHEERS = ['又拿下一个！', '这句你会说了！', '今天也在进步！', '开口就是赢！', '越说越顺！', '这个词是你的了！', '练完这一组，厉害！', '继续，下一句更顺！'];
var lastCheer = -1;

function soundEnabled() {
  try { return localStorage.getItem(LS_SOUND) !== 'off'; } catch (e) { return true; }
}
function setSoundEnabled(on) {
  try { localStorage.setItem(LS_SOUND, on ? 'on' : 'off'); } catch (e) {}
}

/* 成功音：WebAudio 现场合成一声“叮”，不用音频文件 */
var audioCtx = null;
function playDing() {
  if (!soundEnabled()) return;
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t = audioCtx.currentTime;
    [[880, 0.18], [1318.5, 0.08]].forEach(function (pair) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pair[0], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(pair[1], t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch (e) {}
}

/* 短震：先判断支不支持再调。iPhone 的 Safari 没有 vibrate 接口，会直接跳过 */
function buzz(pattern) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch (e) {}
}

/* 烟花：手写 canvas 彩带粒子，不引外部库，离线也能用 */
var confettiCanvas = null, confettiCtx = null, confettiParts = [], confettiRaf = null, confettiEndAt = 0;
var CONFETTI_COLORS = ['#C9A227', '#111827', '#1A7F37', '#B3261E', '#E8A33D'];

function confettiSetup() {
  if (!confettiCanvas) {
    confettiCanvas = document.getElementById('celebrate-canvas');
    if (!confettiCanvas) return false;
    confettiCtx = confettiCanvas.getContext('2d');
  }
  var dpr = window.devicePixelRatio || 1;
  confettiCanvas.width = Math.floor(window.innerWidth * dpr);
  confettiCanvas.height = Math.floor(window.innerHeight * dpr);
  confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

function confettiBurst() {
  if (!confettiSetup()) return;
  var w = window.innerWidth, h = window.innerHeight;
  var i, angle, speed;
  for (i = 0; i < 90; i++) {
    angle = Math.random() * Math.PI * 2;
    speed = 3 + Math.random() * 8;
    confettiParts.push({
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 7,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    });
  }
  confettiEndAt = Date.now() + 1800;
  if (!confettiRaf) confettiTick();
}

function confettiTick() {
  var now = Date.now();
  var w = window.innerWidth, h = window.innerHeight;
  confettiCtx.clearRect(0, 0, w, h);
  confettiParts = confettiParts.filter(function (p) { return p.life > 0 && p.y < h + 20; });
  confettiParts.forEach(function (p) {
    p.vy += 0.18;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    confettiCtx.save();
    confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    confettiCtx.restore();
  });
  if (now < confettiEndAt || confettiParts.length) {
    confettiRaf = requestAnimationFrame(confettiTick);
  } else {
    confettiCtx.clearRect(0, 0, w, h);
    confettiRaf = null;
  }
}

function showCheer() {
  var el = document.getElementById('cheer-text');
  if (!el) return;
  var idx;
  do { idx = Math.floor(Math.random() * CHEERS.length); } while (CHEERS.length > 1 && idx === lastCheer);
  lastCheer = idx;
  el.textContent = CHEERS[idx];
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* 庆祝入口：只在真正值得庆祝的时刻调——完成一组复习、完成一个情景对话、当天第一次存词 */
function celebrate() {
  confettiBurst();
  showCheer();
  playDing();
  buzz(60);
}

/* 当天第一次存词才返回 true（一天只庆祝一次存词） */
function isFirstSaveToday() {
  try {
    var v = localStorage.getItem(LS_FIRST_SAVE);
    if (v === todayKey()) return false;
    localStorage.setItem(LS_FIRST_SAVE, todayKey());
    return true;
  } catch (e) { return false; }
}

/* ---------- Tab 切换 ---------- */
function switchTab(name) {
  document.querySelectorAll('.tab-page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'practice') renderPracticeSelect();
  if (name === 'wordbook') renderWordbook();
  if (name === 'dialog') renderDialogPicker();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
});

/* ---------- 生词本 ---------- */
function renderWordbook() {
  var list = document.getElementById('word-list');
  var countEl = document.getElementById('word-count');
  var emptyEl = document.getElementById('wordbook-empty');
  countEl.textContent = '共 ' + words.length + ' 个词';
  emptyEl.hidden = words.length > 0;
  list.innerHTML = '';
  var sorted = words.slice().sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
  sorted.forEach(function (w) {
    var li = document.createElement('li');
    li.className = 'word-item';
    /* v0.9：一行只留两个大按钮（听一遍 + 跟读），等宽等高不换行。
       例句不再是按钮，改成词下面一行小字链接；删除不再是按钮，
       改成卡片右上角一个小 ×，点一下就删，不再弹窗确认。 */
    li.innerHTML =
      '<div class="word-line"><span class="w">' + esc(w.word) + '</span><span class="t">' + esc(w.translation) + '</span></div>' +
      '<div class="meta">来源：' + esc(w.source || '手动添加') + ' · 认识 ' + (w.known || 0) + ' 次 · 不认识 ' + (w.unknown || 0) + ' 次</div>' +
      '<div class="row-actions">' +
      '<button class="btn btn-outline" data-act="speak">🔊 听一遍</button>' +
      '<button class="btn btn-outline" data-act="practice">🎙️ 跟读</button>' +
      '</div>' +
      '<button class="example-link" data-act="examples">例句</button>' +
      '<button class="word-del" data-act="del" aria-label="删除这个词">×</button>' +
      '<div class="examples" hidden></div>';
    li.querySelector('[data-act="speak"]').addEventListener('click', function () { speak(w.word); });
    li.querySelector('[data-act="practice"]').addEventListener('click', function () {
      switchTab('practice');
      var sel = document.getElementById('practice-select');
      sel.value = w.id;
      renderPracticeWord();
    });
    li.querySelector('[data-act="examples"]').addEventListener('click', function () {
      toggleExamples(li, w);
    });
    li.querySelector('[data-act="del"]').addEventListener('click', function () {
      if (openExampleWordId === w.id) openExampleWordId = null;
      words = words.filter(function (x) { return x.id !== w.id; });
      saveWords(words);
      renderWordbook();
      renderPracticeSelect();
      toast('已删除');
    });
    if (openExampleWordId === w.id) {
      li.querySelector('[data-act="examples"]').textContent = '收起例句';
      var exBox = li.querySelector('.examples');
      exBox.hidden = false;
      loadExamplesForWord(w, exBox);
    }
    list.appendChild(li);
  });
}

document.getElementById('add-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var wordInput = document.getElementById('add-word');
  var transInput = document.getElementById('add-translation');
  var sourceInput = document.getElementById('add-source');
  var word = wordInput.value.trim();
  var translation = transInput.value.trim();
  var source = sourceInput.value.trim();
  if (!word || !translation) { toast('单词和中文意思都要填'); return; }
  var exists = words.some(function (w) { return w.word.toLowerCase() === word.toLowerCase(); });
  if (exists) { toast('这个词已经在生词本里了'); return; }
  words.unshift({ id: uid(), word: word, translation: translation, source: source, known: 0, unknown: 0, addedAt: Date.now(), lastReviewedAt: null });
  saveWords(words);
  wordInput.value = '';
  transInput.value = '';
  sourceInput.value = '';
  renderWordbook();
  if (isFirstSaveToday()) celebrate();
  toast('已存进生词本');
});

/* ---------- 词入句：例句 ---------- */
var openExampleWordId = null;

/* 免费词典 API：免 key。返回的例句只有英文，中文翻译另外用 MyMemory 取 */
function fetchDictExamples(word) {
  return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word))
    .then(function (res) {
      if (!res.ok) throw new Error('dict ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var out = [];
      var seen = {};
      (Array.isArray(data) ? data : []).forEach(function (entry) {
        (entry.meanings || []).forEach(function (m) {
          (m.definitions || []).forEach(function (d) {
            if (d.example && !seen[d.example]) {
              seen[d.example] = true;
              out.push(d.example);
            }
          });
        });
      });
      return out.slice(0, 3);
    });
}

/* MyMemory 免费翻译（免 key）。额度用完会返回 429 或警告文本，那时返回 null，不存警告 */
function translateExample(text) {
  var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|zh-CN';
  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || data.responseStatus !== 200) return null;
      var t = data.responseData && data.responseData.translatedText;
      if (!t || /^MYMEMORY WARNING/i.test(t)) return null;
      return t;
    })
    .catch(function () { return null; });
}

function loadExamplesForWord(w, box) {
  if (w.examplesFetched) { renderExamplesBox(box, w); return; }
  box.innerHTML = '<p class="hint">正在找例句……</p>';
  fetchDictExamples(w.word).then(function (found) {
    w.examplesFetched = true;
    if (!found.length) {
      w.examples = [];
      saveWords(words);
      renderExamplesBox(box, w);
      return;
    }
    var jobs = found.map(function (en) {
      return translateExample(en).then(function (zh) {
        return { en: en, zh: zh || '', source: 'api' };
      });
    });
    return Promise.all(jobs).then(function (list) {
      w.examples = list;
      saveWords(words);
      renderExamplesBox(box, w);
    });
  }).catch(function () {
    box.innerHTML = '<p class="hint">例句没取到，可能是网络问题。</p>';
    var retry = document.createElement('button');
    retry.className = 'btn btn-outline btn-mini';
    retry.textContent = '再试一次';
    retry.addEventListener('click', function () { loadExamplesForWord(w, box); });
    box.appendChild(retry);
  });
}

function renderExamplesBox(box, w) {
  box.innerHTML = '';
  var list = Array.isArray(w.examples) ? w.examples : [];
  if (!list.length) {
    var p = document.createElement('p');
    p.className = 'examples-empty';
    p.textContent = '这个词暂无例句，你自己造一句吧';
    box.appendChild(p);
  }
  list.forEach(function (ex, idx) {
    box.appendChild(buildExampleRow(w, ex, idx, box));
  });
  box.appendChild(buildOwnForm(w, box));
}

function buildExampleRow(w, ex, idx, box) {
  var row = document.createElement('div');
  row.className = 'example-item';
  var enEl = document.createElement('div');
  enEl.className = 'example-en';
  enEl.textContent = ex.en;
  var zhEl = document.createElement('div');
  zhEl.className = 'example-zh';
  zhEl.textContent = ex.zh || '中文翻译暂时没取到（免费额度可能用完了），先读英文。';
  var actions = document.createElement('div');
  actions.className = 'row-actions';
  var speakBtn = document.createElement('button');
  speakBtn.className = 'btn btn-outline btn-mini';
  speakBtn.textContent = '🔊 朗读';
  speakBtn.addEventListener('click', function () { speak(ex.en); });
  var recBtn = document.createElement('button');
  recBtn.className = 'btn btn-outline btn-mini';
  recBtn.textContent = '● 录音';
  actions.appendChild(speakBtn);
  actions.appendChild(recBtn);
  if (ex.source === 'own') {
    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-outline btn-mini';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', function () {
      w.examples = w.examples.filter(function (x, i) { return i !== idx; });
      saveWords(words);
      renderExamplesBox(box, w);
    });
    actions.appendChild(delBtn);
  }
  var player = document.createElement('audio');
  player.className = 'example-player';
  player.controls = true;
  player.hidden = true;
  recBtn.addEventListener('click', function () { recordOnce(recBtn, player); });
  row.appendChild(enEl);
  row.appendChild(zhEl);
  row.appendChild(actions);
  row.appendChild(player);
  return row;
}

function buildOwnForm(w, box) {
  var form = document.createElement('div');
  form.className = 'own-form';
  var title = document.createElement('div');
  title.className = 'own-form-title';
  title.textContent = '自己造一句';
  var enInput = document.createElement('input');
  enInput.type = 'text';
  enInput.placeholder = '用这个词造一句英文，例如 I love the serendipity of travel.';
  enInput.setAttribute('aria-label', '自己造的英文例句');
  var zhInput = document.createElement('input');
  zhInput.type = 'text';
  zhInput.placeholder = '中文翻译（可选）';
  zhInput.setAttribute('aria-label', '例句的中文翻译');
  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = '存下这句';
  saveBtn.addEventListener('click', function () {
    var en = enInput.value.trim();
    var zh = zhInput.value.trim();
    if (!en) { toast('先写一句英文'); return; }
    if (!Array.isArray(w.examples)) w.examples = [];
    w.examples.push({ en: en, zh: zh, source: 'own' });
    w.examplesFetched = true;
    saveWords(words);
    renderExamplesBox(box, w);
    toast('这句存进例句了');
  });
  form.appendChild(title);
  form.appendChild(enInput);
  form.appendChild(zhInput);
  form.appendChild(saveBtn);
  return form;
}

function toggleExamples(li, w) {
  var box = li.querySelector('.examples');
  var btn = li.querySelector('[data-act="examples"]');
  if (box.hidden) {
    openExampleWordId = w.id;
    box.hidden = false;
    btn.textContent = '收起例句';
    loadExamplesForWord(w, box);
  } else {
    openExampleWordId = null;
    box.hidden = true;
    btn.textContent = '例句';
  }
}

/* 通用录音：给例句和对话用。每次新建一个 MediaRecorder，只录给当前这一行/这一句 */
function recordOnce(btn, player) {
  if (btn._recorder && btn._recorder.state === 'recording') { btn._recorder.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('这台设备或这个网址不支持录音（录音要 https 或本机打开）');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    var chunks = [];
    var rec;
    try {
      rec = new MediaRecorder(stream);
    } catch (err) {
      toast('这台设备不支持录音');
      stream.getTracks().forEach(function (t) { t.stop(); });
      return;
    }
    btn._recorder = rec;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      btn.textContent = '● 录音';
      btn.classList.remove('recording');
      btn._recorder = null;
      if (chunks.length) {
        var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        player.src = URL.createObjectURL(blob);
        player.hidden = false;
      }
    };
    rec.start();
    btn.textContent = '■ 停止';
    btn.classList.add('recording');
  }).catch(function () {
    toast('录音被拒绝了，在浏览器设置里允许麦克风再试');
  });
}

/* ---------- 导入 / 导出 ---------- */
document.getElementById('export-btn').addEventListener('click', function () {
  if (words.length === 0) { toast('生词本是空的，没什么可导出'); return; }
  var blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tuokou-yingyu-words.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('已导出 ' + words.length + ' 个词');
});

document.getElementById('import-file').addEventListener('change', function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('not array');
      var added = 0, skipped = 0;
      data.forEach(function (item) {
        if (!item || typeof item.word !== 'string' || !item.word.trim()) { skipped++; return; }
        if (words.some(function (w) { return w.word.toLowerCase() === String(item.word).trim().toLowerCase(); })) { skipped++; return; }
        words.push({
          id: item.id && typeof item.id === 'string' ? item.id : uid(),
          word: String(item.word).trim(),
          translation: typeof item.translation === 'string' ? item.translation : '',
          source: typeof item.source === 'string' ? item.source : '导入',
          known: typeof item.known === 'number' ? item.known : 0,
          unknown: typeof item.unknown === 'number' ? item.unknown : 0,
          addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now(),
          lastReviewedAt: typeof item.lastReviewedAt === 'number' ? item.lastReviewedAt : null,
          examples: Array.isArray(item.examples) ? item.examples : undefined,
          examplesFetched: item.examplesFetched === true
        });
        added++;
      });
      saveWords(words);
      renderWordbook();
      renderPracticeSelect();
      toast('导入完成：新增 ' + added + ' 个，跳过 ' + skipped + ' 个');
    } catch (err) {
      toast('这个文件读不懂，请用脱口英语导出的 JSON');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ---------- 每日复习 ---------- */
var reviewQueue = [];
var reviewIndex = 0;
var reviewKnown = 0;
var reviewUnknown = 0;

function pickReviewQueue() {
  var sorted = words.slice().sort(function (a, b) {
    var scoreA = (a.known || 0) - (a.unknown || 0);
    var scoreB = (b.known || 0) - (b.unknown || 0);
    if (scoreA !== scoreB) return scoreA - scoreB;
    var tA = a.lastReviewedAt || 0, tB = b.lastReviewedAt || 0;
    return tA - tB;
  });
  var picked = sorted.slice(0, REVIEW_SIZE);
  for (var i = picked.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = picked[i]; picked[i] = picked[j]; picked[j] = tmp;
  }
  return picked;
}

function showReviewCard() {
  var w = reviewQueue[reviewIndex];
  document.getElementById('progress-bar').style.width = (reviewIndex / reviewQueue.length * 100) + '%';
  document.getElementById('progress-text').textContent = '第 ' + (reviewIndex + 1) + ' / ' + reviewQueue.length + ' 个';
  document.getElementById('review-word').textContent = w.word;
  document.getElementById('review-source').textContent = w.source ? '来源：' + w.source : '';
  var trans = document.getElementById('review-translation');
  trans.hidden = true;
  trans.textContent = w.translation;
  /* v0.8：复习先开口——卡片先显示“大声读出来”，点一下才显示中文释义。 */
  document.getElementById('review-tip').textContent = '👄 先大声读出来，再点卡片看中文';
  document.getElementById('review-card').dataset.flipped = '0';
}

function startReview() {
  if (words.length === 0) { toast('生词本是空的，先加几个词'); return; }
  reviewQueue = pickReviewQueue();
  reviewIndex = 0;
  reviewKnown = 0;
  reviewUnknown = 0;
  document.getElementById('review-start').hidden = true;
  document.getElementById('review-done').hidden = true;
  document.getElementById('review-play').hidden = false;
  showReviewCard();
}

function flipReviewCard() {
  var trans = document.getElementById('review-translation');
  trans.hidden = !trans.hidden;
  var tip = document.getElementById('review-tip');
  if (tip) tip.textContent = trans.hidden ? '👄 先大声读出来，再点卡片看中文' : '点卡片收起中文';
}

function markReview(known) {
  var w = reviewQueue[reviewIndex];
  if (!w) return;
  var target = words.find(function (x) { return x.id === w.id; });
  if (target) {
    if (known) { target.known = (target.known || 0) + 1; reviewKnown++; }
    else { target.unknown = (target.unknown || 0) + 1; reviewUnknown++; }
    target.lastReviewedAt = Date.now();
    saveWords(words);
  }
  bumpTodayCount();
  reviewIndex++;
  if (reviewIndex >= reviewQueue.length) {
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('review-play').hidden = true;
    document.getElementById('review-done').hidden = false;
    document.getElementById('review-summary').textContent =
      '这组 ' + reviewQueue.length + ' 个词：认识 ' + reviewKnown + ' 个，不认识 ' + reviewUnknown + ' 个。';
    renderWordbook();
    celebrate();
  } else {
    showReviewCard();
  }
}

document.getElementById('start-review-btn').addEventListener('click', startReview);
document.getElementById('review-again-btn').addEventListener('click', startReview);
document.getElementById('review-to-wordbook-btn').addEventListener('click', function () { switchTab('wordbook'); });
document.getElementById('review-card').addEventListener('click', flipReviewCard);
document.getElementById('review-card').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipReviewCard(); }
});
document.getElementById('mark-known-btn').addEventListener('click', function () { markReview(true); });
document.getElementById('mark-unknown-btn').addEventListener('click', function () { markReview(false); });
document.getElementById('speak-review-btn').addEventListener('click', function () {
  var w = reviewQueue[reviewIndex];
  if (w) speak(w.word);
});

/* ---------- 跟读 ---------- */
var mediaRecorder = null;
var recordChunks = [];
var recordStream = null;

function renderPracticeSelect() {
  var sel = document.getElementById('practice-select');
  var current = sel.value;
  sel.innerHTML = '';
  if (words.length === 0) {
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '生词本是空的，先加几个词';
    sel.appendChild(opt0);
    renderPracticeWord();
    return;
  }
  words.forEach(function (w) {
    var opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.word + ' — ' + w.translation;
    sel.appendChild(opt);
  });
  if (current && words.some(function (w) { return w.id === current; })) sel.value = current;
  renderPracticeWord();
}

function currentPracticeWord() {
  var id = document.getElementById('practice-select').value;
  return words.find(function (w) { return w.id === id; }) || null;
}

function renderPracticeWord() {
  var w = currentPracticeWord();
  document.getElementById('practice-word').textContent = w ? w.word : '—';
  document.getElementById('practice-translation').textContent = w ? w.translation : '—';
}

document.getElementById('practice-select').addEventListener('change', renderPracticeWord);

document.getElementById('practice-speak-btn').addEventListener('click', function () {
  var w = currentPracticeWord();
  if (w) speak(w.word);
  else toast('先加几个词');
});

document.getElementById('practice-record-btn').addEventListener('click', async function () {
  var btn = document.getElementById('practice-record-btn');
  var status = document.getElementById('practice-status');
  var player = document.getElementById('practice-player');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('这台设备或这个网址不支持录音（录音要 https 或本机打开）');
    return;
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    toast('录音被拒绝了，在浏览器设置里允许麦克风再试');
    return;
  }
  recordChunks = [];
  try {
    mediaRecorder = new MediaRecorder(recordStream);
  } catch (err) {
    toast('这台设备不支持录音');
    recordStream.getTracks().forEach(function (t) { t.stop(); });
    return;
  }
  mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) recordChunks.push(e.data); };
  mediaRecorder.onstop = function () {
    recordStream.getTracks().forEach(function (t) { t.stop(); });
    btn.textContent = '● 开始录音';
    btn.classList.remove('recording');
    status.textContent = '录好了，点下面的播放，听听自己的声音。';
    if (recordChunks.length) {
      var blob = new Blob(recordChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      player.src = URL.createObjectURL(blob);
      player.hidden = false;
    }
  };
  mediaRecorder.start();
  btn.textContent = '■ 停止录音';
  btn.classList.add('recording');
  status.textContent = '正在录音……读一遍这个词，读完点“停止录音”。';
});

/* ---------- 情景对话 ---------- */
var SCENARIOS = [
  {
    id: 'coffee',
    title: '☕ 咖啡店点单',
    desc: '在咖啡店点一杯喝的：问口味、大小、结账。',
    turns: [
      { who: 'app', en: 'Hi there! What can I get for you today?', zh: '你好！今天想喝点什么？' },
      { who: 'user', en: "Hi, I'd like a latte, please.", zh: '你好，我想要一杯拿铁。' },
      { who: 'app', en: 'Sure. Hot or iced?', zh: '好的，要热的还是冰的？' },
      { who: 'user', en: 'Hot, please. Medium size.', zh: '热的，中杯。' },
      { who: 'app', en: 'Anything else? We have fresh croissants today.', zh: '还需要别的吗？今天有新鲜的可颂。' },
      { who: 'user', en: "No, that's all. How much is it?", zh: '不用了，就这些。多少钱？' },
      { who: 'app', en: "That'll be five dollars. Cash or card?", zh: '一共五美元。现金还是刷卡？' },
      { who: 'user', en: 'Card, please. Thank you!', zh: '刷卡，谢谢！' }
    ]
  },
  {
    id: 'directions',
    title: '🗺️ 问路',
    desc: '在街上问去火车站的路：方向、远近、坐车。',
    turns: [
      { who: 'user', en: 'Excuse me, how do I get to the train station?', zh: '打扰一下，请问去火车站怎么走？' },
      { who: 'app', en: 'Go straight for two blocks, then turn left at the traffic light.', zh: '直走两个街区，在红绿灯处左转。' },
      { who: 'user', en: 'Is it far from here?', zh: '离这儿远吗？' },
      { who: 'app', en: 'Not far. About a ten-minute walk.', zh: '不远，大概步行十分钟。' },
      { who: 'user', en: 'Can I take a bus instead?', zh: '我能坐公交车去吗？' },
      { who: 'app', en: 'Yes, take bus number 12. It stops right in front of the station.', zh: '可以，坐 12 路公交车，它就停在火车站门口。' },
      { who: 'user', en: 'Great, thank you so much!', zh: '太好了，非常感谢！' },
      { who: 'app', en: "You're welcome. Have a nice day!", zh: '不客气，祝你今天愉快！' }
    ]
  },
  {
    id: 'intro',
    title: '👋 自我介绍',
    desc: '第一次见面介绍自己：名字、哪里人、做什么、喜欢什么。',
    turns: [
      { who: 'user', en: 'Hello, my name is Li Ming. Nice to meet you.', zh: '你好，我叫李明，很高兴认识你。' },
      { who: 'app', en: 'Nice to meet you too, Li Ming. Where are you from?', zh: '很高兴认识你，李明。你是哪里人？' },
      { who: 'user', en: "I'm from China. I work as a teacher.", zh: '我来自中国，我是一名老师。' },
      { who: 'app', en: "That's great. What do you teach?", zh: '太棒了，你教什么？' },
      { who: 'user', en: 'I teach English. And I love reading and movies.', zh: '我教英语。我喜欢读书和看电影。' },
      { who: 'app', en: 'Wonderful! What kind of movies do you like?', zh: '真不错！你喜欢什么样的电影？' },
      { who: 'user', en: 'I like comedies. They always make me laugh.', zh: '我喜欢喜剧片，它们总能让我笑。' },
      { who: 'app', en: "Me too! Let's talk more next time.", zh: '我也是！下次再多聊聊。' }
    ]
  }
];

var dialogScenario = null;
var dialogStep = 0;

function renderDialogPicker() {
  document.getElementById('dialog-picker').hidden = false;
  document.getElementById('dialog-play').hidden = true;
  document.getElementById('dialog-done').hidden = true;
  var list = document.getElementById('scenario-list');
  list.innerHTML = '';
  SCENARIOS.forEach(function (sc) {
    var card = document.createElement('button');
    card.className = 'scenario-card';
    card.innerHTML = '<span class="scenario-title">' + esc(sc.title) + '</span>' +
      '<span class="scenario-desc">' + esc(sc.desc) + '</span>' +
      '<span class="scenario-meta">' + sc.turns.length + ' 句话 · 跟着练</span>';
    card.addEventListener('click', function () { startDialog(sc.id); });
    list.appendChild(card);
  });
}

function startDialog(id) {
  dialogScenario = SCENARIOS.find(function (s) { return s.id === id; });
  if (!dialogScenario) return;
  dialogStep = 0;
  document.getElementById('dialog-picker').hidden = true;
  document.getElementById('dialog-done').hidden = true;
  document.getElementById('dialog-play').hidden = false;
  document.getElementById('dialog-title').textContent = dialogScenario.title;
  showDialogTurn();
}

function showDialogTurn() {
  var sc = dialogScenario;
  var turn = sc.turns[dialogStep];
  var player = document.getElementById('dialog-player');
  player.hidden = true;
  player.removeAttribute('src');
  document.getElementById('dialog-progress').textContent = '第 ' + (dialogStep + 1) + ' / ' + sc.turns.length + ' 句';
  document.getElementById('dialog-progress-bar').style.width = (dialogStep / sc.turns.length * 100) + '%';
  var turnEl = document.getElementById('dialog-turn');
  var actionsEl = document.getElementById('dialog-actions');
  turnEl.innerHTML = '';
  actionsEl.innerHTML = '';
  var whoLabel = document.createElement('div');
  whoLabel.className = 'turn-who';
  whoLabel.textContent = turn.who === 'app' ? '对方说' : '轮到你说';
  var enEl = document.createElement('div');
  enEl.className = 'turn-en';
  enEl.textContent = turn.en;
  var zhEl = document.createElement('div');
  zhEl.className = 'turn-zh';
  zhEl.textContent = turn.zh;
  turnEl.appendChild(whoLabel);
  turnEl.appendChild(enEl);
  turnEl.appendChild(zhEl);
  turnEl.className = 'dialog-turn ' + (turn.who === 'app' ? 'turn-app' : 'turn-user');

  var listenBtn = document.createElement('button');
  listenBtn.className = 'btn btn-outline btn-block';
  listenBtn.textContent = turn.who === 'app' ? '🔊 再听一遍' : '🔊 听建议回答';
  listenBtn.addEventListener('click', function () { speak(turn.en); });
  actionsEl.appendChild(listenBtn);

  if (turn.who === 'user') {
    var recBtn = document.createElement('button');
    recBtn.className = 'btn btn-record btn-big btn-block';
    recBtn.textContent = '● 录下你说的';
    recBtn.addEventListener('click', function () { recordOnce(recBtn, player); });
    actionsEl.appendChild(recBtn);
    var recHint = document.createElement('p');
    recHint.className = 'hint';
    recHint.textContent = '录音只给你自己听，不打分。也可以不录，直接点“下一句”。';
    actionsEl.appendChild(recHint);
  }

  var nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary btn-big btn-block';
  nextBtn.textContent = dialogStep + 1 >= sc.turns.length ? '完成' : '下一句';
  nextBtn.addEventListener('click', function () {
    stopSpeaking();
    dialogStep++;
    if (dialogStep >= sc.turns.length) {
      finishDialog();
    } else {
      showDialogTurn();
    }
  });
  actionsEl.appendChild(nextBtn);

  if (turn.who === 'app') speak(turn.en);
}

function finishDialog() {
  document.getElementById('dialog-play').hidden = true;
  document.getElementById('dialog-done').hidden = false;
  document.getElementById('dialog-summary').textContent =
    '「' + dialogScenario.title + '」练完了，一共 ' + dialogScenario.turns.length + ' 句话。';
  celebrate();
}

document.getElementById('dialog-change-btn').addEventListener('click', function () {
  stopSpeaking();
  renderDialogPicker();
});
document.getElementById('dialog-again-btn').addEventListener('click', function () {
  startDialog(dialogScenario.id);
});
document.getElementById('dialog-back-btn').addEventListener('click', function () {
  renderDialogPicker();
});

/* ---------- 设置 ---------- */
var settingsPanel = document.getElementById('settings-panel');
var settingsOverlay = document.getElementById('settings-overlay');

function openSettings() {
  settingsPanel.hidden = false;
  settingsOverlay.hidden = false;
  var s = loadAiSettings();
  document.getElementById('ai-endpoint').value = s.endpoint;
  document.getElementById('ai-key').value = s.key;
  document.getElementById('sound-toggle').checked = soundEnabled();
  refreshVoiceSelect();
  renderSettingsStatus();
}

function closeSettings() {
  if (settingsPanel.hidden) return;
  settingsPanel.hidden = true;
  settingsOverlay.hidden = true;
  settingsPanel.style.transform = '';
  settingsPanel.classList.remove('swiping');
}

/* v0.8：点遮罩任意处就关面板。遮罩是全屏的，打开设置后，面板以外的任何地方
   点下去先落到遮罩上；pointerdown 一按下去就关，不用等 click。 */
settingsOverlay.addEventListener('pointerdown', function () {
  closeSettings();
});

/* v0.8 补丁：面板顶部的小横条（.settings-drag 里那根 44×5 的小 pill）看着像个按钮，
   用户点了它想关面板——以前它只是个装饰，从来没接过点击事件，点了什么都不发生。
   现在点它就关面板；下滑关法照样保留（从它上面往下滑超过 60px 也关）。 */
document.querySelector('.settings-drag').addEventListener('click', function () {
  closeSettings();
});

document.getElementById('settings-btn').addEventListener('click', function () {
  if (settingsPanel.hidden) openSettings();
  else closeSettings();
});

/* ② 右上角的 × */
document.getElementById('settings-close-btn').addEventListener('click', function () {
  closeSettings();
});

/* ① 点面板外面就关：点到面板和设置按钮以外的任何地方都关掉。
   v0.4 用的是 document 'click'，但 iPhone 的 Safari 在普通空白处点按时不一定会触发 click
   （这是 iOS 的老毛病），所以 v0.4 的“点外面”在他手机上经常没反应。
   v0.5 改成用 pointerdown 判断（手指一按下去就触发），click 留着当兜底。
   注意：打开面板那一下的 pointerdown 发生在面板打开之前（面板还是 hidden），不会误关；
   点设置按钮本身也被排除在外，不会和开关冲突。 */
function isOutsideSettingsTap(t) {
  if (!t || !t.closest) return false;
  if (t.closest('#settings-panel')) return false;
  if (t.closest('#settings-btn')) return false;
  return true;
}
document.addEventListener('pointerdown', function (e) {
  if (settingsPanel.hidden) return;
  if (isOutsideSettingsTap(e.target)) closeSettings();
});
document.addEventListener('click', function (e) {
  if (settingsPanel.hidden) return;
  if (isOutsideSettingsTap(e.target)) closeSettings();
});

/* ③ 往下滑动关掉：面板任意位置起手，往下滑超过 60px、松手时才收起；
   滑动时面板跟着手指走一点，松手不够 60px 就弹回来。
   v0.9 大改（真机报的：面板滚不动、往下滑一点就关）：
   - 内容区 .settings-body 自己能滚（overflow-y: auto，touch-action: pan-y），
     手指上下滑就是滚内容，不再被手势抢走；
   - 下滑关闭只在内容已经滚到最顶（scrollTop <= 0）时才生效：内容在底下时，
     往下滑只是滚内容，不关面板——pointerdown 和 pointermove 里都查 scrollTop，
     中途滚下去也一样作废；
   - 关闭只在松手时判定（pointerup），滑动过程中超过 60px 也不提前关；
     以前 v0.8 是滑过 60px 当场就关，太灵敏，手指抖一下面板就没了。
   注意：这里故意不用 setPointerCapture——一旦捕获，面板里按钮的 click 会落到面板上，
   ×、保存、输入框就全点不动了。手指滑出面板才抬起来时，页面级收尾兜底。 */
var settingsBody = document.getElementById('settings-body');
function swipeAtTop() {
  return !settingsBody || settingsBody.scrollTop <= 0;
}
var swipeStartY = null, swipeDY = 0, swipePointerId = null;
function swipeReset() {
  swipeStartY = null;
  swipeDY = 0;
  swipePointerId = null;
  settingsPanel.style.transform = '';
  settingsPanel.classList.remove('swiping');
}
function swipeFinish() {
  if (swipePointerId === null) return;
  var dy = swipeDY;
  swipeReset();
  if (dy > 60) closeSettings();
}
settingsPanel.addEventListener('pointerdown', function (e) {
  if (settingsPanel.hidden) return;
  /* v0.8 补丁：落在表单控件上的按压不跟踪——输入框、下拉框、按钮这些地方点下去
     是给控件用的。以前整块面板都跟踪，手指在下拉框上轻微一动，面板就被加上
     translateY 位移，iOS 上元素一动就把这次点击吞了，下拉框打不开。
     只有落在面板空白处、拖动条、标题、提示文字上才开始跟踪下滑手势。 */
  if (e.target && e.target.closest && e.target.closest('input, select, button, textarea, label')) return;
  /* v0.9：内容已经滚到底下时不跟踪——手指是在滚内容，不是想关面板。 */
  if (!swipeAtTop()) return;
  /* 上一根手指/鼠标没抬起来就又按下来（极少见，或测试里只发 pointerdown 不发 pointerup），
     先把旧的那次清掉，别让它卡住新的手势。 */
  if (swipePointerId !== null) swipeReset();
  swipePointerId = e.pointerId;
  swipeStartY = e.clientY;
  swipeDY = 0;
});
settingsPanel.addEventListener('pointermove', function (e) {
  if (swipePointerId === null || e.pointerId !== swipePointerId) return;
  var dy = e.clientY - swipeStartY;
  if (dy > 0) {
    /* v0.9：中途内容滚下去了也作废——这一下是在滚内容，不关面板。 */
    if (!swipeAtTop()) { swipeReset(); return; }
    /* v0.8 补丁：位移小于 8px 不算滑动——点按时手指的轻微抖动不让面板动，
       面板不动，点击才不会被 iOS 吞掉。 */
    if (dy < 8) { swipeDY = 0; return; }
    swipeDY = dy;
    settingsPanel.classList.add('swiping');
    settingsPanel.style.transform = 'translateY(' + dy + 'px)';
    /* v0.9：滑过 60px 也不提前关，等松手时再判定（见 swipeFinish）。 */
  } else {
    swipeDY = 0;
    settingsPanel.style.transform = '';
    settingsPanel.classList.remove('swiping');
  }
});
settingsPanel.addEventListener('pointerup', function (e) {
  if (e.pointerId === swipePointerId) swipeFinish();
});
settingsPanel.addEventListener('pointercancel', function (e) {
  if (e.pointerId === swipePointerId) swipeReset();
});
/* 手指/鼠标滑出面板才抬起来时，面板自己收不到 pointerup，页面级收尾兜底。 */
document.addEventListener('pointerup', function (e) {
  if (e.pointerId === swipePointerId) swipeFinish();
});
document.addEventListener('pointercancel', function (e) {
  if (e.pointerId === swipePointerId) swipeReset();
});
/* Esc 也能关（桌面上顺手） */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeSettings();
});

/* 朗读声音：换一个就记住；试听用当前选的那个声音读一句 */
document.getElementById('voice-select').addEventListener('change', function (e) {
  /* v0.8 补丁：空列表时的占位项（值是 ''）不保存——它不是真的声音。 */
  if (!e.target.value) return;
  saveVoiceURI(e.target.value);
  toast('朗读声音已记住');
});
/* v0.8 补丁：声音列表还是空的时候（只有“点一下重新加载声音”这一项），
   点下拉框就再刷一次列表。iPhone 上 voiceschanged 有时来得晚，第一次打开设置时
   可能一个声音都没有，刷一次就有了；再点一次就能看到新刷出来的声音。 */
document.getElementById('voice-select').addEventListener('click', function () {
  var sel = document.getElementById('voice-select');
  if (sel && sel.options.length === 1 && sel.options[0].value === '') {
    refreshVoiceSelect();
  }
});
/* v0.8 补丁：“换一个声音”——就算某台手机上下拉框打不开，换声音也有路可走：
   点一下换到下一个英文声音并试读一句，选好就记住；没有声音时先刷一次列表。 */
document.getElementById('voice-next-btn').addEventListener('click', function () {
  var voices = listEnglishVoices();
  if (!voices.length) {
    refreshVoiceSelect();
    toast('还没有可用的英文语音，点一下下拉框再试一次');
    return;
  }
  var sel = document.getElementById('voice-select');
  var cur = sel ? sel.value : '';
  var idx = -1;
  voices.forEach(function (v, i) { if (v.voiceURI === cur) idx = i; });
  var next = voices[(idx + 1) % voices.length];
  saveVoiceURI(next.voiceURI);
  if (sel) sel.value = next.voiceURI;
  toast('已换成：' + next.name);
  speak(VOICE_TEST_TEXT, next.voiceURI);
});
document.getElementById('voice-test-btn').addEventListener('click', function () {
  var sel = document.getElementById('voice-select');
  speak(VOICE_TEST_TEXT, sel ? sel.value : '');
});

function renderSettingsStatus() {
  var s = loadAiSettings();
  document.getElementById('settings-status').textContent =
    (s.endpoint && s.key) ? '已保存：' + s.endpoint : '还没设置（不设置也能用，v0.2 不靠它）。';
}

document.getElementById('save-settings-btn').addEventListener('click', function () {
  var endpoint = document.getElementById('ai-endpoint').value.trim();
  var key = document.getElementById('ai-key').value.trim();
  if ((endpoint && !key) || (!endpoint && key)) {
    toast('地址和 Key 要一起填，或者都留空');
    return;
  }
  saveAiSettings(endpoint, key);
  renderSettingsStatus();
  toast('设置已保存，只存在这台手机上');
  /* v0.5 修：以前保存完面板根本不关，只弹一句“已保存”，Haze 得再点一次设置才回去。
     现在保存成功就直接关掉面板。 */
  closeSettings();
});

/* v0.7：清除缓存并重载——旧 service worker 缓存赖在 iPhone Safari 里不走时用的自救按钮。
   点一下就：注销本页所有的 service worker、删掉所有 Cache Storage、清掉自动加词的
   标记（新旧两个 key 都清），然后重新加载页面。加词本来就按单词去重，所以重加不会重复；
   重新加载后打开的就是服务器上的最新版。哪一步失败也不卡住，最后一定重新加载。 */
document.getElementById('clear-cache-btn').addEventListener('click', function () {
  var btn = document.getElementById('clear-cache-btn');
  try { localStorage.removeItem(LS_STARTER_SEEDED); } catch (e) {}
  try { localStorage.removeItem('huaci-ji-starter-seeded-v1'); } catch (e) {}
  var jobs = [];
  if ('serviceWorker' in navigator && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister().catch(function () {}); }));
    }).catch(function () {}));
  }
  if ('caches' in window && window.caches && window.caches.keys) {
    jobs.push(window.caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return window.caches.delete(k).catch(function () {}); }));
    }).catch(function () {}));
  }
  if (btn) { btn.disabled = true; btn.textContent = '正在清理缓存…'; }
  Promise.all(jobs).then(function () {
    toast('缓存已清除，正在重新加载');
    setTimeout(function () { location.reload(); }, 300);
  }).catch(function () { location.reload(); });
});

document.getElementById('sound-toggle').addEventListener('change', function (e) {
  setSoundEnabled(e.target.checked);
  toast(e.target.checked ? '音效已打开' : '音效已关闭');
});

/* ---------- 启动 ---------- */
renderTodayCount();
renderWordbook();
renderPracticeSelect();
renderPackCards();
/* v0.6：取词包数据。取到了就画卡片；取不到就用内嵌兜底，没加过日常包的打开照样有词可学。 */
fetchStarterPacks().then(function (packs) {
  if (packs && packs.length) {
    starterPacks = packs;
  } else {
    starterLoadFailed = true;
  }
  renderPackCards();
  if (starterSeedPending) {
    starterSeedPending = false;
    seedDailyPack(starterPacks);
  }
});
if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoiceSelect);
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}

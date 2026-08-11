// xcapp build 20260811-1310 v22 leader-collection
(function () {
  'use strict';

  var JS_BUILD = '20260811-1310 v22';

  var IS_NODE = typeof document === 'undefined';

  var CATEGORIES = ['言语理解', '政治理论', '常识判断', '判断推理', '资料分析', '数量关系'];
  var SUBCATEGORIES = {
    '常识判断': ['经济常识', '科技常识', '人文常识', '地理国情', '法律常识'],
    '言语理解': ['逻辑填空', '片段阅读', '语句表达'],
    '判断推理': ['图形推理', '定义判断', '类比推理', '逻辑判断'],
    '政治理论': ['习思想', '马克思', '时政']
  };
  var CAT_COLORS = {
    '言语理解': '#3b82f6',
    '政治理论': '#e5484d',
    '常识判断': '#f59e0b',
    '判断推理': '#10b981',
    '资料分析': '#8b5cf6',
    '数量关系': '#ec4899'
  };
  var REVIEW_OPTIONS = [1, 2, 3, 5, 7, 14, 30];
  var WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  var STORAGE_KEY = 'xcapp_questions_v1';
  var NAV_TABS = [
    { key: 'home', name: '首页' },
    { key: 'ai', name: 'AI' },
    { key: 'stats', name: '统计' }
  ];
  var HOME_SUB_TABS = ['review', 'bank', 'add', 'calc', 'idiom', 'news'];

  var state = {
    tab: 'home',
    overlay: null,
    questions: [],
    search: '',
    filterCat: 'all',
    filterSub: '',
    form: null,
    practice: null,
    ocrRunning: false,
    ocrProgress: 0,
    ocrStatus: '',
    keepScroll: false,
    crop: null,
    cropCb: null,
    calc: { questions: [], history: [], startTime: 0, current: null, answered: false },
    news: { items: [], loading: false, summaries: {}, saved: [], detailLoading: false, leader: { items: [], loading: false, detail: null } },
    homeNews: null,
    idiom: { loading: false, result: null, saved: [], input: '', proof: { loading: false, text: '' } },
    ai: { loading: false, history: [], input: '', pendingImg: '' },
    aiAnalyzing: false,
    aiAnalysis: '',
    fabPos: null,
    fabDragged: false,
    calcTimerId: null,
    scratch: false,
    scratchTool: 'pen',
    scratchColor: '#1f2430',
    sourceHistory: [],
    settings: { reviewWeekday: 0 }
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(dateStr, n) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    var p = dateStr.split('-');
    return p[1] + '月' + p[2] + '日';
  }
  function nextWeekdayDate(fromStr, wd) {
    var p = fromStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var cur = d.getDay();
    var target = wd === 7 ? 0 : wd;
    var diff = (target - cur + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function wdLabel(wd) {
    return wd >= 1 && wd <= 7 ? WEEKDAY_NAMES[wd - 1] : '';
  }

  function startCalcTimer() {
    stopCalcTimer();
    state.calcTimerId = setInterval(function () {
      var timerEl = $('.calc-timer');
      if (timerEl && state.calc.startTime > 0 && !state.calc.answered) {
        var elapsed = ((Date.now() - state.calc.startTime) / 1000).toFixed(1);
        timerEl.textContent = '⏱ ' + elapsed + 's';
      }
    }, 100);
  }

  function stopCalcTimer() {
    if (state.calcTimerId) {
      clearInterval(state.calcTimerId);
      state.calcTimerId = null;
    }
  }
  function stripOptionPrefix(text) {
    return String(text || '').replace(/^[A-F]\s*[.、．)）:：]\s*/, '');
  }

  function toast(msg) {
    var box = $('#toast-box');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2000);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
  }

  function confirmDialog(title, msg, okText, danger) {
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal">' +
        '<div class="m-title">' + esc(title) + '</div>' +
        '<div class="m-msg">' + esc(msg) + '</div>' +
        '<div class="m-btns">' +
        '<button class="btn gray" data-m="cancel">取消</button>' +
        '<button class="btn ' + (danger ? 'danger' : '') + '" data-m="ok">' + esc(okText || '确定') + '</button>' +
        '</div></div>';
      mask.addEventListener('click', function (e) {
        var act = e.target.getAttribute('data-m');
        if (!act) return;
        document.body.removeChild(mask);
        resolve(act === 'ok');
      });
      document.body.appendChild(mask);
    });
  }

  function load() {
    try {
      var raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      state.questions = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.questions = [];
    }
    try {
      var calcRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_calc_history') : null;
      state.calc.history = calcRaw ? JSON.parse(calcRaw) : [];
    } catch (e) {
      state.calc.history = [];
    }
    try {
      var idiomRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_idioms') : null;
      state.idiom.saved = idiomRaw ? JSON.parse(idiomRaw) : [];
    } catch (e) {
      state.idiom.saved = [];
    }
    try {
      var aiRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_ai_history') : null;
      state.ai.history = aiRaw ? JSON.parse(aiRaw) : [];
    } catch (e) {
      state.ai.history = [];
    }
    try {
      var fabRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_fab_pos') : null;
      state.fabPos = fabRaw ? JSON.parse(fabRaw) : null;
    } catch (e) {
      state.fabPos = null;
    }
    try {
      var newsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_news_saved') : null;
      state.news.saved = newsRaw ? JSON.parse(newsRaw) : [];
    } catch (e) {
      state.news.saved = [];
    }
    try {
      var sumRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_news_summaries') : null;
      state.news.summaries = sumRaw ? JSON.parse(sumRaw) : {};
    } catch (e) {
      state.news.summaries = {};
    }
    try {
      var setRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_settings') : null;
      state.settings = setRaw ? JSON.parse(setRaw) : { reviewWeekday: 0 };
      if (!state.settings || typeof state.settings.reviewWeekday !== 'number') state.settings = { reviewWeekday: 0 };
    } catch (e) {
      state.settings = { reviewWeekday: 0 };
    }
    try {
      var srcRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('xcapp_sources') : null;
      state.sourceHistory = srcRaw ? JSON.parse(srcRaw) : [];
      if (!Array.isArray(state.sourceHistory)) state.sourceHistory = [];
    } catch (e) {
      state.sourceHistory = [];
    }
  }
  function saveSources() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_sources', JSON.stringify(state.sourceHistory.slice(0, 50)));
    } catch (e) { /* ignore */ }
  }
  function saveSettings() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_settings', JSON.stringify(state.settings));
    } catch (e) { /* ignore */ }
  }
  function saveNewsSaved() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_news_saved', JSON.stringify(state.news.saved));
    } catch (e) { /* ignore */ }
  }
  function saveNewsSummaries() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_news_summaries', JSON.stringify(state.news.summaries));
    } catch (e) { /* ignore */ }
  }
  function save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.questions));
    } catch (e) {
      toast('保存失败：存储空间不足');
    }
  }
  function saveCalcHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_calc_history', JSON.stringify(state.calc.history));
    } catch (e) { /* ignore */ }
  }
  function saveIdioms() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_idioms', JSON.stringify(state.idiom.saved));
    } catch (e) { /* ignore */ }
  }
  function saveAiHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('xcapp_ai_history', JSON.stringify(state.ai.history.slice(0, 50)));
    } catch (e) { /* ignore */ }
  }

  function isNative() {
    return !!(window.AndroidBridge && typeof window.AndroidBridge.takePhoto === 'function');
  }

  var __cbSeq = 0;
  var __cbs = {};
  if (typeof window !== 'undefined') {
    window.__bridgeResult = function (id, type, payload) {
      var cb = __cbs[id];
      if (cb) { delete __cbs[id]; cb(type, payload); }
    };
  }
  function nativeCall(name, payload) {
    return new Promise(function (resolve, reject) {
      var id = 'cb' + (++__cbSeq);
      __cbs[id] = function (type, data) {
        if (type === 'ok') resolve(data);
        else reject(new Error(data || '操作失败'));
      };
      try { window.AndroidBridge[name](id, payload || ''); }
      catch (e) { delete __cbs[id]; reject(e); }
    });
  }

  function compressImage(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1400;
    quality = quality || 0.78;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  function prepareOcrImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var target = 2200;
        var scale = Math.min(1, target / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  function openCrop(dataUrl, cb, target) {
    state.overlay = { type: 'crop', image: dataUrl };
    state.cropCb = cb;
    state.cropTarget = target || 'main';
    state.crop = null;
    render();
  }

  function renderCrop() {
    return '<div class="overlay crop-overlay">' +
      '<div class="overlay-head">' +
      '<span class="back" data-act="cropCancel">&times;</span>' +
      '<div class="title">裁剪截图</div>' +
      '<button class="btn sm ok" data-act="cropConfirm">确定</button>' +
      '</div>' +
      '<div class="crop-body"><canvas id="crop-canvas"></canvas></div>' +
      '<div class="crop-tip">拖动选框或四角/四边调整裁剪范围，双击选框重置</div>' +
      '<div class="crop-actions">' +
      '<button class="btn gray" data-act="cropRepick">重选图片</button>' +
      '<button class="btn" data-act="cropConfirm">确定裁剪</button>' +
      '</div></div>';
  }

  function detachCrop() {
    if (state.crop && state.crop.detach) {
      try {
        state.crop.detach();
        window.removeEventListener('resize', state.crop.winResize);
      } catch (e) { /* ignore */ }
    }
    state.crop = null;
  }

  function closeCrop() {
    detachCrop();
    state.cropCb = null;
    state.overlay = { type: 'form' };
    state.keepScroll = true;
    render();
  }

  function cropConfirm() {
    var c = state.crop;
    if (!c || !c.ready) { toast('请稍候，图片加载中'); return; }
    var sx = Math.round(c.r.x * c.natW);
    var sy = Math.round(c.r.y * c.natH);
    var sw = Math.max(1, Math.round(c.r.w * c.natW));
    var sh = Math.max(1, Math.round(c.r.h * c.natH));
    var out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    var ctx = out.getContext('2d');
    ctx.drawImage(c.img, sx, sy, sw, sh, 0, 0, sw, sh);
    var dataUrl = out.toDataURL('image/jpeg', 0.9);
    var cb = state.cropCb;
    var target = state.cropTarget;
    detachCrop();
    state.cropCb = null;
    state.cropTarget = null;
    state.overlay = { type: 'form' };
    state.keepScroll = true;
    render();
    if (cb) cb(dataUrl, target);
  }

  function initCrop() {
    if (IS_NODE) return;
    var canvas = $('#crop-canvas');
    if (!canvas) return;
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    detachCrop();
    var img = new Image();
    img.onload = function () {
      var c = {
        canvas: canvas, ctx: ctx, img: img,
        natW: img.naturalWidth || img.width, natH: img.naturalHeight || img.height,
        r: null, w: 0, h: 0, ox: 0, oy: 0, ready: false
      };
      state.crop = c;
      layoutCrop();
      bindCrop(c);
      c.ready = true;
    };
    img.onerror = function () { toast('图片加载失败'); };
    img.src = state.overlay.image;
  }

  function layoutCrop() {
    var c = state.crop;
    if (!c) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = c.canvas.clientWidth || 1;
    var ch = c.canvas.clientHeight || 1;
    var scale = Math.min(cw / c.natW, ch / c.natH);
    c.w = Math.round(c.natW * scale);
    c.h = Math.round(c.natH * scale);
    c.ox = Math.round((cw - c.w) / 2);
    c.oy = Math.round((ch - c.h) / 2);
    c.canvas.width = Math.round(cw * dpr);
    c.canvas.height = Math.round(ch * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!c.r) {
      c.r = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
    }
    drawCrop();
  }

  function drawCrop() {
    var c = state.crop;
    if (!c) return;
    var ctx = c.ctx;
    var cw = c.canvas.clientWidth, chh = c.canvas.clientHeight;
    ctx.clearRect(0, 0, cw, chh);
    ctx.drawImage(c.img, c.ox, c.oy, c.w, c.h);
    var x = c.ox + c.r.x * c.w, y = c.oy + c.r.y * c.h, w = c.r.w * c.w, h = c.r.h * c.h;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cw, y);
    ctx.fillRect(0, y + h, cw, chh - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, cw - x - w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke();
    }
    var hs = 9;
    var pts = [
      [x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2],
      [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]
    ];
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 2;
    pts.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], hs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  function bindCrop(c) {
    var canvas = c.canvas;
    function pos(ev) {
      var rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }
    function toImg(p) {
      return { x: (p.x - c.ox) / c.w, y: (p.y - c.oy) / c.h };
    }
    function clampRect(r) {
      var min = 0.06;
      if (r.w < min) r.w = min;
      if (r.h < min) r.h = min;
      if (r.x < 0) r.x = 0;
      if (r.y < 0) r.y = 0;
      if (r.x + r.w > 1) r.x = 1 - r.w;
      if (r.y + r.h > 1) r.y = 1 - r.h;
      return r;
    }
    function hitTest(p) {
      var r = c.r;
      var x0 = c.ox + r.x * c.w, y0 = c.oy + r.y * c.h, w = r.w * c.w, h = r.h * c.h;
      var tol = 24;
      var handles = [
        { dx: 0, dy: 0 }, { dx: 0.5, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 1, dy: 0.5 }, { dx: 1, dy: 1 }, { dx: 0.5, dy: 1 },
        { dx: 0, dy: 1 }, { dx: 0, dy: 0.5 }
      ];
      for (var i = 0; i < handles.length; i++) {
        var hx = x0 + handles[i].dx * w, hy = y0 + handles[i].dy * h;
        if (Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol) {
          return { mode: 'resize', i: i };
        }
      }
      if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) return { mode: 'move' };
      return null;
    }
    var drag = null;
    function onDown(ev) {
      ev.preventDefault();
      var ht = hitTest(pos(ev));
      if (!ht) return;
      drag = { mode: ht.mode, i: ht.i, start: toImg(pos(ev)), orig: { x: c.r.x, y: c.r.y, w: c.r.w, h: c.r.h } };
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    }
    function onMove(ev) {
      if (!drag) return;
      ev.preventDefault();
      var cur = toImg(pos(ev));
      var d = { x: cur.x - drag.start.x, y: cur.y - drag.start.y };
      var r = { x: drag.orig.x, y: drag.orig.y, w: drag.orig.w, h: drag.orig.h };
      if (drag.mode === 'move') {
        r.x += d.x;
        r.y += d.y;
      } else {
        var h = drag.i;
        if (h === 2 || h === 3 || h === 4) r.w = drag.orig.w + d.x;
        if (h === 6 || h === 7 || h === 0) { r.x = drag.orig.x + d.x; r.w = drag.orig.w - d.x; }
        if (h === 4 || h === 5 || h === 6) r.h = drag.orig.h + d.y;
        if (h === 0 || h === 1 || h === 2) { r.y = drag.orig.y + d.y; r.h = drag.orig.h - d.y; }
      }
      c.r = clampRect(r);
      drawCrop();
    }
    function onUp(ev) {
      drag = null;
      if (canvas.releasePointerCapture && ev.pointerId != null) {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    var dblClick = function () {
      c.r = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
      drawCrop();
    };
    canvas.addEventListener('dblclick', dblClick);
    c.winResize = layoutCrop;
    window.addEventListener('resize', layoutCrop);
    c.detach = function () {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', dblClick);
    };
  }

  function pickFile(kind) {
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (kind === 'camera') input.setAttribute('capture', 'environment');
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) { reject(new Error('未选择文件')); return; }
        var rd = new FileReader();
        rd.onload = function () { compressImage(rd.result).then(resolve, reject); };
        rd.onerror = function () { reject(new Error('读取文件失败')); };
        rd.readAsDataURL(f);
      };
      input.click();
    });
  }

  function pickImage(kind) {
    if (kind === 'camera' && isNative()) {
      return nativeCall('takePhoto')
        .then(function (dataUrl) { return compressImage(dataUrl); })
        .catch(function (err) {
          toast('相机调用失败：' + (err.message || err) + '，已改为文件选择');
          return pickFile(kind);
        });
    }
    return pickFile(kind);
  }

  function downloadBackup(json) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '行测错题备份_' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function exportBackup() {
    var json = JSON.stringify({ app: '行测错题复盘', version: 1, exportedAt: new Date().toISOString(), questions: state.questions }, null, 2);
    if (isNative() && window.AndroidBridge.exportBackup) {
      nativeCall('exportBackup', json).then(function () { toast('已导出'); }, function (e) { toast(e.message); });
    } else {
      downloadBackup(json);
      toast('已导出');
    }
  }

  function importBackup() {
    function merge(text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { toast('备份文件格式错误'); return; }
      var list = data.questions || data;
      if (!Array.isArray(list)) { toast('备份文件格式错误'); return; }
      var ids = {};
      state.questions.forEach(function (q) { ids[q.id] = true; });
      var added = 0;
      list.forEach(function (q) {
        if (q && q.id && q.stem && !ids[q.id]) {
          state.questions.push(q);
          ids[q.id] = true;
          added++;
        }
      });
      save();
      render();
      toast('导入完成，新增 ' + added + ' 题');
    }
    if (isNative() && window.AndroidBridge.importBackup) {
      nativeCall('importBackup').then(merge, function (e) { toast(e.message); });
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { merge(rd.result); };
        rd.readAsText(f);
      };
      input.click();
    }
  }

  function renderHeader() {
    var el = $('#app-header');
    if (state.overlay) { el.innerHTML = ''; return; }
    var pending = state.questions.filter(function (q) { return q.status === 'pending'; }).length;
    var todayDue = state.questions.filter(function (q) { return q.status === 'pending' && q.reviewDate <= todayStr(); }).length;
    var titles = { home: '首页', review: '今日复盘', bank: '错题本', add: '添加错题', calc: '速算练习', idiom: '成语积累', ai: 'AI 问答', news: '每日时政', stats: '统计' };
    var subs = {
      home: '公考学习助手',
      review: '待复盘 ' + pending + ' 题 · 今日到期 ' + todayDue + ' 题',
      bank: '共 ' + state.questions.length + ' 题',
      add: '上传截图 · 识别 · 规划复盘',
      calc: '资料分析常见计算练习',
      idiom: '已收藏 ' + state.idiom.saved.length + ' 个词语',
      ai: '常识问答 · 随问随答',
      news: '公务员考试时政要闻',
      stats: '学习情况一目了然'
    };
    var back = HOME_SUB_TABS.indexOf(state.tab) >= 0
      ? '<span class="header-back" data-act="goHome">‹</span>'
      : '';
    var right = '';
    if (state.tab === 'home' && state.homeNews) {
      right = '<div class="header-news" data-act="switchTab" data-key="news" title="点击查看时政要闻">时政 · ' + esc(state.homeNews.title) + '</div>';
    } else if (state.tab === 'bank') {
      right = '<div class="header-pen" data-act="openSettings" title="复盘设置">⚙</div>';
    }
    el.innerHTML = back +
      '<div class="header-title"><h1>' + (titles[state.tab] || '公考小助手') + '</h1>' +
      '<div class="sub">' + (subs[state.tab] || '') + '</div></div>' + right;
  }

  function renderTabbar() {
    var el = $('#tabbar');
    if (state.overlay) { el.innerHTML = ''; return; }
    var icons = {
      home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
      ai: 'AI',
      stats: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>'
    };
    el.innerHTML = NAV_TABS.map(function (t) {
      var active = state.tab === t.key || (t.key === 'home' && HOME_SUB_TABS.indexOf(state.tab) >= 0);
      return '<div class="tab' + (t.key === 'ai' ? ' tab-ai' : '') + (active ? ' active' : '') + '" data-act="switchTab" data-key="' + t.key + '">' +
        '<span class="ico">' + (icons[t.key] || '·') + '</span>' +
        (t.key === 'ai' ? '' : t.name) + '</div>';
    }).join('');
  }

  function captureActiveInput() {
    if (IS_NODE) return null;
    var a = document.activeElement;
    if (!a) return null;
    if (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA') return null;
    if (a.type === 'checkbox' || a.type === 'radio' || a.type === 'file' || a.type === 'button' || a.type === 'submit') return null;
    return {
      id: a.id || '',
      opt: a.getAttribute('data-opt'),
      end: a.selectionEnd != null ? a.selectionEnd : String(a.value || '').length
    };
  }

  function restoreActiveInput(info) {
    if (!info) return;
    var el = info.id ? document.getElementById(info.id) : null;
    if (!el && info.opt != null) el = document.querySelector('[data-opt="' + info.opt + '"]');
    if (!el) return;
    try { el.focus(); } catch (e) { return; }
    try { if (el.setSelectionRange) el.setSelectionRange(info.end, info.end); } catch (e) { /* ignore */ }
  }

  function render() {
    var content = $('#content');
    var activeInfo = captureActiveInput();
    var keep = state.keepScroll;
    var prevScroll = 0;
    if (keep) {
      var ob = $('.overlay-body', content);
      if (ob) prevScroll = ob.scrollTop;
    }
    state.keepScroll = false;
    renderHeader();
    renderTabbar();
    if (state.overlay) {
      content.innerHTML = renderOverlay();
    } else if (state.tab === 'home') {
      content.innerHTML = renderHome();
    } else if (state.tab === 'review') {
      content.innerHTML = renderReview();
    } else if (state.tab === 'bank') {
      content.innerHTML = renderBank();
    } else if (state.tab === 'add') {
      if (!state.overlay) {
        state.form = freshForm(null);
        state.overlay = { type: 'form' };
      }
      content.innerHTML = renderForm();
    } else if (state.tab === 'calc') {
      content.innerHTML = renderCalc();
    } else if (state.tab === 'idiom') {
      content.innerHTML = renderIdiom();
    } else if (state.tab === 'ai') {
      content.innerHTML = renderAi();
      aiScrollBottom($('#ai-msgs'));
    } else if (state.tab === 'news') {
      content.innerHTML = renderNews();
    } else if (state.tab === 'stats') {
      content.innerHTML = renderStats();
    }
    content.scrollTop = 0;
    if (keep) {
      var ob2 = $('.overlay-body', content);
      if (ob2) ob2.scrollTop = prevScroll;
    }
    if (state.overlay && state.overlay.type === 'crop') initCrop();
    if (state.tab === 'bank') initFab();
    if (state.overlay && state.overlay.type === 'practice' && state.scratch) {
      content.insertAdjacentHTML('beforeend', renderScratch());
      initScratch();
    }
    restoreActiveInput(activeInfo);
  }

  function renderOverlay() {
    var o = state.overlay;
    if (o.type === 'form') return renderForm();
    if (o.type === 'practice') return renderPractice();
    if (o.type === 'detail') return renderDetail();
    if (o.type === 'crop') return renderCrop();
    if (o.type === 'newsDetail') return renderNewsDetail();
    if (o.type === 'newsSaved') return renderNewsSaved();
    if (o.type === 'leaderDetail') return renderLeaderDetail();
    if (o.type === 'settings') return renderSettings();
    return '';
  }

  function catTag(cat, sub, cls) {
    var color = CAT_COLORS[cat] || '#8a93a6';
    var html = '<span class="tag" style="background:' + color + (cls ? ';' + cls : '') + '">' + esc(cat) + '</span>';
    if (sub) {
      html += '<span class="tag sub" style="color:' + color + '">' + esc(sub) + '</span>';
    }
    return html;
  }

  function statusTag(q) {
    if (q.status === 'pending') {
      if (q.reviewDate < todayStr()) return '<span class="tag overdue">已逾期</span>';
      return '<span class="tag pending">待复盘</span>';
    }
    return '<span class="tag done">已复盘</span>';
  }

  function renderHome() {
    var today = todayStr();
    var pending = state.questions.filter(function (q) { return q.status === 'pending'; }).length;
    var done = state.questions.filter(function (q) { return q.status === 'done'; }).length;
    var dueToday = state.questions.filter(function (q) { return q.status === 'pending' && q.reviewDate <= today; }).length;
    var idioms = state.idiom.saved.length;

    var html = '';
    html += '<div class="stat-grid">' +
      '<div class="stat-cell orange"><div class="num">' + pending + '</div><div class="lbl">待复盘</div></div>' +
      '<div class="stat-cell green"><div class="num">' + done + '</div><div class="lbl">已复盘</div></div>' +
      '<div class="stat-cell red"><div class="num">' + dueToday + '</div><div class="lbl">今日待复盘</div></div>' +
      '<div class="stat-cell blue"><div class="num">' + idioms + '</div><div class="lbl">已积累词语</div></div>' +
      '</div>';

    html += '<div class="section-title">学习工具</div>';
    html += '<div class="home-tools">';
    var tools = [
      { key: 'bank', name: '错题本', cnt: '', color: 'orange' },
      { key: 'calc', name: '速算练习', cnt: '', color: 'purple' },
      { key: 'idiom', name: '成语积累', cnt: idioms ? '已收藏 ' + idioms + ' 个' : '', color: 'pink' },
      { key: 'news', name: '每日时政', cnt: '', color: 'teal' }
    ];
    tools.forEach(function (t) {
      html += '<button class="tool-btn ' + t.color + '" data-act="switchTab" data-key="' + t.key + '">' +
        '<span class="nm">' + t.name + '</span>' +
        (t.cnt ? '<span class="cnt">' + t.cnt + '</span>' : '') +
        '</button>';
    });
    html += '</div>';

    html += '<div class="section-title">关于与更新</div>';
    html += '<div class="card">';
    html += '<p class="muted" style="font-size:13px">版本：' + esc(remoteVersionText()) + '<br>构建：' + esc(JS_BUILD) + '</p>';
    html += '<button class="btn mt12" data-act="manualUpdate">检查更新</button>';
    html += '</div>';
    html += '<div class="home-credit">来自双休日</div>';
    return html;
  }

  function renderReview() {
    var today = todayStr();
    var due = state.questions.filter(function (q) {
      return q.status === 'pending' && q.reviewDate <= today;
    }).sort(function (a, b) { return a.reviewDate < b.reviewDate ? -1 : 1; });
    var next = state.questions.filter(function (q) {
      return q.status === 'pending' && q.reviewDate > today;
    }).sort(function (a, b) { return a.reviewDate < b.reviewDate ? -1 : 1; });
    var done = state.questions.filter(function (q) { return q.status === 'done'; });

    var html = '';
    html += '<div class="stat-grid">';
    html += '<div class="stat-cell orange"><div class="num">' + due.length + '</div><div class="lbl">待复盘</div></div>';
    html += '<div class="stat-cell blue"><div class="num">' + next.length + '</div><div class="lbl">即将到期</div></div>';
    html += '<div class="stat-cell green"><div class="num">' + done.length + '</div><div class="lbl">已完成</div></div>';
    html += '</div>';

    if (!due.length && !next.length && !done.length) {
      html += '<div class="empty"><span class="big"></span>暂无错题<br>去「首页」-「添加错题」上传你的第一道错题吧</div>';
    } else {
      if (due.length) {
        html += '<div class="section-title">待复盘（' + due.length + '）</div>';
        due.forEach(function (q) {
          html += '<div class="card q-item">';
          html += '<div class="q-top">' + catTag(q.category, q.subCategory) + statusTag(q) + '</div>';
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html += '<span>' + (q.reviewWeekday ? '每周' + wdLabel(q.reviewWeekday) + ' · ' : '') + '复盘日 ' + fmtDate(q.reviewDate) + '</span>';
          html += '<span>已复盘 ' + (q.rounds || 0) + ' 次</span>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html += '<button class="btn sm" data-act="openDetail" data-id="' + q.id + '">开始复盘</button>';
          html += '<button class="btn gray sm" data-act="delayReview" data-id="' + q.id + '">延期1天</button>';
          html += '<button class="btn danger sm" data-act="delQuestion" data-id="' + q.id + '">删除</button>';
          html += '</div></div>';
        });
      }
      if (next.length) {
        html += '<div class="section-title">即将到期（' + next.length + '）</div>';
        next.forEach(function (q) {
          var remain = Math.ceil((new Date(q.reviewDate) - new Date(today)) / 86400000);
          html += '<div class="card q-item">';
          html += '<div class="q-top">' + catTag(q.category, q.subCategory) + statusTag(q) + '</div>';
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html += '<span>' + (q.reviewWeekday ? '每周' + wdLabel(q.reviewWeekday) + ' · ' : '') + '复盘日 ' + fmtDate(q.reviewDate) + '（约' + remain + '天后）</span>';
          html += '<span>已复盘 ' + (q.rounds || 0) + ' 次</span>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html += '<button class="btn gray sm" data-act="delayReview" data-id="' + q.id + '">延期1天</button>';
          html += '<button class="btn danger sm" data-act="delQuestion" data-id="' + q.id + '">删除</button>';
          html += '</div></div>';
        });
      }
      if (done.length) {
        html += '<div class="section-title">已完成（' + done.length + '）</div>';
        done.forEach(function (q) {
          html += '<div class="card q-item">';
          html += '<div class="q-top">' + catTag(q.category, q.subCategory) + '<span class="tag done">已掌握</span></div>';
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html += '<span>已复盘 ' + (q.rounds || 0) + ' 次</span>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html += '<button class="btn gray sm" data-act="reopenQuestion" data-id="' + q.id + '">重新复盘</button>';
          html += '<button class="btn danger sm" data-act="delQuestion" data-id="' + q.id + '">删除</button>';
          html += '</div></div>';
        });
      }
    }
    return html;
  }

  function stemPreviewHtml(q) {
    if (q.image) {
      return '<div class="q-stem-preview"><img src="' + q.image + '" style="max-width:100%;max-height:120px;border-radius:8px"></div>';
    }
    return '<div class="q-stem-preview">' + esc(q.stem) + '</div>';
  }

  function qItemHtml(q, extra) {
    return '<div class="card q-item" data-act="openDetail" data-id="' + q.id + '">' +
      '<div class="q-top">' + catTag(q.category, q.subCategory) + statusTag(q) + '</div>' +
      stemPreviewHtml(q) +
      '<div class="q-meta">' +
      (q.reviewDate ? '<span>' + (q.reviewWeekday ? '每周' + wdLabel(q.reviewWeekday) + ' · ' : '') + '复盘日 ' + fmtDate(q.reviewDate) + '</span>' : '') +
      (q.source ? '<span>来源 ' + esc(q.source) + '</span>' : '') +
      (extra ? '<span>' + esc(extra) + '</span>' : '') +
      '<span>已复盘 ' + (q.rounds || 0) + ' 次</span>' +
      '</div></div>';
  }

  function renderBank() {
    var html = '<div class="field"><input class="input" id="bank-search" placeholder="搜索题干关键词" value="' + esc(state.search) + '"></div>';
    html += '<div class="chips" style="margin-bottom:12px">' +
      '<span class="chip' + (state.filterCat === 'all' ? ' active' : '') + '" data-act="filterCat" data-cat="all">全部</span>' +
      CATEGORIES.map(function (c) {
        return '<span class="chip' + (state.filterCat === c ? ' active' : '') + '" data-act="filterCat" data-cat="' + c + '">' + c + '</span>';
      }).join('') + '</div>';

    var subCats = SUBCATEGORIES[state.filterCat];
    if (subCats && subCats.length) {
      html += '<div class="chips" style="margin-bottom:12px">' +
        '<span class="chip' + (!state.filterSub ? ' active' : '') + '" data-act="filterSub" data-sub="all">全部子类</span>' +
        subCats.map(function (sc) {
          return '<span class="chip' + (state.filterSub === sc ? ' active' : '') + '" data-act="filterSub" data-sub="' + sc + '">' + sc + '</span>';
        }).join('') + '</div>';
    }

    var kw = state.search.trim();
    var list = state.questions.filter(function (q) {
      if (state.filterCat !== 'all' && q.category !== state.filterCat) return false;
      if (state.filterSub && q.subCategory !== state.filterSub) return false;
      if (kw) {
        var optText = (q.options || []).join(' ');
        if ((q.stem || '').indexOf(kw) < 0 && (q.correctThinking || '').indexOf(kw) < 0 &&
          (q.wrongThinking || '').indexOf(kw) < 0 && (q.source || '').indexOf(kw) < 0 &&
          optText.indexOf(kw) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    if (!list.length) {
      html += '<div class="empty">没有符合条件的错题</div>';
    } else {
      html += '<div id="bank-list"><div class="section-title">共 ' + list.length + ' 题</div>';
      html += list.map(qItemHtml).join('') + '</div>';
    }
    html += '<div class="fab" id="fab-add" data-act="openAdd">+</div>';
    return html;
  }

  function initFab() {
    var fab = $('#fab-add');
    if (!fab) return;
    if (state.fabPos) {
      fab.style.right = state.fabPos.r + 'px';
      fab.style.bottom = state.fabPos.b + 'px';
    }
    var drag = null;
    fab.addEventListener('pointerdown', function (ev) {
      drag = { startX: ev.clientX, startY: ev.clientY, moved: false };
      if (fab.setPointerCapture) {
        try { fab.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    });
    fab.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.startX;
      var dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
      if (drag.moved) {
        var r = window.innerWidth - ev.clientX - fab.offsetWidth / 2;
        var b = window.innerHeight - ev.clientY - fab.offsetHeight / 2;
        r = Math.max(8, Math.min(r, window.innerWidth - fab.offsetWidth - 8));
        b = Math.max(8, Math.min(b, window.innerHeight - fab.offsetHeight - 8));
        fab.style.right = r + 'px';
        fab.style.bottom = b + 'px';
      }
    });
    function endDrag() {
      if (!drag) return;
      var wasMoved = drag.moved;
      drag = null;
      if (wasMoved) {
        state.fabDragged = true;
        state.fabPos = {
          r: parseFloat(fab.style.right) || 18,
          b: parseFloat(fab.style.bottom) || 96
        };
        try { localStorage.setItem('xcapp_fab_pos', JSON.stringify(state.fabPos)); } catch (e) { /* ignore */ }
      }
    }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);
    fab.addEventListener('click', function (ev) {
      if (state.fabDragged) {
        state.fabDragged = false;
        ev.stopPropagation();
      }
    });
  }

  function renderScratch() {
    var isErase = state.scratchTool === 'eraser';
    var colors = [['#1f2430', '黑'], ['#d32f2f', '红'], ['#1565c0', '蓝']];
    var html = '<div class="scratch-layer" id="scratch-layer">' +
      '<div class="scratch-bar">' +
      '<span class="scratch-colors">' +
      colors.map(function (c) {
        return '<button class="scratch-color' + (!isErase && state.scratchColor === c[0] ? ' active' : '') + '" data-act="scratchColor" data-color="' + c[0] + '" title="' + c[1] + '色笔" style="background:' + c[0] + '"></button>';
      }).join('') +
      '</span>' +
      '<button class="btn gray sm' + (isErase ? ' active' : '') + '" data-act="scratchTool" data-tool="eraser" title="橡皮擦">橡皮</button>' +
      '<button class="btn gray sm' + (!isErase ? ' active' : '') + '" data-act="scratchTool" data-tool="pen" title="画笔">画笔</button>' +
      '<button class="btn gray sm" data-act="scratchClear">清空</button>' +
      '<button class="btn sm" data-act="toggleScratch">完成</button>' +
      '</div>' +
      '<div class="scratch-canvas-wrap"><canvas id="scratch-canvas"></canvas></div>' +
      '</div>';
    return html;
  }

  function initScratch() {
    var layer = $('#scratch-layer');
    if (!layer) return;
    var canvas = $('#scratch-canvas');
    if (!canvas) return;
    var wrap = $('.scratch-canvas-wrap');
    if (!wrap) return;

    function resizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      if (w < 10 || h < 10) return false;
      var prev = null;
      try {
        if (canvas.width > 0 && canvas.height > 0) {
          var tmp = document.createElement('canvas');
          tmp.width = canvas.width;
          tmp.height = canvas.height;
          tmp.getContext('2d').drawImage(canvas, 0, 0);
          prev = tmp;
        }
      } catch (e) { /* ignore */ }
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (prev) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      return true;
    }

    if (!resizeCanvas()) {
      setTimeout(function () { resizeCanvas(); }, 50);
      setTimeout(function () { resizeCanvas(); }, 200);
    }
    setTimeout(function () { resizeCanvas(); }, 500);
    setTimeout(function () { resizeCanvas(); }, 1000);

    var ctx = canvas.getContext('2d');
    var isEraser = function () { return state.scratchTool === 'eraser'; };
    function applyMode() {
      ctx.globalCompositeOperation = isEraser() ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isEraser() ? 'rgba(0,0,0,1)' : state.scratchColor;
    }
    applyMode();
    var drawing = false;
    var lastX = 0;
    var lastY = 0;
    function pos(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function widthFor(e) {
      if (isEraser()) return 22;
      var p = e.pressure || 0;
      if (p > 0) return Math.max(1.5, p * 5);
      var pt = e.pointerType || (e.touches ? 'touch' : 'mouse');
      return pt === 'touch' ? 3 : 2;
    }
    function startDraw(clientX, clientY, e) {
      drawing = true;
      applyMode();
      var p = pos(clientX, clientY);
      lastX = p.x;
      lastY = p.y;
      ctx.lineWidth = widthFor(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
    function moveDraw(clientX, clientY, e) {
      if (!drawing) return;
      applyMode();
      var p = pos(clientX, clientY);
      ctx.lineWidth = widthFor(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    }
    function endDraw(clientX, clientY) {
      if (!drawing) return;
      if (clientX != null && clientY != null) {
        var p = pos(clientX, clientY);
        if (Math.abs(p.x - lastX) > 0.1 || Math.abs(p.y - lastY) > 0.1) {
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
      drawing = false;
    }
    function onPointerDown(e) {
      var curW = parseInt(canvas.style.width, 10);
      var curH = parseInt(canvas.style.height, 10);
      if (curW !== wrap.clientWidth || curH !== wrap.clientHeight) resizeCanvas();
      e.preventDefault();
      startDraw(e.clientX, e.clientY, e);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    function onPointerMove(e) {
      if (!drawing) return;
      e.preventDefault();
      moveDraw(e.clientX, e.clientY, e);
    }
    function onPointerUp(e) {
      endDraw(e.clientX, e.clientY);
    }
    function onTouchStart(e) {
      if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        var t = e.touches[0];
        startDraw(t.clientX, t.clientY, { touches: e.touches, pressure: t.force || 0 });
      }
    }
    function onTouchMove(e) {
      if (!drawing) return;
      if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        var t = e.touches[0];
        moveDraw(t.clientX, t.clientY, { touches: e.touches, pressure: t.force || 0 });
      }
    }
    function onTouchEnd(e) {
      var cx = null, cy = null;
      if (e.changedTouches && e.changedTouches.length > 0) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      }
      endDraw(cx, cy);
    }
    function onLeave(e) { if (drawing) drawing = false; }
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    var resizeTimer = null;
    var winResize = function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resizeCanvas(); }, 150);
    };
    window.addEventListener('resize', winResize);
    window.addEventListener('orientationchange', winResize);
  }

  function renderStats() {
    var qs = state.questions;
    var today = todayStr();
    var done = qs.filter(function (q) { return q.status === 'done'; }).length;
    var pending = qs.length - done;
    var overdue = qs.filter(function (q) { return q.status === 'pending' && q.reviewDate < today; }).length;
    var dueToday = qs.filter(function (q) { return q.status === 'pending' && q.reviewDate === today; }).length;
    var rate = qs.length ? Math.round(done / qs.length * 100) : 0;

    var html = '<div class="stat-grid">' +
      '<div class="stat-cell blue"><div class="num">' + qs.length + '</div><div class="lbl">错题总数</div></div>' +
      '<div class="stat-cell orange"><div class="num">' + pending + '</div><div class="lbl">待复盘</div></div>' +
      '<div class="stat-cell green"><div class="num">' + rate + '%</div><div class="lbl">复盘完成率</div></div>' +
      '<div class="stat-cell red"><div class="num">' + (overdue + dueToday) + '</div><div class="lbl">今天应复盘</div></div>' +
      '</div>';

    html += '<div class="section-title">分类统计</div><div class="card">';
    var max = 1;
    CATEGORIES.forEach(function (c) {
      var n = qs.filter(function (q) { return q.category === c; }).length;
      if (n > max) max = n;
    });
    CATEGORIES.forEach(function (c) {
      var arr = qs.filter(function (q) { return q.category === c; });
      var d = arr.filter(function (q) { return q.status === 'done'; }).length;
      html += '<div class="cat-bar-row">' +
        '<span class="name">' + c + '</span>' +
        '<div class="bar-bg"><div class="bar" style="width:' + Math.round(arr.length / max * 100) + '%;background:' + CAT_COLORS[c] + '"></div></div>' +
        '<span class="n">' + d + '/' + arr.length + '</span>' +
        '</div>';
    });
    html += '<button class="btn mt12" data-act="aiAnalyze">' + (state.aiAnalyzing ? 'AI 分析中…' : 'AI 分析学习情况') + '</button>';
    html += '</div>';

    if (state.aiAnalysis) {
      html += '<div class="section-title">AI 学习分析</div><div class="card">';
      html += '<div class="ai-msg bot" style="padding:0;background:none">' + mdRender(state.aiAnalysis) + '</div>';
      html += '<button class="btn gray sm mt12" data-act="clearAiAnalysis">收起分析</button>';
      html += '</div>';
    }

    html += '<div class="section-title">数据备份</div><div class="card">';
    html += '<div class="btn-row">' +
      '<button class="btn ghost" data-act="export">导出备份</button>' +
      '<button class="btn gray" data-act="import">导入备份</button>' +
      '</div>';
    html += '<p class="muted mt12">数据保存在本机。建议定期导出备份，卸载应用或清理数据前请先导出。</p>';
    html += '</div>';

    var history = [];
    qs.forEach(function (q) {
      (q.reviewHistory || []).forEach(function (h) {
        history.push({ date: h.date, correct: h.correct, cat: q.category });
      });
    });
    history.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (history.length) {
      html += '<div class="section-title">最近复盘记录</div><div class="card">';
      history.slice(0, 15).forEach(function (h) {
        html += '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13.5px">' +
          '<span>' + h.date + '</span>' +
          '<span style="color:' + CAT_COLORS[h.cat] + '">' + h.cat + '</span>' +
          '<span style="color:' + (h.correct ? 'var(--ok)' : 'var(--danger)') + ';font-weight:600">' + (h.correct ? '答对' : '答错') + '</span>' +
          '</div>';
      });
      html += '</div>';
    }
    return html;
  }

  function renderCalc() {
    var h = state.calc;
    var today = todayStr();
    var todayRecords = h.history.filter(function (r) { return r.date === today; });
    var totalCorrect = todayRecords.filter(function (r) { return r.correct; }).length;
    var totalToday = todayRecords.length;
    var rateToday = totalToday > 0 ? Math.round(totalCorrect / totalToday * 100) : 0;

    var html = '<div class="calc-page">';
    html += '<div class="stat-grid">';
    html += '<div class="stat-cell blue"><div class="num">' + totalToday + '</div><div class="lbl">今日练习</div></div>';
    html += '<div class="stat-cell green"><div class="num">' + rateToday + '%</div><div class="lbl">今日准确率</div></div>';
    html += '</div>';

    html += '<div class="section-title">速算练习</div><div class="card">';
    html += '<p class="muted" style="margin-bottom:12px">随机乘法练习，快速计算两位数乘法。</p>';

    if (!h.current) {
      html += '<button class="btn" data-act="startCalc">开始练习</button>';
    } else {
      var q = h.current;
      var elapsed = h.startTime > 0 ? ((Date.now() - h.startTime) / 1000).toFixed(1) : 0;
      html += '<div class="calc-question">';
      html += '<p class="calc-stem">' + esc(q.stem) + '</p>';
      html += '<div class="calc-timer">⏱ ' + elapsed + 's</div>';
      html += '<div class="field mt12"><input class="input" id="calc-answer" type="number" placeholder="输入答案"></div>';
      if (!h.answered) {
        html += '<button class="btn" data-act="submitCalc">提交答案</button>';
      } else {
        var userInput = $('#calc-answer') ? $('#calc-answer').value : '';
        userInput = String(userInput || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d.-]/g, '');
        var userVal = parseFloat(userInput);
        var relErr = h.current.answer !== 0 ? Math.abs(userVal - h.current.answer) / h.current.answer * 100 : 0;
        var ok = relErr <= 2;
        html += '<div class="calc-result ' + (ok ? 'correct' : 'wrong') + '">';
        html += '<p>你的答案：' + (h.userAnswer || '-') + '　正确答案：' + h.current.answer + '</p>';
        html += '<p>' + (ok ? '回答正确！' : '回答错误') + '</p>';
        html += '<p>用时：' + h.elapsed + 's</p>';
        html += '</div>';
        html += '<button class="btn" data-act="nextCalc">下一题</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    if (todayRecords.length > 0) {
      html += '<div class="section-title">今日练习记录 (' + todayRecords.length + '题)</div><div class="card">';
      todayRecords.forEach(function (r, idx) {
        var globalIdx = h.history.indexOf(r);
        html += '<div class="calc-record">';
        html += '<span>' + esc(r.stem) + '</span>';
        html += '<span class="' + (r.correct ? 'ok' : 'danger') + '">' + (r.correct ? '✓' : '✗') + ' ' + r.elapsed + 's</span>';
        html += '<button class="btn danger sm" data-act="delCalcRecord" data-i="' + globalIdx + '">删除</button>';
        html += '</div>';
      });
      html += '<button class="btn danger sm mt12" data-act="clearCalcHistory">清空全部记录</button>';
      html += '</div>';
    }

    if (h.history.length > todayRecords.length) {
      var olderRecords = h.history.filter(function (r) { return r.date !== today; });
      html += '<div class="section-title">历史记录 (' + olderRecords.length + '题)</div><div class="card">';
      olderRecords.slice(-20).forEach(function (r) {
        var globalIdx = h.history.indexOf(r);
        html += '<div class="calc-record">';
        html += '<span>' + esc(r.stem) + ' <span class="muted">' + r.date + '</span></span>';
        html += '<span class="' + (r.correct ? 'ok' : 'danger') + '">' + (r.correct ? '✓' : '✗') + ' ' + r.elapsed + 's</span>';
        html += '<button class="btn danger sm" data-act="delCalcRecord" data-i="' + globalIdx + '">删除</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += renderCalcChart();
    html += '</div>';
    return html;
  }

  function renderCalcChart() {
    var h = state.calc.history;
    if (h.length < 2) return '<div class="card" style="text-align:center"><p class="muted">完成更多练习后显示趋势图</p></div>';

    var dateMap = {};
    h.forEach(function (r) {
      if (!dateMap[r.date]) dateMap[r.date] = { total: 0, correct: 0 };
      dateMap[r.date].total++;
      if (r.correct) dateMap[r.date].correct++;
    });

    var dates = Object.keys(dateMap).sort().slice(-7);
    if (dates.length < 2) return '<div class="card" style="text-align:center"><p class="muted">需要至少2天数据才能显示趋势</p></div>';

    var rates = dates.map(function (d) { return dateMap[d].total > 0 ? Math.round(dateMap[d].correct / dateMap[d].total * 100) : 0; });
    var maxRate = 100;
    var chartW = 300, chartH = 150, padL = 40, padB = 30;
    var plotW = chartW - padL - 10;
    var plotH = chartH - padB - 10;

    var points = rates.map(function (r, i) {
      var x = padL + (i / (rates.length - 1)) * plotW;
      var y = 10 + plotH * (1 - r / maxRate);
      return x + ',' + y;
    }).join(' ');

    var html = '<div class="section-title">近7日准确率趋势</div><div class="card">';
    html += '<svg class="calc-chart" viewBox="0 0 ' + chartW + ' ' + chartH + '">';
    html += '<line x1="' + padL + '" y1="10" x2="' + padL + '" y2="' + (10 + plotH) + '" stroke="#e5e9f2" stroke-width="1"/>';
    html += '<line x1="' + padL + '" y1="' + (10 + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (10 + plotH) + '" stroke="#e5e9f2" stroke-width="1"/>';
    html += '<polyline points="' + points + '" fill="none" stroke="#4f6ef7" stroke-width="2" stroke-linejoin="round"/>';
    dates.forEach(function (d, i) {
      var x = padL + (i / (rates.length - 1)) * plotW;
      var y = 10 + plotH * (1 - rates[i] / maxRate);
      html += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#4f6ef7"/>';
      html += '<text x="' + x + '" y="' + (chartH - 5) + '" text-anchor="middle" font-size="9" fill="#8a93a6">' + d.substring(5) + '</text>';
      html += '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" font-size="9" fill="#4f6ef7">' + rates[i] + '%</text>';
    });
    html += '</svg>';
    html += '</div>';
    return html;
  }

  function generateCalcQuestion() {
    var num1 = Math.floor(Math.random() * 90) + 10;
    var num2 = Math.floor(Math.random() * 90) + 10;
    var answer = num1 * num2;
    return { stem: num1 + ' × ' + num2 + ' = ?', answer: answer };
  }

  var FALLBACK_IDIOMS = [
    { name: '马到成功', pinyin: 'mǎ dào chéng gōng', meaning: '形容工作刚开始就取得成功。', provenance: '元·无名氏《小尉迟》第二折', example: '祝各位考生马到成功！' },
    { name: '一心一意', pinyin: 'yī xīn yī yì', meaning: '只有一个心眼儿，没有别的考虑。形容做事专心致志。', provenance: '《三国志·魏志·杜恕传》', example: '他做事一心一意，从不分心。' },
    { name: '一鼓作气', pinyin: 'yī gǔ zuò qì', meaning: '比喻趁劲头大的时候鼓起干劲，一口气把工作做完。', provenance: '《左传·庄公十年》', example: '我们要一鼓作气，趁热打铁。' },
    { name: '水滴石穿', pinyin: 'shuǐ dī shí chuān', meaning: '比喻只要坚持不懈，细微之力也能做出很难办的事。', provenance: '宋·罗大经《鹤林玉露》', example: '学习贵在坚持，水滴石穿。' },
    { name: '持之以恒', pinyin: 'chí zhī yǐ héng', meaning: '长久地坚持下去。', provenance: '清·曾国藩《家训喻纪泽》', example: '学习要持之以恒，不能三天打鱼两天晒网。' },
    { name: '胸有成竹', pinyin: 'xiōng yǒu chéng zhú', meaning: '比喻做事之前已经有了主意和把握。', provenance: '宋·苏轼《文与可画筼筜谷偃竹记》', example: '他考试时胸有成竹，毫不紧张。' },
    { name: '按部就班', pinyin: 'àn bù jiù bān', meaning: '指按照一定的步骤、顺序进行。也指按老规矩办事，缺乏创新精神。', provenance: '晋·陆机《文赋》', example: '做事要按部就班，稳扎稳打。' },
    { name: '不遗余力', pinyin: 'bù yí yú lì', meaning: '把全部力量都使出来，一点不保留。', provenance: '《战国策·赵策三》', example: '他为了备考不遗余力。' },
    { name: '独辟蹊径', pinyin: 'dú pì xī jìng', meaning: '自己开辟一条路。比喻独创一种新风格或者新方法。', provenance: '清·叶燮《原诗》', example: '这篇文章独辟蹊径，令人耳目一新。' },
    { name: '废寝忘食', pinyin: 'fèi qǐn wàng shí', meaning: '顾不上睡觉，忘记了吃饭。形容非常专心努力。', provenance: '《列子·开瑞篇》', example: '他复习备考废寝忘食。' },
    { name: '各抒己见', pinyin: 'gè shū jǐ jiàn', meaning: '各人充分发表自己的意见。', provenance: '清·李汝珍《镜花缘》', example: '讨论会上大家各抒己见。' },
    { name: '画蛇添足', pinyin: 'huà shé tiān zú', meaning: '比喻做了多余的事，非但无益，反而不合适。', provenance: '《战国策·齐策二》', example: '文章结尾再补一段反而画蛇添足。' },
    { name: '精益求精', pinyin: 'jīng yì qiú jīng', meaning: '好了还求更好。', provenance: '《论语·学而》', example: '他对每个知识点都精益求精。' },
    { name: '开卷有益', pinyin: 'kāi juàn yǒu yì', meaning: '打开书本阅读，就会有益处。', provenance: '宋·王辟之《渑水燕谈录》', example: '多读书总是开卷有益的。' },
    { name: '量力而行', pinyin: 'liàng lì ér xíng', meaning: '按照自己力量的大小去做，不要勉强。', provenance: '《左传·昭公十五年》', example: '定目标要量力而行。' },
    { name: '名列前茅', pinyin: 'míng liè qián máo', meaning: '比喻名次列在前面。', provenance: '《左传·宣公十二年》', example: '他在班级考试中名列前茅。' },
    { name: '南辕北辙', pinyin: 'nán yuán běi zhé', meaning: '比喻行动和目的正好相反。', provenance: '《战国策·魏策四》', example: '方向错了，再努力也是南辕北辙。' },
    { name: '破釜沉舟', pinyin: 'pò fǔ chén zhōu', meaning: '比喻下决心不顾一切地干到底。', provenance: '《史记·项羽本纪》', example: '备考最后阶段要有破釜沉舟的决心。' },
    { name: '锲而不舍', pinyin: 'qiè ér bù shě', meaning: '比喻有恒心，有毅力，坚持不懈。', provenance: '《荀子·劝学》', example: '锲而不舍，金石可镂。' },
    { name: '融会贯通', pinyin: 'róng huì guàn tōng', meaning: '把各方面的知识或道理融合贯穿起来，从而得到全面透彻的理解。', provenance: '宋·朱熹《朱子全书》', example: '学习要融会贯通，不能死记硬背。' },
    { name: '事半功倍', pinyin: 'shì bàn gōng bèi', meaning: '指做事得法，因而费力小，收效大。', provenance: '《孟子·公孙丑上》', example: '掌握方法才能事半功倍。' },
    { name: '守株待兔', pinyin: 'shǒu zhū dài tù', meaning: '比喻死守狭隘经验，不知变通，或抱着侥幸心理妄想不劳而获。', provenance: '《韩非子·五蠹》', example: '不能守株待兔，要主动出击。' },
    { name: '脱颖而出', pinyin: 'tuō yǐng ér chū', meaning: '比喻人的才能全部显露出来。', provenance: '《史记·平原君虞卿列传》', example: '他在面试中脱颖而出。' },
    { name: '温故知新', pinyin: 'wēn gù zhī xīn', meaning: '温习旧的知识，能有新的体会和发现。', provenance: '《论语·为政》', example: '温故知新是复习的好方法。' },
    { name: '循序渐进', pinyin: 'xún xù jiàn jìn', meaning: '指学习工作等按照一定的步骤逐渐深入或提高。', provenance: '《论语·宪问》', example: '学习要循序渐进，打好基础。' },
    { name: '一针见血', pinyin: 'yī zhēn jiàn xiě', meaning: '比喻说话直截了当，切中要害。', provenance: '晋·陈寿《三国志》', example: '老师的点评一针见血。' },
    { name: '凿壁偷光', pinyin: 'záo bì tōu guāng', meaning: '形容家贫而读书刻苦。', provenance: '《西京杂记》卷二', example: '他凿壁偷光般刻苦学习。' },
    { name: '专心致志', pinyin: 'zhuān xīn zhì zhì', meaning: '把心思全放在上面，一心一意。', provenance: '《孟子·告子上》', example: '上课要专心致志听讲。' },
    { name: '未雨绸缪', pinyin: 'wèi yǔ chóu móu', meaning: '比喻事先做好准备。', provenance: '《诗经·豳风·鸱鸮》', example: '备考要未雨绸缪，提前规划。' },
    { name: '一丝不苟', pinyin: 'yī sī bù gǒu', meaning: '形容办事认真细致，一点儿不马虎。', provenance: '清·吴敬梓《儒林外史》', example: '审题时要一丝不苟。' },
    { name: '寸积铢累', pinyin: 'cùn jī zhū lěi', meaning: '一寸一铢地积累起来。形容一点一滴地积累。', provenance: '宋·李纲《上渊圣皇帝实封言事奏状》', example: '词汇量要靠平时寸积铢累。' },
    { name: '相辅相成', pinyin: 'xiāng fǔ xiāng chéng', meaning: '两件事物互相配合，互相补充，缺一不可。', provenance: '清·梁启超《初归国演说辞》', example: '实践与理论相辅相成，缺一不可。' },
    { name: '按图索骥', pinyin: 'àn tú suǒ jì', meaning: '按照图像去寻找好马。比喻按线索去寻找；也比喻办事机械死板。', provenance: '明·杨慎《艺林伐山》', example: '不能按图索骥，要灵活变通。' },
    { name: '抱残守缺', pinyin: 'bào cán shǒu quē', meaning: '抱着残缺陈旧的东西不放。形容思想保守，不求改进。', provenance: '《汉书·刘歆传》', example: '要敢于创新，不能抱残守缺。' },
    { name: '标新立异', pinyin: 'biāo xīn lì yì', meaning: '提出新奇的主张，表示与众不同。有时含贬义。', provenance: '南朝宋·刘义庆《世说新语·文学》', example: '他总爱标新立异，吸引眼球。' },
    { name: '层出不穷', pinyin: 'céng chū bù qióng', meaning: '接连不断地出现，没有穷尽。', provenance: '清·纪昀《阅微草堂笔记》', example: '新题型层出不穷，要多加练习。' },
    { name: '出类拔萃', pinyin: 'chū lèi bá cuì', meaning: '超出同类之上，多指人的品德才能。', provenance: '《孟子·公孙丑上》', example: '他在众多考生中出类拔萃。' },
    { name: '沧海一粟', pinyin: 'cāng hǎi yī sù', meaning: '大海里的一粒谷子。比喻非常渺小。', provenance: '宋·苏轼《赤壁赋》', example: '个人的力量不过是沧海一粟。' },
    { name: '大相径庭', pinyin: 'dà xiāng jìng tíng', meaning: '比喻彼此相差很远，大不相同。', provenance: '《庄子·逍遥游》', example: '两人的观点大相径庭。' },
    { name: '得陇望蜀', pinyin: 'dé lǒng wàng shǔ', meaning: '比喻贪得无厌，得寸进尺。', provenance: '《后汉书·岑彭传》', example: '做人不能得陇望蜀。' },
    { name: '东山再起', pinyin: 'dōng shān zài qǐ', meaning: '比喻失势后重新恢复地位或再次崛起。', provenance: '《晋书·谢安传》', example: '失败并不可怕，还可东山再起。' },
    { name: '独树一帜', pinyin: 'dú shù yī zhì', meaning: '单独树立起一面旗帜。比喻自成一家。', provenance: '清·袁枚《随园诗话》', example: '他的答题风格独树一帜。' },
    { name: '耳目一新', pinyin: 'ěr mù yī xīn', meaning: '听到的看到的都换了样子。形容面貌焕然一新。', provenance: '清·李渔《闲情偶寄》', example: '新版教材让人耳目一新。' },
    { name: '方兴未艾', pinyin: 'fāng xīng wèi ài', meaning: '事物正在发展，尚未达到止境。', provenance: '宋·陈亮《上孝宗皇帝书》', example: '网络直播行业方兴未艾。' },
    { name: '釜底抽薪', pinyin: 'fǔ dǐ chōu xīn', meaning: '从锅底抽掉柴火。比喻从根本上解决问题。', provenance: '《吕氏春秋·尽数》', example: '要釜底抽薪，从源头治理。' },
    { name: '刚愎自用', pinyin: 'gāng bì zì yòng', meaning: '固执己见，自以为是。', provenance: '《左传·宣公十二年》', example: '领导不能刚愎自用，要集思广益。' },
    { name: '高瞻远瞩', pinyin: 'gāo zhān yuǎn zhǔ', meaning: '站得高，看得远。比喻眼光远大。', provenance: '汉·王充《论衡·别通篇》', example: '做决策要高瞻远瞩。' },
    { name: '功亏一篑', pinyin: 'gōng kuī yī kuì', meaning: '堆九仞高的山只差一筐土。比喻做事只差最后一点没能完成。', provenance: '《尚书·旅獒》', example: '越是最后关头越要坚持，否则功亏一篑。' },
    { name: '孤注一掷', pinyin: 'gū zhù yī zhì', meaning: '把所有的钱一次押上去。比喻在危急时用尽所有力量作最后一次冒险。', provenance: '《宋史·寇准传》', example: '备考不能靠孤注一掷，要稳扎稳打。' },
    { name: '顾此失彼', pinyin: 'gù cǐ shī bǐ', meaning: '顾了这个，丢了那个。形容无法全面照顾。', provenance: '明·冯梦龙《东周列国志》', example: '工作太多，难免顾此失彼。' },
    { name: '故步自封', pinyin: 'gù bù zì fēng', meaning: '比喻守着老一套，不求进步。', provenance: '《汉书·叙传》', example: '不能故步自封，要不断学习。' },
    { name: '瓜熟蒂落', pinyin: 'guā shú dì luò', meaning: '瓜熟透了，瓜蒂自然脱落。比喻条件具备时机成熟，事情自然成功。', provenance: '清·翟灏《通俗编·草木》', example: '复习充分了，成绩自然瓜熟蒂落。' },
    { name: '冠冕堂皇', pinyin: 'guān miǎn táng huáng', meaning: '形容外表庄严体面的样子，多含贬义。', provenance: '清·李宝嘉《官场现形记》', example: '他说得冠冕堂皇，实际另有目的。' },
    { name: '光怪陆离', pinyin: 'guāng guài lù lí', meaning: '形容奇形怪状，五颜六色，现象奇异。', provenance: '战国楚·屈原《离骚》', example: '展会上各种展品光怪陆离。' },
    { name: '讳莫如深', pinyin: 'huì mò rú shēn', meaning: '把事情隐瞒得很紧，唯恐别人知道。', provenance: '《谷梁传·庄公三十二年》', example: '他对此事讳莫如深，只字不提。' },
    { name: '见贤思齐', pinyin: 'jiàn xián sī qí', meaning: '见到德才兼备的人就要向他看齐。', provenance: '《论语·里仁》', example: '要向优秀的人学习，见贤思齐。' },
    { name: '矫枉过正', pinyin: 'jiǎo wǎng guò zhèng', meaning: '纠正偏差做得过了头，反而超出合理范围。', provenance: '《后汉书·仲长统传》', example: '整顿要适度，不能矫枉过正。' },
    { name: '截然不同', pinyin: 'jié rán bù tóng', meaning: '界限分明，完全不一样。', provenance: '清·梁启超《论国家思想》', example: '两人的性格截然不同。' },
    { name: '竭泽而渔', pinyin: 'jié zé ér yú', meaning: '排干湖水捉鱼。比喻只顾眼前利益，不顾长远打算。', provenance: '《吕氏春秋·义赏》', example: '开发资源不能竭泽而渔。' },
    { name: '津津有味', pinyin: 'jīn jīn yǒu wèi', meaning: '形容兴趣浓厚，很有滋味。', provenance: '明·朱之瑜《朱舜水集》', example: '他看书看得津津有味。' },
    { name: '锦上添花', pinyin: 'jǐn shàng tiān huā', meaning: '在锦上再绣花。比喻好上加好，美上加美。', provenance: '宋·黄庭坚《了了庵颂》', example: '品牌知名度高，宣传只是锦上添花。' },
    { name: '尽善尽美', pinyin: 'jìn shàn jìn měi', meaning: '形容事物完美无缺。', provenance: '《论语·八佾》', example: '任何方案都难做到尽善尽美。' },
    { name: '居安思危', pinyin: 'jū ān sī wēi', meaning: '处在安乐的环境中要想到可能有的危险。', provenance: '《左传·襄公十一年》', example: '企业要居安思危，未雨绸缪。' },
    { name: '举世闻名', pinyin: 'jǔ shì wén míng', meaning: '全世界都知道。形容非常著名。', provenance: '《庄子·逍遥游》', example: '这座古城举世闻名。' },
    { name: '举一反三', pinyin: 'jǔ yī fǎn sān', meaning: '比喻善于类推，能由此及彼，触类旁通。', provenance: '《论语·述而》', example: '做题要举一反三，掌握方法。' },
    { name: '刻舟求剑', pinyin: 'kè zhōu qiú jiàn', meaning: '比喻拘泥成例，不知变通。', provenance: '《吕氏春秋·察今》', example: '情况变了，不能刻舟求剑。' },
    { name: '空穴来风', pinyin: 'kōng xué lái fēng', meaning: '有了洞穴才进风。比喻消息和传说不是完全没有原因的，现多指毫无根据。', provenance: '战国楚·宋玉《风赋》', example: '此事空穴来风，不可轻信。' },
    { name: '口若悬河', pinyin: 'kǒu ruò xuán hé', meaning: '说话像瀑布流泻一样滔滔不绝。形容能言善辩。', provenance: '南朝宋·刘义庆《世说新语·赏誉》', example: '他演讲时口若悬河。' },
    { name: '脍炙人口', pinyin: 'kuài zhì rén kǒu', meaning: '比喻好的诗文或事物，人人都称赞。', provenance: '五代·王定保《唐摭言》', example: '这篇名作脍炙人口。' },
    { name: '滥竽充数', pinyin: 'làn yú chōng shù', meaning: '比喻没有真才实学的人混在行家里面充数，或拿不好的东西混在好的里面充数。', provenance: '《韩非子·内储说上》', example: '要凭真本事，不能滥竽充数。' },
    { name: '老生常谈', pinyin: 'lǎo shēng cháng tán', meaning: '老书生经常说的话。比喻人们听惯了的没有新鲜意思的话。', provenance: '《三国志·魏志·管辂传》', example: '这些话虽是老生常谈，却句句在理。' },
    { name: '乐不思蜀', pinyin: 'lè bù sī shǔ', meaning: '比喻在新环境中得到乐趣，不再想回到原来环境中去。', provenance: '《三国志·蜀志·后主传》', example: '他玩得乐不思蜀，忘了学习。' },
    { name: '理直气壮', pinyin: 'lǐ zhí qì zhuàng', meaning: '理由充分，说话气势就壮。', provenance: '明·冯梦龙《醒世恒言》', example: '他理直气壮地反驳了对方。' },
    { name: '力挽狂澜', pinyin: 'lì wǎn kuáng lán', meaning: '比喻尽力挽回危险的局势。', provenance: '唐·韩愈《进学解》', example: '危急时刻他力挽狂澜。' },
    { name: '淋漓尽致', pinyin: 'lín lí jìn zhì', meaning: '形容文章或说话表达得非常充分、透彻。', provenance: '明·李贽《读孙武子发凡》', example: '文章把人物心理刻画得淋漓尽致。' },
    { name: '鳞次栉比', pinyin: 'lín cì zhì bǐ', meaning: '像鱼鳞和梳子齿那样有次序地排列着。多形容房屋排列得很密很整齐。', provenance: '《诗经·周颂·良耜》', example: '两岸高楼鳞次栉比。' },
    { name: '流连忘返', pinyin: 'liú lián wàng fǎn', meaning: '留恋不止，忘了回去。', provenance: '《孟子·梁惠王下》', example: '这里的景色令人流连忘返。' },
    { name: '马首是瞻', pinyin: 'mǎ shǒu shì zhān', meaning: '原指作战时士卒看着主将的马头行事。后比喻服从指挥或乐于追随。', provenance: '《左传·襄公十四年》', example: '全体员工以他为马首是瞻。' },
    { name: '墨守成规', pinyin: 'mò shǒu chéng guī', meaning: '指思想保守，守着老规矩不肯改变。', provenance: '《战国策·齐策六》', example: '管理要创新，不能墨守成规。' },
    { name: '目中无人', pinyin: 'mù zhōng wú rén', meaning: '眼里没有别人。形容骄傲自大，看不起人。', provenance: '明·冯梦龙《东周列国志》', example: '他取得一点成绩就目中无人。' },
    { name: '沐猴而冠', pinyin: 'mù hóu ér guàn', meaning: '猕猴戴帽子。比喻装扮得像人，实际却虚有其表。', provenance: '《史记·项羽本纪》', example: '他不过是沐猴而冠，并无真才实学。' },
    { name: '难能可贵', pinyin: 'nán néng kě guì', meaning: '不容易做到的事居然能做到，非常可贵。', provenance: '宋·苏轼《与谢民师推官书》', example: '他坚持自学成才，难能可贵。' },
    { name: '能屈能伸', pinyin: 'néng qū néng shēn', meaning: '能弯曲也能伸直。指人在失意时能忍耐，得志时能大干一番。', provenance: '《易·系辞下》', example: '做人要能屈能伸，拿得起放得下。' },
    { name: '弄巧成拙', pinyin: 'nòng qiǎo chéng zhuō', meaning: '本想耍弄聪明，结果反而做了蠢事。', provenance: '宋·黄庭坚《拙轩颂》', example: '他自作聪明，反而弄巧成拙。' },
    { name: '抛砖引玉', pinyin: 'pāo zhuān yǐn yù', meaning: '比喻用粗浅的、不成熟的意见引出别人高明的意见。', provenance: '宋·释道原《景德传灯录》', example: '我先发言，算是抛砖引玉。' },
    { name: '披星戴月', pinyin: 'pī xīng dài yuè', meaning: '身披星星，头戴月亮。形容连夜奔波或早出晚归，十分辛苦。', provenance: '元·无名氏《冤家债主》', example: '他披星戴月地赶路赴考。' },
    { name: '蓬荜生辉', pinyin: 'péng bì shēng huī', meaning: '使寒门增添光辉。多用作宾客来到家里时的客套话。', provenance: '元·秦简夫《剪发待宾》', example: '您大驾光临，令寒舍蓬荜生辉。' },
    { name: '平易近人', pinyin: 'píng yì jìn rén', meaning: '态度谦逊和蔼，使人容易接近。也形容文字深入浅出。', provenance: '《史记·鲁周公世家》', example: '这位领导平易近人，没有架子。' },
    { name: '扑朔迷离', pinyin: 'pū shuò mí lí', meaning: '形容事情错综复杂，难以辨别清楚。', provenance: '《木兰诗》', example: '案件扑朔迷离，一时难以定论。' },
    { name: '杞人忧天', pinyin: 'qǐ rén yōu tiān', meaning: '比喻不必要的或缺乏根据的忧虑和担心。', provenance: '《列子·天瑞》', example: '别杞人忧天，船到桥头自然直。' },
    { name: '千钧一发', pinyin: 'qiān jūn yī fà', meaning: '比喻情况万分危急。', provenance: '《汉书·枚乘传》', example: '千钧一发之际，他果断出手。' },
    { name: '前车之鉴', pinyin: 'qián chē zhī jiàn', meaning: '前面翻车的教训。比喻先前的失败可以作为以后的教训。', provenance: '《汉书·贾谊传》', example: '别人的失败要引为前车之鉴。' },
    { name: '潜移默化', pinyin: 'qián yí mò huà', meaning: '人的思想或性格在不知不觉中受到影响而发生变化。', provenance: '北齐·颜之推《颜氏家训》', example: '家庭环境对孩子有潜移默化的影响。' },
    { name: '浅尝辄止', pinyin: 'qiǎn cháng zhé zhǐ', meaning: '略微尝试一下就停下来。指不深入钻研。', provenance: '清·彭养鸥《黑籍冤魂》', example: '学习不能浅尝辄止，要深入研究。' },
    { name: '强弩之末', pinyin: 'qiáng nǔ zhī mò', meaning: '比喻强大的力量已经衰弱，起不了什么作用。', provenance: '《史记·韩长孺列传》', example: '敌军已是强弩之末，不足为惧。' },
    { name: '巧夺天工', pinyin: 'qiǎo duó tiān gōng', meaning: '人工的精巧胜过天然。形容技艺十分巧妙。', provenance: '元·赵孟頫《赠放烟火者》', example: '这些手工艺品巧夺天工。' },
    { name: '轻描淡写', pinyin: 'qīng miáo dàn xiě', meaning: '原指绘画时用浅淡的颜色轻轻描绘。现多指把重要问题轻轻带过。', provenance: '清·吴敬梓《儒林外史》', example: '他对自己的失误轻描淡写。' },
    { name: '情有独钟', pinyin: 'qíng yǒu dú zhōng', meaning: '指在某一事物上感情特别专注。', provenance: '宋·朱熹《中庸章句集注》', example: '他对古典文学情有独钟。' },
    { name: '穷兵黩武', pinyin: 'qióng bīng dú wǔ', meaning: '随意使用武力，不断发动侵略战争。', provenance: '《三国志·吴志·陆抗传》', example: '统治者穷兵黩武，民不聊生。' },
    { name: '曲高和寡', pinyin: 'qǔ gāo hè guǎ', meaning: '曲调高雅，能跟着唱的人就少。比喻言论或作品不通俗，能了解的人很少。', provenance: '战国楚·宋玉《对楚王问》', example: '他的文章曲高和寡，读者不多。' },
    { name: '全力以赴', pinyin: 'quán lì yǐ fù', meaning: '把全部力量都投入进去。', provenance: '清·赵尔巽《清史稿》', example: '备考最后阶段要全力以赴。' },
    { name: '忍俊不禁', pinyin: 'rěn jùn bù jīn', meaning: '忍不住要发笑。', provenance: '唐·赵璘《因话录》', example: '他讲的笑话让大家忍俊不禁。' },
    { name: '任重道远', pinyin: 'rèn zhòng dào yuǎn', meaning: '担子很重，路程很远。比喻责任重大，要经历长期的奋斗。', provenance: '《论语·泰伯》', example: '教育改革任重道远。' },
    { name: '如虎添翼', pinyin: 'rú hǔ tiān yì', meaning: '好像老虎长上了翅膀。比喻强有力的人得到帮助后变得更加强大。', provenance: '三国蜀·诸葛亮《心书·兵机》', example: '引进了人才，公司如虎添翼。' },
    { name: '如鱼得水', pinyin: 'rú yú dé shuǐ', meaning: '好像鱼得到水一样。比喻得到跟自己十分投合的人或很合适的环境。', provenance: '《三国志·蜀志·诸葛亮传》', example: '他进了研究所，如鱼得水。' },
    { name: '孺子可教', pinyin: 'rú zǐ kě jiào', meaning: '小孩子是可以教诲的。后形容年轻人有出息，可以造就。', provenance: '《史记·留侯世家》', example: '老师夸他孺子可教。' },
    { name: '三顾茅庐', pinyin: 'sān gù máo lú', meaning: '比喻真心诚意，一再邀请、拜访有专长的贤人。', provenance: '《三国志·蜀志·诸葛亮传》', example: '他三顾茅庐，终于请来了专家。' },
    { name: '赏心悦目', pinyin: 'shǎng xīn yuè mù', meaning: '看了使人感到心情舒畅、愉快。', provenance: '清·李渔《闲情偶寄》', example: '公园景色赏心悦目。' },
    { name: '舍本逐末', pinyin: 'shě běn zhú mò', meaning: '抛弃根本的、主要的，而去追求枝节的、次要的。比喻轻重倒置。', provenance: '《汉书·食货志》', example: '复习不能舍本逐末，忽视基础。' },
    { name: '身临其境', pinyin: 'shēn lín qí jìng', meaning: '亲身面临那种境地。', provenance: '明·冯梦龙《警世通言》', example: '读到这段，仿佛身临其境。' },
    { name: '审时度势', pinyin: 'shěn shí duó shì', meaning: '观察分析时势，估计情况的变化。', provenance: '清·洪仁玕《资政新篇》', example: '要审时度势，抓住机遇。' },
    { name: '拾人牙慧', pinyin: 'shí rén yá huì', meaning: '拾取别人的一言半语当作自己的话。比喻窃取别人的语言和文字。', provenance: '南朝宋·刘义庆《世说新语·文学》', example: '写论文不能拾人牙慧。' },
    { name: '首屈一指', pinyin: 'shǒu qū yī zhǐ', meaning: '扳指头计算，首先弯下大拇指。表示第一。', provenance: '清·李宝嘉《官场现形记》', example: '他在这个领域首屈一指。' },
    { name: '束手无策', pinyin: 'shù shǒu wú cè', meaning: '遇到问题，就像手被捆住一样，一点办法也没有。', provenance: '宋·王柏《鲁斋集》', example: '面对突发状况，他束手无策。' },
    { name: '熟视无睹', pinyin: 'shú shì wú dǔ', meaning: '经常看见，却像没看见一样。形容对眼前的事物漫不经心。', provenance: '晋·刘琨《请诛石勒表》', example: '对存在的问题不能熟视无睹。' },
    { name: '水到渠成', pinyin: 'shuǐ dào qú chéng', meaning: '水流到的地方自然形成一条水道。比喻条件成熟，事情自然会成功。', provenance: '宋·苏轼《答秦太虚书》', example: '基础打牢了，成绩自然水到渠成。' },
    { name: '瞬息万变', pinyin: 'shùn xī wàn biàn', meaning: '在极短的时间内就有很多变化。形容变化很多很快。', provenance: '清·吴趼人《痛史》', example: '市场行情瞬息万变。' },
    { name: '司空见惯', pinyin: 'sī kōng jiàn guàn', meaning: '某事常见，不足为奇。', provenance: '唐·孟棨《本事诗·情感》', example: '这种景象他早已司空见惯。' },
    { name: '四面楚歌', pinyin: 'sì miàn chǔ gē', meaning: '比喻陷入四面受敌、孤立无援的境地。', provenance: '《史记·项羽本纪》', example: '公司陷入四面楚歌的困境。' },
    { name: '随波逐流', pinyin: 'suí bō zhú liú', meaning: '随着波浪起伏，跟着流水漂荡。比喻没有坚定的立场，只能随着别人走。', provenance: '《史记·屈原贾生列传》', example: '做人要有主见，不能随波逐流。' },
    { name: '谈笑风生', pinyin: 'tán xiào fēng shēng', meaning: '形容谈话时有说有笑，兴致勃勃，气氛活跃。', provenance: '宋·辛弃疾《念奴娇·赠夏成玉》', example: '聚会上大家谈笑风生。' },
    { name: '叹为观止', pinyin: 'tàn wéi guān zhǐ', meaning: '指赞美所见到的事物好到了极点。', provenance: '《左传·襄公二十九年》', example: '他的书法令人叹为观止。' },
    { name: '天衣无缝', pinyin: 'tiān yī wú fèng', meaning: '比喻事物周密完善，找不出破绽。', provenance: '五代·牛峤《灵怪录·郭翰》', example: '他的解释天衣无缝，无懈可击。' },
    { name: '同舟共济', pinyin: 'tóng zhōu gòng jì', meaning: '比喻团结互助，同心协力，战胜困难。', provenance: '《孙子·九地》', example: '大家同舟共济，共渡难关。' },
    { name: '投鼠忌器', pinyin: 'tóu shǔ jì qì', meaning: '想用东西打老鼠，又怕打坏了近旁的器物。比喻做事有顾忌，不敢放手干。', provenance: '《汉书·贾谊传》', example: '他做事投鼠忌器，放不开手脚。' },
    { name: '图穷匕见', pinyin: 'tú qióng bǐ xiàn', meaning: '比喻事情发展到最后，真相或本意显露了出来。', provenance: '《战国策·燕策三》', example: '谈判到最后，对方才图穷匕见。' },
    { name: '万籁俱寂', pinyin: 'wàn lài jù jì', meaning: '形容周围环境非常安静，一点声响都没有。', provenance: '唐·常建《题破山寺后禅院》', example: '深夜的校园万籁俱寂。' },
    { name: '望尘莫及', pinyin: 'wàng chén mò jí', meaning: '望见前面骑马的人走过扬起的尘土而不能赶上。比喻远远落在后面。', provenance: '《庄子·田子方》', example: '他的水平让我望尘莫及。' },
    { name: '望梅止渴', pinyin: 'wàng méi zhǐ kě', meaning: '比喻愿望无法实现，用空想安慰自己。', provenance: '南朝宋·刘义庆《世说新语·假谲》', example: '画饼充饥终究是望梅止渴。' },
    { name: '危言耸听', pinyin: 'wēi yán sǒng tīng', meaning: '故意说些夸大的吓人的话，使人惊疑震动。', provenance: '宋·吕祖谦《东莱博议》', example: '他危言耸听，制造恐慌。' },
    { name: '文过饰非', pinyin: 'wén guò shì fēi', meaning: '用漂亮的言词掩饰自己的过失和错误。', provenance: '《论语·子张》', example: '犯了错要承认，不能文过饰非。' },
    { name: '闻鸡起舞', pinyin: 'wén jī qǐ wǔ', meaning: '听到鸡叫就起来舞剑。比喻有志报国的人及时奋起。', provenance: '《晋书·祖逖传》', example: '他闻鸡起舞，苦练基本功。' },
    { name: '卧薪尝胆', pinyin: 'wò xīn cháng dǎn', meaning: '形容人刻苦自励，发愤图强。', provenance: '《史记·越王勾践世家》', example: '落后不可怕，关键要卧薪尝胆。' },
    { name: '物极必反', pinyin: 'wù jí bì fǎn', meaning: '事物发展到极点，就会向相反的方向转化。', provenance: '《吕氏春秋·博志》', example: '凡事过犹不及，物极必反。' },
    { name: '喜闻乐见', pinyin: 'xǐ wén lè jiàn', meaning: '喜欢听，乐意看。形容很受欢迎。', provenance: '清·李渔《闲情偶寄》', example: '这种形式群众喜闻乐见。' },
    { name: '相得益彰', pinyin: 'xiāng dé yì zhāng', meaning: '指两个人或两件事物互相配合，双方的能力和作用更能显示出来。', provenance: '汉·王褒《圣主得贤臣颂》', example: '文理结合，相得益彰。' },
    { name: '想入非非', pinyin: 'xiǎng rù fēi fēi', meaning: '思想进入虚幻境界，完全脱离实际；又指胡思乱想。', provenance: '清·李宝嘉《官场现形记》', example: '别想入非非，要脚踏实地。' },
    { name: '削足适履', pinyin: 'xuē zú shì lǚ', meaning: '鞋小脚大，把脚削去一块来凑和鞋的大小。比喻不合理地迁就现成条件。', provenance: '《淮南子·说林训》', example: '不能为了考试而削足适履。' },
    { name: '小心翼翼', pinyin: 'xiǎo xīn yì yì', meaning: '形容言行举动十分谨慎，丝毫不敢疏忽大意。', provenance: '《诗经·大雅·大明》', example: '他小心翼翼地端着杯子。' },
    { name: '笑里藏刀', pinyin: 'xiào lǐ cáng dāo', meaning: '比喻外表和气而内心阴险。', provenance: '《旧唐书·李义府传》', example: '要提防这种笑里藏刀的人。' },
    { name: '心旷神怡', pinyin: 'xīn kuàng shén yí', meaning: '心境开阔，精神愉快。', provenance: '宋·范仲淹《岳阳楼记》', example: '登高远眺，令人心旷神怡。' },
    { name: '欣欣向荣', pinyin: 'xīn xīn xiàng róng', meaning: '形容草木长得茂盛。比喻事业蓬勃发展，兴旺昌盛。', provenance: '晋·陶渊明《归去来兮辞》', example: '公司业务欣欣向荣。' },
    { name: '兴高采烈', pinyin: 'xìng gāo cǎi liè', meaning: '形容兴致高昂，情绪热烈。', provenance: '南朝梁·刘勰《文心雕龙》', example: '大家兴高采烈地讨论着。' },
    { name: '形形色色', pinyin: 'xíng xíng sè sè', meaning: '形容事物种类繁多，各式各样。', provenance: '《列子·天瑞》', example: '市场上商品形形色色。' },
    { name: '虚张声势', pinyin: 'xū zhāng shēng shì', meaning: '假装出强大的气势。指假造声势，借以吓人。', provenance: '唐·韩愈《论淮西事宜状》', example: '他不过是虚张声势，别怕。' },
    { name: '栩栩如生', pinyin: 'xǔ xǔ rú shēng', meaning: '形容画作、雕塑中的艺术形象等生动逼真，就像活的一样。', provenance: '《庄子·齐物论》', example: '画中的老虎栩栩如生。' },
    { name: '悬梁刺股', pinyin: 'xuán liáng cì gǔ', meaning: '形容刻苦学习。', provenance: '《战国策·秦策一》', example: '古人悬梁刺股，今人更应刻苦。' },
    { name: '学富五车', pinyin: 'xué fù wǔ chē', meaning: '形容读书多，学识丰富。', provenance: '《庄子·天下》', example: '他学富五车，知识渊博。' },
    { name: '循规蹈矩', pinyin: 'xún guī dǎo jǔ', meaning: '原指遵守规矩，不轻举妄动。现多指拘守旧准则，不敢稍做变动。', provenance: '宋·朱熹《答或人》', example: '他做事循规蹈矩，从不越界。' },
    { name: '揠苗助长', pinyin: 'yà miáo zhù zhǎng', meaning: '比喻违反事物发展的客观规律，急于求成，反而坏事。', provenance: '《孟子·公孙丑上》', example: '教育孩子不能揠苗助长。' },
    { name: '言简意赅', pinyin: 'yán jiǎn yì gāi', meaning: '形容说话写文章简明扼要。', provenance: '宋·张端义《贵耳集》', example: '他的回答言简意赅，切中要害。' },
    { name: '偃旗息鼓', pinyin: 'yǎn qí xī gǔ', meaning: '放倒旗子，停止敲鼓。比喻停止战斗或停止做某事。', provenance: '《三国志·蜀志·赵云传》', example: '双方偃旗息鼓，暂告停战。' },
    { name: '一蹴而就', pinyin: 'yī cù ér jiù', meaning: '踏一步就成功。比喻事情轻而易举，一下子就成功。', provenance: '宋·苏洵《上田枢密书》', example: '成功不会一蹴而就。' },
    { name: '一鸣惊人', pinyin: 'yī míng jīng rén', meaning: '比喻平时没有突出的表现，一下子做出惊人的成绩。', provenance: '《史记·滑稽列传》', example: '他一鸣惊人，考上了名校。' },
    { name: '一诺千金', pinyin: 'yī nuò qiān jīn', meaning: '许下的一个诺言有千金的价值。比喻说话算数，极有信用。', provenance: '《史记·季布栾布列传》', example: '他说话一诺千金。' },
    { name: '一视同仁', pinyin: 'yī shì tóng rén', meaning: '对人同样看待，不分厚薄。', provenance: '唐·韩愈《原人》', example: '老师对每个学生一视同仁。' },
    { name: '一意孤行', pinyin: 'yī yì gū xíng', meaning: '不接受别人的劝告，顽固地按照自己的主观想法去做。', provenance: '《史记·酷吏列传》', example: '他固执己见，一意孤行。' },
    { name: '贻笑大方', pinyin: 'yí xiào dà fāng', meaning: '指让内行的人笑话。', provenance: '《庄子·秋水》', example: '不懂装懂，只会贻笑大方。' },
    { name: '以卵击石', pinyin: 'yǐ luǎn jī shí', meaning: '拿蛋去碰石头。比喻不估计自己的力量，自取灭亡。', provenance: '《墨子·贵义》', example: '盲目冒进无异于以卵击石。' },
    { name: '异曲同工', pinyin: 'yì qǔ tóng gōng', meaning: '不同的曲调演得同样好。比喻做法不同而都巧妙地达到目的。', provenance: '唐·韩愈《进学解》', example: '两人的方案异曲同工。' },
    { name: '因地制宜', pinyin: 'yīn dì zhì yí', meaning: '根据各地的具体情况，制定适宜的办法。', provenance: '汉·赵晔《吴越春秋·阖闾内传》', example: '发展农业要因地制宜。' },
    { name: '因势利导', pinyin: 'yīn shì lì dǎo', meaning: '顺着事情发展的趋势，向有利于实现目的的方向加以引导。', provenance: '《史记·孙子吴起列传》', example: '对学生要因势利导，循循善诱。' },
    { name: '迎刃而解', pinyin: 'yíng rèn ér jiě', meaning: '比喻处理事情、解决问题很顺利。', provenance: '《晋书·杜预传》', example: '抓住关键，问题迎刃而解。' },
    { name: '忧心忡忡', pinyin: 'yōu xīn chōng chōng', meaning: '形容心事重重，非常忧愁。', provenance: '《诗经·召南·草虫》', example: '他对考试结果忧心忡忡。' },
    { name: '游刃有余', pinyin: 'yóu rèn yǒu yú', meaning: '比喻技术熟练，经验丰富，解决问题毫不费力。', provenance: '《庄子·养生主》', example: '这类题目他早已游刃有余。' },
    { name: '有口皆碑', pinyin: 'yǒu kǒu jiē bēi', meaning: '所有人的嘴都是记功的碑。比喻人人称赞。', provenance: '宋·释普济《五灯会元》', example: '这家老店有口皆碑。' },
    { name: '有条不紊', pinyin: 'yǒu tiáo bù wěn', meaning: '形容有条有理，一点不乱。', provenance: '《尚书·盘庚上》', example: '他做事有条不紊。' },
    { name: '有勇无谋', pinyin: 'yǒu yǒng wú móu', meaning: '只有勇气，没有计谋。指做事只凭猛力而不讲策略。', provenance: '《三国演义》', example: '他做事有勇无谋，容易吃亏。' },
    { name: '与日俱增', pinyin: 'yǔ rì jù zēng', meaning: '随着时间的推移而不断增长。', provenance: '清·李宝嘉《官场现形记》', example: '他的压力与日俱增。' },
    { name: '源远流长', pinyin: 'yuán yuǎn liú cháng', meaning: '河流的源头很远，水流很长。比喻历史悠久，根底深厚。', provenance: '唐·白居易《海州刺史裴君夫人李氏墓志铭》', example: '中华文化源远流长。' },
    { name: '越俎代庖', pinyin: 'yuè zǔ dài páo', meaning: '比喻超出自己职务范围去处理别人所管的事。', provenance: '《庄子·逍遥游》', example: '父母不要越俎代庖，替孩子做决定。' },
    { name: '运筹帷幄', pinyin: 'yùn chóu wéi wò', meaning: '指在帐幕中谋划军机。常指在后方决定作战方案。', provenance: '《史记·高祖本纪》', example: '他运筹帷幄，决胜千里。' },
    { name: '再接再厉', pinyin: 'zài jiē zài lì', meaning: '比喻继续努力，再加一把劲。', provenance: '唐·韩愈《斗鸡联句》', example: '希望大家再接再厉，再创佳绩。' },
    { name: '责无旁贷', pinyin: 'zé wú páng dài', meaning: '自己应尽的责任，不能推卸给旁人。', provenance: '清·文康《儿女英雄传》', example: '保护环境，人人责无旁贷。' },
    { name: '崭露头角', pinyin: 'zhǎn lù tóu jiǎo', meaning: '比喻突出地显露出才能和本领。', provenance: '唐·韩愈《柳子厚墓志铭》', example: '他在大赛中崭露头角。' },
    { name: '张冠李戴', pinyin: 'zhāng guān lǐ dài', meaning: '把姓张的帽子戴到姓李的头上。比喻认错了对象，弄错了事实。', provenance: '明·田艺蘅《留青日札》', example: '他张冠李戴，把两件事混为一谈。' },
    { name: '朝三暮四', pinyin: 'zhāo sān mù sì', meaning: '比喻办事反复无常，经常变卦。', provenance: '《庄子·齐物论》', example: '他朝三暮四，计划总在变。' },
    { name: '振聋发聩', pinyin: 'zhèn lóng fā kuì', meaning: '发出很大的响声，使耳聋的人也能听见。比喻用语言文字唤醒糊涂麻木的人。', provenance: '清·袁枚《随园诗话补遗》', example: '这番话振聋发聩，发人深省。' },
    { name: '知难而进', pinyin: 'zhī nán ér jìn', meaning: '迎着困难上，不退缩。', provenance: '汉·桓宽《盐铁论》', example: '越是困难越要知难而进。' },
    { name: '纸上谈兵', pinyin: 'zhǐ shàng tán bīng', meaning: '在纸面上谈论打仗。比喻空谈理论，不能解决实际问题。', provenance: '《史记·廉颇蔺相如列传》', example: '纸上谈兵不如亲身实践。' },
    { name: '只争朝夕', pinyin: 'zhǐ zhēng zhāo xī', meaning: '形容抓紧时间，力争在最短的时间内达到目的。', provenance: '明·徐复祚《投梭记》', example: '备考要只争朝夕，抓紧时间。' },
    { name: '指鹿为马', pinyin: 'zhǐ lù wéi mǎ', meaning: '比喻故意颠倒黑白，混淆是非。', provenance: '《史记·秦始皇本纪》', example: '他指鹿为马，混淆视听。' },
    { name: '志同道合', pinyin: 'zhì tóng dào hé', meaning: '志向相同，意见相合。', provenance: '《三国志·魏志·陈思王植传》', example: '我们志同道合，一拍即合。' },
    { name: '众志成城', pinyin: 'zhòng zhì chéng chéng', meaning: '万众一心，像坚固的城墙一样不可摧毁。比喻大家团结一致，力量无比强大。', provenance: '《国语·周语下》', example: '大家众志成城，共克时艰。' },
    { name: '周而复始', pinyin: 'zhōu ér fù shǐ', meaning: '转了一圈又一圈，不断循环。', provenance: '《汉书·礼乐志》', example: '四季周而复始，循环往复。' },
    { name: '自相矛盾', pinyin: 'zì xiāng máo dùn', meaning: '比喻自己的言行前后互相抵触。', provenance: '《韩非子·难一》', example: '他的说法自相矛盾。' },
    { name: '左右逢源', pinyin: 'zuǒ yòu féng yuán', meaning: '比喻做事得心应手，非常顺利。现多用来比喻为人圆滑，善于投机。', provenance: '《孟子·离娄下》', example: '他在复杂的人际关系中左右逢源。' },
    { name: '作茧自缚', pinyin: 'zuò jiǎn zì fù', meaning: '蚕吐丝作茧，把自己裹在里面。比喻自己使自己陷入困境。', provenance: '唐·白居易《江州赴忠州至江陵已来舟中示舍弟五十韵》', example: '他立下过多规矩，反而作茧自缚。' },
    { name: '坐井观天', pinyin: 'zuò jǐng guān tiān', meaning: '坐在井底看天。比喻眼界小，见识少。', provenance: '唐·韩愈《原道》', example: '要多走出去看看，不能坐井观天。' }
  ];

  function fetchIdiom(word) {
    return new Promise(function (resolve) {
      var prompt = '请你帮我查"' + word + '"的意思、读音和出处，以及使用语境，并自动找出它的近义词，逐一辨析（辨析内容包括感情色彩、应用语境、意思差别）。' +
        '注意：如果"' + word + '"是词语（两个字），近义词必须也是词语（两个字）；如果"' + word + '"是成语（四个字），近义词必须也是成语（四个字），绝不能混用。近义词至少找出 3 个，必须互不相同、不能重复，且绝不能包含查询词"' + word + '"本身。' +
        '请严格按以下 JSON 格式输出，不要输出 JSON 以外的任何内容。注意：所有字段的值必须是普通字符串，禁止嵌套对象；provenance（出处）必须简短，一句话以内；discrimination 字段用换行符 \\n 分隔每一条，第一条必须列出近义词，随后再逐条辨析。' +
        '{"name":"' + word + '","pinyin":"读音","meaning":"释义","provenance":"出处","example":"例句","discrimination":"近义词：某词、某词、某词\\n感情色彩：…\\n应用语境：…\\n与近义词【某词】对比…\\n与近义词【某词】对比…"}';
      zhipuChat([
        { role: 'system', content: '你是资深语文老师，擅长词语与成语讲解。只输出 JSON，不要输出任何其他文字。' },
        { role: 'user', content: prompt }
      ], 2048, 25000).then(function (txt) {
        var res = parseAiIdiom(txt, word);
        if (res) { resolve(res); return; }
        fallbackIdiom(word).then(resolve);
      }).catch(function () {
        fallbackIdiom(word).then(resolve);
      });
    });
  }

  function repairJson(s) {
    return s.replace(/("(?:[^"\\]|\\.)*"\s*:\s*)("|[\{\[\d\-tfnu"]|\$)/g, '$1$2')
      .replace(/("(?:[^"\\]|\\.)*"\s*:\s*)([^"\s\{\}\[\],][^\{\}\[\],]*?)(\s*[,\}])/g, function (m, k, v, tail) {
        return k + '"' + v.replace(/"/g, '\\"').trim() + '"' + tail;
      });
  }

  function extractIdiomText(t, word) {
    function field(name) {
      var re = new RegExp('"' + name + '"[\\s\\n]*:[\\s\\n]*"([\\s\\S]*?)"\\s*[,}]');
      var m = t.match(re);
      return m ? m[1] : '';
    }
    function discText() {
      var m = t.match(/"disc(?:rimination)?"[\s\n]*:[^\n{]*\{/);
      if (m) {
        var idx = t.indexOf('{', m.index);
        var depth = 0, i = idx;
        for (; i < t.length; i++) {
          if (t[i] === '{') depth++;
          else if (t[i] === '}') { depth--; if (depth === 0) break; }
        }
        var inner = t.slice(idx + 1, i);
        return inner.split(/\n/).map(function (l) {
          var p = l.trim().match(/^"?([^":\n]{1,12})"?[\s\n]*[:：][\s\n]*(.*)$/);
          return p ? p[1] + '：' + p[2].replace(/^"|"$|,$/g, '') : '';
        }).filter(Boolean);
      }
      var m2 = t.match(/"disc(?:rimination)?"[\s\n]*:[\s\n]*"([\s\S]*?)"([,\s}]|$)/);
      if (m2) return m2[1].split(/\\n|\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      return [];
    }
    return {
      name: field('name') || word,
      pinyin: field('pinyin'),
      meaning: field('meaning'),
      provenance: field('provenance'),
      example: field('example'),
      discLines: discText()
    };
  }

  function parseAiIdiom(txt, word) {
    var t = String(txt || '').replace(/```json|```/g, '');
    var m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    function cap(s, n) {
      s = String(s || '').trim();
      return s.length > n ? s.slice(0, n) + '…' : s;
    }
    var d = null;
    try { d = JSON.parse(m[0]); } catch (e) { try { d = JSON.parse(repairJson(m[0])); } catch (e2) { d = null; } }
    if (!d || !(d.meaning || d.name)) {
      var ex = extractIdiomText(t, word);
      if (!ex.meaning && !ex.name) return null;
      var res = { name: ex.name, pinyin: ex.pinyin, meaning: cap(ex.meaning, 300), provenance: cap(ex.provenance, 120), example: cap(ex.example, 120), extra: { type: 'word' } };
      if (ex.discLines.length) { res.extra.discLines = ex.discLines; }
      return res;
    }
    var disc = d.discrimination || d.disc;
    var lines = [];
    if (disc) {
      if (typeof disc === 'object') {
        Object.keys(disc).forEach(function (k) {
          var v = disc[k];
          if (v && typeof v === 'object') {
            Object.keys(v).forEach(function (k2) {
              lines.push(k2 + '：' + String(v[k2]));
            });
          } else if (v) {
            lines.push(k + '：' + String(v));
          }
        });
      } else {
        lines = String(disc).split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      }
    }
    if (!lines.length) lines = [];
    var res = {
      name: d.name || word,
      pinyin: d.pinyin || '',
      meaning: cap(d.meaning || '', 300),
      provenance: cap(d.provenance || '', 120),
      example: cap(d.example || '', 120),
      extra: { type: 'word' }
    };
    if (lines.length) {
      res.extra.discLines = lines;
    }
    return res;
  }

  function fallbackIdiom(word) {
    return new Promise(function (resolve) {
      var found = null;
      for (var i = 0; i < FALLBACK_IDIOMS.length; i++) {
        if (FALLBACK_IDIOMS[i].name === word) { found = FALLBACK_IDIOMS[i]; break; }
      }
      if (!found) {
        for (var j = 0; j < FALLBACK_IDIOMS.length; j++) {
          if (FALLBACK_IDIOMS[j].name.indexOf(word) >= 0) { found = FALLBACK_IDIOMS[j]; break; }
        }
      }
      if (found) {
        resolve({ name: found.name, pinyin: found.pinyin || '', meaning: found.meaning || '', provenance: found.provenance || '', example: found.example || '', extra: { type: 'idiom' } });
      } else {
        resolve({ name: word, pinyin: '', meaning: '未查询到该词语或成语的释义，请检查输入是否正确。', provenance: '', example: '', extra: { type: 'word' } });
      }
    });
  }

  function updateIdiomResultBox(mode) {
    var box = $('#idiom-result-box');
    if (!box) return;
    if (mode === 'querying') {
      box.innerHTML = '<p class="muted mt12">查询中…</p>';
    } else if (mode) {
      box.innerHTML = renderIdiomResult(mode);
    }
  }

  function updateProofreadBox(status, text) {
    var box = $('#proofread-box');
    if (!box) return;
    if (status === 'loading') {
      box.innerHTML = '<p class="muted mt8">AI 校对中…</p>';
    } else if (status === 'result') {
      box.innerHTML = '<div class="proofread-result"></div>';
      var pEl = box.firstChild;
      if (pEl) typeInto(pEl, text, null);
    } else if (status === 'error') {
      box.innerHTML = '<p class="muted mt8" style="color:#c0392b">' + esc(text) + '</p>';
    }
  }

  function renderIdiomResult(r) {
    if (!r) return '';
    var saved = state.idiom.saved.some(function (s) { return s.name === r.name; });
    var html = '<div class="idiom-result card">';
    html += '<div class="idiom-name">' + esc(r.name) +
      (r.extra && r.extra.cx ? '<span class="tag" style="background:#8a93a6;vertical-align:middle;margin-left:8px">' + esc(r.extra.cx) + '</span>' : '') +
      '</div>';
    if (r.meaning) html += '<div class="idiom-block"><div class="lb">释义</div><div class="val">' + esc(r.meaning) + '</div></div>';
    if (r.myMeaning) html += '<div class="idiom-block"><div class="lb">我的释义</div><div class="val">' + esc(r.myMeaning) + '</div></div>';
    if (r.provenance) html += '<div class="idiom-block"><div class="lb">出处</div><div class="val">' + esc(r.provenance) + '</div></div>';
    if (r.example) html += '<div class="idiom-block"><div class="lb">例句</div><div class="val">' + esc(r.example) + '</div></div>';
    if (r.extra && r.extra.discLines && r.extra.discLines.length) {
      html += '<div class="idiom-block"><div class="lb">近义词辨析</div>';
      r.extra.discLines.forEach(function (line) {
        html += '<div class="val">' + esc(line.replace(/^[-*•]\s*/, '')) + '</div>';
      });
      html += '</div>';
    }
    if (r.extra && r.extra.tongyi) html += '<div class="idiom-block"><div class="lb">同义词</div><div class="val">' + esc(r.extra.tongyi) + '</div></div>';
    if (r.extra && r.extra.fanyi) html += '<div class="idiom-block"><div class="lb">反义词</div><div class="val">' + esc(r.extra.fanyi) + '</div></div>';
    if (r.extra && r.extra.yufa) html += '<div class="idiom-block"><div class="lb">语法</div><div class="val">' + esc(r.extra.yufa) + '</div></div>';
    html += '<div class="idiom-block">';
    html += '<div class="lb">我的释义</div>';
    html += '<textarea class="textarea" id="my-meaning" rows="2" placeholder="写下你对这个词语的理解，可交给 AI 校对…"></textarea>';
    html += '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn gray" data-act="proofreadMeaning"' + (state.idiom.proof.loading ? ' disabled' : '') + '>交给 AI 校对</button>' +
      '</div>';
    html += '<div id="proofread-box">';
    if (state.idiom.proof.loading) {
      html += '<p class="muted mt8">AI 校对中…</p>';
    } else if (state.idiom.proof.text) {
      html += '<div class="proofread-result">' + mdRender(state.idiom.proof.text) + '</div>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div class="btn-row" style="margin-top:10px">' +
      (saved
        ? '<button class="btn gray" data-act="unsaveIdiom" data-key="' + esc(r.name) + '">已收藏</button>'
        : '<button class="btn" data-act="saveIdiom" data-key="' + esc(r.name) + '">收藏</button>') +
      '</div>';
    html += '</div>';
    return html;
  }

  function renderIdiom() {
    var it = state.idiom;
    var html = '<div class="idiom-page">';
    html += '<div class="section-title">词语查询</div><div class="card">';
    html += '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<input class="input" id="idiom-input" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="输入词语或成语，如：谱写、马到成功" value="' + esc(state.idiom.input || '') + '" style="flex:1">' +
      '<button class="btn ai-send-btn" data-act="queryIdiom">查询</button>' +
      '</div>';
    html += '<div class="btn-row">' +
      '<button class="btn gray" data-act="randomIdiom">随机一个成语</button>' +
      '</div>';
    html += '</div>';
    html += '<div id="idiom-result-box">';
    if (it.loading) {
      html += '<p class="muted mt12">查询中…</p>';
    } else if (it.result) {
      html += renderIdiomResult(it.result);
    }
    html += '</div>';

    html += '<div id="idiom-saved-box">';
    html += renderIdiomSavedBox();
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderIdiomSavedBox() {
    var it = state.idiom;
    if (!it.saved.length) {
      return '<div class="section-title">我的积累</div><div class="card"><p class="muted">收藏的词语和成语会显示在这里，方便随时复习。</p></div>';
    }
    var html = '<div class="section-title">我的积累（' + it.saved.length + '）</div><div class="card">';
    it.saved.forEach(function (s) {
      var brief = String(s.meaning || '').replace(/\n+/g, ' ');
      if (brief.length > 40) brief = brief.slice(0, 40) + '…';
      html += '<div class="idiom-saved" data-act="openIdiomSaved" data-key="' + esc(s.name) + '">' +
        '<div class="idiom-saved-name">' + esc(s.name) + '</div>' +
        '<div class="idiom-saved-mean">' + esc(brief) + '</div>';
      if (s.myMeaning) html += '<div class="idiom-saved-my">我的释义：' + esc(s.myMeaning) + '</div>';
      html += '<button class="btn danger sm" data-act="unsaveIdiom" data-key="' + esc(s.name) + '" style="margin-top:6px">移除</button>' +
        '</div>';
    });
    html += '<button class="btn danger sm mt12" data-act="clearIdioms">清空收藏</button>';
    html += '</div>';
    return html;
  }

  function updateIdiomSavedBox() {
    var box = $('#idiom-saved-box');
    if (box) box.innerHTML = renderIdiomSavedBox();
  }

  function refreshIdiomSaveBtn() {
    var box = $('#idiom-result-box');
    if (!box) return;
    var r = state.idiom.result;
    var saved = r && state.idiom.saved.some(function (s) { return s.name === r.name; });
    var btn = box.querySelector('[data-act="saveIdiom"], [data-act="unsaveIdiom"]');
    if (!btn) return;
    btn.setAttribute('data-act', saved ? 'unsaveIdiom' : 'saveIdiom');
    btn.textContent = saved ? '已收藏' : '收藏';
    btn.className = saved ? 'btn gray' : 'btn';
  }

  var ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  var ZHIPU_API_KEY = '9c6f09cc27ae4846995e1474b23db127.Zh68EAialtuTh2oL';
  var ZHIPU_TEXT_MODEL = 'glm-4-flash-250414';
  var ZHIPU_VISION_MODEL = 'glm-4v-flash';

  function zhipuChat(messages, maxTokens, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject(new Error('AI 请求超时，请稍后重试'));
      }, timeoutMs || 30000);
      fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + ZHIPU_API_KEY
        },
        body: JSON.stringify({
          model: ZHIPU_TEXT_MODEL,
          messages: messages,
          max_tokens: maxTokens || 2048,
          stream: false,
          temperature: 0.7
        })
      }).then(function (r) {
        clearTimeout(timeout);
        if (!r.ok) {
          throw new Error('AI 服务异常（' + r.status + '）');
        }
        return r.json();
      }).then(function (data) {
        clearTimeout(timeout);
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (content) {
          resolve(String(content));
        } else {
          reject(new Error((data && data.error && data.error.message) || 'AI 服务返回异常'));
        }
      }).catch(function (e) {
        clearTimeout(timeout);
        reject(e && e.message ? e : new Error('无法连接 AI 服务，请检查网络'));
      });
    });
  }

  function zhipuVision(dataUrl, prompt, maxTokens) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject(new Error('识别超时，请稍后重试'));
      }, 30000);
      fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + ZHIPU_API_KEY
        },
        body: JSON.stringify({
          model: ZHIPU_VISION_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompt }
            ]
          }],
          max_tokens: Math.min(maxTokens || 1024, 1024),
          stream: false,
          temperature: 0.1
        })
      }).then(function (r) {
        clearTimeout(timeout);
        if (!r.ok) {
          throw new Error('识别服务异常（' + r.status + '）');
        }
        return r.json();
      }).then(function (data) {
        clearTimeout(timeout);
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (content) {
          resolve(String(content));
        } else {
          reject(new Error((data && data.error && data.error.message) || '识别服务返回异常'));
        }
      }).catch(function (e) {
        clearTimeout(timeout);
        reject(e && e.message ? e : new Error('无法连接识别服务，请检查网络'));
      });
    });
  }

  function buildWrongBookSummary() {
    try {
      var qs = state.questions || [];
      if (!qs.length) return '';
      var today = todayStr();
      var pending = qs.filter(function (q) { return q.status === 'pending'; });
      var done = qs.filter(function (q) { return q.status === 'done'; });
      var overdue = pending.filter(function (q) { return q.reviewDate < today; }).length;
      var dueToday = pending.filter(function (q) { return q.reviewDate === today; }).length;
      var byCat = {};
      var bySub = {};
      var wrongRounds = 0;
      var wrongTotal = 0;
      qs.forEach(function (q) {
        var c = q.category || '未分类';
        byCat[c] = (byCat[c] || 0) + 1;
        var s = q.subCategory;
        if (s) bySub[s] = (bySub[s] || 0) + 1;
        (q.reviewHistory || []).forEach(function (h) {
          wrongTotal++;
          if (!h.correct) wrongRounds++;
        });
      });
      var catRank = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
      var subRank = Object.keys(bySub).sort(function (a, b) { return bySub[b] - bySub[a]; });
      var weak = [];
      catRank.forEach(function (c) {
        var arr = qs.filter(function (q) { return q.category === c; });
        var d = arr.filter(function (q) { return q.status === 'done'; }).length;
        var rate = arr.length ? Math.round(d / arr.length * 100) : 0;
        weak.push(c + '（共' + arr.length + '题，完成率' + rate + '%）');
      });
      var parts = [
        '【我的错题本数据摘要】',
        '错题总数：' + qs.length + '题；待复盘：' + pending.length + '题；已复盘：' + done.length + '题。',
        '逾期未复盘：' + overdue + '题；今天应复盘：' + dueToday + '题。',
        '最近' + wrongTotal + '次复盘记录中答错' + wrongRounds + '次（正确率' + (wrongTotal ? Math.round((wrongTotal - wrongRounds) / wrongTotal * 100) : 100) + '%）。',
        '各分类题量排序：' + catRank.join('、') + '。',
        '各分类复盘完成情况：' + weak.join('；') + '。'
      ];
      if (subRank.length) {
        parts.push('高频子分类：' + subRank.slice(0, 6).join('、') + '。');
      }
      return parts.join('\n');
    } catch (e) { return ''; }
  }

  function fetchAiAnswer(question, history) {
    var q = String(question || '');
    var now = new Date();
    var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    var weekday = '日一二三四五六'.charAt(now.getDay());
    var timeStr = (now.getHours() < 10 ? '0' + now.getHours() : now.getHours()) + ':' + (now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes());
    var sysPrompt = '你是一名公务员考试（国考/省考/事业单位）备考助手，擅长行测、申论、常识、时政等知识。' +
      '本机当前时间：' + dateStr + '（星期' + weekday + '）' + timeStr + '。请以此为准回答一切与时政、新闻、日期、时间相关的问题；用户询问"今天几号/星期几/几点"等日期时间问题时，直接依据该时间作答。' +
      '你的知识截止时间较早，遇到需要最新时政、新闻、时事热点的问题时，必须只依据用户消息中提供的新闻列表作答，不要编造或使用你记忆中的旧新闻，也不要编造新闻。' +
      '回答要简洁、准确、有条理，适当使用换行和序号。' +
      '下面是本次对话的上下文历史（用户和你的历史问答），请结合上下文理解用户意图，但回答时以最新问题为准。';
    var wrongSummary = buildWrongBookSummary();
    if (wrongSummary) {
      sysPrompt += '\n\n【用户错题数据】\n' + wrongSummary +
        '\n当用户询问学习建议、复习计划、薄弱项分析、答题技巧等相关问题时，请结合以上错题数据给出针对性建议（如指出薄弱分类、建议优先复习的方向）；其他问题无需刻意提及这些数据。';
    }
    var msgs = [{ role: 'system', content: sysPrompt }];
    if (history && history.length) {
      var recent = history.slice(-20);
      recent.forEach(function (m) {
        if (m && m.role === 'user') msgs.push({ role: 'user', content: m.content || (m.img ? '（用户上传了一张图片）' : '') });
        else if (m && m.role === 'bot') msgs.push({ role: 'assistant', content: m.content || '' });
      });
    }
    msgs.push({ role: 'user', content: q });
    var isDateAsk = /今天几号|今天是几号|今天星期|今天是星期|几月几号|今天日期|今天几点|现在几点|现在几点了|现在时间|今天时间|哪一天/.test(q);
    var isNewsAsk = isDateAsk ? false : /时政|新闻|头条|要闻|热点|时事|今日.*发生|今天.*发生|最近.*大事|重要讲话|重大会议|最新消息|今年|日期|最新/.test(q);
    if (isNewsAsk) {
      return new Promise(function (resolve, reject) {
        var useItems = function (items) {
          var newsText = items.length
            ? items.map(function (it, i) { return (i + 1) + '. ' + it.title + (it.summary ? '（' + it.summary + '）' : ''); }).join('\n')
            : '（当前未获取到新闻列表）';
          var userMsg = q + '\n\n【今日实时新闻列表】\n' + newsText +
            '\n\n请基于以上新闻回答我的问题；若列表为空，请如实说明未获取到今日新闻。';
          msgs[msgs.length - 1] = { role: 'user', content: userMsg };
          zhipuChat(msgs, 4096).then(resolve, reject);
        };
        if (state.news.items.length) {
          useItems(state.news.items);
        } else {
          fetchNews().then(function (items) {
            state.news.items = items;
            useItems(items);
          });
        }
      });
    }
    return zhipuChat(msgs, 4096);
  }

  function aiText(html, text) {
    return html + String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
  }

  function mdInline(s) {
    s = String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code class="ai-inline">$1</code>');
    return s;
  }

  function mdRender(text) {
    var t = String(text == null ? '' : text);
    t = t
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/(\d{1,3}[.、])\s/g, '\n$1 ')
      .replace(/([一二三四五六七八九十百]{1,3}[、.])\s/g, '\n$1 ')
      .replace(/(^|[^\n*])\*\s+(?=\*\*)/g, '$1\n* ')
      .replace(/^([ \t]*#{1,6})(?=[^ \t#\n])/gm, '$1 ')
      .replace(/([^\n])#+(?=[ \t]|$)/g, '$1')
      .replace(/[ \t]{2,}\*(?=\s)/g, '\n*');
    var lines = t.split('\n');
    var html = '';
    var inCode = false;
    var codeBuf = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim() === '' ? lines[i] : lines[i].replace(/^\s+/, '');
      if (/^```/.test(line.trim())) {
        if (!inCode) { inCode = true; codeBuf = []; }
        else {
          html += '<pre class="ai-code-block">' + String(codeBuf.join('\n'))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
          inCode = false;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      var m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
        var lvl = Math.min(m[1].length, 3);
        html += '<div class="ai-h' + lvl + '">' + mdInline(m[2]) + '</div>';
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        html += '<div class="ai-quote">' + mdInline(m[1]) + '</div>';
      } else if ((m = /^[-*]\s+(.+)$/.exec(line))) {
        html += '<div class="ai-li">• ' + mdInline(m[1]) + '</div>';
      } else if ((m = /^(\d+)[.、]\s+(.+)$/.exec(line))) {
        html += '<div class="ai-li"><span class="ai-num">' + m[1] + '.</span> ' + mdInline(m[2]) + '</div>';
      } else if (/^\s*$/.test(line)) {
        html += '<div class="ai-pad"></div>';
      } else {
        html += '<div class="ai-p">' + mdInline(line) + '</div>';
      }
    }
    if (inCode) {
      html += '<pre class="ai-code-block">' + String(codeBuf.join('\n'))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
    }
    return html;
  }

  function aiScrollBottom(msgs) {
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function typeInto(el, text, done) {
    var i = 0;
    var timer = setInterval(function () {
      if (!el.isConnected) {
        clearInterval(timer);
        if (done) done();
        return;
      }
      i += 2;
      if (i >= text.length) {
        clearInterval(timer);
        el.innerHTML = mdRender(text);
        if (done) done();
      } else {
        el.innerHTML = aiText('', text.slice(0, i));
      }
      var msgs = $('#ai-msgs');
      if (msgs) aiScrollBottom(msgs);
    }, 20);
  }

  function renderAi() {
    var a = state.ai;
    var html = '<div class="ai-page">';
    html += '<div class="ai-hint card">可以问：词语用在这里合适吗？法律常识、历史常识、时政热点、答题技巧…</div>';
    if (a.history.length) {
      html += '<button class="btn danger sm" data-act="clearAiHistory" style="margin:0 2px 8px">清空对话</button>';
    }
    html += '<div class="ai-msgs" id="ai-msgs">';
    a.history.forEach(function (m) {
      if (m.role === 'user') {
        html += '<div class="ai-msg user">' +
          (m.img ? '<img class="ai-msg-img" src="' + esc(m.img) + '" alt="图片">' : '') +
          (m.content ? aiText('', m.content) : '') +
          '</div>';
      } else {
        html += '<div class="ai-msg bot">' + mdRender(m.content) + '</div>';
      }
    });
    if (a.loading) {
      html += '<div class="ai-msg bot typing" id="ai-typing">正在思考…</div>';
    }
    html += '</div>';
    html += '<div class="ai-input-row">' +
      '<input class="input" id="ai-input" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="输入你的问题…" value="' + esc(state.ai.input || '') + '" style="flex:1">' +
      '<button class="btn gray ai-img-btn" data-act="pickAiImage"' + (a.loading ? ' disabled' : '') + ' title="上传图片">图片</button>' +
      '<button class="btn ai-send-btn" data-act="sendAiQuestion"' + (a.loading ? ' disabled' : '') + '>发送</button>' +
      '</div>';
    if (a.pendingImg) {
      html += '<div class="ai-img-preview" id="ai-img-preview">' +
        '<img src="' + a.pendingImg + '" alt="待发送图片">' +
        '<button class="ai-img-remove" data-act="removeAiImage">&times;</button>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderNews() {
    var n = state.news;
    var html = '<div class="news-page">';
    html += '<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>每日时政</span>' +
      '<button class="btn gray sm" data-act="openNewsSaved"' + (n.saved.length ? '' : ' disabled') + '>收藏夹（' + n.saved.length + '）</button>' +
      '</div>';

    html += '<div class="section-title" style="margin-top:14px">领袖讲话 · 近一月收录</div>';
    if (n.leader.loading) {
      html += '<div class="card" style="text-align:center"><p class="muted">收录中...</p></div>';
    } else if (n.leader.items.length > 0) {
      html += '<p class="muted" style="font-size:12px;margin:0 2px 8px">习近平主席近一个月国内考察、重要会议讲话及《求是》文章，AI 收录整理，点击查看要点与金句</p>';
      n.leader.items.forEach(function (it, i) {
        html += '<div class="news-item card" data-act="openLeaderDetail" data-idx="' + i + '">';
        html += '<div class="news-meta" style="margin-bottom:4px"><span class="leader-tag">' + esc(it.type || '讲话') + '</span><span class="leader-domain">' + esc(it.domain || '') + '</span><span>' + esc(fmtDate(it.date)) + '</span></div>';
        html += '<div class="news-title">' + esc(it.title) + '</div>';
        html += '<div class="news-open">查看要点与金句 ▶</div>';
        html += '</div>';
      });
    } else if (n.leader.error) {
      html += '<div class="card"><p class="muted" style="color:#c0392b">' + esc(n.leader.error) + '</p></div>';
    } else {
      html += '<div class="card"><p class="muted">正在准备收录...</p></div>';
    }

    if (n.loading) {
      html += '<div class="card" style="text-align:center"><p class="muted">加载中...</p></div>';
    } else if (n.items.length > 0) {
      html += '<p class="muted" style="font-size:12px;margin:0 2px 8px">AI 已从实时热点中筛选出对公考有价值的时政要闻，点击卡片查看 AI 提炼总结与金句</p>';
      n.items.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) { return s.title === item.title; });
        html += '<div class="news-item card" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source || '人民日报') + '" data-time="' + esc(item.time || '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source || '人民日报') + '</span><span>' + esc(item.time || '') + '</span></div></div>' +
          '<span class="news-star' + (isSaved ? ' on' : '') + '" data-act="toggleSaveNews" data-title="' + esc(item.title) + '" title="收藏">' + (isSaved ? '★' : '☆') + '</span>' +
          '</div>';
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += '</div>';
      });
      html += '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
    } else {
      html += '<div class="card">';
      html += '<p class="muted" style="margin-bottom:12px">今日时政要闻（点击卡片查看 AI 提炼总结与金句）</p>';
      html += '<div class="news-list">';
      var fallbackNews = getFallbackNews();
      fallbackNews.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) { return s.title === item.title; });
        html += '<div class="news-item card" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source) + '" data-time="' + esc(item.time) + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source) + '</span><span>' + esc(item.time) + '</span></div></div>' +
          '<span class="news-star' + (isSaved ? ' on' : '') + '" data-act="toggleSaveNews" data-title="' + esc(item.title) + '" title="收藏">' + (isSaved ? '★' : '☆') + '</span>' +
          '</div>';
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderNewsDetail() {
    var o = state.overlay;
    var title = o.title;
    var n = state.news;
    var cached = n.summaries[title] || '';
    var isSaved = n.saved.some(function (s) { return s.title === title; });
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">AI 时政提炼</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="news-title">' + esc(title) + '</div>';
    html += '<div class="news-meta" style="margin:4px 0 10px"><span>' + esc(o.source || '人民日报') + '</span><span>' + esc(o.time || '') + '</span></div>';
    if (n.detailLoading) {
      html += '<p class="muted">AI 提炼中…</p>';
    } else if (cached) {
      html += '<div class="news-ai-summary">' + mdRender(cached) + '</div>';
    } else if (n.detailError) {
      html += '<p class="muted" style="color:#c0392b">' + esc(n.detailError) + '</p>';
    } else {
      html += '<p class="muted">AI 提炼中…</p>';
    }
    html += '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn' + (isSaved ? ' gray' : '') + '" data-act="toggleSaveNews" data-title="' + esc(title) + '" data-source="' + esc(o.source || '人民日报') + '" data-time="' + esc(o.time || '') + '">' + (isSaved ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '</div>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function renderNewsSaved() {
    var n = state.news;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">我的收藏（' + n.saved.length + '）</div></div>' +
      '<div class="overlay-body">';
    if (!n.saved.length) {
      html += '<div class="card"><p class="muted">还没有收藏任何时政要闻。在新闻卡片上点击 ☆ 即可收藏。</p></div>';
    } else {
      n.saved.forEach(function (item) {
        html += '<div class="news-item card" style="cursor:pointer" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source || '人民日报') + '" data-time="' + esc(item.time || '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source || '人民日报') + '</span><span>' + esc(item.time || '') + '</span></div></div>' +
          '<span class="news-star on" data-act="unsaveNews" data-title="' + esc(item.title) + '" title="取消收藏">★</span>' +
          '</div>';
        html += '</div>';
      });
    }
    html += '</div></div>';
    return html;
  }

  function getFallbackNews() {
    var today = new Date();
    var m = today.getMonth() + 1;
    var d = today.getDate();
    return [
      { title: '2026年政府工作报告要点', source: '人民日报', time: m + '月' + d + '日', summary: '报告强调高质量发展，推进科技创新和产业升级。' },
      { title: '常务会议部署扩大内需重点工作', source: '新华社', time: m + '月' + d + '日', summary: '会议研究部署进一步扩大内需、促进消费的政策措施。' },
      { title: '乡村振兴战略深入推进', source: '人民日报', time: m + '月' + d + '日', summary: '农业农村部表示将加大支持力度，推动农业现代化发展。' },
      { title: '科技创新助力经济高质量发展', source: '新华社', time: m + '月' + d + '日', summary: '科技部表示将加大基础研究投入，推动关键核心技术攻关。' },
      { title: '民生保障政策持续完善', source: '人民日报', time: m + '月' + d + '日', summary: '人社部表示将健全多层次社会保障体系，提高保障水平。' }
    ];
  }

  function isEntertainmentNews(title) {
    var t = (title || '').toLowerCase();
    var keywords = ['明星','演员','综艺','电影','电视剧','歌曲','音乐','恋情','结婚','离' + '婚','出' + '轨',
      '偶像','选秀','网红','直播','带货','真人秀','脱口秀','喜剧','相声','小品','魔术','舞蹈',
      '偶像团体','创造营','青春有你','快乐大本营','天天向上','我是歌手','奔跑吧','极限挑战',
      '爸爸去哪儿','中国好声音','梦想的声音','蒙面歌王','跨界歌王','声临其境','演员的诞生',
      '这！就是街舞','热血街舞团','乘风破浪的姐姐','披荆斩棘的哥哥','脱口秀大会','吐槽大会',
      '奇葩说','中国达人秀','达人秀','舞林大会','笑傲江湖','相声有新人','欢乐喜剧人',
      '我为喜剧狂','今夜百乐门','我就是演员','演员请就位','热搜','爆','沸','热',
      '恋情','官宣','分手','怀孕','产子','婚礼','离' + '婚','出' + '轨','出' + '轨',
      '导演','编剧','票房','首映','上映','杀青','开机','片场','片酬','代言','代言费',
      '时尚','穿搭','美妆','护肤','健身','减肥','减肥法','食谱','旅游','美食','探店',
      '游戏','电竞','LOL','王者荣耀','和平精英','绝地求生','原神','崩坏','鸣潮',
      '网红','主播','带货','直播带货','电商','购物','双十一','618','年货节',
      '明星','艺人','idol','偶像','饭圈','粉丝','应援','打榜','控评','反黑'];
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function isForeignNews(title) {
    var t = (title || '').toLowerCase();
    var keywords = ['美国','特朗普','拜登','俄罗斯','普京','乌克兰','日本','韩国','朝鲜','英国','法国',
      '德国','欧盟','北约','以色列','巴勒斯坦','伊朗','印度','澳大利亚','加拿大',
      '中东','加沙','俄乌','美联储','美元加息','关税战','贸易战',
      '大选','州长','澳网','世界杯','欧冠','NBA'];
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function aiFilterNews(items) {
    return new Promise(function (resolve) {
      var list = items.slice(0, 30);
      if (!list.length) { resolve([]); return; }
      var numbered = list.map(function (it, i) { return (i + 1) + '. ' + it.title; }).join('\n');
      zhipuChat([
        { role: 'system', content: '你是人民日报时政编辑兼公务员考试备考专家。用户会给你一批新闻标题列表，请从中挑选对公务员考试（行测常识、申论、面试时政积累）最有价值的中国国内时政要闻，例如：国家政策、法律法规、政府工作报告、重大会议、外交（中国对外交往）、经济、科技、民生、社会治理等。严格排除：娱乐、体育八卦、明星网红、社会花边、以及纯国外新闻（他国内政、战争冲突、外国大选、外国文体等与我国考试无关的内容）。' },
        { role: 'user', content: '请从下面标题中挑选最值得公务员考试考生关注的时政要闻，只输出选中条目的序号（编号），用英文逗号分隔，不要输出其他内容：\n' + numbered }
      ], 2048, 20000).then(function (txt) {
        var m = txt.match(/\d+/g);
        var picked = [];
        if (m) {
          m.forEach(function (n) {
            var idx = parseInt(n, 10) - 1;
            if (idx >= 0 && idx < list.length && picked.length < 10) picked.push(list[idx]);
          });
        }
        resolve(picked.length >= 3 ? picked : list.slice(0, 10));
      }).catch(function () {
        resolve(list.slice(0, 10));
      });
    });
  }

  function aiSummarizeNews(item) {
    return new Promise(function (resolve, reject) {
      var now = new Date();
      var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
      zhipuChat([
        { role: 'system', content: '你是人民日报资深时政编辑，同时是公务员考试（行测常识、申论、面试）备考专家。今天是' + dateStr + '。请对用户提供的时政要闻进行提炼总结，面向公务员考试备考使用。' },
        { role: 'user', content: '请对下面这条时政要闻进行提炼总结，要求：\n' +
          '1. 用 2-3 句话概括事件核心内容；\n' +
          '2. 提炼 3-5 个考试要点（政策名词、关键数据、目标、措施等），便于行测常识和申论积累；\n' +
          '3. 以人民日报评论风格提炼 2-3 句金句，可直接用于申论大作文或面试答题（金句用【金句】标记，每句单独一行）；\n' +
          '4. 内容须客观准确，不编造事实，来源为人民日报。\n\n要闻标题：' + item.title }
      ], 2048, 30000).then(resolve, reject);
    });
  }

  function fetchNews() {
    return new Promise(function (resolve) {
      var apis = [
        'https://cn.apihz.cn/api/xinwen/toutiao.php?id=10019937&key=3e517cc5c3d87dd21ed69d1f63fc3cde',
        'https://tenapi.cn/v2/toutiaohot',
        'https://api.vvhan.com/api/hotlist/wbHot'
      ];
      var attempt = 0;
      function tryNext() {
        if (attempt >= apis.length) {
          resolve(getFallbackNews());
          return;
        }
        var url = apis[attempt];
        attempt++;
        var timeout = setTimeout(function () { tryNext(); }, 5000);
        fetch(url).then(function (r) {
          clearTimeout(timeout);
          if (!r.ok) { tryNext(); return; }
          return r.json();
        }).then(function (data) {
          if (data && data.data && data.data.length > 0) {
            var isApihz = url.indexOf('apihz.cn') >= 0;
            var items = data.data.map(function (item) {
              var hot = item.hot != null ? item.hot : '';
              return {
                title: item.title || item.name || '',
                source: isApihz ? '头条热榜' : (hot || '热搜'),
                time: isApihz ? (hot !== '' ? '热度 ' + hot : '') : ''
              };
            }).filter(function (item) { return !isEntertainmentNews(item.title) && !isForeignNews(item.title); });
            if (items.length) {
              aiFilterNews(items).then(function (picked) {
                var d = new Date();
                var day = (d.getMonth() + 1) + '月' + d.getDate() + '日';
                resolve(picked.map(function (it) {
                  return { title: it.title, source: '人民日报', time: day, summary: '' };
                }));
              });
            } else { tryNext(); }
          } else {
            tryNext();
          }
        }).catch(function () {
          clearTimeout(timeout);
          tryNext();
        });
      }
      tryNext();
    });
  }

  function fetchLeader() {
    return new Promise(function (resolve, reject) {
      var url = 'leader.json?t=' + Date.now();
      fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        resolve(Array.isArray(data && data.items) ? data.items : []);
      }).catch(function (err) {
        reject(err);
      });
    });
  }

  function renderLeaderDetail() {
    var n = state.news;
    var it = n.leader.detail;
    if (!it) return '';
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">领袖讲话收录</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="news-title">' + esc(it.title) + '</div>';
    html += '<div class="news-meta" style="margin:6px 0 12px">' +
      '<span>' + esc(it.type || '') + '</span>' +
      '<span>' + esc(it.source || '') + '</span>' +
      '<span>' + esc(it.domain || '') + '</span>' +
      '<span>' + esc(fmtDate(it.date)) + '</span></div>';
    if (it.occasion) {
      html += '<p class="muted" style="font-size:13px;margin-bottom:10px">' + esc(it.occasion) + '</p>';
    }
    if (it.points && it.points.length) {
      html += '<div class="section-title" style="margin-top:4px">核心要点</div>';
      html += it.points.map(function (p) {
        return '<div class="ai-li">• ' + mdInline(p) + '</div>';
      }).join('');
    }
    if (it.quote) {
      html += '<div class="section-title" style="margin-top:14px">金句摘录</div>';
      html += '<div class="ai-quote">' + mdInline(it.quote) + '</div>';
    }
    if (it.examHint) {
      html += '<div class="section-title" style="margin-top:14px">备考提示</div>';
      html += '<div class="ai-li">• ' + mdInline(it.examHint) + '</div>';
    }
    html += '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn" data-act="toggleSaveNews" data-title="' + esc(it.title) + '" data-source="' + esc(it.type || '领袖讲话') + '" data-time="' + esc(fmtDate(it.date)) + '">☆ 收藏</button>' +
      '</div>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function openForm(q) {
    state.form = q ? {
      id: q.id, category: q.category, subCategory: q.subCategory || '', stem: q.stem,
      options: (q.options || []).slice(), answer: q.answer,
      wrongThinking: q.wrongThinking || '', correctThinking: q.correctThinking || '',
      reviewDays: q.reviewDays || 3, reviewWeekday: q.reviewWeekday || 0, image: q.image || null, original: q,
      source: q.source || '',
      optImgs: (q.optImgs || (q.options || []).map(function () { return null; })).slice()
    } : freshForm(null);
    state.overlay = { type: 'form' };
  }

  function freshForm(q) {
    var emptyImgs = (q ? (q.options || []) : ['', '', '', '']).map(function () { return null; });
    return {
      id: q && q.id ? q.id : null, category: q ? q.category : '', subCategory: q ? q.subCategory || '' : '', stem: q ? q.stem : '',
      options: (q ? (q.options || []) : ['', '', '', '']).slice(), answer: q ? q.answer : '',
      wrongThinking: q ? q.wrongThinking || '' : '', correctThinking: q ? q.correctThinking || '' : '',
      reviewDays: q ? q.reviewDays || 3 : 3, reviewWeekday: q ? q.reviewWeekday || 0 : (state.settings.reviewWeekday || 0), image: q ? q.image || null : null, original: q || null,
      source: q ? q.source || '' : '',
      optImgs: (q && q.optImgs ? q.optImgs : emptyImgs).slice()
    };
  }

  function renderSettings() {
    var wd = state.settings.reviewWeekday || 0;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">复盘设置</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">默认固定复盘星期</div>';
    html += '<p class="muted" style="font-size:13px">设置后，新建错题将自动默认在每周固定星期复盘，无需每次手动选择。</p>';
    html += '<div class="chips" style="margin-top:10px">' +
      '<span class="chip' + (!wd ? ' active' : '') + '" data-act="setDefaultWeekday" data-wd="0">不固定</span>' +
      WEEKDAY_NAMES.map(function (name, i) {
        return '<span class="chip' + (wd === i + 1 ? ' active' : '') + '" data-act="setDefaultWeekday" data-wd="' + (i + 1) + '">' + name + '</span>';
      }).join('') +
      '</div>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">应用到现有错题</div>';
    html += '<p class="muted" style="font-size:13px">将上方默认星期应用到所有「待复盘」错题，已完成的错题不受影响。</p>';
    html += '<button class="btn mt12" data-act="applyWeekdayAll">应用到所有待复盘错题</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function remoteVersionText() {
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
        var raw = window.AndroidBridge.getAppVersion();
        var v = JSON.parse(raw);
        return 'v' + (v.base || '1.0') + '（远程版本 ' + (v.local || 0) + '）';
      }
    } catch (e) { /* ignore */ }
    return 'v1.0';
  }

  function renderForm() {
    var f = state.form;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">' + (f.id ? '编辑错题' : '添加错题') + '</div></div>' +
      '<div class="overlay-body">';

    html += '<div class="field"><span class="label">错题截图</span>';
    if (f.image) {
      html += '<div class="img-wrap"><img id="form-img" src="' + f.image + '"></div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost" data-act="formCrop">裁剪</button>' +
        '<button class="btn gray" data-act="formRepick" data-kind="gallery">更换图片</button>' +
        '<button class="btn gray" data-act="formRemoveImg">移除</button>' +
        '</div>';
    } else {
      html += '<div class="add-img-area" data-act="formRepick" data-kind="gallery"><span class="big">+</span>点击选择截图<br>（拍照或从相册选取）</div>' +
        '<div class="pick-btns">' +
        '<button class="btn gray" data-act="formRepick" data-kind="gallery">从相册选择</button>' +
        '<button class="btn gray" data-act="formRepick" data-kind="camera">拍照</button>' +
        '</div>';
    }
    html += '</div>';

    if (f.image && !state.ocrRunning) {
      html += '<button class="btn ocr-btn" data-act="runOcr">识别题干与选项</button>';
    }
    if (state.ocrRunning) {
      html += '<div class="ocr-progress">' +
        '<div class="ocr-bar"><div id="ocr-fill" style="width:' + Math.round(state.ocrProgress * 100) + '%"></div></div>' +
        '<div class="ocr-status" id="ocr-status">' + esc(state.ocrStatus || '准备中…') + '</div></div>';
    }

    html += '<div class="field mt12"><span class="label">分类 <span class="req">*</span></span>' +
      '<div class="chips">' +
      CATEGORIES.map(function (c) {
        return '<span class="chip' + (f.category === c ? ' active' : '') + '" data-act="formCat" data-cat="' + c + '">' + c + '</span>';
      }).join('') +
      '</div></div>';

    var subCats = SUBCATEGORIES[f.category];
    if (subCats && subCats.length) {
      html += '<div class="field"><span class="label">子分类</span>' +
        '<div class="chips">' +
        subCats.map(function (sc) {
          return '<span class="chip' + (f.subCategory === sc ? ' active' : '') + '" data-act="formSubCat" data-sub="' + sc + '">' + sc + '</span>';
        }).join('') +
        '</div></div>';
    }

    html += '<div class="field"><span class="label">题目来源</span>' +
      '<input class="input" id="f-source" placeholder="如：2026国考行测真题、粉笔题库、XX模拟卷" value="' + esc(f.source) + '">';
    if (state.sourceHistory.length) {
      html += '<div class="chips" style="margin-top:8px">' +
        state.sourceHistory.slice(0, 12).map(function (s) {
          return '<span class="chip source-chip" data-act="fillSource" data-src="' + esc(s) + '">' + esc(s) +
            '<span class="source-del" data-act="delSource" data-src="' + esc(s) + '" title="删除">×</span></span>';
        }).join('') +
        '</div>';
    }
    html += '</div>';

    html += '<div class="field"><span class="label">题干文字 <span class="muted">（可选，截图已含题干可留空）</span></span>' +
      '<textarea class="textarea" id="f-stem" rows="3" placeholder="题目内容（截图已包含题干时可留空）">' + esc(f.stem) + '</textarea></div>';

    html += '<div class="field"><span class="label">选项</span>' +
      '<div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn gray sm" data-act="ocrOptsImage">上传选项截图，自动提取选项</button>' +
      '</div>';

    f.options.forEach(function (opt, i) {
      var optImg = f.optImgs[i];
      html += '<div class="field"><span class="label">选项 ' + optionLetters[i] + '</span>';
      if (optImg) {
        html += '<div class="opt-img-wrap"><img src="' + optImg + '"></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn gray sm" data-act="formOptImgCrop" data-i="' + i + '">裁剪</button>' +
          '<button class="btn gray sm" data-act="formOptImg" data-i="' + i + '">更换</button>' +
          '<button class="btn gray sm" data-act="formOptImgDel" data-i="' + i + '">改为文字</button>' +
          (f.options.length > 2 ? '<button class="btn danger sm" data-act="formDelOpt" data-i="' + i + '">删除</button>' : '') +
          '</div>';
      } else {
        html += '<div style="display:flex;gap:8px">' +
          '<textarea class="textarea" data-opt="' + i + '" rows="2" placeholder="选项内容（也可用图片）" style="flex:1">' + esc(stripOptionPrefix(opt) || opt) + '</textarea>' +
          '<button class="btn ghost sm" data-act="formOptImg" data-i="' + i + '" style="align-self:flex-start">传图</button>' +
          (f.options.length > 2 ? '<button class="btn danger sm" data-act="formDelOpt" data-i="' + i + '" style="align-self:flex-start">删除</button>' : '') +
          '</div>';
      }
      html += '</div>';
    });
    if (f.options.length < 6) {
      html += '<button class="btn ghost sm" data-act="formAddOpt">+ 增加选项</button>';
    }

    html += '<div class="field mt12"><span class="label">正确答案 <span class="req">*</span></span>' +
      '<input class="input" id="f-answer" placeholder="如：B（多选可填 AB）" value="' + esc(f.answer) + '"></div>';

    html += '<div class="field"><span class="label">当时错误思路（防止以后再次踩坑）</span>' +
      '<textarea class="textarea" id="f-wrong" rows="3" placeholder="你当时为什么做错？错误的想法是什么？">' + esc(f.wrongThinking) + '</textarea></div>';

    html += '<div class="field"><span class="label">正确思路（可选，复盘时再补充）</span>' +
      '<textarea class="textarea" id="f-correct" rows="3" placeholder="这道题的正确解题思路">' + esc(f.correctThinking) + '</textarea></div>';

    html += '<div class="field"><span class="label">几天后复盘 <span class="req">*</span></span>' +
      '<div class="chips">' +
      REVIEW_OPTIONS.map(function (n) {
        return '<span class="chip' + (f.reviewDays === n && !f.reviewWeekday ? ' active' : '') + '" data-act="formDays" data-days="' + n + '">' + n + '天</span>';
      }).join('') +
      '</div>' +
      '<input class="input mt12" id="f-days" type="number" min="1" max="365" placeholder="或自定义天数" value="' + (REVIEW_OPTIONS.indexOf(f.reviewDays) < 0 && !f.reviewWeekday ? f.reviewDays : '') + '"></div>';

    html += '<div class="field"><span class="label">固定每周星期几复盘 <span class="muted">（可选，选此则忽略上面天数）</span></span>' +
      '<div class="chips">' +
      '<span class="chip' + (!f.reviewWeekday ? ' active' : '') + '" data-act="formWeekday" data-wd="0">不固定</span>' +
      WEEKDAY_NAMES.map(function (name, i) {
        return '<span class="chip' + (f.reviewWeekday === i + 1 ? ' active' : '') + '" data-act="formWeekday" data-wd="' + (i + 1) + '">' + name + '</span>';
      }).join('') +
      '</div></div>';

    html += '<button class="btn" data-act="saveForm">' + (f.id ? '保存修改' : '保存错题') + '</button>';
    html += '<div class="divider"></div>';
    html += '<button class="btn gray" data-act="closeOverlay">取消</button>';
    html += '</div></div>';
    return html;
  }

  function openDetail(id) {
    var q = findQ(id);
    if (!q) return;
    state.overlay = { type: 'detail', id: id };
    render();
  }

  function optContentHtml(q, i, text) {
    var img = q.optImgs && q.optImgs[i];
    if (img) return '<img class="opt-img" src="' + img + '">';
    var clean = stripOptionPrefix(text);
    return esc(clean || text || '');
  }

  function renderDetail() {
    var q = findQ(state.overlay.id);
    if (!q) { state.overlay = null; render(); return ''; }
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">错题详情</div></div>' +
      '<div class="overlay-body">';

    html += '<div class="card">';
    html += '<div class="q-top">' + catTag(q.category, q.subCategory) + statusTag(q) + '</div>';
    if (q.source) html += '<p class="muted" style="margin-top:6px">来源：' + esc(q.source) + '</p>';
    if (q.reviewDate) html += '<p class="muted">' + (q.reviewWeekday ? '固定每周' + wdLabel(q.reviewWeekday) + '复盘 · ' : '') + '复盘日：' + fmtDate(q.reviewDate) + '　已复盘 ' + (q.rounds || 0) + ' 次</p>';
    if (q.stem) html += '<p style="font-size:14.5px;white-space:pre-wrap;margin-top:8px">' + esc(q.stem) + '</p>';
    if (q.image) html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
    if (q.options && q.options.length) {
      html += '<div style="margin-top:10px">';
      q.options.forEach(function (opt, i) {
        html += '<div class="opt" style="cursor:default;background:#fff;border:none;padding:4px 0"><span class="key" style="width:22px;height:22px;font-size:12px">' + optionLetters[i] + '</span><span class="txt">' + optContentHtml(q, i, opt) + '</span></div>';
      });
      html += '</div>';
    }
    if (q.answer) {
      html += '<div class="mt12"><span class="answer-pill" id="detail-answer" style="display:none">正确答案 ' + esc(q.answer) + '</span>' +
        '<button class="btn gray sm" id="detail-show-answer">查看正确答案</button></div>';
    }
    html += '</div>';

    html += '<div class="card"><div class="detail-block"><div class="lb">当时的错误思路</div>' +
      '<div class="val">' + (q.wrongThinking ? esc(q.wrongThinking) : '<span class="muted">未填写</span>') + '</div></div>' +
      '<div class="detail-block"><div class="lb">正确思路</div>' +
      '<div class="val">' + (q.correctThinking ? esc(q.correctThinking) : '<span class="muted">尚未填写</span>') + '</div></div></div>';

    if (q.reviewHistory && q.reviewHistory.length) {
      html += '<div class="card"><div class="detail-block"><div class="lb">复盘记录</div>';
      q.reviewHistory.forEach(function (h) {
        html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">' +
          '<span>' + h.date + '</span>' +
          '<span style="color:' + (h.correct ? 'var(--ok)' : 'var(--danger)') + ';font-weight:600">' + (h.correct ? '答对' : '答错') + '</span>' +
          '</div>';
      });
      html += '</div></div>';
    }

    html += '<div class="actions">';
    if (q.status === 'pending') {
      html += '<button class="btn" data-act="practice" data-id="' + q.id + '">去复盘</button>';
      html += '<button class="btn gray" data-act="snooze" data-id="' + q.id + '">推迟3天</button>';
    } else {
      html += '<button class="btn" data-act="practice" data-id="' + q.id + '">再做一次</button>';
      html += '<button class="btn gray" data-act="reactivate" data-id="' + q.id + '">重新待复盘</button>';
    }
    html += '</div>';
    html += '<div class="actions">' +
      '<button class="btn ghost" data-act="edit" data-id="' + q.id + '">编辑</button>' +
      '<button class="btn danger" data-act="del" data-id="' + q.id + '">删除</button>' +
      '</div>';
    html += '</div></div>';
    return html;
  }

  function openPractice(id) {
    var q = findQ(id);
    if (!q) return;
    state.practice = { id: id, selected: {}, answered: false, again: false, note: q.correctThinking || '' };
    state.overlay = { type: 'practice', id: id };
    render();
  }

  function renderPractice() {
    var q = findQ(state.overlay.id);
    if (!q) { state.overlay = null; render(); return ''; }
    var p = state.practice;
    var answerSet = extractLetters(q.answer);
    var multi = answerSet.length > 1;

    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closePractice">&times;</span>' +
      '<div class="title">复盘做题</div>' +
      '<span class="header-pen' + (state.scratch ? ' on' : '') + '" data-act="toggleScratch" title="临时草稿纸">' + (state.scratch ? '✓' : '✏') + '</span></div>' +
      '<div class="overlay-body">';

    html += '<div class="practice-head">' +
      '<span class="round-badge">第 ' + ((q.rounds || 0) + 1) + ' 次复盘</span>' +
      '<h2>' + catTag(q.category, q.subCategory) + '</h2></div>';

    html += '<div class="card">';
    if (q.stem) html += '<p style="font-size:15px;white-space:pre-wrap">' + esc(q.stem) + '</p>';
    if (q.image) html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
    if (q.options && q.options.length) {
      html += '<div class="opt-list">';
      q.options.forEach(function (opt, i) {
        var key = optionLetters[i];
        var cls = 'opt';
        if (p.answered) {
          var correct = answerSet.indexOf(key) >= 0;
          var chosen = !!p.selected[key];
          if (correct) cls += ' correct';
          else if (chosen) cls += ' wrong';
        } else if (p.selected[key]) {
          cls += ' selected';
        }
        html += '<div class="' + cls + '" data-act="pickOpt" data-key="' + key + '">' +
          '<span class="key">' + key + '</span><span class="txt">' + optContentHtml(q, i, opt) + '</span></div>';
      });
      html += '</div>';
      if (multi && !p.answered) html += '<p class="muted">本题为多选题，可多选</p>';
    }
    if (!p.answered) {
      html += '<button class="btn mt12" data-act="submitAnswer">提交答案</button>';
    }
    html += '</div>';

    if (p.answered) {
      var correct = isCorrect(p.selected, q.answer);
      html += '<div class="result-box">';
      html += '<div class="result-banner ' + (correct ? 'right' : 'wrong') + '">' + (correct ? '回答正确' : '回答错误') + '</div>';
      html += '<div class="card" style="margin-top:12px">';
      html += '<div class="detail-block"><div class="lb">正确答案</div><div class="val"><span class="answer-pill">' + esc(q.answer) + '</span></div></div>';
      if (q.wrongThinking) {
        html += '<div class="think-box"><div class="lb">回顾：你当时的错误思路</div>' + esc(q.wrongThinking) + '</div>';
      }
      html += '</div>';

      html += '<div class="card">';
      html += '<div class="field"><span class="label">现在写下正确思路（复盘的意义所在）</span>' +
        '<textarea class="textarea" id="p-note" rows="4" placeholder="例如：这类题应先看提问方式，再定位原文，关键词是……">' + esc(p.note) + '</textarea></div>';
      html += '<label style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:12px;cursor:pointer">' +
        '<input type="checkbox" id="p-again"' + (p.again ? ' checked' : '') + '> 答错了，3 天后再次复盘</label>';
      html += '<button class="btn" data-act="finishPractice">完成复盘</button>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function extractLetters(s) {
    var m = String(s || '').toUpperCase().match(/[A-F]/g);
    return m ? m : [];
  }
  function isCorrect(selected, answer) {
    var a = extractLetters(answer).sort().join('');
    var b = Object.keys(selected).sort().join('');
    return a !== '' && a === b;
  }

  function findQ(id) {
    for (var i = 0; i < state.questions.length; i++) {
      if (state.questions[i].id === id) return state.questions[i];
    }
    return null;
  }

  function saveForm() {
    var f = state.form;
    var category = f.category;
    var stemEl = $('#f-stem');
    var stem = stemEl ? stemEl.value.trim() : (f.stem || '');
    var answer = $('#f-answer').value.trim().toUpperCase();
    var wrong = $('#f-wrong').value.trim();
    var correct = $('#f-correct').value.trim();
    var sourceEl = $('#f-source');
    var source = sourceEl ? sourceEl.value.trim() : (f.source || '');
    var customDays = parseInt($('#f-days').value, 10);
    var reviewDays = customDays > 0 ? customDays : f.reviewDays;
    var reviewWeekday = f.reviewWeekday || 0;

    if (!category) { toast('请选择题目的分类'); return; }
    if (!f.image && !stem) { toast('请上传题干截图'); return; }
    if (!answer) { toast('请填写正确答案'); return; }
    if (!reviewWeekday && (!reviewDays || reviewDays < 1)) { toast('请选择复盘天数或固定星期'); return; }

    var opts = [];
    var optImgs = [];
    f.options.forEach(function (o, i) {
      var text = String(o || '').trim().replace(/^[A-F]\s*[.、．)）:：]\s*/, '');
      var img = f.optImgs[i];
      if (text || img) {
        opts.push(optionLetters[i] + '. ' + text);
        optImgs.push(img || null);
      }
    });

    var now = todayStr();
    var nextReview = reviewWeekday ? nextWeekdayDate(now, reviewWeekday) : addDays(now, reviewDays);
    if (f.id) {
      var q = findQ(f.id);
      q.category = category;
      q.subCategory = f.subCategory || '';
      q.stem = stem;
      q.options = opts;
      q.optImgs = optImgs;
      q.answer = answer;
      q.wrongThinking = wrong;
      q.correctThinking = correct;
      q.source = source;
      q.reviewDays = reviewDays;
      q.reviewWeekday = reviewWeekday;
      q.reviewDate = nextReview;
      q.image = f.image;
      q.status = 'pending';
      q.updatedAt = Date.now();
    } else {
      state.questions.unshift({
        id: uid(),
        category: category,
        subCategory: f.subCategory || '',
        stem: stem,
        options: opts,
        optImgs: optImgs,
        answer: answer,
        wrongThinking: wrong,
        correctThinking: correct,
        source: source,
        image: f.image,
        reviewDays: reviewDays,
        reviewWeekday: reviewWeekday,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewDate: nextReview,
        status: 'pending',
        rounds: 0,
        reviewHistory: []
      });
    }
    save();
    if (source) {
      state.sourceHistory = state.sourceHistory.filter(function (s) { return s !== source; });
      state.sourceHistory.unshift(source);
      saveSources();
    }
    state.overlay = null;
    state.form = null;
    state.tab = 'bank';
    render();
    toast(reviewWeekday ? '已保存，每周' + wdLabel(reviewWeekday) + '复盘' : '已保存，' + reviewDays + ' 天后复盘');
  }

  function submitPractice() {
    var p = state.practice;
    var keys = Object.keys(p.selected);
    if (!keys.length) { toast('请先选择答案'); return; }
    p.answered = true;
    var q = findQ(p.id);
    var correct = isCorrect(p.selected, q.answer);
    p.again = !correct;
    state.keepScroll = true;
    render();
  }

  function finishPractice() {
    var p = state.practice;
    var q = findQ(p.id);
    if (!q) return;
    var note = $('#p-note').value.trim();
    if (!note) { toast('请写下你的正确思路'); return; }
    var again = $('#p-again').checked;
    q.correctThinking = note;
    q.reviewHistory = q.reviewHistory || [];
    q.reviewHistory.push({ date: todayStr(), correct: isCorrect(p.selected, q.answer) });
    q.rounds = (q.rounds || 0) + 1;
    if (again) {
      q.status = 'pending';
      q.reviewDate = q.reviewWeekday ? nextWeekdayDate(todayStr(), q.reviewWeekday) : addDays(todayStr(), 3);
    } else {
      q.status = 'done';
      q.doneDate = todayStr();
      q.reviewDate = null;
    }
    q.updatedAt = Date.now();
    save();
    state.overlay = null;
    state.practice = null;
    render();
    toast(again ? (q.reviewWeekday ? '已记录，每周' + wdLabel(q.reviewWeekday) + '再次复盘' : '已记录，3 天后再次复盘') : '复盘完成');
  }

  function snooze(id) {
    var q = findQ(id);
    if (!q) return;
    q.reviewDate = q.reviewWeekday ? nextWeekdayDate(todayStr(), q.reviewWeekday) : addDays(todayStr(), 3);
    q.updatedAt = Date.now();
    save();
    render();
    toast(q.reviewWeekday ? '已推迟到' + wdLabel(q.reviewWeekday) : '已推迟 3 天');
  }

  function reactivate(id) {
    var q = findQ(id);
    if (!q) return;
    q.status = 'pending';
    q.reviewDate = q.reviewWeekday ? nextWeekdayDate(todayStr(), q.reviewWeekday) : addDays(todayStr(), 1);
    q.updatedAt = Date.now();
    save();
    render();
    toast(q.reviewWeekday ? '已重新加入复盘计划（每周' + wdLabel(q.reviewWeekday) + '）' : '已重新加入复盘计划（明天）');
  }

  async function del(id) {
    var q = findQ(id);
    if (!q) return;
    var ok = await confirmDialog('删除错题', '确定删除这道错题吗？删除后不可恢复。', '删除', true);
    if (!ok) return;
    state.questions = state.questions.filter(function (x) { return x.id !== id; });
    save();
    state.overlay = null;
    render();
    toast('已删除');
  }

  function parseOcrText(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var result = { stem: '', options: [], answer: '' };
    var optionReStrict = /^([A-F])\s*[.、．)）:：]\s*(.+)$/;
    var optionReNoSep = /^([A-F])\s+(.+)$/;
    var optionReLoose = /([A-F])\s*[.、．)）:：]\s*(.+)$/;
    var answerRe = /(?:正\s*确|参\s*考|标\s*准)?\s*答[案秦窒]\s*[:：]?\s*([A-F])/;
    var stemLines = [];
    var optionLines = [];
    var inOptions = false;

    lines.forEach(function (line) {
      if (!result.answer) {
        var am = line.match(answerRe);
        if (am) {
          result.answer = am[1];
          line = line.replace(answerRe, '').trim();
        }
      }
      var m = line.match(optionReStrict) || line.match(optionReNoSep);
      if (m) {
        inOptions = true;
        optionLines.push({ key: m[1], text: m[2] });
        return;
      }
      if (!inOptions) {
        stemLines.push(line);
        return;
      }
      var lm = line.match(optionReLoose);
      if (lm && optionLines.length && lm[1] > optionLines[optionLines.length - 1].key) {
        optionLines.push({ key: lm[1], text: lm[2] });
      } else if (optionLines.length) {
        optionLines[optionLines.length - 1].text += line;
      }
    });

    if (optionLines.length >= 2) {
      result.stem = stemLines.join('\n');
      result.options = optionLines.map(function (o) { return o.key + '. ' + o.text; });
      if (!result.stem) result.stem = '（题干识别失败，请手动补充）';
    } else {
      result.stem = lines.join('\n');
    }
    return result;
  }

  function ocrUpdate(status, progress) {
    state.ocrStatus = status;
    state.ocrProgress = progress || 0;
    var fill = $('#ocr-fill');
    var label = $('#ocr-status');
    if (fill) fill.style.width = Math.round((progress || 0) * 100) + '%';
    if (label) label.textContent = status;
  }

  async function runOcr() {
    var f = state.form;
    if (!f || !f.image) { toast('请先选择错题截图'); return; }
    state.ocrRunning = true;
    state.ocrProgress = 0;
    state.ocrStatus = '正在识别题干与选项…';
    render();
    try {
      var img = await prepareOcrImage(f.image);
      ocrUpdate('AI 识别中…', 0.5);
      var text = await zhipuVision(img,
        '请识别这张考试错题截图中的全部文字。' +
        '输出要求：先输出题干内容；如果图中有选项，每行输出一个选项，格式为"A. 选项内容"；' +
        '如果图中有正确答案标记（如"答案：B"），请在最后一行输出"答案：B"（用大写字母）。' +
        '请完整、准确地输出所有文字，不要遗漏，不要额外解释。',
        4096);
      if (!state.form || !state.overlay || state.overlay.type !== 'form') {
        state.ocrRunning = false;
        return;
      }
      var parsed = parseOcrText(text);
      f.stem = parsed.stem || f.stem;
      if (parsed.options.length >= 2) {
        var oldImgs = f.optImgs || [];
        f.options = parsed.options;
        f.optImgs = parsed.options.map(function (_, idx) { return idx < oldImgs.length ? oldImgs[idx] : null; });
      }
      if (parsed.answer) f.answer = f.answer || parsed.answer;
      state.ocrRunning = false;
      state.keepScroll = true;
      render();
      if (parsed.options.length >= 2) toast('识别完成，请核对内容');
      else toast('识别完成，未能识别出选项，请手动填写');
    } catch (e) {
      state.ocrRunning = false;
      render();
      toast('识别失败：' + (e && e.message ? e.message : e));
    }
  }

  async function ocrExtractOptions(dataUrl) {
    var f = state.form;
    if (!f) return;
    state.ocrRunning = true;
    state.ocrProgress = 0;
    state.ocrStatus = '正在识别选项…';
    render();
    try {
      var img = await prepareOcrImage(dataUrl);
      ocrUpdate('AI 识别中…', 0.5);
      var text = await zhipuVision(img,
        '请识别这张图片中的全部选项文字，每行输出一个选项，格式为"A. 选项内容"（A 为大写字母）。' +
        '请完整、准确地输出所有选项，不要遗漏，不要额外解释。',
        2048);
      if (!state.form || !state.overlay || state.overlay.type !== 'form') {
        state.ocrRunning = false;
        return;
      }
      var parsed = parseOcrText(text);
      if (parsed.options.length >= 2) {
        var oldImgs = f.optImgs || [];
        f.options = parsed.options;
        f.optImgs = parsed.options.map(function (_, idx) { return idx < oldImgs.length ? oldImgs[idx] : null; });
        state.ocrRunning = false;
        state.keepScroll = true;
        render();
        toast('已提取 ' + parsed.options.length + ' 个选项，请核对');
      } else {
        state.ocrRunning = false;
        state.keepScroll = true;
        render();
        toast('未能识别出选项，请上传更清晰的截图');
      }
    } catch (e) {
      state.ocrRunning = false;
      render();
      toast('识别失败：' + (e && e.message ? e.message : e));
    }
  }

  if (!IS_NODE) document.addEventListener('click', function (e) {
    var showBtn = e.target.closest('#detail-show-answer');
    if (showBtn) {
      var ans = $('#detail-answer');
      if (ans) {
        ans.style.display = 'inline-block';
        showBtn.style.display = 'none';
      }
      return;
    }
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');
    var cat = el.getAttribute('data-cat');
    var sub = el.getAttribute('data-sub');
    var key = el.getAttribute('data-key');
    var days = el.getAttribute('data-days');
    var kind = el.getAttribute('data-kind');
    var i = el.getAttribute('data-i');

    switch (act) {
      case 'goHome':
        state.tab = 'home';
        render();
        break;
      case 'openAdd':
        state.tab = 'add';
        render();
        break;
      case 'switchTab':
        state.tab = key;
        render();
        break;
      case 'queryIdiom':
        var idiomWord = $('#idiom-input') ? $('#idiom-input').value.trim() : '';
        if (!idiomWord) { toast('请输入词语或成语'); return; }
        state.idiom.loading = true;
        state.idiom.result = null;
        state.idiom.proof = { loading: false, text: '' };
        updateIdiomResultBox('querying');
        fetchIdiom(idiomWord).then(function (res) {
          state.idiom.loading = false;
          state.idiom.result = res;
          updateIdiomResultBox(res);
        });
        break;
      case 'randomIdiom':
        var rnd = FALLBACK_IDIOMS[Math.floor(Math.random() * FALLBACK_IDIOMS.length)];
        state.idiom.loading = true;
        state.idiom.result = null;
        state.idiom.proof = { loading: false, text: '' };
        updateIdiomResultBox('querying');
        fetchIdiom(rnd.name).then(function (res) {
          state.idiom.loading = false;
          state.idiom.result = res;
          updateIdiomResultBox(res);
        });
        break;
      case 'proofreadMeaning':
        var pw = state.idiom.result ? state.idiom.result.name : '';
        var pm = $('#my-meaning') ? $('#my-meaning').value.trim() : '';
        if (!pm) { toast('请先写下你的释义'); return; }
        state.idiom.proof.loading = true;
        state.idiom.proof.text = '';
        updateProofreadBox('loading');
        fetchAiAnswer('请校对下面关于词语"' + pw + '"的理解是否正确。我的理解：' + pm +
          '。如果理解准确，请简要肯定；如果理解有偏差或不完整，请指出问题并给出正确的释义。请用中文简洁回答，200字以内。')
          .then(function (txt) {
            state.idiom.proof.loading = false;
            state.idiom.proof.text = txt;
            updateProofreadBox('result', txt);
          })
          .catch(function (err) {
            state.idiom.proof.loading = false;
            updateProofreadBox('error', (err && err.message) || '校对失败，请重试');
          });
        break;
      case 'saveIdiom':
        if (state.idiom.result) {
          var exists = state.idiom.saved.some(function (s) { return s.name === state.idiom.result.name; });
          if (!exists) {
            var src = state.idiom.result;
            var toSave = { name: src.name, meaning: src.meaning || '' };
            if (state.idiom.proof.text) toSave.meaning = state.idiom.proof.text;
            if (src.provenance) toSave.provenance = src.provenance;
            if (src.example) toSave.example = src.example;
            if (src.extra && src.extra.discLines && src.extra.discLines.length) toSave.discLines = src.extra.discLines.slice();
            var myMeanEl = $('#my-meaning');
            if (myMeanEl && myMeanEl.value.trim()) toSave.myMeaning = myMeanEl.value.trim();
            state.idiom.saved.unshift(toSave);
            saveIdioms();
            toast('已收藏');
          }
          refreshIdiomSaveBtn();
          updateIdiomSavedBox();
        }
        break;
      case 'unsaveIdiom':
        state.idiom.saved = state.idiom.saved.filter(function (s) { return s.name !== key; });
        saveIdioms();
        refreshIdiomSaveBtn();
        updateIdiomSavedBox();
        toast('已移除');
        break;
      case 'openIdiomSaved':
        for (var si = 0; si < state.idiom.saved.length; si++) {
          if (state.idiom.saved[si].name === key) {
            var sv = state.idiom.saved[si];
            var recon = { name: sv.name, meaning: sv.meaning || '', extra: { type: 'word' } };
            if (sv.myMeaning) recon.myMeaning = sv.myMeaning;
            if (sv.provenance) recon.provenance = sv.provenance;
            if (sv.example) recon.example = sv.example;
            if (sv.discLines && sv.discLines.length) recon.extra.discLines = sv.discLines;
            state.idiom.result = recon;
            state.idiom.proof = { loading: false, text: '' };
            updateIdiomResultBox(recon);
            var box = $('#idiom-result-box');
            if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            toast('已显示详情');
          }
        }
        break;
      case 'clearIdioms':
        confirmDialog('清空收藏', '确定清空全部收藏的词语吗？此操作不可恢复。', '清空', true).then(function (ok) {
          if (ok) {
            state.idiom.saved = [];
            saveIdioms();
            refreshIdiomSaveBtn();
            updateIdiomSavedBox();
            toast('已清空');
          }
        });
        break;
      case 'clearAiAnalysis':
        state.aiAnalysis = '';
        state.keepScroll = true;
        render();
        break;
      case 'aiAnalyze':
        if (state.aiAnalyzing) return;
        if (!(state.questions || []).length) { toast('暂无错题数据，先去添加错题吧'); return; }
        state.aiAnalyzing = true;
        state.keepScroll = true;
        render();
        var summary = buildWrongBookSummary();
        fetchAiAnswer(
          '请根据我的错题本数据，分析我的学习情况：指出薄弱环节（分类和子分类）、复盘进度的风险点（逾期/待复盘）、以及接下来的复习建议（哪些分类优先、每天怎么安排）。请用中文简洁回答，600字以内。\n\n【数据】\n' + summary,
          []
        ).then(function (txt) {
          state.aiAnalyzing = false;
          state.aiAnalysis = txt;
          state.keepScroll = true;
          render();
        }).catch(function (err) {
          state.aiAnalyzing = false;
          state.keepScroll = true;
          render();
          toast('AI 分析失败：' + ((err && err.message) || '请重试'));
        });
        break;
      case 'sendAiQuestion':
        var aiInputEl = $('#ai-input');
        var aiQ = aiInputEl ? aiInputEl.value.trim() : '';
        var aiImg = state.ai.pendingImg || '';
        if (!aiQ && !aiImg) { toast('请输入问题或上传图片'); return; }
        if (state.ai.loading) return;
        state.ai.history.push({ role: 'user', content: aiQ, img: aiImg });
        state.ai.loading = true;
        state.ai.pendingImg = '';
        saveAiHistory();
        if (aiInputEl) aiInputEl.value = '';
        state.ai.input = '';
        var msgs = $('#ai-msgs');
        if (msgs) {
          var userEl = document.createElement('div');
          userEl.className = 'ai-msg user';
          if (aiImg) {
            var imgEl = document.createElement('img');
            imgEl.className = 'ai-msg-img';
            imgEl.src = aiImg;
            imgEl.alt = '图片';
            userEl.appendChild(imgEl);
          }
          if (aiQ) userEl.innerHTML += aiText('', aiQ);
          msgs.appendChild(userEl);
          var typingEl = document.createElement('div');
          typingEl.className = 'ai-msg bot typing';
          typingEl.innerHTML = '正在思考…';
          msgs.appendChild(typingEl);
          aiScrollBottom(msgs);
        }
        var aiRequest = aiImg
          ? zhipuVision(aiImg, (aiQ || '请分析这张图片').replace(/["\\]/g, ' '), 1024)
          : fetchAiAnswer(aiQ, state.ai.history.slice(0, -1));
        aiRequest.then(function (answer) {
          state.ai.history.push({ role: 'bot', content: answer });
          saveAiHistory();
          if (state.tab === 'ai' && msgs) {
            typingEl.className = 'ai-msg bot';
            typingEl.innerHTML = '';
            typeInto(typingEl, answer, function () {
              state.ai.loading = false;
              var sendBtn = document.querySelector('[data-act="sendAiQuestion"]');
              if (sendBtn) sendBtn.disabled = false;
              var imgBtn = document.querySelector('[data-act="pickAiImage"]');
              if (imgBtn) imgBtn.disabled = false;
              aiScrollBottom(msgs);
            });
          } else {
            state.ai.loading = false;
          }
        }).catch(function (err) {
          state.ai.history.push({ role: 'bot', content: '（' + err.message + '）' });
          state.ai.loading = false;
          saveAiHistory();
          if (state.tab === 'ai' && msgs) {
            typingEl.className = 'ai-msg bot';
            typingEl.innerHTML = '<span class="muted">' + esc(err.message) + '</span>';
            aiScrollBottom(msgs);
          }
        });
        break;
      case 'pickAiImage':
        pickImage('gallery').then(function (dataUrl) {
          if (!dataUrl) return;
          return compressImage(dataUrl, 1100, 0.7).then(function (small) {
            state.ai.pendingImg = small;
            state.keepScroll = true;
            render();
            var amsgs = $('#ai-msgs');
            if (amsgs) aiScrollBottom(amsgs);
          });
        }).catch(function (err) {
          toast('图片上传失败：' + (err.message || err));
        });
        break;
      case 'removeAiImage':
        state.ai.pendingImg = '';
        state.keepScroll = true;
        render();
        var amsgs2 = $('#ai-msgs');
        if (amsgs2) aiScrollBottom(amsgs2);
        break;
      case 'clearAiHistory':
        confirmDialog('清空对话', '确定清空全部问答记录吗？', '清空', true).then(function (ok) {
          if (ok) {
            state.ai.history = [];
            saveAiHistory();
            render();
            toast('已清空');
          }
        });
        break;
      case 'openDetail':
        openDetail(id);
        break;
      case 'practice':
        openPractice(id);
        break;
      case 'closeOverlay':
        state.overlay = null;
        state.form = null;
        state.practice = null;
        if (state.tab === 'add') state.tab = 'bank';
        render();
        break;
      case 'closePractice':
        state.practice = null;
        state.overlay = null;
        state.scratch = false;
        if (state.tab === 'add') state.tab = 'bank';
        render();
        break;
      case 'edit':
        openForm(findQ(id));
        render();
        break;
      case 'del':
        del(id);
        break;
      case 'snooze':
        snooze(id);
        break;
      case 'reactivate':
        reactivate(id);
        break;
      case 'filterCat':
        state.filterCat = cat;
        state.filterSub = '';
        render();
        break;
      case 'filterSub':
        state.filterSub = sub === 'all' ? '' : sub;
        render();
        break;
      case 'toggleScratch':
        state.scratch = !state.scratch;
        state.keepScroll = true;
        render();
        break;
      case 'scratchClear':
        var scCanvas = $('#scratch-canvas');
        if (scCanvas) {
          scCanvas.getContext('2d').clearRect(0, 0, scCanvas.width, scCanvas.height);
        }
        break;
      case 'scratchTool':
        var tool = el.getAttribute('data-tool') || 'pen';
        state.scratchTool = tool;
        var scTb = $('.scratch-bar');
        if (scTb) {
          $all('[data-act="scratchTool"]', scTb).forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-tool') === tool);
          });
          $all('[data-act="scratchColor"]', scTb).forEach(function (b) {
            b.classList.toggle('active', tool !== 'eraser' && b.getAttribute('data-color') === state.scratchColor);
          });
          var scTip = $('.scratch-tip', scTb);
          if (scTip) scTip.textContent = tool === 'eraser' ? '橡皮擦模式：擦除笔迹' : '手写笔 / 手指直接书写';
        }
        var scCv = $('#scratch-canvas');
        if (scCv) {
          var scCtx = scCv.getContext('2d');
          scCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
          scCtx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : state.scratchColor;
        }
        break;
      case 'scratchColor':
        var scColor = el.getAttribute('data-color') || '#1f2430';
        state.scratchColor = scColor;
        state.scratchTool = 'pen';
        var scCv2 = $('#scratch-canvas');
        if (scCv2) {
          var scCtx2 = scCv2.getContext('2d');
          scCtx2.globalCompositeOperation = 'source-over';
          scCtx2.strokeStyle = scColor;
        }
        var scTb2 = $('.scratch-bar');
        if (scTb2) {
          $all('[data-act="scratchTool"]', scTb2).forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-tool') === 'pen');
          });
          $all('[data-act="scratchColor"]', scTb2).forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-color') === scColor);
          });
          var scTip2 = $('.scratch-tip', scTb2);
          if (scTip2) scTip2.textContent = '手写笔 / 手指直接书写';
        }
        break;
      case 'formCat':
        state.form.category = cat;
        state.form.subCategory = '';
        state.keepScroll = true;
        render();
        break;
      case 'formSubCat':
        state.form.subCategory = sub;
        state.keepScroll = true;
        render();
        break;
      case 'fillSource':
        state.form.source = el.getAttribute('data-src') || '';
        state.keepScroll = true;
        render();
        break;
      case 'delSource':
        var delSrc = el.getAttribute('data-src') || '';
        state.sourceHistory = state.sourceHistory.filter(function (s) { return s !== delSrc; });
        saveSources();
        state.keepScroll = true;
        render();
        break;
      case 'formDays':
        state.form.reviewDays = parseInt(days, 10);
        state.form.reviewWeekday = 0;
        state.keepScroll = true;
        render();
        break;
      case 'formWeekday':
        state.form.reviewWeekday = parseInt(el.getAttribute('data-wd'), 10) || 0;
        state.keepScroll = true;
        render();
        break;
      case 'formAddOpt':
        if (state.form.options.length < 6) {
          state.form.options.push('');
          state.form.optImgs.push(null);
          state.keepScroll = true;
          render();
        }
        break;
      case 'formDelOpt':
        state.form.options.splice(parseInt(i, 10), 1);
        state.form.optImgs.splice(parseInt(i, 10), 1);
        state.keepScroll = true;
        render();
        break;
      case 'formRemoveImg':
        state.form.image = null;
        state.keepScroll = true;
        render();
        break;
      case 'formOptImg':
        pickImage('gallery').then(function (dataUrl) {
          var idx = parseInt(i, 10);
          openCrop(dataUrl, function (cropped) {
            state.form.optImgs[idx] = cropped;
            state.keepScroll = true;
            render();
          }, 'opt-' + idx);
        }, function (err) { toast(err.message); });
        break;
      case 'formOptImgDel':
        state.form.optImgs[parseInt(i, 10)] = null;
        state.keepScroll = true;
        render();
        break;
      case 'formOptImgCrop':
        var cropIdx = parseInt(i, 10);
        var cropImg = state.form.optImgs[cropIdx];
        if (cropImg) {
          openCrop(cropImg, function (cropped) {
            state.form.optImgs[cropIdx] = cropped;
            state.keepScroll = true;
            render();
          }, 'opt-' + cropIdx);
        }
        break;
      case 'ocrOptsImage':
        pickImage('gallery').then(function (dataUrl) {
          openCrop(dataUrl, function (cropped) {
            ocrExtractOptions(cropped);
          }, 'opt-extract');
        }, function (err) { toast(err.message); });
        break;
      case 'formRepick':
        pickImage(kind).then(function (dataUrl) {
          openCrop(dataUrl, function (cropped) {
            state.form.image = cropped;
            state.keepScroll = true;
            render();
          });
        }, function (err) { toast(err.message); });
        break;
      case 'formCrop':
        if (state.form.image) {
          openCrop(state.form.image, function (cropped) {
            state.form.image = cropped;
            state.keepScroll = true;
            render();
          });
        }
        break;
      case 'cropCancel':
        closeCrop();
        break;
      case 'cropRepick':
        pickImage('gallery').then(function (dataUrl) {
          state.overlay.image = dataUrl;
          state.crop = null;
          render();
        }, function (err) { toast(err.message); });
        break;
      case 'cropConfirm':
        cropConfirm();
        break;
      case 'runOcr':
        runOcr();
        break;
      case 'saveForm':
        saveForm();
        break;
      case 'pickOpt':
        if (state.practice.answered) return;
        var p = state.practice;
        var q = findQ(p.id);
        var multi = extractLetters(q.answer).length > 1;
        if (p.selected[key]) {
          delete p.selected[key];
        } else {
          if (!multi) p.selected = {};
          p.selected[key] = true;
        }
        var optEls = document.querySelectorAll('.opt[data-key]');
        for (var oi = 0; oi < optEls.length; oi++) {
          var ok = optEls[oi].getAttribute('data-key');
          if (p.selected[ok]) optEls[oi].classList.add('selected');
          else optEls[oi].classList.remove('selected');
        }
        break;
      case 'submitAnswer':
        submitPractice();
        break;
      case 'finishPractice':
        finishPractice();
        break;
      case 'startCalc':
        state.calc.current = generateCalcQuestion();
        state.calc.startTime = Date.now();
        state.calc.answered = false;
        state.calc.userAnswer = null;
        state.keepScroll = true;
        render();
        startCalcTimer();
        break;
      case 'submitCalc':
        stopCalcTimer();
        var calcInput = $('#calc-answer') ? $('#calc-answer').value : '';
        calcInput = String(calcInput || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d.-]/g, '');
        var calcAnswer = parseFloat(calcInput);
        var elapsed = ((Date.now() - state.calc.startTime) / 1000).toFixed(1);
        var relError = state.calc.current.answer !== 0 ? Math.abs(calcAnswer - state.calc.current.answer) / state.calc.current.answer * 100 : 0;
        var ok = relError <= 2;
        state.calc.history.push({
          date: todayStr(),
          stem: state.calc.current.stem,
          answer: state.calc.current.answer,
          userAnswer: calcAnswer,
          correct: ok,
          elapsed: elapsed
        });
        state.calc.answered = true;
        state.calc.userAnswer = calcAnswer;
        state.calc.elapsed = elapsed;
        saveCalcHistory();
        state.keepScroll = true;
        render();
        toast(ok ? '回答正确！' : '答错，正确答案：' + state.calc.current.answer);
        break;
      case 'nextCalc':
        state.calc.current = generateCalcQuestion();
        state.calc.startTime = Date.now();
        state.calc.answered = false;
        state.calc.userAnswer = null;
        state.keepScroll = true;
        render();
        startCalcTimer();
        break;
      case 'delCalcRecord':
        var delIdx = parseInt(i, 10);
        confirmDialog('删除记录', '确定删除这条练习记录吗？', '删除', true).then(function (ok) {
          if (ok) {
            state.calc.history.splice(delIdx, 1);
            saveCalcHistory();
            render();
            toast('已删除');
          }
        });
        break;
      case 'clearCalcHistory':
        confirmDialog('清空记录', '确定清空所有练习记录吗？此操作不可恢复。', '清空', true).then(function (ok) {
          if (ok) {
            state.calc.history = [];
            saveCalcHistory();
            render();
            toast('已清空');
          }
        });
        break;
      case 'delayReview':
        var delayQ = findQ(id);
        if (delayQ) {
          delayQ.reviewDate = delayQ.reviewWeekday
            ? nextWeekdayDate(addDays(todayStr(), 1), delayQ.reviewWeekday)
            : addDays(todayStr(), 1);
          delayQ.updatedAt = Date.now();
          save();
          render();
          toast(delayQ.reviewWeekday ? '已延期至下周' + wdLabel(delayQ.reviewWeekday) : '已延期1天');
        }
        break;
      case 'delQuestion':
        var delQ = findQ(id);
        if (delQ) {
          confirmDialog('删除错题', '确定删除这道错题吗？此操作不可恢复。', '删除', true).then(function (ok) {
            if (ok) {
              state.questions = state.questions.filter(function (q) { return q.id !== id; });
              save();
              render();
              toast('已删除');
            }
          });
        }
        break;
      case 'reopenQuestion':
        var reopenQ = findQ(id);
        if (reopenQ) {
          reopenQ.status = 'pending';
          reopenQ.reviewDate = reopenQ.reviewWeekday
            ? nextWeekdayDate(addDays(todayStr(), 1), reopenQ.reviewWeekday)
            : addDays(todayStr(), 1);
          save();
          render();
          toast(reopenQ.reviewWeekday ? '已重新加入复盘（每周' + wdLabel(reopenQ.reviewWeekday) + '）' : '已重新加入复盘');
        }
        break;
      case 'openSettings':
        state.overlay = { type: 'settings' };
        render();
        break;
      case 'setDefaultWeekday':
        state.settings.reviewWeekday = parseInt(el.getAttribute('data-wd'), 10) || 0;
        saveSettings();
        state.keepScroll = true;
        render();
        toast(state.settings.reviewWeekday ? '默认每周' + wdLabel(state.settings.reviewWeekday) + '复盘' : '已改为不固定');
        break;
      case 'applyWeekdayAll':
        var aw = state.settings.reviewWeekday || 0;
        var applied = 0;
        state.questions.forEach(function (qq) {
          if (qq.status === 'pending') {
            qq.reviewWeekday = aw;
            qq.reviewDate = aw ? nextWeekdayDate(todayStr(), aw) : qq.reviewDate;
            applied++;
          }
        });
        if (applied) {
          save();
          toast(aw ? '已应用到 ' + applied + ' 道待复盘错题' : '已取消固定星期');
        } else {
          toast('没有待复盘错题');
        }
        render();
        break;
      case 'manualUpdate':
        if (window.AndroidBridge && typeof window.AndroidBridge.checkUpdate === 'function') {
          toast('正在检查更新…');
          nativeCall('checkUpdate', '').then(function (msg) {
            toast(msg);
          }, function (err) {
            toast(err && err.message ? err.message : '检查更新失败');
          });
        } else {
          toast('当前环境不支持在线更新');
        }
        break;
      case 'openLeaderDetail':
        var li = parseInt(el.getAttribute('data-idx') || '-1', 10);
        var ldr = state.news.leader.items[li];
        if (ldr) {
          state.news.leader.detail = ldr;
          state.overlay = { type: 'leaderDetail' };
          render();
        }
        break;
      case 'openNewsSaved':
        state.overlay = { type: 'newsSaved' };
        render();
        break;
      case 'openNewsDetail':
        var nTitle2 = el.getAttribute('data-title') || '';
        var nSource = el.getAttribute('data-source') || '人民日报';
        var nTime = el.getAttribute('data-time') || '';
        var nws = state.news;
        if (nws.detailLoading) return;
        if (!nws.summaries[nTitle2]) {
          var savedSum = '';
          for (var si2 = 0; si2 < nws.saved.length; si2++) {
            if (nws.saved[si2].title === nTitle2 && nws.saved[si2].summary) { savedSum = nws.saved[si2].summary; break; }
          }
          if (savedSum) {
            nws.summaries[nTitle2] = savedSum;
            saveNewsSummaries();
            state.overlay = { type: 'newsDetail', title: nTitle2, source: nSource, time: nTime };
            render();
            break;
          }
          nws.detailLoading = true;
          nws.detailError = '';
          state.overlay = { type: 'newsDetail', title: nTitle2, source: nSource, time: nTime };
          render();
          aiSummarizeNews({ title: nTitle2 }).then(function (txt) {
            nws.summaries[nTitle2] = txt;
            saveNewsSummaries();
            nws.detailLoading = false;
            render();
          }).catch(function (err) {
            nws.detailLoading = false;
            nws.detailError = (err && err.message) || '总结失败，请重试';
            render();
          });
        } else {
          nws.detailLoading = false;
          state.overlay = { type: 'newsDetail', title: nTitle2, source: nSource, time: nTime };
          render();
        }
        break;
      case 'toggleSaveNews':
        var ts = el.getAttribute('data-title') || '';
        var idx = -1;
        for (var ti = 0; ti < state.news.saved.length; ti++) {
          if (state.news.saved[ti].title === ts) { idx = ti; break; }
        }
        if (idx >= 0) {
          state.news.saved.splice(idx, 1);
          saveNewsSaved();
          toast('已取消收藏');
        } else {
          state.news.saved.unshift({
            title: ts,
            source: el.getAttribute('data-source') || '人民日报',
            time: el.getAttribute('data-time') || '',
            summary: state.news.summaries[ts] || ''
          });
          saveNewsSaved();
          toast('已收藏');
        }
        render();
        break;
      case 'unsaveNews':
        var us = el.getAttribute('data-title') || '';
        state.news.saved = state.news.saved.filter(function (s) { return s.title !== us; });
        saveNewsSaved();
        render();
        toast('已取消收藏');
        break;
      case 'refreshNews':
        state.news.loading = true;
        render();
        fetchNews().then(function (items) {
          state.news.items = items;
          state.news.loading = false;
          state.homeNews = items.length ? items[Math.floor(Math.random() * items.length)] : null;
          render();
        });
        break;
      case 'export':
        exportBackup();
        break;
      case 'import':
        importBackup();
        break;
    }
  });

  if (!IS_NODE) document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    var aiInp = $('#ai-input');
    var idmInp = $('#idiom-input');
    if (aiInp && document.activeElement === aiInp) {
      var sendBtn = document.querySelector('[data-act="sendAiQuestion"]');
      if (sendBtn && !sendBtn.disabled) sendBtn.click();
    } else if (idmInp && document.activeElement === idmInp) {
      var queryBtn = document.querySelector('[data-act="queryIdiom"]');
      if (queryBtn) queryBtn.click();
    }
  });

  if (!IS_NODE) document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'idiom-input') { state.idiom.input = t.value; return; }
    if (t.id === 'ai-input') { state.ai.input = t.value; return; }
    if (!state.form) return;
    if (t.id === 'f-stem') state.form.stem = t.value;
    else if (t.id === 'f-answer') state.form.answer = t.value;
    else if (t.id === 'f-wrong') state.form.wrongThinking = t.value;
    else if (t.id === 'f-correct') state.form.correctThinking = t.value;
    else if (t.id === 'f-source') state.form.source = t.value;
    else if (t.id === 'f-days') {
      var v = parseInt(t.value, 10);
      if (v > 0) state.form.reviewDays = v;
    } else if (t.dataset && t.dataset.opt != null) {
      state.form.options[parseInt(t.dataset.opt, 10)] = t.value;
    }
  });

  if (!IS_NODE) document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.id === 'bank-search') {
      state.search = t.value;
      renderBankSearchOnly();
    }
  });

  function renderBankSearchOnly() {
    var kw = state.search.trim();
    var list = state.questions.filter(function (q) {
      if (state.filterCat !== 'all' && q.category !== state.filterCat) return false;
      if (state.filterSub && q.subCategory !== state.filterSub) return false;
      if (kw) {
        var optText = (q.options || []).join(' ');
        if ((q.stem || '').indexOf(kw) < 0 && (q.correctThinking || '').indexOf(kw) < 0 &&
          (q.wrongThinking || '').indexOf(kw) < 0 && (q.source || '').indexOf(kw) < 0 &&
          optText.indexOf(kw) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var listBox = $('#bank-list');
    if (listBox) {
      listBox.innerHTML = list.length
        ? '<div class="section-title">共 ' + list.length + ' 题</div>' + list.map(qItemHtml).join('')
        : '<div class="empty">没有符合条件的错题</div>';
    }
  }

  if (typeof window !== 'undefined') {
    window.__handleBack = function () {
      if (state.overlay) {
        if (state.overlay.type === 'crop') {
          closeCrop();
          return 1;
        }
        state.overlay = null;
        state.form = null;
        state.practice = null;
        if (state.tab === 'add') state.tab = 'bank';
        render();
        return 1;
      }
      if (HOME_SUB_TABS.indexOf(state.tab) >= 0) {
        state.tab = 'home';
        render();
        return 1;
      }
      return 0;
    };
  }

  load();
  if (!IS_NODE) render();
  if (!IS_NODE) {
    fetchNews().then(function (items) {
      state.news.items = items;
      state.homeNews = items.length ? items[Math.floor(Math.random() * items.length)] : null;
      renderHeader();
    });
    state.news.leader.loading = true;
    fetchLeader().then(function (items) {
      state.news.leader.items = items;
      state.news.leader.loading = false;
      render();
    }).catch(function () {
      state.news.leader.loading = false;
      state.news.leader.error = '领袖讲话收录加载失败';
      render();
    });
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseOcrText: parseOcrText, extractLetters: extractLetters, isCorrect: isCorrect, addDays: addDays, todayStr: todayStr };
  }
})();

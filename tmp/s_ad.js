// xcapp build 20260810-2150 source history
(function () {
  'use strict';

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
    news: { items: [], loading: false, summaries: {}, saved: [], detailLoading: false },
    homeNews: null,
    idiom: { loading: false, result: null, saved: [], input: '', proof: { loading: false, text: '' } },
    ai: { loading: false, history: [], input: '', pendingImg: '' },
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
    var icons = { home: '首', ai: 'AI', stats: '统' };
    el.innerHTML = NAV_TABS.map(function (t) {
      var active = state.tab === t.key || (t.key === 'home' && HOME_SUB_TABS.indexOf(state.tab) >= 0);
      return '<div class="tab' + (active ? ' active' : '') + '" data-act="switchTab" data-key="' + t.key + '">' +
        '<span class="ico">' + (icons[t.key] || '·') + '</span>' +
        t.name + '</div>';
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
    if (state.overlay && state.overlay.type === 'practice' && state.scratch) initScratch();
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
      '<span class="scratch-tip">' + (isErase ? '橡皮擦模式：擦除笔迹' : '手写笔 / 手指直接书写') + '</span>' +
      colors.map(function (c) {
        return '<button class="scratch-color' + (!isErase && state.scratchColor === c[0] ? ' active' : '') + '" data-act="scratchColor" data-color="' + c[0] + '" title="' + c[1] + '色笔" style="background:' + c[0] + '"></button>';
      }).join('') +
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
    var head = $('.overlay-head');
    if (head) layer.style.top = head.offsetHeight + 'px';
    var canvas = $('#scratch-canvas');
    if (!canvas) return;
    var wrap = $('.scratch-canvas-wrap');
    if (!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    if (w < 10 || h < 10) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var isEraser = function () { return state.scratchTool === 'eraser'; };
    function applyMode() {
      ctx.globalCompositeOperation = isEraser() ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isEraser() ? 'rgba(0,0,0,1)' : state.scratchColor;
    }
    applyMode();
    var drawing = false;
    var lastX = 0;
    var lastY = 0;
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function widthFor(e) {
      if (isEraser()) return 22;
      var p = e.pressure || 0;
      if (p > 0) return Math.max(1.5, p * 5);
      return e.pointerType === 'touch' ? 3 : 2;
    }
    function onDown(e) {
      e.preventDefault();
      drawing = true;
      applyMode();
      var p = pos(e);
      lastX = p.x;
      lastY = p.y;
      ctx.lineWidth = widthFor(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      try { c render(); return ''; }
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
    if (state.scratch) html += renderScratch();
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
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseOcrText: parseOcrText, extractLetters: extractLetters, isCorrect: isCorrect, addDays: addDays, todayStr: todayStr };
  }
})();


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

    var kw = state.search.trim();
    var list = state.questions.filter(function (q) {
      if (state.filterCat !== 'all' && q.category !== state.filterCat) return false;
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
    var html = '<div class="scratch-layer" id="scratch-layer">' +
      '<div class="scratch-bar">' +
      '<span class="scratch-tip">' + (isErase ? '橡皮擦模式：擦除笔迹' : '手写笔 / 手指直接书写') + '</span>' +
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
      ctx.strokeStyle = isEraser() ? 'rgba(0,0,0,1)' : '#1f2430';
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
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    function onMove(e) {
      if (!drawing) return;
      e.preventDefault();
      applyMode();
      var p = pos(e);
      ctx.lineWidth = widthFor(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    }
    function onUp(e) {
      if (!drawing) return;
      drawing = false;
      if (e && e.type === 'pointerup' && (e.clientX !== lastX || e.clientY !== lastY)) {
        ctx.lineTo(e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getB

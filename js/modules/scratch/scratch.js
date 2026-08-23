/* ===== modules/scratch.js =====
 * 草稿画板（scratch）渲染与画布交互：画笔/橡皮/撤回/双指滚动。
 * 对外暴露 XCAPP.scratch
 * 依赖：state.js、storage.js、core.js
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  // === 共享依赖别名（加载时可用） ===
  var $ = NS.utils.$, $all = NS.utils.$all, esc = NS.utils.esc, stripMd = NS.utils.stripMd;
  var pad = NS.utils.pad, todayStr = NS.utils.todayStr, addDays = NS.utils.addDays;
  var fmtDate = NS.utils.fmtDate, nextWeekdayDate = NS.utils.nextWeekdayDate, wdLabel = NS.utils.wdLabel;
  var stripOptionPrefix = NS.utils.stripOptionPrefix, fmtSize = NS.utils.fmtSize;
  var toast = NS.utils.toast, confirmDialog = NS.utils.confirmDialog, uid = NS.utils.uid;
  var storageSet = NS.storage.set, storageGet = NS.storage.get, storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative, nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage, prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state, IS_NODE = NS.IS_NODE;
  var CATEGORIES = NS.consts.CATEGORIES, SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS, REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters, STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS, HOME_SUB_TABS = NS.consts.HOME_SUB_TABS, UNIT_LIST = NS.consts.UNIT_LIST;
  var save = NS.store.save, load = NS.store.load, findQ = NS.store.findQ;
  var saveSources = NS.store.saveSources, saveSettings = NS.store.saveSettings;
  var saveCalcHistory = NS.store.saveCalcHistory, saveIdioms = NS.store.saveIdioms, saveAiHistory = NS.store.saveAiHistory;
  var saveCompareCache = NS.store.saveCompareCache, saveNewsSaved = NS.store.saveNewsSaved;
  var saveNewsSummaries = NS.store.saveNewsSummaries, saveSummaries = NS.store.saveSummaries;
  var compressQuestionsImages = NS.store.compressQuestionsImages, markImgDirty = NS.store.markImgDirty;
  var imgKey = NS.store.imgKey, qImagesPayload = NS.store.qImagesPayload, persistDirtyImages = NS.store.persistDirtyImages;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() { return NS.shell.render(); }
  function renderHeader() { return NS.shell.renderHeader(); }
  function catTag(a, b, c) { return NS.shell.catTag(a, b, c); }
  function statusTag(q) { return NS.shell.statusTag(q); }
  // 如需调用其他模块函数，在此添加懒加载包装器，例如：
  // function fetchAiAnswer(q, h) { return NS.ai.fetchAiAnswer(q, h); }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function renderScratch() {
    var isErase = state.scratchTool === 'eraser';
    var colors = [['#1f2430', '黑'], ['#d32f2f', '红'], ['#1565c0', '蓝']];
    var html = '<div class="scratch-layer" id="scratch-layer" style="' + (state.scratch ? '' : 'display:none') + '">' +
      '<div class="scratch-bar">' +
      '<span class="scratch-colors">' +
      colors.map(function (c) {
        return '<button class="scratch-color' + (!isErase && state.scratchColor === c[0] ? ' active' : '') + '" data-act="scratchColor" data-color="' + c[0] + '" title="' + c[1] + '色笔" style="background:' + c[0] + '"></button>';
      }).join('') +
      '</span>' +
      '<button class="btn gray sm' + (isErase ? ' active' : '') + '" data-act="scratchTool" data-tool="eraser" title="橡皮擦">橡皮</button>' +
      '<button class="btn gray sm' + (!isErase ? ' active' : '') + '" data-act="scratchTool" data-tool="pen" title="画笔">画笔</button>' +
      '<button class="btn gray sm" data-act="scratchUndo" title="撤回上一步">撤回</button>' +
      '<button class="btn gray sm" data-act="scratchClear">清空</button>' +
      '<button class="btn sm" data-act="toggleScratch">完成</button>' +
      '</div>' +
      '<div class="scratch-canvas-wrap"><canvas id="scratch-canvas"></canvas></div>' +
      '</div>';
    return html;
  }

  function attachTwoFingerScroll(canvas, setMulti) {
    var lastTwo = null;
    function clearTwo() { lastTwo = null; setMulti(false); }
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length >= 2) {
        setMulti(true);
        var t1 = e.touches[0], t2 = e.touches[1];
        lastTwo = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      } else if (e.touches.length === 1) {
        clearTwo();
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length >= 2) {
        setMulti(true);
        var t1 = e.touches[0], t2 = e.touches[1];
        var x = (t1.clientX + t2.clientX) / 2;
        var y = (t1.clientY + t2.clientY) / 2;
        if (lastTwo) {
          var sc = document.querySelector('.overlay-body');
          if (sc) sc.scrollTop -= (y - lastTwo.y);
        }
        lastTwo = { x: x, y: y };
      }
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length <= 1) clearTwo();
    }, { passive: true });
    canvas.addEventListener('touchcancel', clearTwo, { passive: true });
  }

  function pushScratchHistory(cv) {
    if (!cv || cv.id !== 'scratch-canvas') return;
    try {
      var u = cv.toDataURL('image/png');
      var h = state.scratchHistory;
      if (!h) { h = state.scratchHistory = []; }
      if (h.length && h[h.length - 1] === u) return;
      h.push(u);
      if (h.length > 30) h.shift();
    } catch (e) { /* ignore */ }
  }

  function initScratch() {
    var layer = $('#scratch-layer');
    if (!layer) return;
    var canvas = $('#scratch-canvas');
    if (!canvas) return;
    var wrap = $('.scratch-canvas-wrap');
    if (!wrap) return;

    var restoredFromHistory = false;
    function resizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      if (w < 10 || h < 10) return false;
      if (!restoredFromHistory && state.scratchHistory && state.scratchHistory.length) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        var img = new Image();
        img.onload = function () {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        img.src = state.scratchHistory[state.scratchHistory.length - 1];
        restoredFromHistory = true;
        return true;
      }
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
      pushScratchHistory(canvas);
    }
    var activePointerId = null;
    var pendingTouch = null;
    var pendingTimer = null;
    function cancelPending() {
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      pendingTouch = null;
    }
    function onPointerDown(e) {
      if (activePointerId !== null) { e.preventDefault(); return; }
      activePointerId = e.pointerId;
      var curW = parseInt(canvas.style.width, 10);
      var curH = parseInt(canvas.style.height, 10);
      if (curW !== wrap.clientWidth || curH !== wrap.clientHeight) resizeCanvas();
      e.preventDefault();
      if (e.pointerType === 'touch') {
        pendingTouch = { x: e.clientX, y: e.clientY, e: e, pid: e.pointerId };
        pendingTimer = setTimeout(function () {
          pendingTimer = null;
          if (pendingTouch && pendingTouch.pid === activePointerId) {
            startDraw(pendingTouch.x, pendingTouch.y, pendingTouch.e);
          }
          pendingTouch = null;
        }, 120);
      } else {
        startDraw(e.clientX, e.clientY, e);
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      if (pendingTouch) {
        pendingTouch.e = e;
        if (Math.abs(e.clientX - pendingTouch.x) > 6 || Math.abs(e.clientY - pendingTouch.y) > 6) {
          if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
          startDraw(pendingTouch.x, pendingTouch.y, e);
          pendingTouch = null;
        }
        return;
      }
      if (!drawing) return;
      e.preventDefault();
      moveDraw(e.clientX, e.clientY, e);
    }
    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      if (pendingTouch) cancelPending();
      endDraw(e.clientX, e.clientY);
      activePointerId = null;
    }
    function onPointerCancel(e) {
      if (e.pointerId === activePointerId) activePointerId = null;
    }
    function onLeave(e) { if (drawing) drawing = false; }
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onLeave);
    var resizeTimer = null;
    var winResize = function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resizeCanvas(); }, 150);
    };
    window.addEventListener('resize', winResize);
    window.addEventListener('orientationchange', winResize);
  }

  // === 对外暴露 ===
  NS.scratch = {
    renderScratch: renderScratch,
    attachTwoFingerScroll: attachTwoFingerScroll,
    pushScratchHistory: pushScratchHistory,
    initScratch: initScratch
  };
})();

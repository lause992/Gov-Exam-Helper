/* ===== xcapp ink module: 通用手写画板引擎（公式/总结/草稿画板共用） ===== */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  function grid(ctx, w, h) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#eef1f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= w; gx += 24) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
    for (var gy = 0; gy <= h; gy += 24) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
    ctx.stroke();
  }

  function loadInto(cv, ctx, w, h, url) {
    var img = new Image();
    img.onload = function () {
      ctx.globalCompositeOperation = 'source-over';
      grid(ctx, w, h);
      var scale = Math.min(w / img.width, h / img.height, 1);
      var dw = img.width * scale;
      var dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    img.onerror = function () { /* ignore */ };
    img.src = url;
  }

  function create(canvas, opts) {
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var ctxW = canvas.width / dpr;
    var ctxH = canvas.height / dpr;
    var state = {
      drawing: false,
      lastX: 0,
      lastY: 0,
      erase: !!opts.initialErase,
      lineWidth: opts.lineWidth || 2.4,
      eraseWidth: opts.eraseWidth || 20,
      color: opts.color || '#1f2430'
    };
    var ctx = canvas.getContext('2d');
    var hist = [];
    var HIST_MAX = 40;

    function pushHist() {
      try {
        hist.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (hist.length > HIST_MAX) hist.shift();
      } catch (e) { /* ignore */ }
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function applyMode() {
      if (state.erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = state.eraseWidth;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.lineWidth;
      }
    }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      state.drawing = true;
      pushHist();
      if (opts.onDown) opts.onDown(e);
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      applyMode();
      var p = pos(e);
      state.lastX = p.x;
      state.lastY = p.y;
      ctx.beginPath();
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(state.lastX + 0.4, state.lastY + 0.4);
      ctx.stroke();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!state.drawing) return;
      if (opts.onMove) opts.onMove(e);
      var p = pos(e);
      ctx.beginPath();
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      state.lastX = p.x;
      state.lastY = p.y;
    });
    function endDraw(e) {
      if (!state.drawing) return;
      state.drawing = false;
      if (opts.onUp) opts.onUp(e);
    }
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);

    return {
      canvas: canvas,
      ctx: ctx,
      setErase: function (b) { state.erase = !!b; },
      setColor: function (c) { state.color = c; },
      setLineWidth: function (n) { state.lineWidth = n; },
      clear: function () {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        state.erase = false;
        grid(ctx, ctxW, ctxH);
        hist = [];
      },
      load: function (url) { loadInto(canvas, ctx, ctxW, ctxH, url); hist = []; },
      undo: function () {
        if (!hist.length) return false;
        var img = hist.pop();
        ctx.putImageData(img, 0, 0);
        return true;
      },
      canUndo: function () { return hist.length > 0; }
    };
  }

  NS.ink = {
    grid: grid,
    loadInto: loadInto,
    create: create
  };
})();
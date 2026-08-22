/* ===== modules/shell.js =====
 * 应用外壳模块：主渲染调度、头部/标签栏、覆盖层分发。
 * 对外暴露 XCAPP.shell。
 * 依赖：所有功能模块需在本文件之前加载（通过 NS 运行时解析）。
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  // === 共享依赖别名 ===
  var $ = NS.utils.$, $all = NS.utils.$all, esc = NS.utils.esc;
  var todayStr = NS.utils.todayStr;
  var state = NS.state, IS_NODE = NS.IS_NODE;
  var NAV_TABS = NS.consts.NAV_TABS, HOME_SUB_TABS = NS.consts.HOME_SUB_TABS;
  var findQ = NS.store.findQ;

  // === 跨模块渲染引用（运行时通过 NS 解析） ===
  function renderHome() { return NS.home.renderHome(); }
  function renderReview() { return NS.home.renderReview(); }
  function renderBank() { return NS.home.renderBank(); }
  function renderForm() { return NS.form.renderForm(); }
  function renderCalc() { return NS.calc.renderCalc(); }
  function renderIdiom() { return NS.idiom.renderIdiom(); }
  function renderAi() { return NS.ai.renderAi(); }
  function renderNews() { return NS.news.renderNews(); }
  function renderStats() { return NS.stats.renderStats(); }
  function renderPractice() { return NS.detail.renderPractice(); }
  function renderDetail() { return NS.detail.renderDetail(); }
  function renderCrop() { return NS.crop.renderCrop(); }
  function renderNewsDetail() { return NS.news.renderNewsDetail(); }
  function renderNewsSaved() { return NS.news.renderNewsSaved(); }
  function renderLeaderDetail() { return NS.news.renderLeaderDetail(); }
  function renderShenlunInk() { return NS.shenlunCompare.renderShenlunInk(); }
  function renderShenlunCompare() { return NS.shenlunCompare.renderShenlunCompare(); }
  function renderSettings() { return NS.form.renderSettings(); }
  function renderSummary() { return NS.summary.renderSummary(); }
  function renderScratch() { return NS.scratch.renderScratch(); }
  function initCrop() { return NS.crop.initCrop(); }
  function initFormulaPad() { return NS.form.initFormulaPad(); }
  function initSummary() { return NS.summary.initSummary(); }
  function initFab() { return NS.home.initFab(); }
  function initScratch() { return NS.scratch.initScratch(); }
  function initShenlunCanvas() { return NS.shenlunCanvas.initShenlunCanvas(); }
  function freshForm(q) { return NS.form.freshForm(q); }
  function aiScrollBottom(el) { return NS.ai.aiScrollBottom(el); }
  function extractMaxChars(q) { return NS.detail.extractMaxChars(q); }

  // === 模块代码 ===
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
      mat: a.getAttribute('data-mat-title') || a.getAttribute('data-mat-content'),
      end: a.selectionEnd != null ? a.selectionEnd : String(a.value || '').length
    };
  }

  function restoreActiveInput(info) {
    if (!info) return;
    var el = info.id ? document.getElementById(info.id) : null;
    if (!el && info.opt != null) el = document.querySelector('[data-opt="' + info.opt + '"]');
    if (!el && info.mat != null) el = document.querySelector('[data-mat-title="' + info.mat + '"], [data-mat-content="' + info.mat + '"]');
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
      else if (state.listScroll) {
        content.scrollTop = state.listScroll;
        state.listScroll = 0;
      }
    }
    if (state.overlay && state.overlay.type === 'crop') initCrop();
    if (state.formulaOpen && $('#formula-canvas')) initFormulaPad();
    if (state.overlay && state.overlay.type === 'summary') initSummary();
    if (state.tab === 'bank') initFab();
    if (state.overlay && state.overlay.type === 'practice' && state.scratch) {
      content.insertAdjacentHTML('beforeend', renderScratch());
      initScratch();
    }
    if (state.overlay && state.overlay.type === 'practice' && $('#shenlun-canvas')) {
      initShenlunCanvas();
    }
    if (state.overlay && state.overlay.type === 'practice' && $('#p-note')) {
      var wcEl = $('#word-count');
      var noteInput = $('#p-note');
      if (wcEl && noteInput) {
        var pq = findQ(state.practice && state.practice.id);
        wcEl.textContent = noteInput.value.length + '/' + extractMaxChars(pq);
        noteInput.addEventListener('input', function () {
          var maxC = extractMaxChars(pq);
          var len = noteInput.value.length;
          wcEl.textContent = len + '/' + maxC;
          if (len > maxC) wcEl.style.color = 'var(--danger)';
          else wcEl.style.color = 'var(--muted)';
        });
      }
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
    if (o.type === 'shenlunInk') return renderShenlunInk();
    if (o.type === 'shenlunCompare') return renderShenlunCompare();
    if (o.type === 'settings') return renderSettings();
    if (o.type === 'summary') return renderSummary();
    if (o.type === 'unit') return NS.units.render(state, state.unitCat);
    return '';
  }

  function catTag(cat, sub, cls) {
    var color = NS.consts.CAT_COLORS[cat] || '#8a93a6';
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

  // === 对外暴露 ===
  NS.shell = {
    render: render,
    renderHeader: renderHeader,
    renderTabbar: renderTabbar,
    renderOverlay: renderOverlay,
    captureActiveInput: captureActiveInput,
    restoreActiveInput: restoreActiveInput,
    catTag: catTag,
    statusTag: statusTag
  };
})();

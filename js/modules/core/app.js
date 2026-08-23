/* ===== modules/app.js =====
 * 应用主入口：初始化状态、注册返回键处理、加载初始数据。
 * 必须最后加载，依赖所有其他模块。
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};
  var IS_NODE = NS.IS_NODE;
  var state = NS.state;
  var HOME_SUB_TABS = NS.consts.HOME_SUB_TABS;

  // === 跨模块引用 ===
  function load() { return NS.store.load(); }
  function render() { return NS.shell.render(); }
  function renderHeader() { return NS.shell.renderHeader(); }
  function closeCrop() { return NS.crop.closeCrop(); }
  function fetchNews() { return NS.news.fetchNews(); }
  function fetchLeader() { return NS.news.fetchLeader(); }
  function parseOcrText(t) { return NS.detail.parseOcrText(t); }
  function extractLetters(s) { return NS.detail.extractLetters(s); }
  function isCorrect(a, b) { return NS.detail.isCorrect(a, b); }
  var addDays = NS.utils.addDays;
  var todayStr = NS.utils.todayStr;

  // === 返回键处理 ===
  if (typeof window !== 'undefined') {
    window.__handleBack = function () {
      if (state.overlay) {
        if (state.overlay.type === 'crop') {
          closeCrop();
          return 1;
        }
        if (state.practice) {
          var bpId = state.practice.id;
          state.practice = null;
          state.scratch = false;
          state.overlay = { type: 'detail', id: bpId };
          render();
          return 1;
        }
        state.overlay = null;
        state.form = null;
        state.practice = null;
        if (state.tab === 'add') state.tab = 'bank';
        state.keepScroll = true;
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

  // === 初始化 ===
  load();
  // load() 内已通过 applyDarkMode() 设置好 body.dark class;这里只在 IS_NODE 下兜底
  if (IS_NODE) document.body.classList.toggle("dark", state.darkMode);
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

  // === Node.js 导出（测试用） ===
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseOcrText: parseOcrText, extractLetters: extractLetters, isCorrect: isCorrect, addDays: addDays, todayStr: todayStr };
  }

  NS.app = { init: load };
})();

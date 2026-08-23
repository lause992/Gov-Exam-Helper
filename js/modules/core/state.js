/* ===== modules/state.js =====
 * 全局状态与共享常量。
 * 所有模块通过 XCAPP.state / XCAPP.consts 访问共享状态，避免闭包耦合。
 * 加载顺序：core.js → units.js → ink.js → state.js → storage.js → ...
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  NS.IS_NODE = typeof document === 'undefined';
  NS.JS_BUILD = '20260824 v8.0';

  /* ===== 共享常量（原 core/01-constants.js） ===== */
  NS.consts = {
    CATEGORIES: ['言语理解', '政治理论', '常识判断', '判断推理', '资料分析', '数量关系', '申论'],
    SUBCATEGORIES: {
      '常识判断': ['经济常识', '科技常识', '人文常识', '地理国情', '法律常识'],
      '言语理解': ['逻辑填空', '片段阅读', '语句表达'],
      '判断推理': ['图形推理', '定义判断', '类比推理', '逻辑判断', '一拖五'],
      '政治理论': ['习思想', '马克思', '时政'],
      '数量关系': ['工程问题', '最值问题', '年龄问题', '和差倍比问题', '周期问题', '数列问题', '行程问题', '几何问题', '容斥原理问题', '排列组合问题', '概率问题', '经济利润问题', '统筹规划问题', '星期日期问题', '公倍数与公约数问题', '分段计算问题', '函数最值问题'],
      '申论': ['概括归纳', '综合分析', '提出对策', '贯彻执行', '文章写作']
    },
    CAT_COLORS: {
      '言语理解': '#3b82f6',
      '政治理论': '#e5484d',
      '常识判断': '#f59e0b',
      '判断推理': '#10b981',
      '资料分析': '#8b5cf6',
      '数量关系': '#ec4899',
      '申论': '#0d9488'
    },
    REVIEW_OPTIONS: [1, 2, 3, 5, 7, 14, 30],
    optionLetters: ['A', 'B', 'C', 'D', 'E', 'F'],
    STORAGE_KEY: 'xcapp_questions_v1',
    NAV_TABS: [
      { key: 'home', name: '首页' },
      { key: 'ai', name: 'AI' },
      { key: 'stats', name: '统计' }
    ],
    HOME_SUB_TABS: ['review', 'bank', 'add', 'calc', 'idiom', 'news'],
    IMG_KEY_PREFIX: 'xcapp_img_',
    WEEKDAY_NAMES: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  };
  NS.consts.UNIT_LIST = (NS.units && NS.units.LIST) || [];

  /* ===== 全局状态对象（原 core/02-state.js） ===== */
  NS.state = {
    tab: 'home',
    overlay: null,
    user: '',
    questions: [],
    search: '',
    filterCat: 'all',
    filterSub: '',
    filterDone: 'all',
    favOnly: false,
    todayOnly: false,
    detailSwipeDir: '',
    formulaPadQid: '',
    formulaErase: false,
    formulaOpen: false,
    formulaDirty: false,
    formulaEngine: null,
    summaryEngine: null,
    summaries: {},
    summaryCat: '',
    summaryPage: 0,
    summaryDirty: false,
    summaryErase: false,
    summaryJumpOpen: false,
    summaryNav: null,
    unitCat: 'length',
    form: null,
    practice: null,
    ocrRunning: false,
    ocrProgress: 0,
    ocrStatus: '',
    keepScroll: false,
    listScroll: 0,
    crop: null,
    cropCb: null,
    calc: { history: [], startTime: 0, current: null, answered: false },
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
    scratchHistory: [],
    sourceHistory: [],
    settings: { reviewWeekday: 0, retryDays: 3 },
    compareCache: {},
    compareLoading: false,
    compareLoadingSingle: '',
    compareActive: '',
    shenlunScoring: false,
    reviewExpandedIdx: -1,
    imgDirty: {},
    darkMode: false,
    darkModePref: 'auto'
  };
})();

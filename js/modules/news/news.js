/* ===== modules/news.js =====
 * 每日时政模块：新闻列表、领袖讲话、AI 筛选与提炼、收藏等。
 * 对外暴露 XCAPP.news
 * 依赖：state.js、storage.js、core.js
 */
(function () {
  "use strict";
  var NS = (window.XCAPP = window.XCAPP || {});

  // === 共享依赖别名（加载时可用） ===
  var $ = NS.utils.$,
    $all = NS.utils.$all,
    esc = NS.utils.esc,
    stripMd = NS.utils.stripMd;
  var pad = NS.utils.pad,
    todayStr = NS.utils.todayStr,
    addDays = NS.utils.addDays;
  var fmtDate = NS.utils.fmtDate,
    nextWeekdayDate = NS.utils.nextWeekdayDate,
    wdLabel = NS.utils.wdLabel;
  var stripOptionPrefix = NS.utils.stripOptionPrefix,
    fmtSize = NS.utils.fmtSize;
  var toast = NS.utils.toast,
    confirmDialog = NS.utils.confirmDialog,
    uid = NS.utils.uid;
  var storageSet = NS.storage.set,
    storageGet = NS.storage.get,
    storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative,
    nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage,
    prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state,
    IS_NODE = NS.IS_NODE;
  var CATEGORIES = NS.consts.CATEGORIES,
    SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS,
    REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters,
    STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS,
    HOME_SUB_TABS = NS.consts.HOME_SUB_TABS,
    UNIT_LIST = NS.consts.UNIT_LIST;
  var save = NS.store.save,
    load = NS.store.load,
    findQ = NS.store.findQ;
  var saveSources = NS.store.saveSources,
    saveSettings = NS.store.saveSettings;
  var saveCalcHistory = NS.store.saveCalcHistory,
    saveIdioms = NS.store.saveIdioms,
    saveAiHistory = NS.store.saveAiHistory;
  var saveCompareCache = NS.store.saveCompareCache,
    saveNewsSaved = NS.store.saveNewsSaved;
  var saveNewsSummaries = NS.store.saveNewsSummaries,
    saveSummaries = NS.store.saveSummaries;
  var compressQuestionsImages = NS.store.compressQuestionsImages,
    markImgDirty = NS.store.markImgDirty;
  var imgKey = NS.store.imgKey,
    qImagesPayload = NS.store.qImagesPayload,
    persistDirtyImages = NS.store.persistDirtyImages;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() {
    return NS.shell.render();
  }
  function renderHeader() {
    return NS.shell.renderHeader();
  }
  function catTag(a, b, c) {
    return NS.shell.catTag(a, b, c);
  }
  function statusTag(q) {
    return NS.shell.statusTag(q);
  }
  function zhipuChat(a, b, c) {
    return NS.ai.zhipuChat(a, b, c);
  }
  function mdRender(t) {
    return NS.ai.mdRender(t);
  }
  function mdInline(s) {
    return NS.ai.mdInline(s);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  var ENTERTAINMENT_KEYWORDS = [
    "明星",
    "演员",
    "综艺",
    "电影",
    "电视剧",
    "歌曲",
    "音乐",
    "恋情",
    "结婚",
    "离婚",
    "出轨",
    "偶像",
    "选秀",
    "网红",
    "直播",
    "带货",
    "真人秀",
    "脱口秀",
    "喜剧",
    "相声",
    "小品",
    "魔术",
    "舞蹈",
    "偶像团体",
    "创造营",
    "青春有你",
    "快乐大本营",
    "天天向上",
    "我是歌手",
    "奔跑吧",
    "极限挑战",
    "爸爸去哪儿",
    "中国好声音",
    "梦想的声音",
    "蒙面歌王",
    "跨界歌王",
    "声临其境",
    "演员的诞生",
    "这！就是街舞",
    "热血街舞团",
    "乘风破浪的姐姐",
    "披荆斩棘的哥哥",
    "脱口秀大会",
    "吐槽大会",
    "奇葩说",
    "中国达人秀",
    "达人秀",
    "舞林大会",
    "笑傲江湖",
    "相声有新人",
    "欢乐喜剧人",
    "我为喜剧狂",
    "今夜百乐门",
    "我就是演员",
    "演员请就位",
    "热搜",
    "爆",
    "沸",
    "热",
    "官宣",
    "分手",
    "怀孕",
    "产子",
    "婚礼",
    "导演",
    "编剧",
    "票房",
    "首映",
    "上映",
    "杀青",
    "开机",
    "片场",
    "片酬",
    "代言",
    "代言费",
    "时尚",
    "穿搭",
    "美妆",
    "护肤",
    "健身",
    "减肥",
    "减肥法",
    "食谱",
    "旅游",
    "美食",
    "探店",
    "游戏",
    "电竞",
    "LOL",
    "王者荣耀",
    "和平精英",
    "绝地求生",
    "原神",
    "崩坏",
    "鸣潮",
    "主播",
    "电商",
    "购物",
    "双十一",
    "618",
    "年货节",
    "艺人",
    "idol",
    "饭圈",
    "粉丝",
    "应援",
    "打榜",
    "控评",
    "反黑",
  ];

  var FOREIGN_KEYWORDS = [
    "美国",
    "特朗普",
    "拜登",
    "俄罗斯",
    "普京",
    "乌克兰",
    "日本",
    "韩国",
    "朝鲜",
    "英国",
    "法国",
    "德国",
    "欧盟",
    "北约",
    "以色列",
    "巴勒斯坦",
    "伊朗",
    "印度",
    "澳大利亚",
    "加拿大",
    "中东",
    "加沙",
    "俄乌",
    "美联储",
    "美元加息",
    "关税战",
    "贸易战",
    "大选",
    "州长",
    "澳网",
    "世界杯",
    "欧冠",
    "NBA",
  ];

  function renderNews() {
    var n = state.news;
    var html = '<div class="news-page">';
    html +=
      '<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">' +
      "<span>每日时政</span>" +
      '<button class="btn gray sm" data-act="openNewsSaved"' +
      (n.saved.length ? "" : " disabled") +
      ">收藏夹（" +
      n.saved.length +
      "）</button>" +
      "</div>";

    html +=
      '<div class="section-title" style="margin-top:14px">领袖讲话 · 近一月收录</div>';
    if (n.leader.loading) {
      html +=
        '<div class="card" style="text-align:center"><p class="muted">收录中...</p></div>';
    } else if (n.leader.items.length > 0) {
      html +=
        '<p class="muted" style="font-size:12px;margin:0 2px 8px">习近平主席近一个月国内考察、重要会议讲话及《求是》文章，AI 收录整理，点击查看要点与金句</p>';
      n.leader.items.forEach(function (it, i) {
        html +=
          '<div class="news-item card" data-act="openLeaderDetail" data-idx="' +
          i +
          '">';
        html +=
          '<div class="news-meta" style="margin-bottom:4px"><span class="leader-tag">' +
          esc(it.type || "讲话") +
          '</span><span class="leader-domain">' +
          esc(it.domain || "") +
          "</span><span>" +
          esc(fmtDate(it.date)) +
          "</span></div>";
        html += '<div class="news-title">' + esc(it.title) + "</div>";
        html += '<div class="news-open">查看要点与金句 ▶</div>';
        html += "</div>";
      });
    } else if (n.leader.error) {
      html +=
        '<div class="card"><p class="muted" style="color:#c0392b">' +
        esc(n.leader.error) +
        "</p></div>";
    } else {
      html += '<div class="card"><p class="muted">正在准备收录...</p></div>';
    }

    if (n.loading) {
      html +=
        '<div class="card" style="text-align:center"><p class="muted">加载中...</p></div>';
    } else if (n.items.length > 0) {
      html +=
        '<p class="muted" style="font-size:12px;margin:0 2px 8px">AI 已从实时热点中筛选出对公考有价值的时政要闻，点击卡片查看 AI 提炼总结与金句</p>';
      n.items.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) {
          return s.title === item.title;
        });
        html +=
          '<div class="news-item card" data-act="openNewsDetail" data-title="' +
          esc(item.title) +
          '" data-source="' +
          esc(item.source || "人民日报") +
          '" data-time="' +
          esc(item.time || "") +
          '">';
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' +
          esc(item.title) +
          "</div>" +
          '<div class="news-meta"><span>' +
          esc(item.source || "人民日报") +
          "</span><span>" +
          esc(item.time || "") +
          "</span></div></div>" +
          '<span class="news-star' +
          (isSaved ? " on" : "") +
          '" data-act="toggleSaveNews" data-title="' +
          esc(item.title) +
          '" title="收藏">' +
          (isSaved ? "★" : "☆") +
          "</span>" +
          "</div>";
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += "</div>";
      });
      html +=
        '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
    } else {
      html += '<div class="card">';
      html +=
        '<p class="muted" style="margin-bottom:12px">今日时政要闻（点击卡片查看 AI 提炼总结与金句）</p>';
      html += '<div class="news-list">';
      var fallbackNews = getFallbackNews();
      fallbackNews.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) {
          return s.title === item.title;
        });
        html +=
          '<div class="news-item card" data-act="openNewsDetail" data-title="' +
          esc(item.title) +
          '" data-source="' +
          esc(item.source) +
          '" data-time="' +
          esc(item.time) +
          '">';
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' +
          esc(item.title) +
          "</div>" +
          '<div class="news-meta"><span>' +
          esc(item.source) +
          "</span><span>" +
          esc(item.time) +
          "</span></div></div>" +
          '<span class="news-star' +
          (isSaved ? " on" : "") +
          '" data-act="toggleSaveNews" data-title="' +
          esc(item.title) +
          '" title="收藏">' +
          (isSaved ? "★" : "☆") +
          "</span>" +
          "</div>";
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += "</div>";
      });
      html += "</div>";
      html +=
        '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderNewsDetail() {
    var o = state.overlay;
    var title = o.title;
    var n = state.news;
    var cached = n.summaries[title] || "";
    var isSaved = n.saved.some(function (s) {
      return s.title === title;
    });
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">AI 时政提炼</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="news-title">' + esc(title) + "</div>";
    html +=
      '<div class="news-meta" style="margin:4px 0 10px"><span>' +
      esc(o.source || "人民日报") +
      "</span><span>" +
      esc(o.time || "") +
      "</span></div>";
    if (n.detailLoading) {
      html += '<p class="muted">AI 提炼中…</p>';
    } else if (cached) {
      html += '<div class="news-ai-summary">' + mdRender(cached) + "</div>";
    } else if (n.detailError) {
      html +=
        '<p class="muted" style="color:#c0392b">' + esc(n.detailError) + "</p>";
    } else {
      html += '<p class="muted">AI 提炼中…</p>';
    }
    html +=
      '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn' +
      (isSaved ? " gray" : "") +
      '" data-act="toggleSaveNews" data-title="' +
      esc(title) +
      '" data-source="' +
      esc(o.source || "人民日报") +
      '" data-time="' +
      esc(o.time || "") +
      '">' +
      (isSaved ? "★ 已收藏" : "☆ 收藏") +
      "</button>" +
      "</div>";
    html += "</div>";
    html += "</div></div>";
    return html;
  }

  function renderNewsSaved() {
    var n = state.news;
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">我的收藏（' +
      n.saved.length +
      "）</div></div>" +
      '<div class="overlay-body">';
    if (!n.saved.length) {
      html +=
        '<div class="card"><p class="muted">还没有收藏任何时政要闻。在新闻卡片上点击 ☆ 即可收藏。</p></div>';
    } else {
      n.saved.forEach(function (item) {
        html +=
          '<div class="news-item card" style="cursor:pointer" data-act="openNewsDetail" data-title="' +
          esc(item.title) +
          '" data-source="' +
          esc(item.source || "人民日报") +
          '" data-time="' +
          esc(item.time || "") +
          '">';
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' +
          esc(item.title) +
          "</div>" +
          '<div class="news-meta"><span>' +
          esc(item.source || "人民日报") +
          "</span><span>" +
          esc(item.time || "") +
          "</span></div></div>" +
          '<span class="news-star on" data-act="unsaveNews" data-title="' +
          esc(item.title) +
          '" title="取消收藏">★</span>' +
          "</div>";
        html += "</div>";
      });
    }
    html += "</div></div>";
    return html;
  }

  function getFallbackNews() {
    var today = new Date();
    var m = today.getMonth() + 1;
    var d = today.getDate();
    return [
      {
        title: "2026年政府工作报告要点",
        source: "人民日报",
        time: m + "月" + d + "日",
        summary: "报告强调高质量发展，推进科技创新和产业升级。",
      },
      {
        title: "常务会议部署扩大内需重点工作",
        source: "新华社",
        time: m + "月" + d + "日",
        summary: "会议研究部署进一步扩大内需、促进消费的政策措施。",
      },
      {
        title: "乡村振兴战略深入推进",
        source: "人民日报",
        time: m + "月" + d + "日",
        summary: "农业农村部表示将加大支持力度，推动农业现代化发展。",
      },
      {
        title: "科技创新助力经济高质量发展",
        source: "新华社",
        time: m + "月" + d + "日",
        summary: "科技部表示将加大基础研究投入，推动关键核心技术攻关。",
      },
      {
        title: "民生保障政策持续完善",
        source: "人民日报",
        time: m + "月" + d + "日",
        summary: "人社部表示将健全多层次社会保障体系，提高保障水平。",
      },
    ];
  }

  function titleHasKeyword(title, keywords) {
    var t = (title || "").toLowerCase();
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function aiFilterNews(items) {
    return new Promise(function (resolve) {
      var list = items.slice(0, 30);
      if (!list.length) {
        resolve([]);
        return;
      }
      var numbered = list
        .map(function (it, i) {
          return i + 1 + ". " + it.title;
        })
        .join("\n");
      zhipuChat(
        [
          {
            role: "system",
            content:
              "你是人民日报时政编辑兼公务员考试备考专家。用户会给你一批新闻标题列表，请从中挑选对公务员考试（行测常识、申论、面试时政积累）最有价值的中国国内时政要闻，例如：国家政策、法律法规、政府工作报告、重大会议、外交（中国对外交往）、经济、科技、民生、社会治理等。严格排除：娱乐、体育八卦、明星网红、社会花边、以及纯国外新闻（他国内政、战争冲突、外国大选、外国文体等与我国考试无关的内容）。",
          },
          {
            role: "user",
            content:
              "请从下面标题中挑选最值得公务员考试考生关注的时政要闻，只输出选中条目的序号（编号），用英文逗号分隔，不要输出其他内容：\n" +
              numbered,
          },
        ],
        2048,
        20000,
      )
        .then(function (txt) {
          var m = txt.match(/\d+/g);
          var picked = [];
          if (m) {
            m.forEach(function (n) {
              var idx = parseInt(n, 10) - 1;
              if (idx >= 0 && idx < list.length && picked.length < 10)
                picked.push(list[idx]);
            });
          }
          resolve(picked.length >= 3 ? picked : list.slice(0, 10));
        })
        .catch(function () {
          resolve(list.slice(0, 10));
        });
    });
  }

  function aiSummarizeNews(item) {
    return new Promise(function (resolve, reject) {
      var now = new Date();
      var dateStr =
        now.getFullYear() +
        "年" +
        (now.getMonth() + 1) +
        "月" +
        now.getDate() +
        "日";
      zhipuChat(
        [
          {
            role: "system",
            content:
              "你是人民日报资深时政编辑，同时是公务员考试（行测常识、申论、面试）备考专家。今天是" +
              dateStr +
              "。请对用户提供的时政要闻进行提炼总结，面向公务员考试备考使用。",
          },
          {
            role: "user",
            content:
              "请对下面这条时政要闻进行提炼总结，要求：\n" +
              "1. 用 2-3 句话概括事件核心内容；\n" +
              "2. 提炼 3-5 个考试要点（政策名词、关键数据、目标、措施等），便于行测常识和申论积累；\n" +
              "3. 以人民日报评论风格提炼 2-3 句金句，可直接用于申论大作文或面试答题（金句用【金句】标记，每句单独一行）；\n" +
              "4. 内容须客观准确，不编造事实，来源为人民日报。\n\n要闻标题：" +
              item.title,
          },
        ],
        2048,
        30000,
      ).then(resolve, reject);
    });
  }

  function fetchNews() {
    return new Promise(function (resolve) {
      var apis = [
        "https://cn.apihz.cn/api/xinwen/toutiao.php?id=10019937&key=3e517cc5c3d87dd21ed69d1f63fc3cde",
        "https://tenapi.cn/v2/toutiaohot",
        "https://api.vvhan.com/api/hotlist/wbHot",
      ];
      var attempt = 0;
      function tryNext() {
        if (attempt >= apis.length) {
          resolve(getFallbackNews());
          return;
        }
        var url = apis[attempt];
        attempt++;
        var timeout = setTimeout(function () {
          tryNext();
        }, 5000);
        fetch(url)
          .then(function (r) {
            clearTimeout(timeout);
            if (!r.ok) {
              tryNext();
              return;
            }
            return r.json();
          })
          .then(function (data) {
            if (data && data.data && data.data.length > 0) {
              var isApihz = url.indexOf("apihz.cn") >= 0;
              var items = data.data
                .map(function (item) {
                  var hot = item.hot != null ? item.hot : "";
                  return {
                    title: item.title || item.name || "",
                    source: isApihz ? "头条热榜" : hot || "热搜",
                    time: isApihz ? (hot !== "" ? "热度 " + hot : "") : "",
                  };
                })
                .filter(function (item) {
                  return (
                    !titleHasKeyword(item.title, ENTERTAINMENT_KEYWORDS) &&
                    !titleHasKeyword(item.title, FOREIGN_KEYWORDS)
                  );
                });
              if (items.length) {
                aiFilterNews(items).then(function (picked) {
                  var d = new Date();
                  var day = d.getMonth() + 1 + "月" + d.getDate() + "日";
                  resolve(
                    picked.map(function (it) {
                      return {
                        title: it.title,
                        source: "人民日报",
                        time: day,
                        summary: "",
                      };
                    }),
                  );
                });
              } else {
                tryNext();
              }
            } else {
              tryNext();
            }
          })
          .catch(function () {
            clearTimeout(timeout);
            tryNext();
          });
      }
      tryNext();
    });
  }

  function fetchLeader() {
    return new Promise(function (resolve, reject) {
      var url = "leader.json?t=" + Date.now();
      function done(data) {
        resolve(Array.isArray(data && data.items) ? data.items : []);
      }
      fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(done)
        .catch(function (err) {
          try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.onload = function () {
              try {
                done(JSON.parse(xhr.responseText));
              } catch (e2) {
                reject(err);
              }
            };
            xhr.onerror = function () {
              reject(err);
            };
            xhr.send();
          } catch (e3) {
            reject(err);
          }
        });
    });
  }

  function renderLeaderDetail() {
    var n = state.news;
    var it = n.leader.detail;
    if (!it) return "";
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">领袖讲话收录</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="news-title">' + esc(it.title) + "</div>";
    html +=
      '<div class="news-meta" style="margin:6px 0 12px">' +
      "<span>" +
      esc(it.type || "") +
      "</span>" +
      "<span>" +
      esc(it.source || "") +
      "</span>" +
      "<span>" +
      esc(it.domain || "") +
      "</span>" +
      "<span>" +
      esc(fmtDate(it.date)) +
      "</span></div>";
    if (it.occasion) {
      html +=
        '<p class="muted" style="font-size:13px;margin-bottom:10px">' +
        esc(it.occasion) +
        "</p>";
    }
    if (it.points && it.points.length) {
      html +=
        '<div class="section-title" style="margin-top:4px">核心要点</div>';
      html += it.points
        .map(function (p) {
          return '<div class="ai-li">• ' + mdInline(p) + "</div>";
        })
        .join("");
    }
    if (it.quote) {
      html +=
        '<div class="section-title" style="margin-top:14px">金句摘录</div>';
      html += '<div class="ai-quote">' + mdInline(it.quote) + "</div>";
    }
    if (it.examHint) {
      html +=
        '<div class="section-title" style="margin-top:14px">备考提示</div>';
      html += '<div class="ai-li">• ' + mdInline(it.examHint) + "</div>";
    }
    html +=
      '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn" data-act="toggleSaveNews" data-title="' +
      esc(it.title) +
      '" data-source="' +
      esc(it.type || "领袖讲话") +
      '" data-time="' +
      esc(fmtDate(it.date)) +
      '">☆ 收藏</button>' +
      "</div>";
    html += "</div>";
    html += "</div></div>";
    return html;
  }

  // === 对外暴露 ===
  NS.news = {
    renderNews: renderNews,
    renderNewsDetail: renderNewsDetail,
    renderNewsSaved: renderNewsSaved,
    getFallbackNews: getFallbackNews,
    titleHasKeyword: titleHasKeyword,
    aiFilterNews: aiFilterNews,
    aiSummarizeNews: aiSummarizeNews,
    fetchNews: fetchNews,
    fetchLeader: fetchLeader,
    renderLeaderDetail: renderLeaderDetail,
  };
})();

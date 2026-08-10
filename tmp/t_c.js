ed ? ' gray' : '') + '" data-act="toggleSaveNews" data-title="' + esc(title) + '" data-source="' + esc(o.source || '人民日报') + '" data-time="' + esc(o.time || '') + '">' + (isSaved ? '★ 已收藏' : '☆ 收藏') + '</button>' +
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
      { title: '国务院常务会议部署重点工作', source: '新华社', time: m + '月' + d + '日', summary: '会议研究部署进一步扩大内需、促进消费的政策措施。' },
      { title: '乡村振兴战略深入推进', source: '人民日报', time: m + '月' + d + '日', summary: '农业农村部表示将加大支持力度，推动农业现代化发展。' },
      { title: '科技创新助力经济高质量发展', source: '新华社', time: m + '月' + d + '日', summary: '科技部表示将加大基础研究投入，推动关键核心技术攻关。' },
      { title: '民生保障政策持续完善', source: '人民日报', time: m + '月' + d + '日', summary: '人社部表示将健全多层次社会保障体系，提高保障水平。' }
    ];
  }

  function isEntertainmentNews(title) {
    var t = (title || '').toLowerCase();
    var keywords = ['明星','演员','综艺','电影','电视剧','歌曲','音乐','恋情','结婚','离' + '婚','出' + '轨',
      '偶像','选秀','网红','直播','带货','真人秀','脱口秀','喜剧','相声','小品','魔术','舞蹈',
      '偶像团体','创造营','青春有你','快乐大本

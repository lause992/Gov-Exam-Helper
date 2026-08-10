   html += '<p class="muted" style="font-size:13px">将上方默认星期应用到所有「待复盘」错题，已完成的错题不受影响。</p>';
    html += '<button class="btn mt12" data-act="applyWeekdayAll">应用到所有待复盘错题</button>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">关于与更新</div>';
    html += '<p class="muted" style="font-size:13px" id="ver-info">版本：' + esc(remoteVersionText()) + '</p>';
    html += '<button class="btn mt12" data-act="manualUpdate">检查更新</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function remoteVersionText() {
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
        return String(window.AndroidBridge.getAppVersion());
      }
    } catch (e) { /* ignore */ }
    return '1.0';
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

    html += '<div class="field"><span class="label">题目来源</span>' +
      '<input class="input" id="f-source" placeholder="如：2026国考行测真题、粉笔题库、XX模拟卷" value="' + esc(f.source) + '"></div>';

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
    html += '<div class="q-top">' + catTag(q.category) + statusTag(q) + '</div>';
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
      html += '<button class="btn gray" da

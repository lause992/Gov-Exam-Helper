    html += '<button class="btn gray" data-act="snooze" data-id="' + q.id + '">推迟3天</button>';
    } else {
      html += '<button class="btn" data-act="practice" data-id="' + q.id + '">再做一次</button>';
      html += '<button class="btn gray" data-act="reactivate" data-id="' + q.id + '">重新待复盘</button>';
    }
    html += '</div>';
    html += '<div class="actions">' +
      '<button class="btn ghost" data-act="edit" data-id="' + q.id + '">编辑</button>' +
      '<button class="btn danger" data-act="del" data-id="' + q.id + '">删除</button>' +
      '</div>';
    html += '</div></div>';
    return html;
  }

  function openPractice(id) {
    var q = findQ(id);
    if (!q) return;
    state.practice = { id: id, selected: {}, answered: false, again: false, note: q.correctThinking || '' };
    state.overlay = { type: 'practice', id: id };
    render();
  }

  function renderPractice() {
    var q = findQ(state.overlay.id);
    if (!q) { state.overlay = null; render(); return ''; }
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
          var scTip = $('.scratch-tip', scTb);
          if (scTip) scTip.textContent = tool === 'eraser' ? '橡皮擦模式：擦除笔迹' : '手写笔 / 手指直接书写';
        }
        var scCv = $('#scratch-canvas');
        if (scCv) {
          var scCtx = scCv.getContext('2d');
          scCtx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
          scCtx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : '#1f2430';
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


/* =====================================================================
   ベーベー福の神ワーク 専用アプリ
   - データはブラウザの中(localStorage)だけに保存します
   - 福の神No. = 3桁(1つめ=年 / 2つめ=月+日 / 3つめ=1つめ+2つめ)
   - 999の関係 = 同じ位どうしを足すと、ぜんぶ9になる関係(9+9=18→9も9)
   ===================================================================== */
(function () {
  "use strict";


  // ------------------------------------------------------------------
  // 小道具
  // ------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 1900);
  }

  // ------------------------------------------------------------------
  // 福の神No. の計算
  //   1つめ : 生まれ年の数字をぜんぶ足して1桁にする
  //   2つめ : 月の数字 + 日の数字 を足して1桁にする
  //   3つめ : 1つめ + 2つめ を1桁にする
  // ------------------------------------------------------------------
  function digitSum(n) {
    return String(n).split("").reduce(function (s, c) {
      const v = parseInt(c, 10);
      return s + (isNaN(v) ? 0 : v);
    }, 0);
  }
  function toSingle(n) {
    n = Math.abs(n);
    while (n >= 10) n = digitSum(n);
    return n;
  }
  function calcFuku(y, m, d) {
    const n1 = toSingle(y);
    const n2 = toSingle(digitSum(m) + digitSum(d));
    const n3 = toSingle(n1 + n2);
    return { n1: n1, n2: n2, n3: n3, label: "" + n1 + n2 + n3 };
  }
  // ---------- 裏数字（潜在数字＝生まれた月 / 顕在数字＝生まれた日）----------
  //   潜在数字 : 月の数字を1桁になるまで足す（6月→6 / 12月→1+2=3）
  //   顕在数字 : 日の数字を1桁になるまで足す（24日→2+4=6 / 19日→1+9=10→1）
  function calcUra(m, d) {
    return {
      sen: toSingle(digitSum(m)),
      ken: toSingle(digitSum(d)),
      label: "" + toSingle(digitSum(m)) + toSingle(digitSum(d))
    };
  }
  // ---------- ご褒美数字（福の神ナンバー3つの合計）----------
  //   raw    : そのまま足した数（134 → 1+3+4 = 8）
  //   single : それを1桁になるまで足したもの（18 → 1+8 = 9）
  function calcGohobi(f) {
    const raw = f.n1 + f.n2 + f.n3;
    return { raw: raw, single: toSingle(raw) };
  }

  // "YYYY-MM-DD" → {y,m,d} / だめなら null
  function parseBirth(s) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || "").trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }
  // 打ち込まれた生年月日を、多少くずれていても読み取る
  //   1990/06/24 ・ 1990-6-24 ・ 1990.6.24 ・ 1990 6 24 ・ 19900624 ・ 1990年6月24日
  function parseLoose(str) {
    const t = String(str || "")
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .trim();
    if (!t) return null;
    const nums = t.match(/\d+/g);
    let y, m, d;
    if (nums && nums.length >= 3) {
      y = +nums[0]; m = +nums[1]; d = +nums[2];
    } else {
      const digits = t.replace(/\D/g, "");
      if (digits.length !== 8) return null;
      y = +digits.slice(0, 4); m = +digits.slice(4, 6); d = +digits.slice(6, 8);
    }
    if (!(y >= 1900 && y <= 2100)) return null;
    if (!(m >= 1 && m <= 12)) return null;
    if (!(d >= 1 && d <= 31)) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return { y: y, m: m, d: d };
  }
  // 保存する形（YYYY-MM-DD）にそろえる
  function isoOf(b) {
    return b.y + "-" + ("0" + b.m).slice(-2) + "-" + ("0" + b.d).slice(-2);
  }
  // 画面に出す形（1990/06/24）
  function slashOf(birth) {
    const b = parseBirth(birth);
    return b ? b.y + "/" + ("0" + b.m).slice(-2) + "/" + ("0" + b.d).slice(-2) : String(birth || "");
  }

  function fukuOf(p) {
    const b = parseBirth(p.birth);
    return b ? calcFuku(b.y, b.m, b.d) : null;
  }
  function birthJa(s) {
    const b = parseBirth(s);
    return b ? b.y + "年" + b.m + "月" + b.d + "日" : "(生年月日なし)";
  }
  // 1人ぶんの診断（福の神ナンバー・裏数字・ご褒美数字）をまとめて出す
  function diagOf(p) {
    const b = parseBirth(p.birth);
    if (!b) return null;
    const f = calcFuku(b.y, b.m, b.d);
    return { b: b, f: f, ura: calcUra(b.m, b.d), go: calcGohobi(f) };
  }
  function uraBadge(u) {
    if (!u) return "";
    return '<span class="ura-badge" title="裏数字（潜在・顕在）">' +
      "<span>" + u.sen + "</span><span>" + u.ken + "</span></span>";
  }
  function goBadge(g) {
    if (!g) return "";
    return '<span class="go-badge" title="ご褒美数字">' + g.single + "</span>";
  }
  function badge(f, big) {
    if (!f) return '<span class="hint">—</span>';
    return '<span class="fuku-badge' + (big ? " big" : "") + '">' +
      "<span>" + f.n1 + "</span><span>" + f.n2 + "</span><span>" + f.n3 + "</span></span>";
  }

  // ------------------------------------------------------------------
  // 999の関係
  //   同じ位どうしを足して1桁にすると 9 になる (9+9=18→9 も 9 とみなす)
  //   ※1つめ・2つめがそろえば3つめは必ず自動で9になる(検証済み)が、
  //     念のため3つとも確認している
  // ------------------------------------------------------------------
  function nineOK(a, b) { return toSingle(a + b) === 9; }
  function partnerDigit(n) { return n === 9 ? 9 : 9 - n; }
  function partnerLabel(f) {
    return "" + partnerDigit(f.n1) + partnerDigit(f.n2) + partnerDigit(f.n3);
  }
  function is999(f1, f2) {
    if (!f1 || !f2) return false;
    return nineOK(f1.n1, f2.n1) && nineOK(f1.n2, f2.n2) && nineOK(f1.n3, f2.n3);
  }

  // ------------------------------------------------------------------
  // データの出し入れ
  // ------------------------------------------------------------------
  let people = [];
  let groupList = [];   // のりぴさんが作ったグループ名（作った順）
  let editingId = null;
  let lastPlan = null; // グループ分けの下書き

  let scope = "mine";      // "mine" = 自分が登録した人 / "all" = 全員ぶん（のりぴさんのみ）
  let removedIds = [];     // 消した人（次の保存でサーバーからも消す）
  let saving = false;

  function readOnly() { return scope === "all"; }

  function save() {
    if (!window.BebeDB || !window.BebeDB.user) return;
    if (readOnly()) return;               // 全員ぶんを見ているときは書きかえない
    const ids = removedIds.slice();
    removedIds = [];
    saving = true;
    window.BebeDB.persist(people, ids, groupList).then(function () {
      saving = false;
    }).catch(function (e) {
      saving = false;
      removedIds = ids.concat(removedIds);
      alert("保存できませんでした。\n電波の状態をたしかめて、もう一度おためしください。\n\n（" +
        (e && e.message ? e.message : e) + "）");
    });
  }

  // サーバーから読み直して画面を作り直す
  async function reloadFromServer() {
    if (!window.BebeDB || !window.BebeDB.user) return;
    try {
      const res = await window.BebeDB.loadAll(scope);
      people = res.people;
      groupList = res.groups;
    } catch (e) {
      people = []; groupList = [];
      alert("データを読み込めませんでした。\n\n（" + (e && e.message ? e.message : e) + "）");
    }
    refreshGroupPickers();
    renderMeibo();
    renderScopeNote();
  }

  // 作ったグループ ＋ すでに使われているグループ名
  function groupNames() {
    const out = [];
    groupList.forEach(function (g) {
      g = String(g || "").trim();
      if (g && out.indexOf(g) < 0) out.push(g);
    });
    people.forEach(function (p) {
      const g = (p.group || "").trim();
      if (g && out.indexOf(g) < 0) out.push(g);
    });
    return out;
  }

  function addGroup() {
    const name = $("new-group").value.trim();
    if (!name) { alert("グループ名を入れてください。"); return; }
    if (groupNames().indexOf(name) >= 0) { alert("その名前はもうあります。"); return; }
    groupList.push(name);
    $("new-group").value = "";
    save();
    refreshGroupPickers();
    toast("「" + name + "」を作りました");
  }

  function deleteGroup(name) {
    const used = people.filter(function (p) { return (p.group || "").trim() === name; });
    const msg = used.length
      ? "「" + name + "」を消します。\nこのグループの " + used.length +
        "人は「グループなし」になります。\n（登録そのものは消えません）"
      : "「" + name + "」を消します。よろしいですか？";
    if (!confirm(msg)) return;
    groupList = groupList.filter(function (g) { return g !== name; });
    used.forEach(function (p) { p.group = ""; });
    save();
    refreshGroupPickers();
    renderMeibo();
    toast("「" + name + "」を消しました");
  }

  function renderGroupChips() {
    const box = $("group-chips");
    if (!box) return;
    const names = groupNames();
    box.innerHTML = names.length
      ? names.map(function (g) {
          const n = people.filter(function (p) { return (p.group || "").trim() === g; }).length;
          return '<span class="gchip">' + esc(g) + "（" + n + "人）" +
            '<button data-gdel="' + esc(g) + '" title="けす">✕</button></span>';
        }).join("")
      : '<span class="hint">まだグループがありません。</span>';
  }

  // ------------------------------------------------------------------
  // セレクトの中身づくり
  // ------------------------------------------------------------------
  function fillDigitSelect(sel, withStar) {
    let html = withStar ? '<option value="">＊</option>' : "";
    for (let i = 1; i <= 9; i++) html += '<option value="' + i + '">' + i + "</option>";
    sel.innerHTML = html;
  }
  function fillGroupSelect(sel, allLabel) {
    const cur = sel.value;
    let html = '<option value="">' + allLabel + "</option>";
    groupNames().forEach(function (g) {
      html += '<option value="' + esc(g) + '">' + esc(g) + "</option>";
    });
    html += '<option value="__none__">（グループなしの人）</option>';
    sel.innerHTML = html;
    sel.value = cur;
    if (sel.value !== cur) sel.value = "";
  }
  function refreshGroupPickers() {
    fillGroupSelect($("f-group"), "（すべて）");
    fillGroupSelect($("n-group"), "（全員の中からさがす）");
    fillGroupSelect($("s-group"), "（全員）");
    fillGroupSelect($("g-target"), "（全員）");
    const opts = '<option value="">（グループなし）</option>' +
      groupNames().map(function (g) {
        return '<option value="' + esc(g) + '">' + esc(g) + "</option>";
      }).join("");
    ["in-group", "q-group"].forEach(function (id) {
      const sel = $(id);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = opts;
      sel.value = cur;
      if (sel.value !== cur) sel.value = "";
    });
    renderGroupChips();
    const psel = $("sel-person");
    const cur = psel.value;
    psel.innerHTML = '<option value="">（えらんでください）</option>' +
      sorted(people).map(function (p) {
        const f = fukuOf(p);
        return '<option value="' + p.id + '">' + esc(p.name) +
          (f ? "（" + f.label + "）" : "") + "</option>";
      }).join("");
    psel.value = cur;
  }

  function sorted(list) {
    return list.slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "ja");
    });
  }
  // グループ条件でしぼる("__none__" はグループなしの人)
  function byGroup(list, g) {
    if (!g) return list.slice();
    if (g === "__none__") return list.filter(function (p) { return !(p.group || "").trim(); });
    return list.filter(function (p) { return (p.group || "").trim() === g; });
  }

  // ==================================================================
  // タブ
  // ==================================================================
  const RENDER = {
    meibo: renderMeibo,
    fuku: renderFukuTab,
    nine: renderNineTab,
    sheet: function () { },
    group: function () { }
  };
  function showTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.classList.toggle("on", b.dataset.tab === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll("main section"), function (s) {
      s.classList.toggle("on", s.id === "tab-" + name);
    });
    if (RENDER[name]) RENDER[name]();
    window.scrollTo(0, 0);
  }

  // ==================================================================
  // ① めいぼ
  // ==================================================================
  function formPreview() {
    const b = parseLoose($("in-birth").value);
    const box = $("preview");
    if (!b) {
      box.innerHTML = $("in-birth").value.trim()
        ? '<div class="hint warn" style="margin-top:4px">生年月日が読み取れません。1990/06/24 のように入れてください。</div>'
        : "";
      return;
    }
    const f = calcFuku(b.y, b.m, b.d), u = calcUra(b.m, b.d), g = calcGohobi(f);
    box.innerHTML = '<div style="margin-top:4px;line-height:2.2">' +
      '<span class="hint">' + b.y + "年" + b.m + "月" + b.d + "日 →</span> " +
      badge(f) + " <b style='margin:0 10px 0 6px'>" + f.label + "</b>" +
      '<span class="minilab">裏</span>' + uraBadge(u) +
      ' <span class="minilab">ご褒美</span>' + goBadge(g) +
      ' <span class="hint">／ 999の相手は <b>' + partnerLabel(f) + "</b></span></div>";
  }

  function addOrUpdate() {
    const name = $("in-name").value.trim();
    const b = parseLoose($("in-birth").value);
    if (!name) { alert("お名前を入れてください。"); return; }
    if (!b) { alert("生年月日を 1990/06/24 のように入れてください。"); return; }
    const data = {
      name: name,
      birth: isoOf(b),
      group: $("in-group").value.trim(),
      memo: $("in-memo").value.trim()
    };
    if (editingId) {
      const p = people.find(function (x) { return x.id === editingId; });
      if (p) Object.assign(p, data);
      editingId = null;
      $("btn-add").textContent = "この人を登録する";
      toast("書きかえました");
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      people.push(data);
      toast(name + " さんを登録しました");
    }
    save();
    clearForm();
    refreshGroupPickers();
    renderMeibo();
  }
  function clearForm() {
    $("in-name").value = "";
    $("in-birth").value = "";
    $("in-memo").value = "";
    $("preview").innerHTML = "";
    editingId = null;
    $("btn-add").textContent = "この人を登録する";
  }
  function startEdit(id) {
    const p = people.find(function (x) { return x.id === id; });
    if (!p) return;
    editingId = id;
    $("in-name").value = p.name || "";
    $("in-birth").value = slashOf(p.birth);
    $("in-group").value = p.group || "";
    $("in-memo").value = p.memo || "";
    $("btn-add").textContent = "この内容に書きかえる";
    formPreview();
    window.scrollTo(0, 0);
    toast("上の欄で直してください");
  }
  function removePerson(id) {
    const p = people.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!confirm(p.name + " さんを消します。よろしいですか？")) return;
    people = people.filter(function (x) { return x.id !== id; });
    removedIds.push(id);
    if (editingId === id) clearForm();
    save();
    refreshGroupPickers();
    renderMeibo();
    toast("消しました");
  }

  // 絞り込み
  function currentFilter() {
    return {
      n1: $("f-n1").value, n2: $("f-n2").value, n3: $("f-n3").value,
      us: $("f-us").value, uk: $("f-uk").value, go: $("f-go").value,
      group: $("f-group").value, text: $("f-text").value.trim()
    };
  }
  function matchFilter(p, fl) {
    const dg = diagOf(p);
    const f = dg ? dg.f : null;
    if (fl.n1 && (!f || f.n1 !== +fl.n1)) return false;
    if (fl.n2 && (!f || f.n2 !== +fl.n2)) return false;
    if (fl.n3 && (!f || f.n3 !== +fl.n3)) return false;
    if (fl.us && (!dg || dg.ura.sen !== +fl.us)) return false;
    if (fl.uk && (!dg || dg.ura.ken !== +fl.uk)) return false;
    if (fl.go && (!dg || dg.go.single !== +fl.go)) return false;
    if (fl.group) {
      const g = (p.group || "").trim();
      if (fl.group === "__none__") { if (g) return false; }
      else if (g !== fl.group) return false;
    }
    if (fl.text) {
      const b = parseBirth(p.birth);
      const hay = [p.name, p.memo, p.group, f ? f.label : "", p.birth,
        dg ? "裏" + dg.ura.label + " ご褒美" + dg.go.single : "",
        b ? b.y + "年" + b.m + "月" + b.d + "日" : ""].join(" ").toLowerCase();
      const words = fl.text.toLowerCase().split(/[\s　]+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function personCardHtml(p) {
    const dg = diagOf(p);
    const f = dg ? dg.f : null;
    return '<div class="pcard">' +
      '<div class="nums">' + badge(f) + uraBadge(dg && dg.ura) + goBadge(dg && dg.go) + "</div>" +
      '<div class="nm"><b>' + esc(p.name) + "</b>" +
      ((p.group || "").trim() ? '<span class="gtag">' + esc(p.group) + "</span>" : "") +
      "<small>" + esc(slashOf(p.birth)) +
      (dg ? " ／ 999の相手 " + partnerLabel(f) : "") +
      ((p.memo || "").trim() ? " ／ " + esc(p.memo) : "") +
      (readOnly() && p.ownerName ? " ／ 登録：" + esc(p.ownerName) : "") +
      "</small></div>" +
      '<div class="acts noprint">' +
      (readOnly() ? "" :
        '<button data-edit="' + p.id + '" title="なおす">✏️</button>' +
        '<button data-del="' + p.id + '" title="けす">✕</button>') +
      "</div></div>";
  }

  function renderMeibo() {
    $("count-all").textContent = people.length;
    const fl = currentFilter();
    const hit = sorted(people.filter(function (p) { return matchFilter(p, fl); }));
    const isFiltered = fl.n1 || fl.n2 || fl.n3 || fl.group || fl.text;
    $("filt-result").innerHTML = isFiltered
      ? "条件に合う人：<b>" + hit.length + "人</b>（全" + people.length + "人のうち）"
      : "";
    $("plist").innerHTML = hit.length
      ? '<div class="plist-head">' +
        '<span class="h-no">🍀福の神　🟣裏　🟢ご褒美</span>' +
        '<span class="h-nm">お名前・生年月日</span>' +
        '<span class="h-ac"></span></div>' +
        hit.map(personCardHtml).join("")
      : '<div class="empty">' + (people.length
        ? "条件に合う人がいません。"
        : "まだだれも登録されていません。上の欄から登録してください。") + "</div>";
  }

  // ==================================================================
  // ② 福の神No.
  // ==================================================================
  // 「1＋9＋9＋0 ＝ 19 → 1＋9 ＝ 10 → 1＋0 ＝ 1」のように
  // 1桁になるまでの道のりを、途中をとばさずに全部書く
  function sumStepsFrom(parts, first) {
    const steps = [parts.join("＋") + " ＝ " + first];
    let cur = String(first);
    while (cur.length > 1) {
      const t = digitSum(cur);
      steps.push(cur.split("").join("＋") + " ＝ " + t);
      cur = String(t);
    }
    return steps.join(" → ");
  }
  function sumSteps(n) {
    const parts = String(n).split("");
    if (parts.length === 1) return String(n);
    return sumStepsFrom(parts, digitSum(n));
  }

  function fukuExplainHtml(b, f, u, g) {
    const mdParts = String(b.m).split("").concat(String(b.d).split(""));
    return '<div class="calc-note">' +
      "<b>" + b.y + "年" + b.m + "月" + b.d + "日</b> の計算<br>" +
      '<b style="color:var(--n1)">1つめ</b>（年）：' + sumSteps(b.y) + "<br>" +
      '<b style="color:var(--n2)">2つめ</b>（月と日）：' +
      sumStepsFrom(mdParts, digitSum(b.m) + digitSum(b.d)) + "<br>" +
      '<b style="color:var(--n3)">3つめ</b>（1つめ＋2つめ）：' +
      sumStepsFrom([f.n1, f.n2], f.n1 + f.n2) +
      '<div style="border-top:1px dashed var(--line);margin:8px 0 6px"></div>' +
      '<b style="color:var(--ura)">裏数字</b><br>' +
      "　潜在数字（" + b.m + "月）：" + sumSteps(b.m) + "<br>" +
      "　顕在数字（" + b.d + "日）：" + sumSteps(b.d) +
      '<div style="border-top:1px dashed var(--line);margin:8px 0 6px"></div>' +
      '<b style="color:var(--go)">ご褒美数字</b>：' + f.n1 + "＋" + f.n2 + "＋" + f.n3 +
      " ＝ " + g.raw +
      (g.raw >= 10 ? '<br>　<span class="hint">（1桁にすると ' +
        sumStepsFrom(String(g.raw).split(""), g.single) + "）</span>" : "") +
      "</div>";
  }

  // 3つの数字を大きく見せる共通パーツ
  function diagHeroHtml(dg) {
    return '<div class="hero">' +
      '<div class="hero-item"><div class="hero-k">福の神ナンバー</div>' +
      badge(dg.f, true) + '<div class="hero-v">' + dg.f.label + "</div></div>" +
      '<div class="hero-item"><div class="hero-k">裏数字</div>' +
      '<span class="ura-badge big"><span>' + dg.ura.sen + "</span><span>" + dg.ura.ken +
      '</span></span><div class="hero-v">潜在 ' + dg.ura.sen + " ／ 顕在 " + dg.ura.ken + "</div></div>" +
      '<div class="hero-item"><div class="hero-k">ご褒美数字</div>' +
      '<span class="go-badge big">' + dg.go.single + "</span>" +
      '<div class="hero-v">' + (dg.go.raw >= 10 ? "（" + dg.go.raw + " を1桁に）" : "&nbsp;") + "</div></div>" +
      "</div>" +
      '<div class="hint" style="text-align:center">999の相手は <b>' + partnerLabel(dg.f) + "</b></div>";
  }

  function renderQuickCalc() {
    const box = $("q-result");
    const b = parseLoose($("q-birth").value);
    if (!b) {
      box.innerHTML = $("q-birth").value.trim()
        ? '<div class="hint warn">生年月日が読み取れません。1990/06/24 のように入れてください。</div>'
        : "";
      $("q-save").style.display = "none";
      return;
    }
    $("q-save").style.display = readOnly() ? "none" : "";
    const dg = { b: b, f: calcFuku(b.y, b.m, b.d), ura: calcUra(b.m, b.d), go: null };
    dg.go = calcGohobi(dg.f);
    box.innerHTML = diagHeroHtml(dg) + fukuExplainHtml(b, dg.f, dg.ura, dg.go);
  }

  function renderPersonDetail() {
    const box = $("person-detail");
    const id = $("sel-person").value;
    if (!id) { box.innerHTML = ""; return; }
    const p = people.find(function (x) { return x.id === id; });
    if (!p) { box.innerHTML = ""; return; }
    const dg = diagOf(p);
    if (!dg) { box.innerHTML = '<div class="hint warn">生年月日が正しく入っていません。</div>'; return; }
    const b = dg.b, f = dg.f;
    const mates = people.filter(function (q) {
      return q.id !== p.id && is999(f, fukuOf(q));
    });
    box.innerHTML = '<div style="text-align:center;margin:14px 0">' +
      '<div style="font-weight:800;font-size:1.05rem">' + esc(p.name) + "</div>" +
      '<div class="hint" style="margin-bottom:8px">' + esc(birthJa(p.birth)) +
      ((p.group || "").trim() ? '<span class="gtag">' + esc(p.group) + "</span>" : "") + "</div>" +
      "</div>" + diagHeroHtml(dg) + fukuExplainHtml(b, f, dg.ura, dg.go) +
      "<h3>🔗 めいぼの中の999の相手（" + mates.length + "人）</h3>" +
      (mates.length
        ? '<div class="plist">' + sorted(mates).map(personCardHtml).join("") + "</div>"
        : '<div class="hint">いまのめいぼには、999の関係の人はいません。</div>');
  }

  // 診断タブで出した人を、そのままめいぼに登録する
  function addFromQuick() {
    const name = $("q-name").value.trim();
    const b = parseLoose($("q-birth").value);
    if (!b) { alert("生年月日を 1990/06/24 のように入れてください。"); return; }
    if (!name) { alert("お名前を入れてください。"); return; }
    people.push({
      id: uid(),
      name: name,
      birth: isoOf(b),
      group: $("q-group").value.trim(),
      memo: $("q-memo").value.trim(),
      createdAt: Date.now()
    });
    save();
    $("q-name").value = "";
    $("q-memo").value = "";
    refreshGroupPickers();
    renderMeibo();
    toast(name + " さんをめいぼに登録しました");
  }

  function renderFukuTab() { renderQuickCalc(); renderPersonDetail(); }

  // ==================================================================
  // ③ 999の関係
  // ==================================================================
  function renderPartnerFinder() {
    const n1 = +$("p-n1").value, n2 = +$("p-n2").value, n3 = +$("p-n3").value;
    const me = { n1: n1, n2: n2, n3: n3, label: "" + n1 + n2 + n3 };
    const pl = partnerLabel(me);
    const hit = people.filter(function (q) { return is999(me, fukuOf(q)); });
    const auto = toSingle(n1 + n2) === n3;
    $("p-result").innerHTML =
      '<div style="text-align:center;margin:14px 0">' +
      '<div class="hint">あなたの番号</div>' + badge(me) +
      '<div style="font-size:1.4rem;margin:8px 0;color:var(--gold)">↕</div>' +
      '<div class="hint">999の相手の番号</div>' +
      badge({ n1: partnerDigit(n1), n2: partnerDigit(n2), n3: partnerDigit(n3) }, true) +
      '<div style="font-size:1.1rem;font-weight:800;margin-top:8px">' + pl + "</div></div>" +
      (auto ? "" : '<div class="hint warn">※この3桁の組み合わせは、生年月日からは出てこない番号です（3つめは「1つめ＋2つめ」になるはず）。</div>') +
      "<h3>めいぼの中にいる相手（" + hit.length + "人）</h3>" +
      (hit.length ? '<div class="plist">' + sorted(hit).map(personCardHtml).join("") + "</div>"
        : '<div class="hint">いまのめいぼにはいません。</div>');
  }

  function findPairs(list) {
    const pairs = [];
    for (let i = 0; i < list.length; i++) {
      const fi = fukuOf(list[i]);
      if (!fi) continue;
      for (let j = i + 1; j < list.length; j++) {
        const fj = fukuOf(list[j]);
        if (fj && is999(fi, fj)) pairs.push({ a: list[i], b: list[j], fa: fi, fb: fj });
      }
    }
    return pairs;
  }

  function pairRowHtml(pr) {
    return '<div class="pair hit">' +
      '<div class="who"><b>' + esc(pr.a.name) + "</b>" + badge(pr.fa) + "</div>" +
      '<div class="link">⇄</div>' +
      '<div class="who" style="text-align:right"><b>' + esc(pr.b.name) + "</b>" + badge(pr.fb) + "</div>" +
      "</div>";
  }

  function renderPairList() {
    const list = sorted(byGroup(people, $("n-group").value));
    const pairs = findPairs(list);
    $("pair-list").innerHTML =
      '<div class="hint" style="margin-bottom:10px">' + list.length + "人の中に、999のペアは <b>" +
      pairs.length + "組</b> あります。</div>" +
      (pairs.length ? pairs.map(pairRowHtml).join("")
        : '<div class="empty">999の関係のペアは見つかりませんでした。</div>');
  }

  function renderMatrix() {
    const list = sorted(byGroup(people, $("n-group").value))
      .filter(function (p) { return !!fukuOf(p); });
    const area = $("matrix-area");
    if (list.length < 2) {
      area.innerHTML = '<div class="empty">2人以上登録すると表が出ます。</div>';
      return;
    }
    const f = list.map(fukuOf);
    let h = '<div class="matrix-wrap"><table class="matrix"><tr><th class="rh">　</th>';
    list.forEach(function (p, i) {
      h += "<th>" + esc(p.name) + "<br>" + f[i].label + "</th>";
    });
    h += "</tr>";
    list.forEach(function (p, i) {
      h += '<tr><th class="rh">' + esc(p.name) + " " + f[i].label + "</th>";
      list.forEach(function (q, j) {
        if (i === j) h += '<td class="self">－</td>';
        else if (is999(f[i], f[j])) h += '<td class="yes">◎</td>';
        else h += "<td></td>";
      });
      h += "</tr>";
    });
    h += "</table></div>";
    area.innerHTML = h;
  }

  function renderNineTab() { renderPartnerFinder(); renderPairList(); renderMatrix(); }

  // ==================================================================
  // ④ 分析シート
  // ==================================================================
  // fn(診断) が返す値ごとに人数をかぞえ、多い順に並べる
  function statsBy(list, fn) {
    const counts = {};
    let total = 0;
    list.forEach(function (p) {
      const dg = diagOf(p);
      if (!dg) return;
      const v = fn(dg);
      counts[v] = (counts[v] || 0) + 1;
      total++;
    });
    const rank = Object.keys(counts).map(function (k) { return { n: +k, c: counts[k] }; })
      .sort(function (a, b) { return b.c - a.c || a.n - b.n; });
    return { rank: rank, total: total };
  }
  function barsHtml(title, fn, list, color) {
    const st = statsBy(list, fn);
    if (!st.total) return "";
    const max = st.rank[0].c;
    const rows = st.rank.map(function (x) {
      const pct = Math.round(x.c / st.total * 100);
      return '<div class="bar-row' + (x.c === max ? " top" : "") + '">' +
        '<div class="bn" style="background:' + color + '">' + x.n + "</div>" +
        '<div class="bt"><div class="bf" style="width:' + Math.max(pct, 3) +
        "%;background:" + color + '"></div></div>' +
        '<div class="bp">' + x.c + "人 " + pct + "%</div></div>";
    }).join("");
    return "<h3>" + title + "</h3>" + rows;
  }

  function renderSheet() {
    const g = $("s-group").value;
    const list = sorted(byGroup(people, g)).filter(function (p) { return !!fukuOf(p); });
    const area = $("sheet-area");
    if (!list.length) {
      area.innerHTML = '<div class="card"><div class="empty">分析できる人がいません。' +
        "生年月日が入った人を登録してください。</div></div>";
      return;
    }
    const title = $("s-title").value.trim() ||
      ("ベーベー福の神ワーク 分析シート" + (g && g !== "__none__" ? "（" + g + "）" : ""));
    const pairs = findPairs(list);
    const s1 = statsBy(list, function (d) { return d.f.n1; });

    // 同じ福の神No.の人をまとめる
    const byLabel = {};
    list.forEach(function (p) { const l = fukuOf(p).label; (byLabel[l] = byLabel[l] || []).push(p); });
    const labelRank = Object.keys(byLabel).sort(function (a, b) {
      return byLabel[b].length - byLabel[a].length || a.localeCompare(b);
    });
    const topLabel = labelRank[0] || "";
    const topCount = topLabel ? byLabel[topLabel].length : 0;
    const today = new Date();
    const stamp = today.getFullYear() + "年" + (today.getMonth() + 1) + "月" + today.getDate() + "日";

    let h = '<div class="card" id="sheet-card">';
    h += '<h2 style="border-bottom-width:3px">' + esc(title) + "</h2>";
    h += '<div class="hint" style="margin-bottom:12px">' + stamp + " 作成 ／ 対象：" +
      (g === "__none__" ? "グループなしの人" : (g || "全員")) + "</div>";

    h += '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + list.length + '</div><div class="k">人数</div></div>' +
      '<div class="stat"><div class="v">' + pairs.length + '</div><div class="k">999のペア</div></div>' +
      '<div class="stat"><div class="v">' + labelRank.length + '</div><div class="k">番号の種類</div></div>' +
      '<div class="stat"><div class="v">' + (s1.total && topCount >= 2 ? topLabel : "—") +
      '</div><div class="k">いちばん多い番号' +
      (topCount >= 2 ? "（" + topCount + "人）" : "") + "</div></div>" +
      "</div>";
    if (topCount < 2) h += '<div class="hint" style="margin:-6px 0 14px">※ 同じ福の神ナンバーの人はいません。みんなちがう番号です。</div>';

    h += "<h3>🍀 福の神ナンバー</h3>";
    h += barsHtml("　🔴 1つめの数字", function (d) { return d.f.n1; }, list, "#e9736b");
    h += barsHtml("　🟡 2つめの数字", function (d) { return d.f.n2; }, list, "#f0b429");
    h += barsHtml("　🔵 3つめの数字", function (d) { return d.f.n3; }, list, "#4a9fd8");
    h += "<h3>🟣 裏数字</h3>";
    h += barsHtml("　潜在数字（生まれた月）", function (d) { return d.ura.sen; }, list, "#8e6bbf");
    h += barsHtml("　顕在数字（生まれた日）", function (d) { return d.ura.ken; }, list, "#a98ad0");
    h += barsHtml("🟢 ご褒美数字", function (d) { return d.go.single; }, list, "#2e9e7a");

    h += "<h3>🍀 福の神ナンバーの多い順</h3>";
    h += '<table class="sheet"><tr><th>福の神ナンバー</th><th>人数</th><th>だれ</th></tr>';
    labelRank.forEach(function (l) {
      h += "<tr><td><b>" + l + "</b></td><td>" + byLabel[l].length + "人</td><td>" +
        byLabel[l].map(function (p) { return esc(p.name); }).join("、") + "</td></tr>";
    });
    h += "</table>";

    h += "<h3>🔗 999のペア（" + pairs.length + "組）</h3>";
    if (pairs.length) {
      h += '<table class="sheet"><tr><th>ひとり目</th><th>No.</th><th>ふたり目</th><th>No.</th></tr>';
      pairs.forEach(function (pr) {
        h += "<tr><td>" + esc(pr.a.name) + "</td><td><b>" + pr.fa.label + "</b></td><td>" +
          esc(pr.b.name) + "</td><td><b>" + pr.fb.label + "</b></td></tr>";
      });
      h += "</table>";
    } else {
      h += '<div class="hint">999の関係のペアはありませんでした。</div>';
    }

    h += "<h3>📋 ぜんいん一覧</h3>";
    h += '<table class="sheet"><tr><th>お名前</th><th>生年月日</th><th>福の神<br>ナンバー</th>' +
      "<th>裏数字<br>潜在／顕在</th><th>ご褒美<br>数字</th><th>999の<br>相手</th><th>グループ</th></tr>";
    list.forEach(function (p) {
      const dg = diagOf(p);
      h += "<tr><td>" + esc(p.name) + "</td><td>" + esc(birthJa(p.birth)) +
        "</td><td><b>" + dg.f.label + "</b></td><td>" + dg.ura.sen + " ／ " + dg.ura.ken +
        "</td><td><b>" + dg.go.single + "</b>" +
        "</td><td>" + partnerLabel(dg.f) + "</td><td>" +
        esc((p.group || "").trim() || "—") + "</td></tr>";
    });
    h += "</table></div>";

    area.innerHTML = h;
    toast("シートを作りました");
  }

  // 画像(PNG)で保存 — html2canvas を押したときだけ読み込む
  function savePng() {
    const card = $("sheet-card");
    if (!card) { alert("先に「シートを作る」を押してください。"); return; }
    function run() {
      toast("画像を作っています…");
      window.html2canvas(card, { backgroundColor: "#ffffff", scale: 2 })
        .then(function (canvas) {
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = "福の神ワーク分析シート.png";
          a.click();
          toast("画像を保存しました");
        })
        .catch(function () { alert("画像にできませんでした。PDFでお試しください。"); });
    }
    if (window.html2canvas) { run(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = run;
    s.onerror = function () {
      alert("画像の道具を取ってこられませんでした（ネットにつながっていない？）。\nPDFで保存をお使いください。");
    };
    document.head.appendChild(s);
  }

  // ==================================================================
  // ⑤ グループ分け
  // ==================================================================
  function divide() {
    const mode = $("g-mode").value;
    const list = sorted(byGroup(people, $("g-target").value))
      .filter(function (p) { return !!fukuOf(p); });
    if (!list.length) {
      $("group-area").innerHTML = '<div class="card"><div class="empty">分ける人がいません。</div></div>';
      lastPlan = null;
      return;
    }
    let plan = [];

    const BY = {
      n1: { lab: "1つめ", get: function (d) { return d.f.n1; } },
      n2: { lab: "2つめ", get: function (d) { return d.f.n2; } },
      n3: { lab: "3つめ", get: function (d) { return d.f.n3; } },
      us: { lab: "潜在数字", get: function (d) { return d.ura.sen; } },
      uk: { lab: "顕在数字", get: function (d) { return d.ura.ken; } },
      go: { lab: "ご褒美数字", get: function (d) { return d.go.single; } }
    };
    if (BY[mode]) {
      const lab = BY[mode].lab, get = BY[mode].get;
      const map = {};
      list.forEach(function (p) { const k = get(diagOf(p)); (map[k] = map[k] || []).push(p); });
      Object.keys(map).sort(function (a, b) { return a - b; }).forEach(function (k) {
        plan.push({ name: lab + "が" + k, members: map[k] });
      });

    } else if (mode === "label") {
      const map = {};
      list.forEach(function (p) { const k = fukuOf(p).label; (map[k] = map[k] || []).push(p); });
      Object.keys(map).sort().forEach(function (k) {
        plan.push({ name: "福の神" + k, members: map[k] });
      });

    } else if (mode === "nine") {
      const used = {};
      let no = 1;
      const rest = [];
      list.forEach(function (p) {
        if (used[p.id]) return;
        const f = fukuOf(p);
        const mate = list.find(function (q) {
          return !used[q.id] && q.id !== p.id && is999(f, fukuOf(q));
        });
        if (mate) {
          used[p.id] = used[mate.id] = true;
          plan.push({ name: "999ペア" + (no++), members: [p, mate] });
        } else { rest.push(p); }
      });
      if (rest.length) plan.push({ name: "相手が見つからなかった人", members: rest, note: true });

    } else if (mode === "even") {
      const k = +$("g-count").value || 2;
      // 同じ福の神No.がかたよらないよう、番号順に並べて順番に配っていく
      const seq = list.slice().sort(function (a, b) {
        return fukuOf(a).label.localeCompare(fukuOf(b).label);
      });
      for (let i = 0; i < k; i++) plan.push({ name: "グループ" + (i + 1), members: [] });
      seq.forEach(function (p, i) { plan[i % k].members.push(p); });
      plan = plan.filter(function (g) { return g.members.length; });

    } else { // manual
      lastPlan = null;
      renderManual(list);
      return;
    }

    lastPlan = plan;
    renderPlan(plan, mode);
  }

  function renderPlan(plan, mode) {
    let h = '<div class="card"><h2>🎯 分け方の下書き（' + plan.length + "グループ）</h2>" +
      '<div class="hint" style="margin-bottom:12px">まだ保存されていません。' +
      "気に入ったら上の「この分け方をめいぼに保存する」を押してください。</div>";
    plan.forEach(function (g) {
      h += '<div class="gbox"><div class="gh"><span>' + esc(g.name) +
        "</span><span>" + g.members.length + "人</span></div>" +
        '<div class="gb">' + g.members.map(function (p) {
          const dg = diagOf(p);
          return '<div class="gmini">' + badge(dg.f) + "<b>" + esc(p.name) + "</b>" +
            uraBadge(dg.ura) + goBadge(dg.go) + "</div>";
        }).join("") + "</div></div>";
    });
    if (mode === "nine") {
      const un = plan.find(function (g) { return g.note; });
      if (un) h += '<div class="hint warn">※「相手が見つからなかった人」は、' +
        "このめいぼの中に999の相手がいない人です。</div>";
    }
    h += "</div>";
    $("group-area").innerHTML = h;
  }

  function renderManual(list) {
    let h = '<div class="card"><h2>✋ 手で入れかえる</h2>' +
      '<div class="hint" style="margin-bottom:12px">グループ名を直すと、その場で保存されます。</div>';
    list.forEach(function (p) {
      const f = fukuOf(p);
      h += '<div class="gmini" style="margin-bottom:8px">' + badge(f) +
        "<b>" + esc(p.name) + "</b>" +
        '<select data-gset="' + p.id + '" ' +
        'style="flex:0 0 140px;padding:6px 8px;border:1.5px solid var(--line);border-radius:6px">' +
        '<option value="">（なし）</option>' +
        groupNames().map(function (g) {
          return '<option value="' + esc(g) + '"' +
            ((p.group || "").trim() === g ? " selected" : "") + ">" + esc(g) + "</option>";
        }).join("") + "</select></div>";
    });
    h += "</div>";
    $("group-area").innerHTML = h;
  }

  function applyPlan() {
    if (!lastPlan || !lastPlan.length) {
      alert("先に「分けてみる」を押してください。");
      return;
    }
    if (!confirm("めいぼのグループ名を、この分け方に書きかえます。よろしいですか？")) return;
    lastPlan.forEach(function (g) {
      if (groupList.indexOf(g.name) < 0) groupList.push(g.name);
      g.members.forEach(function (m) {
        const p = people.find(function (x) { return x.id === m.id; });
        if (p) p.group = g.name;
      });
    });
    save();
    refreshGroupPickers();
    renderMeibo();
    toast("めいぼに保存しました");
  }

  // ==================================================================
  // バックアップ
  // ==================================================================
  function exportFile() {
    if (!people.length) { alert("書き出すデータがありません。"); return; }
    const blob = new Blob([JSON.stringify({ v: 1, people: people }, null, 2)],
      { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = "福の神ワーク_バックアップ_" + d.getFullYear() +
      ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("書き出しました");
  }
  function importFile(file) {
    const r = new FileReader();
    r.onload = function () {
      let arr;
      try {
        const o = JSON.parse(r.result);
        arr = Array.isArray(o) ? o : o.people;
      } catch (e) { alert("読み込めないファイルでした。"); return; }
      if (!Array.isArray(arr)) { alert("読み込めないファイルでした。"); return; }
      const add = arr.filter(function (p) { return p && p.name && parseBirth(p.birth); });
      if (!add.length) { alert("使えるデータが入っていませんでした。"); return; }
      const mode = confirm("いまの" + people.length + "人に、" + add.length +
        "人を『追加』します。\n\nOK＝追加する／キャンセル＝いまのデータを全部この" +
        add.length + "人に『入れかえる』");
      const fixed = add.map(function (p) {
        return {
          id: p.id || uid(), name: String(p.name), birth: p.birth,
          group: p.group ? String(p.group) : "", memo: p.memo ? String(p.memo) : "",
          createdAt: p.createdAt || Date.now()
        };
      });
      if (mode) {
        const have = {};
        people.forEach(function (p) { have[p.name + "|" + p.birth] = true; });
        fixed.forEach(function (p) {
          if (!have[p.name + "|" + p.birth]) { people.push(p); have[p.name + "|" + p.birth] = true; }
        });
      } else {
        const newIds = {};
        fixed.forEach(function (p) { newIds[p.id] = true; });
        people.forEach(function (p) { if (!newIds[p.id]) removedIds.push(p.id); });
        people = fixed;
      }
      save();
      refreshGroupPickers();
      renderMeibo();
      toast("読み込みました（" + people.length + "人）");
    };
    r.readAsText(file);
  }

  // ==================================================================
  // ログイン表示
  // ==================================================================
  function renderUserBar() {
    const bar = $("userbar");
    const db = window.BebeDB;
    if (!bar || !db || !db.user) { if (bar) bar.innerHTML = ""; return; }
    const nm = db.user.displayName || db.user.email || "";
    let h = "<span><b>" + esc(nm) + "</b> さん</span>";
    if (db.isAdmin) {
      h += '<button id="sc-mine" class="' + (scope === "mine" ? "on" : "") + '">自分のぶん</button>' +
           '<button id="sc-all" class="' + (scope === "all" ? "on" : "") + '">全員ぶん</button>';
    }
    h += '<button id="btn-logout">ログアウト</button>';
    bar.innerHTML = h;
    if (db.isAdmin) {
      $("sc-mine").addEventListener("click", function () { setScope("mine"); });
      $("sc-all").addEventListener("click", function () { setScope("all"); });
    }
    $("btn-logout").addEventListener("click", function () {
      if (confirm("ログアウトします。よろしいですか？")) db.logout();
    });
  }

  function setScope(next) {
    if (scope === next) return;
    scope = next;
    clearForm();
    renderUserBar();
    reloadFromServer();
    toast(next === "all" ? "全員ぶんを表示します（見るだけ）" : "自分のぶんを表示します");
  }

  // 「全員ぶんを見ています」の案内と、登録フォームの出し分け
  function renderScopeNote() {
    const note = $("scope-note");
    const form = $("regist-card");
    const backup = $("backup-card");
    const ro = readOnly();
    if (note) {
      note.style.display = ro ? "" : "none";
      note.textContent = "いまは全員ぶんを見ています。ここでは登録や書きかえはできません。" +
        "（自分のぶんに切りかえると登録できます）";
    }
    if (form) form.style.display = ro ? "none" : "";
    if (backup) backup.style.display = ro ? "none" : "";
    const qs = $("q-save");
    if (qs && ro) qs.style.display = "none";
    const gc = $("group-card");
    if (gc) gc.style.display = ro ? "none" : "";
  }

  // ==================================================================
  // 起動
  // ==================================================================
  function init() {

    fillDigitSelect($("f-n1"), true);
    fillDigitSelect($("f-n2"), true);
    fillDigitSelect($("f-n3"), true);
    fillDigitSelect($("f-us"), true);
    fillDigitSelect($("f-uk"), true);
    fillDigitSelect($("f-go"), true);
    fillDigitSelect($("p-n1"), false);
    fillDigitSelect($("p-n2"), false);
    fillDigitSelect($("p-n3"), false);
    $("p-n1").value = 1; $("p-n2").value = 3; $("p-n3").value = 4;
    let gc = "";
    for (let i = 2; i <= 10; i++) gc += '<option value="' + i + '">' + i + "グループ</option>";
    $("g-count").innerHTML = gc;
    $("g-count").value = 2;

    // タブ
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
      b.addEventListener("click", function () { showTab(b.dataset.tab); });
    });

    // めいぼ
    $("in-birth").addEventListener("input", formPreview);
    $("btn-add").addEventListener("click", addOrUpdate);
    $("btn-clear-form").addEventListener("click", function () { clearForm(); toast("入力を消しました"); });
    $("plist").addEventListener("click", function (e) {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (ed) startEdit(ed.dataset.edit);
      else if (dl) removePerson(dl.dataset.del);
    });
    ["f-n1", "f-n2", "f-n3", "f-us", "f-uk", "f-go", "f-group"].forEach(function (id) {
      $(id).addEventListener("change", renderMeibo);
    });
    $("f-text").addEventListener("input", renderMeibo);
    $("btn-reset-filter").addEventListener("click", function () {
      $("f-n1").value = ""; $("f-n2").value = ""; $("f-n3").value = "";
      $("f-us").value = ""; $("f-uk").value = ""; $("f-go").value = "";
      $("f-group").value = ""; $("f-text").value = "";
      renderMeibo();
    });

    // 福の神No.
    $("q-birth").addEventListener("input", renderQuickCalc);
    $("sel-person").addEventListener("change", renderPersonDetail);
    $("btn-q-add").addEventListener("click", addFromQuick);
    $("btn-add-group").addEventListener("click", addGroup);
    $("new-group").addEventListener("keydown", function (e) {
      if (e.key === "Enter") addGroup();
    });
    $("group-chips").addEventListener("click", function (e) {
      const t = e.target.closest("[data-gdel]");
      if (t) deleteGroup(t.dataset.gdel);
    });

    // 999
    ["p-n1", "p-n2", "p-n3"].forEach(function (id) {
      $(id).addEventListener("change", renderPartnerFinder);
    });
    $("n-group").addEventListener("change", function () { renderPairList(); renderMatrix(); });

    // 分析シート
    $("btn-make-sheet").addEventListener("click", renderSheet);
    $("btn-save-png").addEventListener("click", savePng);
    $("btn-save-pdf").addEventListener("click", function () {
      if (!$("sheet-card")) { alert("先に「シートを作る」を押してください。"); return; }
      window.print();
    });

    // グループ分け
    $("g-mode").addEventListener("change", function () {
      $("g-count-field").style.display = $("g-mode").value === "even" ? "" : "none";
    });
    $("btn-divide").addEventListener("click", divide);
    $("btn-apply-group").addEventListener("click", applyPlan);

    // バックアップ
    $("btn-export").addEventListener("click", exportFile);
    $("btn-import").addEventListener("click", function () { $("file-import").click(); });
    $("file-import").addEventListener("change", function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = "";
    });
    $("group-area").addEventListener("change", function (e) {
      const t = e.target.closest("[data-gset]");
      if (!t) return;
      const p = people.find(function (x) { return x.id === t.dataset.gset; });
      if (!p) return;
      p.group = t.value.trim();
      save();
      refreshGroupPickers();
      renderMeibo();
      toast("グループを変えました");
    });

    // ---------- ログイン ----------
    $("btn-login").addEventListener("click", function () {
      const err = $("login-error");
      err.style.display = "none";
      if (!window.BebeDB) {
        err.textContent = "ログインの準備ができていません。少し待ってから、もう一度押してください。";
        err.style.display = "block";
        return;
      }
      window.BebeDB.login().catch(function (e) {
        err.textContent = "ログインできませんでした。（" + (e && e.message ? e.message : e) + "）";
        err.style.display = "block";
      });
    });

    startAuth();
    refreshGroupPickers();
    renderMeibo();
  }

  // ログインの状態を見て、ログイン画面かアプリ画面かを出し分ける
  function startAuth() {
    function begin() {
      window.BebeDB.onReady(function (user) {
        const overlay = $("login-overlay");
        const content = $("app-content");
        $("login-wait").style.display = "none";
        $("login-body").style.display = user ? "none" : "";
        if (user) {
          overlay.classList.remove("on");
          content.classList.add("ready");
          if (!window.BebeDB.isAdmin) scope = "mine";
          renderUserBar();
          reloadFromServer();
        } else {
          people = []; groupList = [];
          scope = "mine";
          content.classList.remove("ready");
          overlay.classList.add("on");
          renderUserBar();
          refreshGroupPickers();
          renderMeibo();
        }
      });
    }
    if (window.BebeDB) { begin(); return; }
    window.addEventListener("bebedb-ready", begin, { once: true });
    // モジュールが読めないとき（ネットが無いなど）は、その旨を出す
    setTimeout(function () {
      if (!window.BebeDB) {
        const err = $("login-error");
        err.textContent = "ログインの準備ができませんでした。ネットにつながっているか確認して、画面を再読み込みしてください。";
        err.style.display = "block";
        $("login-wait").style.display = "none";
        $("login-body").style.display = "";
        $("login-overlay").classList.add("on");
      }
    }, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();

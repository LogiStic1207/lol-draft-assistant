/* ========================================================
   ui.js — Draft Room UI
   (A) 좌/우 팀 밴/픽 슬롯
   (B) Champion Pool Browser
   (C) Decision Assistant + Comp Radar
   (D) Series Tracker
   ======================================================== */

const DraftUI = (() => {
  let _roleFilter = 'ALL';
  let _searchQuery = '';
  let _poolFilter = 'all'; // all, signature, available, locked, enemy

  function init() {
    const container = document.getElementById('view-draft');
    if (!container) return;
    container.innerHTML = _buildHTML();
    _bindEvents();
  }

  function _buildHTML() {
    return `
      <div class="draft-room">
        <!-- (D) Series Tracker -->
        <div class="series-tracker" id="series-tracker">
          <div class="series-info">
            <span class="series-format" id="series-format">BO3</span>
            <span class="series-game" id="series-game">GAME 1</span>
            <span class="series-fearless" id="series-fearless">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              FEARLESS: <span id="lock-count">0</span> 잠금
            </span>
          </div>
          <div class="series-games-bar" id="series-games-bar"></div>
          <div class="series-actions">
            <button class="btn btn-sm btn-accent" id="btn-new-series">새 시리즈</button>
            <button class="btn btn-sm" id="btn-finish-game" disabled>게임 종료</button>
            <button class="btn btn-sm" id="btn-undo">↩ 되돌리기</button>
            <button class="btn btn-sm" id="btn-meta-modal">🔧 패치 메타</button>
          </div>
        </div>

        <div class="draft-main">
          <!-- (A) Left: Blue/Our Team -->
          <div class="draft-side draft-blue" id="draft-blue">
            <div class="side-header">
              <span class="side-label">BLUE</span>
              <div class="ban-icons" id="blue-bans">
                ${_buildBanIcons(5, 'blue-ban')}
              </div>
            </div>
            <div class="pick-slots" id="blue-picks">
              ${_buildSlots(5, 'blue-pick')}
            </div>
          </div>

          <!-- (B) Center: Champion Pool -->
          <div class="draft-center">
            <div class="turn-indicator" id="turn-indicator">
              <span id="turn-text">시리즈를 시작하세요</span>
            </div>
            <div class="pool-filters">
              <div class="role-filters" id="role-filters">
                <button class="role-btn active" data-role="ALL">ALL</button>
                <button class="role-btn" data-role="TOP">TOP</button>
                <button class="role-btn" data-role="JG">JG</button>
                <button class="role-btn" data-role="MID">MID</button>
                <button class="role-btn" data-role="BOT">BOT</button>
                <button class="role-btn" data-role="SUP">SUP</button>
              </div>
              <input type="text" class="search-input" id="champ-search" placeholder="챔피언 검색..." />
            </div>
            <div class="champion-grid" id="champion-grid"></div>
          </div>

          <!-- (A) Right: Red/Enemy Team -->
          <div class="draft-side draft-red" id="draft-red">
            <div class="side-header">
              <span class="side-label">RED</span>
              <div class="ban-icons" id="red-bans">
                ${_buildBanIcons(5, 'red-ban')}
              </div>
            </div>
            <div class="pick-slots" id="red-picks">
              ${_buildSlots(5, 'red-pick')}
            </div>
          </div>
        </div>

        <!-- (C) Decision Assistant — All panels merged -->
        <div class="decision-assistant" id="decision-assistant">
          <div class="assist-panel" id="assist-recs">
            <div class="assist-section" id="ban-recs">
              <h4>🚫 밴 추천</h4>
              <div class="rec-list" id="ban-rec-list"></div>
            </div>
            <div class="assist-section" id="pick-recs-sig">
              <h4>🌟 픽 추천</h4>
              <div class="rec-list" id="pick-sig-list"></div>
            </div>
            <div class="assist-section" id="pick-recs-safe">
              <h4>🛡️ 안전 선픽</h4>
              <div class="rec-list" id="pick-safe-list"></div>
            </div>
            <div class="assist-section" id="predict-section">
              <h4>🔮 상대 예측 픽</h4>
              <div class="rec-list" id="predict-list"></div>
            </div>
            <div class="assist-section" id="comp-section">
              <h4>📊 컴프 분석</h4>
              <canvas id="comp-radar-canvas" width="200" height="200"></canvas>
              <div id="comp-warnings"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- New Series Modal -->
      <div class="modal-overlay hidden" id="modal-new-series">
        <div class="modal">
          <h3>새 시리즈 시작</h3>
          <div class="form-group">
            <label>유형</label>
            <select id="modal-match-type">
              <option value="scrim">🎯 스크림</option>
              <option value="official">🏆 공식 경기</option>
            </select>
          </div>
          <div class="form-group">
            <label>포맷</label>
            <select id="modal-format">
              <option value="BO3">BO3</option>
              <option value="BO5">BO5</option>
            </select>
          </div>
          <div class="form-group">
            <label>상대팀</label>
            <select id="modal-opponent"><option value="">-- 선택 --</option></select>
          </div>
          <div class="form-group">
            <label>우리 사이드</label>
            <select id="modal-side">
              <option value="blue">블루</option>
              <option value="red">레드</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-accent" id="modal-start">시작</button>
            <button class="btn" id="modal-cancel">취소</button>
          </div>
        </div>
      </div>

      <!-- Finish Game Modal -->
      <div class="modal-overlay hidden" id="modal-finish-game">
        <div class="modal">
          <h3>게임 결과 입력</h3>
          <div class="form-group">
            <label>결과</label>
            <select id="modal-result">
              <option value="W">승리 (W)</option>
              <option value="L">패배 (L)</option>
            </select>
          </div>
          <div class="form-group">
            <label>메모 (한 줄)</label>
            <input type="text" id="modal-memo" placeholder="예: 미드 주도권 부족" />
          </div>
          <div class="form-group">
            <label>계획 태그</label>
            <select id="modal-plan-tag">
              <option value="">-- 선택 --</option>
              <option value="teamfight">한타</option>
              <option value="splitpush">스플릿</option>
              <option value="poking">포킹</option>
              <option value="pick">픽조합</option>
              <option value="objective">오브젝트</option>
            </select>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="modal-plan-success" /> 플랜 성공</label>
          </div>
          <div class="form-group">
            <label>다음 게임 사이드</label>
            <select id="modal-next-side">
              <option value="blue">블루</option>
              <option value="red">레드</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-accent" id="modal-finish-confirm">저장 & 다음 게임</button>
            <button class="btn" id="modal-finish-cancel">취소</button>
          </div>
        </div>
      </div>

    `;
  }

  function _buildSlots(count, prefix) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="slot-wrapper">
        <div class="draft-slot" id="${prefix}-${i}"><div class="slot-placeholder">${i + 1}</div></div>
        <span class="slot-label" id="${prefix}-name-${i}"></span>
      </div>`;
    }
    return html;
  }

  function _buildBanIcons(count, prefix) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="ban-icon-slot" id="${prefix}-${i}"><span class="ban-icon-num">${i + 1}</span></div>`;
    }
    return html;
  }

  function _bindEvents() {
    // New Series
    document.getElementById('btn-new-series')?.addEventListener('click', _showNewSeriesModal);
    document.getElementById('modal-start')?.addEventListener('click', _startNewSeries);
    document.getElementById('modal-cancel')?.addEventListener('click', () => _hideModal('modal-new-series'));

    // Finish Game
    document.getElementById('btn-finish-game')?.addEventListener('click', _showFinishGameModal);
    document.getElementById('modal-finish-confirm')?.addEventListener('click', _finishGame);
    document.getElementById('modal-finish-cancel')?.addEventListener('click', () => _hideModal('modal-finish-game'));

    // Series Complete
    document.getElementById('modal-series-ok')?.addEventListener('click', _resetDraft);

    // Undo
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      DraftEngine.undoAction();
      _refreshAll();
    });

    // Meta Modal (triggers local function)
    document.getElementById('btn-meta-modal')?.addEventListener('click', _showMetaModal);

    // Lane Assignment
    document.getElementById('btn-lane-confirm')?.addEventListener('click', _confirmLaneAssignment);

    // Role filters
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _roleFilter = btn.dataset.role;
        _renderChampionGrid();
      });
    });

    // Search
    document.getElementById('champ-search')?.addEventListener('input', (e) => {
      _searchQuery = e.target.value.toLowerCase();
      _renderChampionGrid();
    });

    _renderChampionGrid();
  }

  function _showNewSeriesModal() {
    const select = document.getElementById('modal-opponent');
    select.innerHTML = '<option value="">-- 선택 --</option>';
    Store.getOpponents().forEach(o => {
      select.innerHTML += `<option value="${o.id}">${o.name}</option>`;
    });
    document.getElementById('modal-new-series')?.classList.remove('hidden');
  }

  function _showFinishGameModal() {
    document.getElementById('modal-finish-game')?.classList.remove('hidden');
  }

  function _hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  }

  function _startNewSeries() {
    const format = document.getElementById('modal-format').value;
    const oppId = document.getElementById('modal-opponent').value;
    const side = document.getElementById('modal-side').value;
    const matchType = document.getElementById('modal-match-type').value;

    DraftEngine.startSeries(format, oppId, side);
    DraftEngine.startGame(1, side);
    // Save matchType on state for later use when saving series
    const state = DraftEngine.getState();
    if (state) state.matchType = matchType;
    _hideModal('modal-new-series');
    _refreshAll();
  }

  function _finishGame() {
    const result = document.getElementById('modal-result').value;
    const memo = document.getElementById('modal-memo').value;
    const tag = document.getElementById('modal-plan-tag').value;
    const success = document.getElementById('modal-plan-success').checked;
    const nextSide = document.getElementById('modal-next-side').value;

    const gameRecord = DraftEngine.finishGame(result, memo, tag, success);
    if (!gameRecord) return;

    // Update opponent data
    const state = DraftEngine.getState();
    if (state?.opponentId) {
      for (const cid of gameRecord.picks.enemy) {
        Store.updateOpponentPickFreq(state.opponentId, cid);
      }
    }

    // Update player mastery
    const won = result === 'W';
    const players = Store.getPlayers();
    for (const cid of gameRecord.picks.our) {
      // Try to match champion to player (heuristic: use first matching player by role)
      for (const p of players) {
        const champ = CHAMPION_MAP[cid];
        if (champ && champ.roles.some(r => r === p.role)) {
          Store.updatePlayerMastery(p.id, cid, won);
          break;
        }
      }
    }

    // Save series: track ongoing series ID on state
    if (state?.opponentId) {
      if (state._seriesId) {
        // Append game to existing series
        Store.addGameToSeries(state._seriesId, gameRecord);
      } else {
        // Create new series
        const series = Store.addSeries({
          date: new Date().toISOString().slice(0, 10),
          opponentId: state.opponentId,
          format: state.format,
          matchType: state.matchType || 'scrim',
          patch: DDRAGON_VERSION,
          rule: 'HARD_FEARLESS_GLOBAL',
          games: [gameRecord],
          completed: false,
        });
        state._seriesId = series.id;
      }

      // If series is complete, mark it
      if (state.isSeriesComplete) {
        Store.updateSeries(state._seriesId, { completed: true });
      }
    }

    _hideModal('modal-finish-game');

    // Start next game or show series complete
    if (state.isSeriesComplete) {
      // Show series complete modal
      const wins = state.gameHistory.filter(g => g.result === 'W').length;
      const losses = state.gameHistory.filter(g => g.result === 'L').length;
      const opp = state.opponentId ? Store.getOpponent(state.opponentId) : null;
      const summaryEl = document.getElementById('series-complete-summary');
      if (summaryEl) {
        summaryEl.textContent = `vs ${opp?.name || '상대팀'} — ${wins}W ${losses}L (${state.format})`;
      }
      document.getElementById('modal-series-complete')?.classList.remove('hidden');
    } else {
      DraftEngine.startGame(state.currentGame, nextSide);
    }
    _refreshAll();
  }

  function _resetDraft() {
    _hideModal('modal-series-complete');
    // Refresh the scrim log if it exists
    if (typeof ScrimUI !== 'undefined') ScrimUI.render();
    // Reinitialize draft room
    init();
  }

  function _showMetaModal() {
    const content = document.getElementById('meta-modal-content');
    if (!content) return;
    if (typeof MetaAnalyzer === 'undefined') {
      content.innerHTML = '<p>메타 분석기가 로드되지 않았습니다.</p>';
      document.getElementById('modal-meta')?.classList.remove('hidden');
      return;
    }
    const scores = MetaAnalyzer.getMetaScores ? MetaAnalyzer.getMetaScores() : {};
    const buffs = [], nerfs = [];
    for (const [cid, data] of Object.entries(scores)) {
      const champ = CHAMPION_MAP[cid];
      if (!champ) continue;
      const score = data.score || 0;
      if (score > 0) buffs.push({ champ, score, changes: data.changes || [] });
      else if (score < 0) nerfs.push({ champ, score, changes: data.changes || [] });
    }
    buffs.sort((a, b) => b.score - a.score);
    nerfs.sort((a, b) => a.score - b.score);

    content.innerHTML = `
      <div class="meta-info-row">
        <span>현재 패치: <strong>${DDRAGON_VERSION}</strong></span>
      </div>
      <div class="meta-columns">
        <div class="meta-col">
          <h4>🔺 버프 (${buffs.length})</h4>
          ${buffs.length === 0 ? '<p class="text-muted">감지된 버프 없음</p>' : buffs.map(b => `
            <div class="meta-champ-row buff">
              <img src="${b.champ.image}" class="meta-champ-img" />
              <span>${b.champ.name}</span>
              <span class="meta-score-badge buff">+${(b.score * 100).toFixed(0)}</span>
            </div>
          `).join('')}
        </div>
        <div class="meta-col">
          <h4>🔻 너프 (${nerfs.length})</h4>
          ${nerfs.length === 0 ? '<p class="text-muted">감지된 너프 없음</p>' : nerfs.map(n => `
            <div class="meta-champ-row nerf">
              <img src="${n.champ.image}" class="meta-champ-img" />
              <span>${n.champ.name}</span>
              <span class="meta-score-badge nerf">${(n.score * 100).toFixed(0)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.getElementById('modal-meta')?.classList.remove('hidden');
  }

  function _showLaneAssignment() {
    const state = DraftEngine.getState();
    if (!state) return;
    const bluePicks = state.bluePicks;
    const redPicks = state.redPicks;
    const list = document.getElementById('lane-assign-list');
    if (!list) return;
    const lanes = ['TOP', 'JG', 'MID', 'BOT', 'SUP'];
    const blueLabel = state.ourSide === 'blue' ? '🔵 우리 팀 (블루)' : '🔵 상대 팀 (블루)';
    const redLabel = state.ourSide === 'red' ? '🔴 우리 팀 (레드)' : '🔴 상대 팀 (레드)';

    function renderTeam(picks, label, prefix) {
      return `
        <h4 style="margin:12px 0 8px;color:var(--text-secondary)">${label}</h4>
        ${picks.map((cid, i) => {
        const c = CHAMPION_MAP[cid];
        if (!c) return '';
        return `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <img src="${c.image}" style="width:36px;height:36px;border-radius:50%" />
              <strong style="flex:1">${c.name}</strong>
              <select class="lane-select" data-prefix="${prefix}" data-index="${i}" style="padding:4px 8px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-primary)">
                ${lanes.map(l => `<option value="${l}" ${l === (c.roles[0] || 'MID') ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          `;
      }).join('')}
      `;
    }

    list.innerHTML = renderTeam(bluePicks, blueLabel, 'blue') + renderTeam(redPicks, redLabel, 'red');
    document.getElementById('modal-lane-assign')?.classList.remove('hidden');
  }

  function _confirmLaneAssignment() {
    const state = DraftEngine.getState();
    if (!state) return;
    const blueAssign = {};
    const redAssign = {};
    document.querySelectorAll('.lane-select').forEach(sel => {
      const prefix = sel.dataset.prefix;
      const idx = parseInt(sel.dataset.index);
      const picks = prefix === 'blue' ? state.bluePicks : state.redPicks;
      const champId = picks[idx];
      if (champId) {
        if (prefix === 'blue') blueAssign[champId] = sel.value;
        else redAssign[champId] = sel.value;
      }
    });
    // Assign based on which side is ours
    if (state.ourSide === 'blue') {
      state.laneAssignments = blueAssign;
      state.enemyLaneAssignments = redAssign;
    } else {
      state.laneAssignments = redAssign;
      state.enemyLaneAssignments = blueAssign;
    }
    document.getElementById('modal-lane-assign')?.classList.add('hidden');
    _refreshAll();
  }

  function _refreshAll() {
    _updateSeriesTracker();
    _updateDraftBoard();
    _renderChampionGrid();
    _updateDecisionAssistant();
    _updateTurnIndicator();

    const state = DraftEngine.getState();
    const finishBtn = document.getElementById('btn-finish-game');
    // Disable if no state, game not complete, series already finished, or lane not assigned yet
    const lanesDone = state?.laneAssignments && Object.keys(state.laneAssignments).length > 0;
    if (finishBtn) finishBtn.disabled = !state?.isComplete || state?.isSeriesComplete || (state?.isComplete && !lanesDone);

    // Auto-show lane assignment when draft completes
    if (state?.isComplete && !state?.isSeriesComplete && !state?.laneAssignments) {
      _showLaneAssignment();
    }
  }

  function _updateSeriesTracker() {
    const state = DraftEngine.getState();
    if (!state) return;

    document.getElementById('series-format').textContent = state.format;
    document.getElementById('series-game').textContent = `GAME ${state.currentGame}`;
    document.getElementById('lock-count').textContent = state.globalLocked.length;

    // Games bar
    const bar = document.getElementById('series-games-bar');
    let barHTML = '';
    for (let i = 1; i <= state.maxGames; i++) {
      const hist = state.gameHistory.find(g => g.gameNo === i);
      const cls = i === state.currentGame ? 'game-tab active' :
        hist ? `game-tab done ${hist.result === 'W' ? 'win' : 'loss'}` : 'game-tab';
      barHTML += `<div class="${cls}">G${i}${hist ? (hist.result === 'W' ? ' ✓' : ' ✗') : ''}</div>`;
    }
    bar.innerHTML = barHTML;
  }

  function _updateDraftBoard() {
    const state = DraftEngine.getState();
    if (!state) return;

    // Update ban icons (small circular)
    _updateBanIcons('blue-ban', state.blueBans);
    _updateBanIcons('red-ban', state.redBans);
    // Update pick slots
    _updateSlots('blue-pick', state.bluePicks, 'pick');
    _updateSlots('red-pick', state.redPicks, 'pick');

    // Highlight current turn
    const turn = DraftEngine.getCurrentTurn();
    document.querySelectorAll('.draft-slot, .ban-icon-slot').forEach(s => s.classList.remove('pending'));
    if (turn) {
      const prefix = `${turn.side}-${turn.type}`;
      const slot = document.getElementById(`${prefix}-${turn.index}`);
      if (slot) slot.classList.add('pending');
    }

    // Highlight our side
    const blue = document.getElementById('draft-blue');
    const red = document.getElementById('draft-red');
    if (blue && red) {
      blue.classList.toggle('our-side', state.ourSide === 'blue');
      red.classList.toggle('our-side', state.ourSide === 'red');
    }
  }

  function _updateBanIcons(prefix, champs) {
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById(`${prefix}-${i}`);
      if (!slot) continue;
      if (i < champs.length) {
        const c = CHAMPION_MAP[champs[i]];
        if (c) {
          slot.innerHTML = `
            <img src="${c.image}" alt="${c.name}" class="ban-icon-img" onerror="this.style.display='none'" />
            <span class="ban-icon-x">✕</span>
          `;
          slot.classList.add('filled');
          slot.title = c.name;
        }
      } else {
        slot.innerHTML = `<span class="ban-icon-num">${i + 1}</span>`;
        slot.classList.remove('filled');
        slot.title = '';
      }
    }
  }

  function _updateSlots(prefix, champs, type) {
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById(`${prefix}-${i}`);
      const nameLabel = document.getElementById(`${prefix}-name-${i}`);
      if (!slot) continue;
      if (i < champs.length) {
        const c = CHAMPION_MAP[champs[i]];
        if (c) {
          const metaLabel = (typeof MetaAnalyzer !== 'undefined') ? MetaAnalyzer.getMetaLabel(c.id) : '';
          slot.innerHTML = `
            <img src="${c.image}" alt="${c.name}" class="slot-img" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><rect fill=%22%23333%22 width=%2248%22 height=%2248%22/></svg>'" />
            ${metaLabel ? `<span class="slot-meta">${metaLabel}</span>` : ''}
          `;
          slot.classList.add('filled');
          if (nameLabel) nameLabel.textContent = c.name;
        }
      } else {
        slot.innerHTML = `<div class="slot-placeholder">${i + 1}</div>`;
        slot.classList.remove('filled');
        if (nameLabel) nameLabel.textContent = '';
      }
    }
  }

  function _updateTurnIndicator() {
    const state = DraftEngine.getState();
    const el = document.getElementById('turn-text');
    if (!el) return;
    if (!state) { el.textContent = '시리즈를 시작하세요'; return; }
    if (state.isSeriesComplete) { el.textContent = '시리즈 완료!'; return; }
    if (state.isComplete) { el.textContent = '드래프트 완료 — 게임 종료를 눌러주세요'; return; }
    const turn = DraftEngine.getCurrentTurn();
    if (!turn) return;
    const isOurs = turn.side === state.ourSide;
    const action = turn.type === 'ban' ? '밴' : '픽';
    const side = turn.side === 'blue' ? '블루' : '레드';
    el.textContent = `${side}팀 ${action} (${isOurs ? '우리 턴' : '상대 턴'})`;
    document.getElementById('turn-indicator')?.classList.toggle('our-turn', isOurs);
    document.getElementById('turn-indicator')?.classList.toggle('enemy-turn', !isOurs);
  }

  function _renderChampionGrid() {
    const grid = document.getElementById('champion-grid');
    if (!grid) return;

    const state = DraftEngine.getState();
    let champs = CHAMPIONS;

    // Role filter
    if (_roleFilter !== 'ALL') {
      champs = champs.filter(c => c.roles.includes(_roleFilter));
    }
    // Search filter
    if (_searchQuery) {
      champs = champs.filter(c => c.name.toLowerCase().includes(_searchQuery) || c.id.toLowerCase().includes(_searchQuery));
    }

    const unavailable = new Set(state ? [
      ...state.globalLocked, ...state.blueBans, ...state.redBans,
      ...state.bluePicks, ...state.redPicks
    ] : []);

    // Signature sets
    const sigs = new Set();
    const team = Store.getTeam();
    (team.signaturePicks || []).forEach(s => sigs.add(s));
    Store.getPlayers().forEach(p => (p.signatureChamps || []).forEach(s => sigs.add(s)));

    grid.innerHTML = champs.map(c => {
      const locked = unavailable.has(c.id);
      const isSig = sigs.has(c.id);
      const cls = ['champ-card'];
      if (locked) cls.push('locked');
      if (isSig && !locked) cls.push('signature');
      if (state?.globalLocked.includes(c.id)) cls.push('fearless-locked');

      return `<div class="${cls.join(' ')}" data-champ="${c.id}" ${locked ? '' : `onclick="DraftUI.onChampClick('${c.id}')"`}>
        <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.style.display='none'" />
        <span class="champ-name">${c.name}</span>
        ${isSig ? '<span class="sig-badge">★</span>' : ''}
        ${state?.globalLocked.includes(c.id) ? '<span class="lock-badge">🔒</span>' : ''}
      </div>`;
    }).join('');
  }

  function onChampClick(champId) {
    const state = DraftEngine.getState();
    if (!state || state.isComplete) return;
    DraftEngine.selectChampion(champId);
    _refreshAll();
  }

  function _updateDecisionAssistant() {
    const state = DraftEngine.getState();
    if (!state) return;

    const available = DraftEngine.getAvailableChampions();
    const opp = state.opponentId ? Store.getOpponent(state.opponentId) : null;
    const enemyPicks = DraftEngine.getEnemyPicks();
    const ourPicks = DraftEngine.getOurPicks();
    const turn = DraftEngine.getCurrentTurn();
    const isBanPhase = turn && turn.type === 'ban';
    const isPickPhase = turn && turn.type === 'pick';
    const isOurTurn = turn && turn.side === state.ourSide;
    // Blue first pick = first pick phase turn for blue
    const isBlueFirstPick = isPickPhase && turn.side === 'blue' && turn.index === 0;

    // --- Ban recommendations: Only during OUR ban turn ---
    const bans = Analysis.computeBanScores(available, opp, state);
    const banList = document.getElementById('ban-rec-list');
    if (banList) {
      if (isBanPhase && isOurTurn) {
        banList.innerHTML = bans.map(b => `
          <div class="rec-card ban-card" onclick="DraftUI.onChampClick('${b.champion.id}')">
            <img src="${b.champion.image}" class="rec-img" onerror="this.style.display='none'" />
            <div class="rec-info">
              <strong>${b.champion.name}</strong>
              <span class="rec-score">${(b.score * 100).toFixed(0)}점</span>
              <div class="rec-reasons">${b.reasons.map(r => `<span class="reason">${r}</span>`).join('')}</div>
            </div>
          </div>
        `).join('') || '<div class="empty-rec">데이터 부족</div>';
      } else if (isBanPhase && !isOurTurn) {
        banList.innerHTML = '<div class="empty-rec">상대 밴 턴 — 대기 중</div>';
      } else if (!turn) {
        banList.innerHTML = bans.map(b => `
          <div class="rec-card ban-card">
            <img src="${b.champion.image}" class="rec-img" onerror="this.style.display='none'" />
            <div class="rec-info">
              <strong>${b.champion.name}</strong>
              <span class="rec-score">${(b.score * 100).toFixed(0)}점</span>
            </div>
          </div>
        `).join('') || '<div class="empty-rec">데이터 부족</div>';
      } else {
        banList.innerHTML = '<div class="empty-rec">픽 페이즈 진행 중</div>';
      }
    }

    // --- Pick recommendations: Only during OUR pick turn ---
    const picks = Analysis.computePickScores(available, state);
    const sigList = document.getElementById('pick-sig-list');
    if (sigList) {
      if (isPickPhase && isOurTurn) {
        // Combined: signature + general picks sorted by score (top 5)
        const combined = picks.all.slice(0, 5);
        sigList.innerHTML = combined.map(p => `
          <div class="rec-card ${p.type === 'SIGNATURE' ? 'sig-card' : 'pick-card'}" onclick="DraftUI.onChampClick('${p.champion.id}')">
            <img src="${p.champion.image}" class="rec-img" onerror="this.style.display='none'" />
            <div class="rec-info">
              <strong>${p.champion.name}</strong>
              <span class="rec-score">${(p.score * 100).toFixed(0)}점</span>
              <div class="rec-reasons">${p.reasons.map(r => `<span class="reason">${r}</span>`).join('')}</div>
            </div>
          </div>
        `).join('') || '<div class="empty-rec">추천 데이터 없음 — Team DNA에서 등록</div>';
      } else if (isPickPhase && !isOurTurn) {
        sigList.innerHTML = '<div class="empty-rec">상대 픽 턴 — 대기 중</div>';
      } else {
        sigList.innerHTML = '<div class="empty-rec">밴 페이즈 진행 중</div>';
      }
    }

    // Safe first pick: visible only when our side is blue
    const safeSection = document.getElementById('pick-recs-safe');
    const safeList = document.getElementById('pick-safe-list');
    if (safeSection && safeList) {
      if (state.ourSide === 'blue') {
        safeSection.style.display = '';
        if (isBlueFirstPick && isOurTurn) {
          safeList.innerHTML = picks.safe.slice(0, 3).map(p => `
            <div class="rec-card safe-card" onclick="DraftUI.onChampClick('${p.champion.id}')">
              <img src="${p.champion.image}" class="rec-img" onerror="this.style.display='none'" />
              <div class="rec-info">
                <strong>${p.champion.name}</strong>
                <span class="rec-score">${(p.score * 100).toFixed(0)}점</span>
                <div class="rec-reasons">${p.reasons.map(r => `<span class="reason">${r}</span>`).join('')}</div>
              </div>
            </div>
          `).join('') || '<div class="empty-rec">안전 선픽 없음</div>';
        } else if (isPickPhase) {
          safeList.innerHTML = '<div class="empty-rec">블루 1픽 타이밍에 표시</div>';
        } else {
          safeList.innerHTML = '<div class="empty-rec">밴 페이즈 진행 중</div>';
        }
      } else {
        // Red side: hide safe first pick section
        safeSection.style.display = 'none';
      }
    }

    // Enemy prediction
    const preds = Analysis.predictEnemyPicks(available, opp, enemyPicks);
    const predList = document.getElementById('predict-list');
    if (predList) {
      predList.innerHTML = preds.map((p, i) => `
        <div class="rec-card predict-card">
          <span class="predict-rank">#${i + 1}</span>
          <img src="${p.champion.image}" class="rec-img" onerror="this.style.display='none'" />
          <div class="rec-info">
            <strong>${p.champion.name}</strong>
            <span class="rec-score">${(p.score * 100).toFixed(0)}%</span>
          </div>
        </div>
      `).join('') || '<div class="empty-rec">상대팀 데이터 부족</div>';
    }

    // Comp radar + warnings
    _drawCompRadar(ourPicks);
    const warnings = Analysis.getCompWarnings(ourPicks);
    const warnEl = document.getElementById('comp-warnings');
    if (warnEl) {
      warnEl.innerHTML = warnings.map(w => `
        <div class="warning-card ${w.severity.toLowerCase()}">
          <span class="warn-icon">${w.severity === 'HIGH' ? '🔴' : w.severity === 'MEDIUM' ? '🟡' : '🟢'}</span>
          <div>
            <div class="warn-text">${w.text}</div>
            ${w.solution ? `<div class="warn-solution">→ ${w.solution}</div>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  function _drawCompRadar(pickIds) {
    const canvas = document.getElementById('comp-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = 70;
    ctx.clearRect(0, 0, w, h);

    const radar = Analysis.computeCompRadar(pickIds);
    const labels = ['이니시', 'CC', '프론트', '스케일', 'AP/AD', '오브젝트'];
    const values = [radar.engage, radar.cc, radar.frontline, radar.scale, radar.dmgBalance, radar.objective];
    const n = labels.length;

    // Draw grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const rr = (r * ring) / 4;
        const x = cx + rr * Math.cos(angle);
        const y = cy + rr * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.stroke();
    }

    // Draw data
    ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
      const val = values[idx] * r;
      const x = cx + val * Math.cos(angle);
      const y = cy + val * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.fill();
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#c7d2fe';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + (r + 18) * Math.cos(angle);
      const y = cy + (r + 18) * Math.sin(angle);
      ctx.fillText(labels[i], x, y + 4);
    }
  }

  function refresh() { _refreshAll(); }

  return { init, onChampClick, refresh };
})();

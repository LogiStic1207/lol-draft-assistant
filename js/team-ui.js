/* ========================================================
   team-ui.js — Team DNA (Roster + S/A/B/X Champion Pool)
   - Champion Picker Modal for pool management
   ======================================================== */

const TeamUI = (() => {
  function init() {
    const container = document.getElementById('view-team');
    if (!container) return;
    render();
  }

  function render() {
    const container = document.getElementById('view-team');
    if (!container) return;
    const team = Store.getTeam();
    const players = Store.getPlayers();

    container.innerHTML = `
      <div class="team-page">
        <div class="page-header">
          <h2>Team DNA</h2>
          <p class="subtitle">팀 프로필과 선수별 챔피언풀을 관리합니다</p>
        </div>

        <!-- Team Profile -->
        <div class="card team-profile-card">
          <h3>팀 프로필</h3>
          <div class="form-row">
            <div class="form-group">
              <label>팀 이름</label>
              <input type="text" id="team-name" value="${team.name || ''}" placeholder="팀 이름 입력" />
            </div>
            <div class="form-group">
              <label>메인 샷콜러</label>
              <select id="team-shotcaller">
                <option value="">-- 선택 --</option>
                ${players.map(p => `<option value="${p.id}" ${team.mainShotcaller === p.id ? 'selected' : ''}>${p.name} (${p.role})</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>팀 스타일 태그</label>
            <div class="tag-group" id="team-style-tags">
              ${['교전', '오브젝트', '스케일', '스플릿', '포킹', '픽조합'].map(tag =>
      `<button class="tag-btn ${(team.styleTags || []).includes(tag) ? 'active' : ''}" data-tag="${tag}">${tag}</button>`
    ).join('')}
            </div>
          </div>
          <button class="btn btn-accent" id="btn-save-team">저장</button>
        </div>

        <!-- Players -->
        <div class="section-header">
          <h3>선수 로스터</h3>
          <button class="btn btn-sm btn-accent" id="btn-add-player">+ 선수 추가</button>
        </div>

        <div class="players-grid" id="players-grid">
          ${players.map(p => _renderPlayerCard(p)).join('')}
          ${players.length === 0 ? '<div class="empty-state">선수를 추가해주세요 (5명)</div>' : ''}
        </div>

        <!-- Data Management -->
        <div class="card data-mgmt-card">
          <h3>데이터 관리</h3>
          <div class="btn-row">
            <button class="btn btn-sm" id="btn-export-json">JSON 내보내기</button>
            <button class="btn btn-sm" id="btn-export-csv">CSV 내보내기</button>
            <label class="btn btn-sm">JSON 가져오기 <input type="file" id="import-json" accept=".json" hidden /></label>
          </div>
        </div>
      </div>
    `;

    _bindTeamEvents();
  }

  function _renderPlayerCard(p) {
    const sigChamps = (p.signatureChamps || []).map(cid => CHAMPION_MAP[cid]).filter(Boolean);
    const comfortChamps = (p.comfortChamps || []).map(cid => CHAMPION_MAP[cid]).filter(Boolean);
    const avoidChamps = (p.avoidChamps || []).map(cid => CHAMPION_MAP[cid]).filter(Boolean);

    return `
      <div class="card player-card" data-player="${p.id}">
        <div class="player-header">
          <div class="player-role-badge ${p.role?.toLowerCase()}">${p.role || '?'}</div>
          <div class="player-info">
            <input type="text" class="player-name-input" value="${p.name || ''}" placeholder="선수 이름" data-field="name" />
            <select class="player-role-select" data-field="role">
              ${Object.values(ROLES).map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
          <button class="btn-icon btn-remove-player" title="삭제">🗑</button>
        </div>

        <div class="champ-pool-section">
          <div class="pool-tier">
            <span class="tier-badge s-tier">S</span> 시그니처
            <div class="pool-chips">${sigChamps.map(c => `<span class="pool-chip sig"><img src="${c.image}" onerror="this.style.display='none'" />${c.name}<button class="chip-remove" data-champ="${c.id}" data-tier="signature" data-player="${p.id}">×</button></span>`).join('')}</div>
            <button class="btn btn-xs pool-add" data-tier="signature" data-player="${p.id}">+</button>
          </div>
          <div class="pool-tier">
            <span class="tier-badge a-tier">A</span> 주력
            <div class="pool-chips">${comfortChamps.map(c => `<span class="pool-chip comfort"><img src="${c.image}" onerror="this.style.display='none'" />${c.name}<button class="chip-remove" data-champ="${c.id}" data-tier="comfort" data-player="${p.id}">×</button></span>`).join('')}</div>
            <button class="btn btn-xs pool-add" data-tier="comfort" data-player="${p.id}">+</button>
          </div>
          <div class="pool-tier">
            <span class="tier-badge x-tier">X</span> 금지
            <div class="pool-chips">${avoidChamps.map(c => `<span class="pool-chip avoid"><img src="${c.image}" onerror="this.style.display='none'" />${c.name}<button class="chip-remove" data-champ="${c.id}" data-tier="avoid" data-player="${p.id}">×</button></span>`).join('')}</div>
            <button class="btn btn-xs pool-add" data-tier="avoid" data-player="${p.id}">+</button>
          </div>
        </div>
      </div>
    `;
  }

  function _bindTeamEvents() {
    // Save team profile
    document.getElementById('btn-save-team')?.addEventListener('click', () => {
      const team = Store.getTeam();
      team.name = document.getElementById('team-name').value;
      team.mainShotcaller = document.getElementById('team-shotcaller').value;
      Store.saveTeam(team);
      _toast('팀 프로필 저장됨');
    });

    // Style tags
    document.querySelectorAll('#team-style-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const team = Store.getTeam();
        const tags = [];
        document.querySelectorAll('#team-style-tags .tag-btn.active').forEach(b => tags.push(b.dataset.tag));
        team.styleTags = tags;
        Store.saveTeam(team);
      });
    });

    // Add player
    document.getElementById('btn-add-player')?.addEventListener('click', () => {
      const players = Store.getPlayers();
      if (players.length >= 5) { _toast('최대 5명까지 등록 가능'); return; }
      const usedRoles = new Set(players.map(p => p.role));
      const availRoles = Object.values(ROLES).filter(r => !usedRoles.has(r));
      Store.addPlayer({
        name: '',
        role: availRoles[0] || 'TOP',
        signatureChamps: [],
        comfortChamps: [],
        avoidChamps: [],
      });
      render();
    });

    // Remove player
    document.querySelectorAll('.btn-remove-player').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.player-card');
        if (card) { Store.removePlayer(card.dataset.player); render(); }
      });
    });

    // Player name/role changes
    document.querySelectorAll('.player-name-input, .player-role-select').forEach(input => {
      input.addEventListener('change', () => {
        const card = input.closest('.player-card');
        if (!card) return;
        const field = input.dataset.field;
        Store.updatePlayer(card.dataset.player, { [field]: input.value });
        if (field === 'role') render();
      });
    });

    // Champion pool add buttons — open champion picker modal
    document.querySelectorAll('.pool-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const tier = btn.dataset.tier;
        const playerId = btn.dataset.player;
        _showChampionPicker(playerId, tier);
      });
    });

    // Champion pool remove buttons
    document.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const champId = btn.dataset.champ;
        const tier = btn.dataset.tier;
        const playerId = btn.dataset.player;
        const player = Store.getPlayers().find(p => p.id === playerId);
        if (!player) return;
        const key = tier === 'signature' ? 'signatureChamps' : tier === 'comfort' ? 'comfortChamps' : 'avoidChamps';
        player[key] = (player[key] || []).filter(c => c !== champId);
        Store.updatePlayer(playerId, { [key]: player[key] });
        render();
      });
    });

    // Export/Import
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      _downloadFile('draft-os-data.json', Store.exportJSON(), 'application/json');
    });
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      _downloadFile('draft-os-scrims.csv', Store.exportCSV(), 'text/csv');
    });
    document.getElementById('import-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (Store.importJSON(ev.target.result)) { _toast('데이터 가져오기 성공'); render(); }
        else _toast('가져오기 실패');
      };
      reader.readAsText(file);
    });
  }

  /* ============================================================
     Champion Picker Modal — searchable grid with role filter
     ============================================================ */
  function _showChampionPicker(playerId, tier) {
    // Get player's existing pool to exclude already-added champions
    const player = Store.getPlayers().find(p => p.id === playerId);
    if (!player) return;
    const existingIds = new Set([
      ...(player.signatureChamps || []),
      ...(player.comfortChamps || []),
      ...(player.avoidChamps || []),
    ]);

    const tierLabel = tier === 'signature' ? 'S 시그니처' : tier === 'comfort' ? 'A 주력' : 'X 금지';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'champ-picker-overlay';
    overlay.innerHTML = `
      <div class="champ-picker-modal">
        <div class="champ-picker-header">
          <h3>챔피언 선택 — ${tierLabel}</h3>
          <button class="btn-icon champ-picker-close">✕</button>
        </div>
        <div class="champ-picker-filters">
          <input type="text" class="champ-picker-search" placeholder="챔피언 검색..." autofocus />
          <div class="champ-picker-roles">
            <button class="role-btn active" data-role="ALL">ALL</button>
            <button class="role-btn" data-role="TOP">TOP</button>
            <button class="role-btn" data-role="JG">JG</button>
            <button class="role-btn" data-role="MID">MID</button>
            <button class="role-btn" data-role="BOT">BOT</button>
            <button class="role-btn" data-role="SUP">SUP</button>
          </div>
        </div>
        <div class="champ-picker-grid"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector('.champ-picker-grid');
    const searchInput = overlay.querySelector('.champ-picker-search');
    let roleFilter = 'ALL';

    function renderGrid() {
      const query = searchInput.value.toLowerCase();
      const filtered = CHAMPIONS.filter(c => {
        if (existingIds.has(c.id)) return false;
        if (roleFilter !== 'ALL' && !c.roles.includes(roleFilter)) return false;
        return c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
      });

      grid.innerHTML = filtered.map(c => `
        <div class="champ-picker-item" data-id="${c.id}">
          <img src="${c.image}" alt="${c.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'"/>
          <span>${c.name}</span>
        </div>
      `).join('');

      // Bind click on each champion
      grid.querySelectorAll('.champ-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const champId = item.dataset.id;
          const key = tier === 'signature' ? 'signatureChamps' : tier === 'comfort' ? 'comfortChamps' : 'avoidChamps';
          if (!player[key]) player[key] = [];
          if (!player[key].includes(champId)) player[key].push(champId);
          Store.updatePlayer(playerId, { [key]: player[key] });
          overlay.remove();
          render();
        });
      });
    }

    renderGrid();

    // Search
    searchInput.addEventListener('input', renderGrid);

    // Role filter
    overlay.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        roleFilter = btn.dataset.role;
        renderGrid();
      });
    });

    // Close
    overlay.querySelector('.champ-picker-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Focus search
    setTimeout(() => searchInput.focus(), 100);
  }

  function _downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function _toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
  }

  return { init, render };
})();

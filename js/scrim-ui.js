/* ========================================================
   scrim-ui.js — Scrim/Match Log (Read-Only History View)
   Shows completed series with expandable draft details
   ======================================================== */

const ScrimUI = (() => {

  function init() { render(); }

  function render() {
    const container = document.getElementById('view-scrim-log');
    if (!container) return;

    // Only show completed series (or all if you want in-progress too)
    const allSeries = Store.getSeries().sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || 0
    );

    container.innerHTML = `
      <div class="scrim-page">
        <div class="page-header">
          <h2>Scrim / Match Log</h2>
          <p class="subtitle">Draft Room에서 완료된 시리즈의 결과가 자동으로 기록됩니다</p>
        </div>

        <!-- Filter Bar -->
        <div class="log-filter-bar">
          <button class="filter-btn active" data-filter="all">전체</button>
          <button class="filter-btn" data-filter="official">🏆 공식 경기</button>
          <button class="filter-btn" data-filter="scrim">🎯 스크림</button>
        </div>

        <!-- History -->
        <div class="match-history" id="match-history">
          ${allSeries.length === 0
        ? '<div class="empty-state">아직 기록된 경기가 없습니다.<br>Draft Room에서 시리즈를 완료하면 자동으로 추가됩니다.</div>'
        : allSeries.map(s => _renderSeriesCard(s)).join('')
      }
        </div>
      </div>
    `;

    _bindEvents();
  }

  function _renderSeriesCard(s) {
    const opp = Store.getOpponent(s.opponentId);
    const games = s.games || [];
    const wins = games.filter(g => g.result === 'W').length;
    const losses = games.filter(g => g.result === 'L').length;
    const isComplete = s.completed !== false;
    const typeLabel = s.matchType === 'official' ? '🏆 공식' : '🎯 스크림';
    const statusLabel = isComplete ? '' : '<span class="series-in-progress">진행 중</span>';
    const scoreClass = wins > losses ? 'win' : wins < losses ? 'loss' : 'draw';
    const seriesId = s.id || '';

    return `
      <div class="card series-result-card" data-match-type="${s.matchType || 'scrim'}">
        <div class="series-result-header" onclick="ScrimUI._toggleDetail('${seriesId}')">
          <div class="series-result-left">
            <span class="series-type-badge ${s.matchType || 'scrim'}">${typeLabel}</span>
            <span class="series-date">${s.date || '-'}</span>
            <span class="series-opp-name">${opp?.name || '알 수 없음'}</span>
            <span class="series-format-badge">${s.format}</span>
            ${statusLabel}
          </div>
          <div class="series-result-right">
            <span class="series-score ${scoreClass}">${wins}W - ${losses}L</span>
            <span class="series-expand-arrow" id="arrow-${seriesId}">▼</span>
          </div>
        </div>
        <div class="series-detail-panel hidden" id="detail-${seriesId}">
          ${games.map((g, i) => _renderGameDetail(g, i, s)).join('')}
        </div>
      </div>
    `;
  }

  function _renderGameDetail(g, idx, series) {
    const sideIcon = g.side === 'blue' ? '🔵' : '🔴';
    const resultClass = g.result === 'W' ? 'win' : 'loss';
    const ourBans = (g.bans?.our || []);
    const enemyBans = (g.bans?.enemy || []);
    const ourPicks = (g.picks?.our || []);
    const enemyPicks = (g.picks?.enemy || []);
    const pickOrder = g.pickOrder || {}; // { champId: draftTurnNumber }

    return `
      <div class="game-detail-card ${resultClass}">
        <div class="game-detail-header">
          <span class="game-no-badge">Game ${g.gameNo || idx + 1}</span>
          <span class="game-side">${sideIcon} ${g.side === 'blue' ? '블루' : '레드'}사이드</span>
          <span class="game-result-badge ${resultClass}">${g.result === 'W' ? '승리' : '패배'}</span>
          ${g.planTag ? `<span class="game-tag-badge">${_tagLabel(g.planTag)}</span>` : ''}
          ${g.memo ? `<span class="game-memo-text">💬 ${g.memo}</span>` : ''}
        </div>

        <div class="game-draft-detail">
          <!-- Bans -->
          <div class="draft-detail-row">
            <span class="draft-detail-label our">우리 밴</span>
            <div class="draft-detail-champs">
              ${ourBans.map(cid => _champBadge(cid, 'ban')).join('')}
              ${ourBans.length === 0 ? '<span class="no-data">-</span>' : ''}
            </div>
          </div>
          <div class="draft-detail-row">
            <span class="draft-detail-label enemy">상대 밴</span>
            <div class="draft-detail-champs">
              ${enemyBans.map(cid => _champBadge(cid, 'ban')).join('')}
              ${enemyBans.length === 0 ? '<span class="no-data">-</span>' : ''}
            </div>
          </div>

          <!-- Picks (with draft order numbers) -->
          <div class="draft-detail-row">
            <span class="draft-detail-label our">우리 픽</span>
            <div class="draft-detail-champs">
              ${ourPicks.map(cid => _champBadge(cid, 'pick', pickOrder[cid])).join('')}
              ${ourPicks.length === 0 ? '<span class="no-data">-</span>' : ''}
            </div>
          </div>
          <div class="draft-detail-row">
            <span class="draft-detail-label enemy">상대 픽</span>
            <div class="draft-detail-champs">
              ${enemyPicks.map(cid => _champBadge(cid, 'pick', pickOrder[cid])).join('')}
              ${enemyPicks.length === 0 ? '<span class="no-data">-</span>' : ''}
            </div>
          </div>

          <!-- Draft Order (if saved) -->
          ${g.draftOrder && g.draftOrder.length > 0 ? `
            <div class="draft-order-timeline">
              <span class="draft-detail-label">밴픽 순서</span>
              <div class="draft-timeline-items">
                ${g.draftOrder.map((step, i) => {
      const c = CHAMPION_MAP[step.champId];
      const sideClass = step.side === 'blue' ? 'blue' : 'red';
      const typeIcon = step.type === 'ban' ? '✕' : '✓';
      return `<div class="timeline-step ${sideClass} ${step.type}">
                    <span class="timeline-num">${i + 1}</span>
                    ${c ? `<img src="${c.image}" class="timeline-img" title="${c.name}" />` : `<span>${step.champId}</span>`}
                    <span class="timeline-type">${typeIcon}</span>
                  </div>`;
    }).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Locked Champions -->
        ${(g.globalLocked || []).length > 0 ? `
          <div class="game-locked-info">
            <span class="locked-label">🔒 피어리스 잠금 (${g.globalLocked.length})</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  function _champBadge(champId, type, order) {
    const c = CHAMPION_MAP[champId];
    if (!c) return `<span class="champ-badge unknown">${champId}</span>`;
    return `
      <div class="champ-badge ${type}">
        <img src="${c.image}" alt="${c.name}" class="champ-badge-img" onerror="this.style.display='none'" />
        <span class="champ-badge-name">${c.name}</span>
        ${order ? `<span class="champ-badge-order">${order}</span>` : ''}
      </div>
    `;
  }

  function _tagLabel(tag) {
    const map = {
      teamfight: '한타', splitpush: '스플릿', poking: '포킹',
      pick: '픽조합', objective: '오브젝트', sidelane: '사이드',
      vision: '시야', invade: '인베'
    };
    return map[tag] || tag;
  }

  function _toggleDetail(seriesId) {
    const panel = document.getElementById(`detail-${seriesId}`);
    const arrow = document.getElementById(`arrow-${seriesId}`);
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (arrow) {
      arrow.textContent = panel.classList.contains('hidden') ? '▼' : '▲';
    }
  }

  function _bindEvents() {
    // Filter buttons
    document.querySelectorAll('.log-filter-bar .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.log-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.series-result-card').forEach(card => {
          if (filter === 'all') {
            card.style.display = '';
          } else {
            card.style.display = card.dataset.matchType === filter ? '' : 'none';
          }
        });
      });
    });
  }

  return { init, render, _toggleDetail };
})();

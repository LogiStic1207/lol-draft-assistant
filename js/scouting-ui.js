/* ========================================================
   scouting-ui.js — Opponent Scouting
   ======================================================== */

const ScoutingUI = (() => {
    let _selectedOpp = null;

    function init() {
        render();
    }

    function render() {
        const container = document.getElementById('view-scouting');
        if (!container) return;
        const opponents = Store.getOpponents();

        container.innerHTML = `
      <div class="scouting-page">
        <div class="page-header">
          <h2>Opponent Scouting</h2>
          <p class="subtitle">상대팀의 픽 빈도, 밴 반응 패턴, 스타일을 기록합니다</p>
        </div>

        <div class="scouting-layout">
          <!-- Opponent List -->
          <div class="card opp-list-card">
            <h3>상대팀 목록</h3>
            <div class="opp-list" id="opp-list">
              ${opponents.map(o => `
                <div class="opp-item ${_selectedOpp?.id === o.id ? 'active' : ''}" data-opp="${o.id}">
                  <span class="opp-name">${o.name}</span>
                  <span class="opp-games">${_getOppGameCount(o.id)}전</span>
                </div>
              `).join('')}
              ${opponents.length === 0 ? '<div class="empty-state">상대팀을 추가하세요</div>' : ''}
            </div>
            <div class="form-row" style="margin-top:12px">
              <input type="text" id="new-opp-name" placeholder="새 상대팀 이름" />
              <button class="btn btn-sm btn-accent" id="btn-add-opp">추가</button>
            </div>
          </div>

          <!-- Opponent Detail -->
          <div class="card opp-detail-card" id="opp-detail">
            ${_selectedOpp ? _renderOppDetail(_selectedOpp) : '<div class="empty-state">상대팀을 선택하세요</div>'}
          </div>
        </div>
      </div>
    `;

        _bindEvents();
    }

    function _renderOppDetail(opp) {
        const pickFreq = opp.pickFreq || {};
        const sorted = Object.entries(pickFreq).sort((a, b) => b[1] - a[1]);
        const styleTags = opp.styleTags || [];
        const patterns = opp.patterns || [];

        return `
      <h3>${opp.name}</h3>

      <div class="form-group">
        <label>스타일 태그</label>
        <div class="tag-group" id="opp-style-tags">
          ${['교전', '스케일', '오브젝트', '스플릿', '포킹', '초반 교전', '라인전'].map(tag =>
            `<button class="tag-btn ${styleTags.includes(tag) ? 'active' : ''}" data-tag="${tag}">${tag}</button>`
        ).join('')}
        </div>
      </div>

      <div class="section-header"><h4>📊 픽 빈도 (TOP)</h4></div>
      <div class="freq-list">
        ${sorted.slice(0, 10).map(([champId, count]) => {
            const c = CHAMPION_MAP[champId];
            return c ? `
            <div class="freq-item">
              <img src="${c.image}" class="freq-img" onerror="this.style.display='none'" />
              <span>${c.name}</span>
              <span class="freq-bar"><span class="freq-fill" style="width:${Math.min(count / (sorted[0]?.[1] || 1) * 100, 100)}%"></span></span>
              <span class="freq-count">${count}회</span>
            </div>
          ` : '';
        }).join('')}
        ${sorted.length === 0 ? '<div class="empty-state">아직 상대 데이터가 없습니다. 스크림을 기록하면 자동 누적됩니다.</div>' : ''}
      </div>

      <div class="form-group" style="margin-top:16px">
        <label>밴 반응 패턴 메모</label>
        <textarea id="opp-patterns" rows="3" placeholder="예: 세주아니 밴 → 비 1픽으로 전환">${patterns.join('\n')}</textarea>
      </div>

      <div class="btn-row" style="margin-top:12px">
        <button class="btn btn-accent btn-sm" id="btn-save-opp">저장</button>
        <button class="btn btn-sm btn-danger" id="btn-delete-opp">삭제</button>
      </div>
    `;
    }

    function _getOppGameCount(oppId) {
        return Store.getSeries()
            .filter(s => s.opponentId === oppId)
            .reduce((sum, s) => sum + (s.games?.length || 0), 0);
    }

    function _bindEvents() {
        // Select opponent
        document.querySelectorAll('.opp-item').forEach(el => {
            el.addEventListener('click', () => {
                _selectedOpp = Store.getOpponent(el.dataset.opp);
                render();
            });
        });

        // Add opponent
        document.getElementById('btn-add-opp')?.addEventListener('click', () => {
            const name = document.getElementById('new-opp-name')?.value?.trim();
            if (!name) return;
            _selectedOpp = Store.addOpponent({ name });
            render();
        });

        // Save opponent
        document.getElementById('btn-save-opp')?.addEventListener('click', () => {
            if (!_selectedOpp) return;
            const tags = [];
            document.querySelectorAll('#opp-style-tags .tag-btn.active').forEach(b => tags.push(b.dataset.tag));
            const patterns = (document.getElementById('opp-patterns')?.value || '').split('\n').filter(Boolean);
            Store.updateOpponent(_selectedOpp.id, { styleTags: tags, patterns });
            _selectedOpp = Store.getOpponent(_selectedOpp.id);
            _showToast('상대팀 저장됨');
        });

        // Delete opponent
        document.getElementById('btn-delete-opp')?.addEventListener('click', () => {
            if (!_selectedOpp || !confirm(`${_selectedOpp.name}를 삭제하시겠습니까?`)) return;
            Store.removeOpponent(_selectedOpp.id);
            _selectedOpp = null;
            render();
        });

        // Style tags toggle
        document.querySelectorAll('#opp-style-tags .tag-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('active'));
        });
    }

    function _showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
    }

    return { init, render };
})();

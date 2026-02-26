/* ========================================================
   store.js — localStorage CRUD + JSON/CSV export
   ======================================================== */

const Store = (() => {
    const KEYS = {
        TEAM: 'draftOS_team',
        PLAYERS: 'draftOS_players',
        OPPONENTS: 'draftOS_opponents',
        SERIES: 'draftOS_series',
    };

    function _get(key) {
        try { return JSON.parse(localStorage.getItem(key)) || null; }
        catch { return null; }
    }
    function _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
    function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    /* ---- Team ---- */
    function getTeam() { return _get(KEYS.TEAM) || { id: _uid(), name: '', mainShotcaller: '', styleTags: [], signaturePicks: [] }; }
    function saveTeam(t) { _set(KEYS.TEAM, t); }

    /* ---- Players ---- */
    function getPlayers() { return _get(KEYS.PLAYERS) || []; }
    function savePlayers(arr) { _set(KEYS.PLAYERS, arr); }
    function addPlayer(p) {
        const players = getPlayers();
        if (!p.id) p.id = _uid();
        players.push(p);
        savePlayers(players);
        return p;
    }
    function updatePlayer(id, data) {
        const players = getPlayers().map(p => p.id === id ? { ...p, ...data } : p);
        savePlayers(players);
    }
    function removePlayer(id) {
        savePlayers(getPlayers().filter(p => p.id !== id));
    }
    function getPlayerByRole(role) { return getPlayers().find(p => p.role === role) || null; }

    /* ---- Opponent Teams ---- */
    function getOpponents() { return _get(KEYS.OPPONENTS) || []; }
    function saveOpponents(arr) { _set(KEYS.OPPONENTS, arr); }
    function addOpponent(opp) {
        const arr = getOpponents();
        if (!opp.id) opp.id = _uid();
        if (!opp.pickFreq) opp.pickFreq = {};
        if (!opp.styleTags) opp.styleTags = [];
        if (!opp.patterns) opp.patterns = [];
        if (!opp.banReaction) opp.banReaction = {};
        arr.push(opp);
        saveOpponents(arr);
        return opp;
    }
    function updateOpponent(id, data) {
        const arr = getOpponents().map(o => o.id === id ? { ...o, ...data } : o);
        saveOpponents(arr);
    }
    function removeOpponent(id) { saveOpponents(getOpponents().filter(o => o.id !== id)); }
    function getOpponent(id) { return getOpponents().find(o => o.id === id) || null; }

    /* ---- Series ---- */
    function getSeries() { return _get(KEYS.SERIES) || []; }
    function saveSeries(arr) { _set(KEYS.SERIES, arr); }
    function addSeries(s) {
        const arr = getSeries();
        if (!s.id) s.id = _uid();
        if (!s.games) s.games = [];
        arr.push(s);
        saveSeries(arr);
        return s;
    }
    function updateSeries(id, data) {
        const arr = getSeries().map(s => s.id === id ? { ...s, ...data } : s);
        saveSeries(arr);
    }
    function addGameToSeries(seriesId, game) {
        const arr = getSeries();
        const s = arr.find(x => x.id === seriesId);
        if (s) { s.games.push(game); saveSeries(arr); }
    }

    /* ---- Export / Import ---- */
    function exportJSON() {
        return JSON.stringify({
            team: getTeam(), players: getPlayers(),
            opponents: getOpponents(), series: getSeries(),
            exportedAt: new Date().toISOString()
        }, null, 2);
    }
    function importJSON(jsonStr) {
        try {
            const d = JSON.parse(jsonStr);
            if (d.team) saveTeam(d.team);
            if (d.players) savePlayers(d.players);
            if (d.opponents) saveOpponents(d.opponents);
            if (d.series) saveSeries(d.series);
            return true;
        } catch { return false; }
    }
    function exportCSV() {
        const all = getSeries();
        const rows = ['series_id,date,opponent,format,game_no,side,global_locked_count,our_bans,enemy_bans,our_picks,enemy_picks,result,key_reason_tag,key_reason_memo'];
        for (const s of all) {
            const opp = getOpponent(s.opponentId);
            for (const g of (s.games || [])) {
                rows.push([
                    s.id, s.date, opp ? opp.name : s.opponentId, s.format,
                    g.gameNo, g.side, (g.globalLocked || []).length,
                    (g.bans?.our || []).join('|'), (g.bans?.enemy || []).join('|'),
                    (g.picks?.our || []).join('|'), (g.picks?.enemy || []).join('|'),
                    g.result || '', g.planTag || '', `"${(g.memo || '').replace(/"/g, '""')}"`
                ].join(','));
            }
        }
        return rows.join('\n');
    }

    /* ---- Scrim data update helpers ---- */
    function updateOpponentPickFreq(oppId, champId) {
        const opp = getOpponent(oppId);
        if (!opp) return;
        if (!opp.pickFreq) opp.pickFreq = {};
        opp.pickFreq[champId] = (opp.pickFreq[champId] || 0) + 1;
        updateOpponent(oppId, { pickFreq: opp.pickFreq });
    }
    function updatePlayerMastery(playerId, champId, won) {
        const players = getPlayers();
        const p = players.find(x => x.id === playerId);
        if (!p) return;
        if (!p.mastery) p.mastery = {};
        const m = p.mastery[champId] || { games: 0, wins: 0, recent: [] };
        m.games++;
        if (won) m.wins++;
        m.recent.push({ date: Date.now(), won });
        if (m.recent.length > 20) m.recent.shift();
        p.mastery[champId] = m;
        savePlayers(players);
    }

    return {
        getTeam, saveTeam,
        getPlayers, savePlayers, addPlayer, updatePlayer, removePlayer, getPlayerByRole,
        getOpponents, saveOpponents, addOpponent, updateOpponent, removeOpponent, getOpponent,
        getSeries, saveSeries, addSeries, updateSeries, addGameToSeries,
        exportJSON, importJSON, exportCSV,
        updateOpponentPickFreq, updatePlayerMastery,
    };
})();

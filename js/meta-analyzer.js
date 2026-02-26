/* ========================================================
   meta-analyzer.js — Patch Stat Diff + Meta Power Score
   Auto-detects buffs/nerfs by comparing DDragon champion stats
   between patch versions
   ======================================================== */

const MetaAnalyzer = (() => {
    const CHAMP_DETAIL_URL = (v, id) =>
        `https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion/${id}.json`;
    const CACHE_KEY = 'draftOS_meta_cache';
    const MANUAL_KEY = 'draftOS_meta_manual';

    /* Stats fields to compare (higher = buff, lower = nerf for most) */
    const STAT_FIELDS = [
        'hp', 'hpperlevel', 'mp', 'mpperlevel',
        'armor', 'armorperlevel', 'spellblock', 'spellblockperlevel',
        'attackdamage', 'attackdamageperlevel',
        'attackspeed', 'attackspeedperlevel',
        'hpregen', 'hpregenperlevel', 'mpregen', 'mpregenperlevel',
        'movespeed', 'attackrange',
    ];

    /* Fields where LOWER = BUFF (cooldowns, costs) */
    const INVERSE_FIELDS = new Set(['cooldown', 'cost']);

    let _metaScores = {}; // { champId: { score, changes[] } }
    let _lastDiffVersion = null;

    /* ---- Fetch single champion detail ---- */
    async function _fetchChampDetail(version, champId) {
        try {
            const resp = await fetch(CHAMP_DETAIL_URL(version, champId));
            const data = await resp.json();
            return data.data[champId] || null;
        } catch {
            return null;
        }
    }

    /* ---- Compare stats for one champion ---- */
    function _diffStats(oldData, newData, champId) {
        const changes = [];
        if (!oldData || !newData) return changes;

        // Compare base stats
        const oldStats = oldData.stats || {};
        const newStats = newData.stats || {};
        for (const field of STAT_FIELDS) {
            const ov = oldStats[field], nv = newStats[field];
            if (ov !== undefined && nv !== undefined && ov !== nv) {
                const delta = nv - ov;
                changes.push({
                    champId, category: 'stats', field,
                    old: ov, new: nv, delta,
                    type: delta > 0 ? 'BUFF' : 'NERF',
                });
            }
        }

        // Compare spell cooldowns & costs
        const oldSpells = oldData.spells || [];
        const newSpells = newData.spells || [];
        for (let i = 0; i < Math.min(oldSpells.length, newSpells.length); i++) {
            const os = oldSpells[i], ns = newSpells[i];
            const spellName = ns.name || `Spell ${i}`;

            // Cooldowns (array of values per rank)
            if (os.cooldown && ns.cooldown) {
                const oldAvg = os.cooldown.reduce((a, b) => a + b, 0) / os.cooldown.length;
                const newAvg = ns.cooldown.reduce((a, b) => a + b, 0) / ns.cooldown.length;
                if (Math.abs(oldAvg - newAvg) > 0.01) {
                    const delta = newAvg - oldAvg;
                    changes.push({
                        champId, category: 'spell', field: `${spellName} CD`,
                        old: oldAvg.toFixed(1), new: newAvg.toFixed(1), delta,
                        type: delta < 0 ? 'BUFF' : 'NERF', // lower CD = buff
                    });
                }
            }

            // Costs
            if (os.cost && ns.cost) {
                const oldAvg = os.cost.reduce((a, b) => a + b, 0) / os.cost.length;
                const newAvg = ns.cost.reduce((a, b) => a + b, 0) / ns.cost.length;
                if (Math.abs(oldAvg - newAvg) > 0.01) {
                    const delta = newAvg - oldAvg;
                    changes.push({
                        champId, category: 'spell', field: `${spellName} 코스트`,
                        old: oldAvg.toFixed(1), new: newAvg.toFixed(1), delta,
                        type: delta < 0 ? 'BUFF' : 'NERF', // lower cost = buff
                    });
                }
            }
        }

        return changes;
    }

    /* ---- Diff all champions between two versions ---- */
    async function diffChampionStats(prevVersion, currVersion) {
        // Check cache first
        const cached = _loadCache();
        if (cached && cached.prevVersion === prevVersion && cached.currVersion === currVersion) {
            _metaScores = cached.metaScores || {};
            _lastDiffVersion = currVersion;
            console.log(`[MetaAnalyzer] Loaded cached diff: ${prevVersion} → ${currVersion}`);
            return cached.allChanges || [];
        }

        console.log(`[MetaAnalyzer] Diffing patches: ${prevVersion} → ${currVersion}`);
        const allChanges = [];
        _metaScores = {};

        // Process champions in batches to avoid rate limits
        const champIds = CHAMPIONS.map(c => c.id);
        const BATCH = 10;

        for (let i = 0; i < champIds.length; i += BATCH) {
            const batch = champIds.slice(i, i + BATCH);
            const results = await Promise.allSettled(
                batch.map(async (cid) => {
                    const oldData = await _fetchChampDetail(prevVersion, cid);
                    const newData = await _fetchChampDetail(currVersion, cid);
                    return { champId: cid, changes: _diffStats(oldData, newData, cid) };
                })
            );

            for (const r of results) {
                if (r.status === 'fulfilled' && r.value.changes.length > 0) {
                    allChanges.push(...r.value.changes);
                    const cid = r.value.champId;
                    const buffs = r.value.changes.filter(c => c.type === 'BUFF').length;
                    const nerfs = r.value.changes.filter(c => c.type === 'NERF').length;
                    const score = Math.max(-0.3, Math.min(0.3, (buffs - nerfs) * 0.1));
                    _metaScores[cid] = {
                        score,
                        buffs, nerfs,
                        changes: r.value.changes,
                        label: score > 0 ? '🔺 버프' : score < 0 ? '🔻 너프' : '—',
                    };
                }
            }

            // Small delay between batches
            if (i + BATCH < champIds.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        _lastDiffVersion = currVersion;
        _saveCache({ prevVersion, currVersion, metaScores: _metaScores, allChanges });
        console.log(`[MetaAnalyzer] Found ${allChanges.length} changes across ${Object.keys(_metaScores).length} champions`);
        return allChanges;
    }

    /* ---- Meta Power Score for a champion ---- */
    function getMetaPowerScore(champId) {
        const manual = _getManualAdj(champId);
        const auto = (_metaScores[champId]?.score) || 0;
        return Math.max(-0.3, Math.min(0.3, auto + manual));
    }

    function getMetaScores() { return _metaScores; }
    function getMetaLabel(champId) { return _metaScores[champId]?.label || ''; }
    function getMetaChanges(champId) { return _metaScores[champId]?.changes || []; }

    /* ---- Manual adjustment (for item/system changes) ---- */
    function setManualAdjustment(champId, score) {
        const data = _getManualData();
        data[champId] = Math.max(-0.3, Math.min(0.3, score));
        localStorage.setItem(MANUAL_KEY, JSON.stringify(data));
    }
    function removeManualAdjustment(champId) {
        const data = _getManualData();
        delete data[champId];
        localStorage.setItem(MANUAL_KEY, JSON.stringify(data));
    }
    function _getManualData() {
        try { return JSON.parse(localStorage.getItem(MANUAL_KEY)) || {}; }
        catch { return {}; }
    }
    function _getManualAdj(champId) {
        return _getManualData()[champId] || 0;
    }
    function getManualAdjustments() { return _getManualData(); }

    /* ---- Cache helpers ---- */
    function _loadCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY)); }
        catch { return null; }
    }
    function _saveCache(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
        catch { /* storage full */ }
    }
    function clearCache() { localStorage.removeItem(CACHE_KEY); }

    /* ---- Summary: all buffed/nerfed champions ---- */
    function getSummary() {
        const buffed = [];
        const nerfed = [];
        for (const [cid, data] of Object.entries(_metaScores)) {
            const champ = CHAMPION_MAP[cid];
            if (!champ) continue;
            if (data.score > 0) buffed.push({ ...data, champion: champ });
            else if (data.score < 0) nerfed.push({ ...data, champion: champ });
        }
        buffed.sort((a, b) => b.score - a.score);
        nerfed.sort((a, b) => a.score - b.score);
        return { buffed, nerfed, totalChanges: Object.keys(_metaScores).length };
    }

    return {
        diffChampionStats, getMetaPowerScore, getMetaScores,
        getMetaLabel, getMetaChanges, getSummary,
        setManualAdjustment, removeManualAdjustment, getManualAdjustments,
        clearCache,
    };
})();

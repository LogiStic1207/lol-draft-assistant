/* ========================================================
   version-checker.js — Auto Version Detection + Champion Update
   Fetches latest DDragon version and detects new champions
   ======================================================== */

const VersionChecker = (() => {
    const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
    const CHAMPION_URL = (v) => `https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`;
    const CACHE_KEY = 'draftOS_version_cache';

    let _latestVersion = null;
    let _newChampions = [];
    let _removedChampions = [];

    /* Fetch latest DDragon version */
    async function checkLatestVersion() {
        try {
            const resp = await fetch(VERSIONS_URL);
            const versions = await resp.json();
            _latestVersion = versions[0]; // first = latest
            console.log(`[VersionChecker] Latest DDragon: ${_latestVersion}, Current: ${DDRAGON_VERSION}`);
            return {
                latest: _latestVersion,
                current: DDRAGON_VERSION,
                isOutdated: _latestVersion !== DDRAGON_VERSION,
            };
        } catch (e) {
            console.warn('[VersionChecker] Failed to check version:', e);
            return { latest: null, current: DDRAGON_VERSION, isOutdated: false, error: e.message };
        }
    }

    /* Fetch champion list from DDragon for a given version */
    async function fetchChampionList(version) {
        try {
            const resp = await fetch(CHAMPION_URL(version || _latestVersion || DDRAGON_VERSION));
            const data = await resp.json();
            return Object.keys(data.data); // Array of champion IDs
        } catch (e) {
            console.warn('[VersionChecker] Failed to fetch champion list:', e);
            return [];
        }
    }

    /* Compare current CHAMPIONS array with DDragon list */
    async function detectNewChampions() {
        const version = _latestVersion || DDRAGON_VERSION;
        const ddragonChamps = await fetchChampionList(version);
        if (ddragonChamps.length === 0) return { newChamps: [], removedChamps: [] };

        const localIds = new Set(CHAMPIONS.map(c => c.id));
        const remoteIds = new Set(ddragonChamps);

        _newChampions = ddragonChamps.filter(id => !localIds.has(id));
        _removedChampions = CHAMPIONS.map(c => c.id).filter(id => !remoteIds.has(id));

        console.log(`[VersionChecker] New champions: ${_newChampions.join(', ') || 'none'}`);
        console.log(`[VersionChecker] Removed/renamed: ${_removedChampions.join(', ') || 'none'}`);

        return { newChamps: _newChampions, removedChamps: _removedChampions };
    }

    /* Get previous version (for stat diff) */
    async function getPreviousVersion() {
        try {
            const resp = await fetch(VERSIONS_URL);
            const versions = await resp.json();
            return versions.length > 1 ? versions[1] : null;
        } catch {
            return null;
        }
    }

    /* Generate notification message */
    function getUpdateNotification() {
        const msgs = [];
        if (_latestVersion && _latestVersion !== DDRAGON_VERSION) {
            msgs.push(`새 패치 감지: ${DDRAGON_VERSION} → ${_latestVersion}`);
        }
        if (_newChampions.length > 0) {
            msgs.push(`신규 챔피언: ${_newChampions.join(', ')}`);
        }
        return msgs.length > 0 ? msgs.join(' | ') : null;
    }

    /* Full check: version + champions */
    async function runFullCheck() {
        const versionInfo = await checkLatestVersion();
        const champInfo = await detectNewChampions();
        return {
            ...versionInfo,
            ...champInfo,
            notification: getUpdateNotification(),
        };
    }

    return {
        checkLatestVersion, fetchChampionList, detectNewChampions,
        getPreviousVersion, getUpdateNotification, runFullCheck,
    };
})();

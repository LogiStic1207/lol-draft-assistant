/* ========================================================
   draft-engine.js — Hard Fearless + Draft State Machine
   BO3/BO5 support, global lock, undo
   ======================================================== */

const DraftEngine = (() => {
    let _state = null;

    function _newState() {
        return {
            format: 'BO3',            // BO3 or BO5
            currentGame: 1,
            maxGames: 3,
            opponentId: null,
            ourSide: 'blue',          // blue or red

            // Series-level
            globalLocked: [],         // champions locked across ALL games (both teams)
            gameHistory: [],          // array of game results

            // Current game
            turnIndex: 0,             // index in DRAFT_ORDER
            blueBans: [],             // [champId, ...]
            redBans: [],
            bluePicks: [],
            redPicks: [],
            phase: 'BAN1',
            isComplete: false,
            isSeriesComplete: false,

            // Undo stack
            undoStack: [],

            // Series reserve (planned cards)
            reservedPicks: {},        // { playerId: [{ champId, reserveForGame }] }
        };
    }

    function startSeries(format, opponentId, ourSide) {
        _state = _newState();
        _state.format = format || 'BO3';
        _state.maxGames = format === 'BO5' ? 5 : 3;
        _state.opponentId = opponentId || null;
        _state.ourSide = ourSide || 'blue';
        return _state;
    }

    function startGame(gameNo, ourSide) {
        if (!_state) return null;
        _state.currentGame = gameNo || _state.currentGame;
        _state.ourSide = ourSide || _state.ourSide;
        _state.turnIndex = 0;
        _state.blueBans = [];
        _state.redBans = [];
        _state.bluePicks = [];
        _state.redPicks = [];
        _state.phase = 'BAN1';
        _state.isComplete = false;
        _state.undoStack = [];
        return _state;
    }

    function getCurrentTurn() {
        if (!_state || _state.isComplete) return null;
        if (_state.turnIndex >= DRAFT_ORDER.length) return null;
        return DRAFT_ORDER[_state.turnIndex];
    }

    function getCurrentPhase() {
        const turn = getCurrentTurn();
        return turn ? turn.phase : (_state?.isComplete ? 'COMPLETE' : 'NONE');
    }

    function isOurTurn() {
        const turn = getCurrentTurn();
        if (!turn || !_state) return false;
        return turn.side === _state.ourSide;
    }

    function getAvailableChampions() {
        if (!_state) return CHAMPIONS.slice();
        const unavailable = new Set([
            ..._state.globalLocked,
            ..._state.blueBans,
            ..._state.redBans,
            ..._state.bluePicks,
            ..._state.redPicks,
        ]);
        return CHAMPIONS.filter(c => !unavailable.has(c.id));
    }

    function isChampionAvailable(champId) {
        if (!_state) return true;
        const unavailable = new Set([
            ..._state.globalLocked,
            ..._state.blueBans,
            ..._state.redBans,
            ..._state.bluePicks,
            ..._state.redPicks,
        ]);
        return !unavailable.has(champId);
    }

    function selectChampion(champId) {
        if (!_state || _state.isComplete) return null;
        const turn = getCurrentTurn();
        if (!turn) return null;
        if (!isChampionAvailable(champId)) return null;

        // Save undo state
        _state.undoStack.push({
            turnIndex: _state.turnIndex,
            blueBans: [..._state.blueBans],
            redBans: [..._state.redBans],
            bluePicks: [..._state.bluePicks],
            redPicks: [..._state.redPicks],
        });

        // Apply selection
        if (turn.type === 'ban') {
            if (turn.side === 'blue') _state.blueBans.push(champId);
            else _state.redBans.push(champId);
        } else {
            if (turn.side === 'blue') _state.bluePicks.push(champId);
            else _state.redPicks.push(champId);
        }

        // Advance turn
        _state.turnIndex++;
        if (_state.turnIndex < DRAFT_ORDER.length) {
            _state.phase = DRAFT_ORDER[_state.turnIndex].phase;
        } else {
            _state.isComplete = true;
            _state.phase = 'COMPLETE';
        }

        return _state;
    }

    function undoAction() {
        if (!_state || _state.undoStack.length === 0) return null;
        const prev = _state.undoStack.pop();
        _state.turnIndex = prev.turnIndex;
        _state.blueBans = prev.blueBans;
        _state.redBans = prev.redBans;
        _state.bluePicks = prev.bluePicks;
        _state.redPicks = prev.redPicks;
        _state.isComplete = false;
        _state.phase = DRAFT_ORDER[_state.turnIndex].phase;
        return _state;
    }

    function finishGame(result, memo, planTag, planSuccess) {
        if (!_state) return null;

        // Build pick order map: champId -> turnIndex (1-based draft position)
        // DRAFT_ORDER has indices for each step; picks start at different indices
        const pickOrderMap = {};
        for (let i = 0; i < DRAFT_ORDER.length; i++) {
            const step = DRAFT_ORDER[i];
            if (step.type === 'pick') {
                if (step.side === 'blue') {
                    const pickIdx = _state.bluePicks.length > 0 ? null : -1;
                    // Find which champion was placed at this turn
                    // We track by counting how many picks of this side come before this index
                    let sidePickCount = 0;
                    for (let j = 0; j <= i; j++) {
                        if (DRAFT_ORDER[j].type === 'pick' && DRAFT_ORDER[j].side === 'blue') {
                            sidePickCount++;
                        }
                    }
                    if (sidePickCount <= _state.bluePicks.length) {
                        const champId = _state.bluePicks[sidePickCount - 1];
                        if (champId) pickOrderMap[champId] = i + 1; // 1-based draft turn
                    }
                } else {
                    let sidePickCount = 0;
                    for (let j = 0; j <= i; j++) {
                        if (DRAFT_ORDER[j].type === 'pick' && DRAFT_ORDER[j].side === 'red') {
                            sidePickCount++;
                        }
                    }
                    if (sidePickCount <= _state.redPicks.length) {
                        const champId = _state.redPicks[sidePickCount - 1];
                        if (champId) pickOrderMap[champId] = i + 1;
                    }
                }
            }
        }

        const gameRecord = {
            gameNo: _state.currentGame,
            side: _state.ourSide,
            bans: {
                our: _state.ourSide === 'blue' ? [..._state.blueBans] : [..._state.redBans],
                enemy: _state.ourSide === 'blue' ? [..._state.redBans] : [..._state.blueBans],
            },
            picks: {
                our: _state.ourSide === 'blue' ? [..._state.bluePicks] : [..._state.redPicks],
                enemy: _state.ourSide === 'blue' ? [..._state.redPicks] : [..._state.bluePicks],
            },
            pickOrder: pickOrderMap, // { champId: draftTurnNumber }
            globalLocked: [..._state.globalLocked],
            result: result || null,
            memo: memo || '',
            planTag: planTag || '',
            planSuccess: planSuccess || null,
        };

        // Update global lock (all picks from this game)
        const newLocked = [..._state.bluePicks, ..._state.redPicks];
        _state.globalLocked = [..._state.globalLocked, ...newLocked];

        // Add to history
        _state.gameHistory.push(gameRecord);

        // Check series end: first-to-win
        // BO3 = first to 2 wins, BO5 = first to 3 wins
        const winsNeeded = _state.format === 'BO5' ? 3 : 2;
        const ourWins = _state.gameHistory.filter(g => g.result === 'W').length;
        const enemyWins = _state.gameHistory.filter(g => g.result === 'L').length;

        if (ourWins >= winsNeeded || enemyWins >= winsNeeded || _state.currentGame >= _state.maxGames) {
            _state.isSeriesComplete = true;
        } else {
            _state.currentGame++;
        }

        return gameRecord;
    }

    function getState() { return _state; }

    function getGlobalLockedCount() { return _state ? _state.globalLocked.length : 0; }

    function getGameHistory() { return _state ? _state.gameHistory : []; }

    function getOurPicks() {
        if (!_state) return [];
        return _state.ourSide === 'blue' ? _state.bluePicks : _state.redPicks;
    }
    function getEnemyPicks() {
        if (!_state) return [];
        return _state.ourSide === 'blue' ? _state.redPicks : _state.bluePicks;
    }
    function getOurBans() {
        if (!_state) return [];
        return _state.ourSide === 'blue' ? _state.blueBans : _state.redBans;
    }
    function getEnemyBans() {
        if (!_state) return [];
        return _state.ourSide === 'blue' ? _state.redBans : _state.blueBans;
    }

    function getRemainingSignatures(players) {
        if (!_state) return {};
        const result = {};
        for (const p of (players || [])) {
            const sigs = (p.signatureChamps || []).filter(c => !_state.globalLocked.includes(c));
            result[p.id] = sigs;
        }
        return result;
    }

    /* Series Reserve: mark a pick to save for later games */
    function setReserve(playerId, champId, reserveForGame) {
        if (!_state) return;
        if (!_state.reservedPicks[playerId]) _state.reservedPicks[playerId] = [];
        _state.reservedPicks[playerId].push({ champId, reserveForGame });
    }

    function getReserves() { return _state ? _state.reservedPicks : {}; }

    function checkReserveWarnings() {
        if (!_state) return [];
        const warnings = [];
        for (const [pid, reserves] of Object.entries(_state.reservedPicks)) {
            for (const r of reserves) {
                if (_state.globalLocked.includes(r.champId)) {
                    warnings.push({
                        playerId: pid, champId: r.champId, type: 'LOCKED',
                        text: `예약 카드 ${r.champId}가 이미 잠겼습니다!`
                    });
                }
            }
        }
        return warnings;
    }

    return {
        startSeries, startGame, getCurrentTurn, getCurrentPhase, isOurTurn,
        getAvailableChampions, isChampionAvailable, selectChampion, undoAction,
        finishGame, getState, getGlobalLockedCount, getGameHistory,
        getOurPicks, getEnemyPicks, getOurBans, getEnemyBans,
        getRemainingSignatures, setReserve, getReserves, checkReserveWarnings,
    };
})();

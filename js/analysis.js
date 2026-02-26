/* ========================================================
   analysis.js — BanScore / PickScore / CompRadar / Warnings
   3 Engines: Opponent Prediction, Ban, Pick
   ======================================================== */

const Analysis = (() => {

    /* ============================================
       Engine 1: Opponent Prediction
       P_enemyPick(c) = Freq_opp(c) × RoleNeed × Availability
       ============================================ */
    function predictEnemyPicks(available, opponentData, enemyPicks) {
        const opp = opponentData || {};
        const freq = opp.pickFreq || {};
        const totalPicks = Object.values(freq).reduce((s, v) => s + v, 0) || 1;

        // Determine un-filled roles based on enemy picks
        const roleFilled = { TOP: false, JG: false, MID: false, BOT: false, SUP: false };
        // Note: lanes are NOT fixed order. We just check what roles are likely filled
        // by the enemy picks so far (heuristic based on champion primary roles)
        for (const cid of (enemyPicks || [])) {
            const champ = CHAMPION_MAP[cid];
            if (champ && champ.roles.length > 0) {
                // Mark the first un-filled role that matches
                for (const r of champ.roles) {
                    if (!roleFilled[r]) { roleFilled[r] = true; break; }
                }
            }
        }
        const unfilledRoles = Object.keys(roleFilled).filter(r => !roleFilled[r]);

        return available.map(c => {
            const freqScore = (freq[c.id] || 0) / totalPicks;
            const roleNeed = c.roles.some(r => unfilledRoles.includes(r)) ? 1.0 : 0.3;
            const score = freqScore * roleNeed;
            return { champion: c, score, freqScore, roleNeed };
        }).sort((a, b) => b.score - a.score).slice(0, 5);
    }

    /* ============================================
       Engine 2: BanScore
       BanScore(c) = P_enemyPick × Threat × (1 + SeriesImpact)
       ============================================ */
    function computeBanScores(available, opponentData, draftState, teamData) {
        const predictions = predictEnemyPicks(available, opponentData,
            draftState ? (draftState.ourSide === 'blue' ? draftState.redPicks : draftState.bluePicks) : []);
        const predMap = {};
        predictions.forEach(p => { predMap[p.champion.id] = p.score; });

        const sigs = _getTeamSignatures(teamData);

        return available.map(c => {
            const pEnemy = predMap[c.id] || 0.05;
            const threat = _computeThreat(c, sigs, opponentData);
            const seriesImpact = _computeSeriesImpact(c, draftState);
            const score = pEnemy * threat * (1 + seriesImpact);
            const reasons = _buildBanReasons(c, pEnemy, threat, seriesImpact, opponentData, sigs);
            return { champion: c, score, pEnemy, threat, seriesImpact, reasons };
        }).sort((a, b) => b.score - a.score).slice(0, 5);
    }

    function _computeThreat(champ, teamSigs, opp) {
        let t = 0.5; // base threat
        // Is this champion a counter to our signatures?
        if (teamSigs.length > 0) t += 0.1;
        // Is this a frequent opponent pick?
        const freq = (opp?.pickFreq || {})[champ.id] || 0;
        if (freq >= 3) t += 0.2;
        else if (freq >= 1) t += 0.1;
        // High engage clarity = high team value for opponent
        t += (champ.tags.engageClarity || 0) * 0.05;
        t += (champ.tags.objectiveControl || 0) * 0.05;
        // Meta power: buffed champs are higher threat for enemy
        if (typeof MetaAnalyzer !== 'undefined') {
            const meta = MetaAnalyzer.getMetaPowerScore(champ.id);
            if (meta > 0) t += meta * 0.5; // buffed = more threatening
        }
        return Math.min(t, 1.0);
    }

    function _computeSeriesImpact(champ, draftState) {
        if (!draftState) return 0;
        // Higher impact for flex champions that deny multiple roles
        let impact = (champ.tags.flexValue || 0) * 0.15;
        // Higher impact in later games (more cards are locked)
        const gameNo = draftState.currentGame || 1;
        impact += (gameNo - 1) * 0.1;
        return Math.min(impact, 0.5);
    }

    function _buildBanReasons(champ, pEnemy, threat, seriesImpact, opp, sigs) {
        const reasons = [];
        if (pEnemy > 0.15) reasons.push(`상대 선호 픽 (예측 확률 ${(pEnemy * 100).toFixed(0)}%)`);
        const freq = (opp?.pickFreq || {})[champ.id] || 0;
        if (freq >= 3) reasons.push(`상대가 ${freq}회 사용 (높은 빈도)`);
        if (champ.tags.engageClarity >= 2) reasons.push('높은 이니시/교전 능력');
        if (champ.tags.objectiveControl >= 2) reasons.push('오브젝트 장악력');
        if (seriesImpact > 0.2) reasons.push('시리즈 영향도 높음 (Fearless 잠금 효과)');
        if (reasons.length === 0) reasons.push('일반 위협 밴');
        return reasons;
    }

    /* ============================================
       Engine 3: PickScore
       PickScore = MetaPower + TeamFit + PlayerMastery + DraftNeed + CounterValue − Risk
       Separated into: Signature Lane + Safety Lane
       ============================================ */
    function computePickScores(available, draftState, teamData, opponentData) {
        const players = teamData?.players || Store.getPlayers();
        const team = teamData?.team || Store.getTeam();
        const sigs = _getTeamSignatures(teamData);
        const ourPicks = draftState ? (draftState.ourSide === 'blue' ? draftState.bluePicks : draftState.redPicks) : [];
        const enemyPicks = draftState ? (draftState.ourSide === 'blue' ? draftState.redPicks : draftState.bluePicks) : [];

        const scored = available.map(c => {
            const sigScore = sigs.includes(c.id) ? 1.0 : 0.0;
            const safeScore = _computeSafeScore(c);
            const mastery = _computeMastery(c, players);
            const tgv = _computeTeamGameValue(c);
            const flex = (c.tags.flexValue || 0) / 2;
            const seriesVal = _computeSeriesValue(c, draftState);
            const risk = (c.tags.executionDifficulty || 0) / 2 * 0.5;
            const draftNeed = _computeDraftNeed(c, ourPicks);
            // Meta power score from patch diff
            const metaPower = (typeof MetaAnalyzer !== 'undefined') ? MetaAnalyzer.getMetaPowerScore(c.id) : 0;

            const score = 0.30 * sigScore + 0.15 * safeScore + 0.12 * mastery
                + 0.13 * tgv + 0.10 * flex + 0.05 * seriesVal - 0.15 * risk
                + 0.05 * draftNeed + 0.15 * metaPower;

            const type = sigScore > 0 ? 'SIGNATURE' : 'SAFE';
            const reasons = _buildPickReasons(c, sigScore, safeScore, mastery, tgv, flex, seriesVal, risk, metaPower);

            return { champion: c, score, type, sigScore, reasons };
        }).sort((a, b) => b.score - a.score);

        // Split into signature lane and safety lane
        const sigPicks = scored.filter(s => s.type === 'SIGNATURE').slice(0, 3);
        const safePicks = scored.filter(s => s.type === 'SAFE').slice(0, 5);

        return { signature: sigPicks, safe: safePicks, all: scored.slice(0, 10) };
    }

    function _computeSafeScore(champ) {
        let safe = 0.5;
        safe += (champ.tags.laneStability || 0) * 0.15;
        safe += (champ.tags.disengage || 0) * 0.1;
        safe -= (champ.tags.executionDifficulty || 0) * 0.1;
        return Math.max(0, Math.min(safe, 1.0));
    }

    function _computeMastery(champ, players) {
        let bestMastery = 0;
        for (const p of (players || [])) {
            if ((p.signatureChamps || []).includes(champ.id)) bestMastery = Math.max(bestMastery, 1.0);
            else if ((p.comfortChamps || []).includes(champ.id)) bestMastery = Math.max(bestMastery, 0.7);
            // Check mastery data
            if (p.mastery && p.mastery[champ.id]) {
                const m = p.mastery[champ.id];
                const winRate = m.games > 0 ? m.wins / m.games : 0.5;
                bestMastery = Math.max(bestMastery, winRate);
            }
        }
        return bestMastery;
    }

    function _computeTeamGameValue(champ) {
        const t = champ.tags;
        return (0.25 * (t.objectiveControl || 0) / 2
            + 0.20 * (t.engageClarity || 0) / 2
            + 0.20 * (t.laneStability || 0) / 2
            + 0.15 * (t.disengage || 0) / 2
            + 0.10 * (t.flexValue || 0) / 2
            - 0.20 * (t.executionDifficulty || 0) / 2);
    }

    function _computeSeriesValue(champ, draftState) {
        if (!draftState) return 0.5;
        const gameNo = draftState.currentGame || 1;
        const maxGames = draftState.maxGames || 3;
        // Early game: free to use any card. Late game: preserve flex/value cards
        if (gameNo <= 1) return 0.5;
        // In later games, flex champions are more valuable (fewer options)
        return 0.3 + (champ.tags.flexValue || 0) * 0.15 + (gameNo / maxGames) * 0.2;
    }

    function _computeDraftNeed(champ, ourPicks) {
        if (ourPicks.length === 0) return 0.3;
        // Check damage balance
        const dmgCounts = { AP: 0, AD: 0, MIXED: 0 };
        for (const cid of ourPicks) {
            const c = CHAMPION_MAP[cid];
            if (c) dmgCounts[c.dmg] = (dmgCounts[c.dmg] || 0) + 1;
        }
        let need = 0;
        if (dmgCounts.AP >= 2 && champ.dmg === 'AD') need += 0.3;
        if (dmgCounts.AD >= 2 && champ.dmg === 'AP') need += 0.3;
        // Check for frontline/engage need
        const hasEngage = ourPicks.some(cid => {
            const c = CHAMPION_MAP[cid];
            return c && (c.tags.engageClarity || 0) >= 2;
        });
        if (!hasEngage && (champ.tags.engageClarity || 0) >= 2) need += 0.2;
        return Math.min(need, 1.0);
    }

    function _buildPickReasons(c, sig, safe, mastery, tgv, flex, series, risk, metaPower) {
        const r = [];
        if (sig > 0) r.push('🌟 팀 시그니처 픽');
        if (mastery >= 0.8) r.push(`숙련도 높음 (${(mastery * 100).toFixed(0)}%)`);
        if (safe >= 0.7) r.push('라인 안정성 높음');
        if (tgv >= 0.3) r.push('팀게임 기여도 우수');
        if (flex >= 0.4) r.push('플렉스 가능 (드래프트 숨김)');
        if (risk > 0.3) r.push('⚠️ 실행 난이도 높음');
        if (metaPower && metaPower > 0.05) r.push('🔺 이번 패치 버프');
        if (metaPower && metaPower < -0.05) r.push('🔻 이번 패치 너프');
        if (r.length === 0) r.push('일반 추천');
        return r;
    }

    /* ============================================
       Comp Radar (6-axis)
       ============================================ */
    function computeCompRadar(pickIds) {
        const axes = {
            engage: 0,    // 이니시
            cc: 0,        // CC
            frontline: 0, // 프론트
            scale: 0,     // 스케일
            dmgBalance: 0,// AP·AD 밸런스
            objective: 0, // 오브젝트
        };
        let ap = 0, ad = 0;
        for (const cid of (pickIds || [])) {
            const c = CHAMPION_MAP[cid];
            if (!c) continue;
            axes.engage += (c.tags.engageClarity || 0);
            axes.frontline += (c.tags.laneStability || 0);
            axes.objective += (c.tags.objectiveControl || 0);
            axes.cc += (c.tags.disengage || 0);
            axes.scale += (c.tags.laneStability || 0);
            if (c.dmg === 'AP') ap++;
            else if (c.dmg === 'AD') ad++;
        }
        const total = pickIds.length || 1;
        axes.engage = Math.min(axes.engage / (total * 2), 1);
        axes.cc = Math.min(axes.cc / (total * 2), 1);
        axes.frontline = Math.min(axes.frontline / (total * 2), 1);
        axes.scale = Math.min(axes.scale / (total * 2), 1);
        axes.objective = Math.min(axes.objective / (total * 2), 1);
        // Damage balance: 1.0 = perfect balance, 0 = all one type
        const maxDmg = Math.max(ap, ad, 1);
        const minDmg = Math.min(ap, ad);
        axes.dmgBalance = total > 1 ? minDmg / maxDmg : 0.5;
        return axes;
    }

    /* ============================================
       Warnings
       ============================================ */
    function getCompWarnings(pickIds) {
        const warnings = [];
        const radar = computeCompRadar(pickIds);
        let ap = 0, ad = 0;
        for (const cid of (pickIds || [])) {
            const c = CHAMPION_MAP[cid];
            if (c?.dmg === 'AP') ap++;
            else if (c?.dmg === 'AD') ad++;
        }

        if (ap >= 3 && ad <= 1) warnings.push({
            type: 'COMP_RISK', severity: 'HIGH',
            text: 'AP 비중 과다 — 상대 MR 스택에 취약',
            solution: '다음 픽에서 AD 딜러 우선 고려'
        });
        if (ad >= 3 && ap <= 1) warnings.push({
            type: 'COMP_RISK', severity: 'HIGH',
            text: 'AD 비중 과다 — 상대 아머 스택에 취약',
            solution: '다음 픽에서 AP 챔피언 우선 고려'
        });
        if (radar.engage < 0.2 && pickIds.length >= 3) warnings.push({
            type: 'COMP_RISK', severity: 'MEDIUM',
            text: '이니시 부족 — 한타 시작이 어려움',
            solution: '이니시 능력이 있는 챔피언 (오른, 세주아니 등) 고려'
        });
        if (radar.frontline < 0.2 && pickIds.length >= 3) warnings.push({
            type: 'COMP_RISK', severity: 'MEDIUM',
            text: '프론트 부족 — 팀파이트 구조 불안',
            solution: '탱커/브루저를 보강하세요'
        });
        if (radar.cc < 0.15 && pickIds.length >= 3) warnings.push({
            type: 'COMP_RISK', severity: 'LOW',
            text: 'CC 부족 — 적 캐리를 잡기 어려움'
        });
        return warnings;
    }

    /* ============================================
       Helpers
       ============================================ */
    function _getTeamSignatures(teamData) {
        const sigs = [];
        const team = teamData?.team || Store.getTeam();
        if (team.signaturePicks) sigs.push(...team.signaturePicks);
        const players = teamData?.players || Store.getPlayers();
        for (const p of players) {
            if (p.signatureChamps) sigs.push(...p.signatureChamps);
        }
        return [...new Set(sigs)];
    }

    return {
        predictEnemyPicks, computeBanScores, computePickScores,
        computeCompRadar, getCompWarnings,
    };
})();

/* ========================================================
   app.js — Application Init Hub
   ======================================================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Draft OS initializing...');

    // Initialize modules
    DraftUI.init();
    TeamUI.init();
    ScoutingUI.init();
    ScrimUI.init();

    // Router
    Router.init((view) => {
        if (view === 'team') TeamUI.render();
        else if (view === 'scouting') ScoutingUI.render();
        else if (view === 'scrim-log') ScrimUI.render();
        else if (view === 'draft') DraftUI.refresh();
    });

    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            Router.navigate(item.dataset.view);
        });
    });

    // Auto version check + meta analysis
    _runStartupChecks();

    console.log('Draft OS ready.');
});

async function _runStartupChecks() {
    try {
        // 1) Check for new DDragon version
        const result = await VersionChecker.runFullCheck();
        if (result.notification) {
            _showUpdateBanner(result.notification);
        }

        // 2) Auto-diff champion stats for meta power score
        const prevVersion = await VersionChecker.getPreviousVersion();
        if (prevVersion) {
            await MetaAnalyzer.diffChampionStats(prevVersion, DDRAGON_VERSION);
            const summary = MetaAnalyzer.getSummary();
            if (summary.totalChanges > 0) {
                console.log(`[Meta] ${summary.buffed.length} buffed, ${summary.nerfed.length} nerfed champions`);
            }
        }
    } catch (e) {
        console.warn('[Startup] Check failed:', e);
    }
}

function _showUpdateBanner(message) {
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = `
        <span class="update-icon">🔔</span>
        <span class="update-text">${message}</span>
        <button class="update-close" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.prepend(banner);
}

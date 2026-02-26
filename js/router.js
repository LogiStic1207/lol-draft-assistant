/* ========================================================
   router.js — Hash-based 4-view routing
   ======================================================== */

const Router = (() => {
    const VIEWS = ['draft', 'team', 'scouting', 'scrim-log'];
    let _onChangeCallback = null;

    function init(cb) {
        _onChangeCallback = cb;
        window.addEventListener('hashchange', _handle);
        _handle();
    }

    function _handle() {
        const hash = (location.hash || '#draft').replace('#', '');
        const view = VIEWS.includes(hash) ? hash : 'draft';
        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        // Show target
        const target = document.getElementById(`view-${view}`);
        if (target) target.classList.add('active');
        // Update nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });
        if (_onChangeCallback) _onChangeCallback(view);
    }

    function navigate(view) {
        location.hash = '#' + view;
    }

    function currentView() {
        return (location.hash || '#draft').replace('#', '');
    }

    return { init, navigate, currentView };
})();

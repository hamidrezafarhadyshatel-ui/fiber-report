function renderPage(page, { focus = true } = {}) {
    const dashboard = document.getElementById('dashboard');
    const reportPages = document.querySelectorAll('.report-page');

    if (page === 'dashboard') {
        if (dashboard) dashboard.style.display = 'block';
        reportPages.forEach(el => el.classList.remove('active'));
        return;
    }

    const map = {
        drop: 'pageDrop',
        fusion: 'pageFusion',
        fat: 'pageFat',
        shoot: 'pageShoot',
        omran: 'pageOmran'
    };
    const targetId = map[page];
    if (!targetId) return;

    if (dashboard) dashboard.style.display = 'none';
    reportPages.forEach(el => el.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');

    setupDateValidation(page);
    bindActions();
    if (focus) {
        const contractorId = page + 'Contractor';
        setTimeout(() => document.getElementById(contractorId)?.focus(), 200);
    }
}

function navigateTo(page, { replace = false, focus = true } = {}) {
    const map = {
        dashboard: window.location.pathname,
        drop: window.location.pathname,
        fusion: window.location.pathname,
        fat: window.location.pathname,
        shoot: window.location.pathname,
        omran: window.location.pathname
    };
    if (!(page in map)) return;

    const state = { page };
    const url = map[page];
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
    renderPage(page, { focus });
}

function handlePopState(event) {
    const page = event.state?.page || 'dashboard';
    renderPage(page, { focus: false });
}
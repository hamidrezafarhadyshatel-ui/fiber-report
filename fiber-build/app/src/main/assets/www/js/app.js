function initAllFieldHistories() {
    ['dropContractor', 'dropReporter', 'fusionContractor', 'fusionReporter',
     'fatContractor', 'fatReporter', 'shootContractor', 'shootReporter',
     'omranContractor', 'omranReporter'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) setupFieldHistory(el, id);
    });
}

function goBack() {
    navigateTo('dashboard');
}

function bindActions() {
    document.querySelectorAll('.actions').forEach(container => {
        try {
            const page = container.closest('.report-page');
            if (!page) return;
            const pageId = page.id;
            let config;
            if (pageId === 'pageDrop') config = dropConfig;
            else if (pageId === 'pageFusion') config = fusionConfig;
            else if (pageId === 'pageFat') config = fatConfig;
            else if (pageId === 'pageShoot') config = shootConfig;
            else if (pageId === 'pageOmran') config = omranConfig;
            else return;

            container.querySelectorAll('[data-action]').forEach(btn => {
                if (btn.dataset.bound) return;
                btn.dataset.bound = 'true';
                const action = btn.dataset.action;
                btn.addEventListener('click', function () {
                    switch (action) {
                        case 'save': saveReport(config); break;
                        case 'load': loadReport(config); break;
                        case 'import': importReport(config); break;
                        case 'excel': exportExcel(config); break;
                        case 'csv': exportCSV(config); break;
                        case 'json': exportJSON(config); break;
                        case 'reportFull': generateTextReport(config, 'full'); break;
                        case 'reportSummary': generateTextReport(config, 'summary'); break;
                        case 'preview': previewReport(config); break;
                        case 'new': newReport(config); break;
                    }
                });
            });
        } catch (e) { console.warn('bindActions error:', e); }
    });
}

// ================================================================
//  دکمه‌های داشبورد
// ================================================================
document.querySelectorAll('.dash-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', function () {
        const page = this.dataset.page;
        navigateTo(page);
    });
});

// ================================================================
//  راه‌اندازی
// ================================================================
window.addEventListener('popstate', handlePopState);

const loggedIn = localStorage.getItem('fiber_logged_in');

if (loggedIn === 'true') {
    showApp();
} else {
    showLogin();
}

document.addEventListener('DOMContentLoaded', function () {
    bindActions();
    setupDateValidation('drop');
    setupDateValidation('fusion');
    setupDateValidation('fat');
    setupDateValidation('shoot');
    setupDateValidation('omran');

    if (loggedIn === 'true') {
        const currentState = history.state;
        if (currentState && currentState.page !== 'dashboard') {
            navigateTo(currentState.page);
        }
    }
});

setTimeout(bindActions, 200);

document.addEventListener('input', function (e) {
    const page = e.target.closest('.report-page');
    if (!page || e.target.closest('#loginPage')) return;
    let config;
    if (page.id === 'pageDrop') config = dropConfig;
    else if (page.id === 'pageFusion') config = fusionConfig;
    else if (page.id === 'pageFat') config = fatConfig;
    else if (page.id === 'pageShoot') config = shootConfig;
    else if (page.id === 'pageOmran') config = omranConfig;
    else return;
    if (config) scheduleAutosave(config);
});

document.addEventListener('change', function (e) {
    const page = e.target.closest('.report-page');
    if (!page) return;
    let config;
    if (page.id === 'pageDrop') config = dropConfig;
    else if (page.id === 'pageFusion') config = fusionConfig;
    else if (page.id === 'pageFat') config = fatConfig;
    else if (page.id === 'pageShoot') config = shootConfig;
    else if (page.id === 'pageOmran') config = omranConfig;
    else return;
    if (config) scheduleAutosave(config);
});

console.log('سیستم گزارش‌گیری فیبر نوری بارگذاری شد.');
let currentPage = 'dashboard';
let exitInProgress = false;
let dialogOpen = false;

function renderPage(page, { focus = true } = {}) {
    currentPage = page;
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
        omran: 'pageOmran',
        aggregate: 'pageAggregate'
    };
    const targetId = map[page];
    if (!targetId) return;

    if (page === 'aggregate' && typeof isAggregateAccessAllowed === 'function' && !isAggregateAccessAllowed()) {
        showToast('دسترسی به گزارش تجمیعی فقط برای مدیر سیستم مجاز است.', true);
        currentPage = 'dashboard';
        return navigateTo('dashboard');
    }

    if (dashboard) dashboard.style.display = 'none';
    reportPages.forEach(el => el.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');

    if (page === 'aggregate') {
        if (typeof initAggregatePage === 'function') initAggregatePage();
        if (typeof renderAggregateUI === 'function') renderAggregateUI();
        return;
    }

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
        omran: window.location.pathname,
        aggregate: window.location.pathname
    };
    if (!(page in map)) return;

    if (page === 'aggregate' && typeof isAggregateAccessAllowed === 'function' && !isAggregateAccessAllowed()) {
        showToast('دسترسی به گزارش تجمیعی فقط برای مدیر سیستم مجاز است.', true);
        page = 'dashboard';
    }

    if (page === 'dashboard') replace = true;

    const state = { page };
    const url = map[page];
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
    renderPage(page, { focus });
}

function handlePopState(event) {
    if (exitInProgress || dialogOpen) return;

    // اگه تو صفحه گزارش هستیم → برگرد داشبورد
    if (currentPage !== 'dashboard') {
        renderPage('dashboard', { focus: false });
        history.pushState({ page: 'dashboard' }, '', window.location.pathname);
        return;
    }

    // تو داشبورد هستیم → دیالوگ تأیید خروج
    showExitDialog();
}

function showExitDialog() {
    dialogOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'exit-dialog-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999; direction: rtl; font-family: Tahoma, Arial, sans-serif;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
        background: #fff; border-radius: 14px; padding: 24px 22px;
        width: 300px; max-width: 85%; text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    box.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 10px;">🚪</div>
        <div style="font-size: 16px; font-weight: bold; color: #1565c0; margin-bottom: 20px;">
            از برنامه خارج می‌شوید؟
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="exitDialogYes" style="
                flex: 1; padding: 12px; border: 0; border-radius: 10px;
                background: #c62828; color: #fff; font-weight: bold;
                font-size: 15px; cursor: pointer; font-family: inherit;
            ">بله، خروج</button>
            <button id="exitDialogNo" style="
                flex: 1; padding: 12px; border: 0; border-radius: 10px;
                background: #e8f1fb; color: #155a9c; font-weight: bold;
                font-size: 15px; cursor: pointer; font-family: inherit;
            ">خیر</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('exitDialogYes').addEventListener('click', function () {
        dialogOpen = false;
        overlay.remove();
        exitInProgress = true;
        tryExitApp();
    });

    document.getElementById('exitDialogNo').addEventListener('click', function () {
        dialogOpen = false;
        overlay.remove();
        // دوباره entry trap بذار تا بک بعدی هم trigger بشه
        history.pushState({ page: 'dashboard' }, '', window.location.pathname);
    });

    // کلیک روی پس‌زمینه = خیر
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            dialogOpen = false;
            overlay.remove();
            history.pushState({ page: 'dashboard' }, '', window.location.pathname);
        }
    });
}

function tryExitApp() {
    try {
        if (typeof median !== 'undefined' && median.navigation && typeof median.navigation.close === 'function') {
            median.navigation.close();
            return;
        }
    } catch (e) { console.warn('Median exit failed:', e); }

    try { window.close(); return; } catch (e) {}

    if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') {
        navigator.app.exitApp();
        return;
    }

    exitInProgress = false;
    showToast('برای خروج، دکمه هوم گوشی را بزنید.', false);
}

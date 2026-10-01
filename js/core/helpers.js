        let toastTimer = null;

        function showToast(msg, isError = false) {
            const el = document.getElementById('toast-container');
            if (!el) return;
            el.textContent = msg;
            el.className = 'show ' + (isError ? 'error' : 'success');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                el.className = '';
                el.textContent = '';
                toastTimer = null;
            }, 4000);
        }

        // فقط مقادیر غیرصفر را برای خلاصه گزارش نمایش می‌دهد تا خروجی شلوغ نشود.
        function nonZeroMetric(label, value, unit = '') {
            const n = Number(value);
            if (!Number.isFinite(n) || n === 0) return '';
            return `${label}: ${value}${unit ? ' ' + unit : ''}`;
        }

        function joinNonZeroMetrics(metrics, separator = ' | ') {
            return metrics.map(item => {
                if (Array.isArray(item)) return nonZeroMetric(item[0], item[1], item[2] || '');
                return item || '';
            }).filter(Boolean).join(separator);
        }

        const MAX_HISTORY = 10;

        function getFieldHistory(key) {
            try { const data = localStorage.getItem('field_history_' + key); return data ? JSON.parse(data) : []; } catch (
            e) { return []; }
        }

        function saveFieldHistory(key, value) {
            if (!value || value.trim() === '') return;
            let history = getFieldHistory(key);
            history = history.filter(item => item !== value.trim());
            history.unshift(value.trim());
            if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
            safeLocalStorageSet('field_history_' + key, JSON.stringify(history));
        }

        function setupFieldHistory(input, key) {
            if (!input) return;
            const datalistId = 'datalist_' + key;
            let datalist = document.getElementById(datalistId);
            if (!datalist) { datalist = document.createElement('datalist');
                datalist.id = datalistId;
                document.body.appendChild(datalist); }
            input.setAttribute('list', datalistId);
            input.addEventListener('focus', function() {
                const history = getFieldHistory(key);
                datalist.innerHTML = '';
                history.forEach(value => { const opt = document.createElement('option');
                    opt.value = value;
                    datalist.appendChild(opt); });
            });
            input.addEventListener('blur', function() { const val = this.value.trim(); if (val) saveFieldHistory(key, val); });
            input.addEventListener('change', function() { const val = this.value.trim(); if (val) saveFieldHistory(key, val); });
        }

        function isJalaliLeapYear(year) {
            const a = year % 33;
            return a === 1 || a === 5 || a === 9 || a === 13 || a === 17 || a === 22 || a === 26 || a === 30;
        }

        function validateDate(yearId, monthId, dayId) {
            const y = parseInt(document.getElementById(yearId).value);
            const m = parseInt(document.getElementById(monthId).value);
            const d = parseInt(document.getElementById(dayId).value);
            if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
            if (y < 1300 || y > 1500) return false;
            if (m < 1 || m > 12) return false;
            const maxDay = m <= 6 ? 31 : (m <= 11 ? 30 : (isJalaliLeapYear(y) ? 30 : 29));
            return d >= 1 && d <= maxDay;
        }

        function getDateStr(yearId, monthId, dayId) {
            const y = document.getElementById(yearId).value;
            const m = String(document.getElementById(monthId).value).padStart(2, '0');
            const d = String(document.getElementById(dayId).value).padStart(2, '0');
            return (y && m && d) ? `${y}/${m}/${d}` : '';
        }

        function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

        function downloadBlob(blob, name) {
    const reader = new FileReader();
    reader.onload = function() {
        const a = document.createElement('a');
        a.href = reader.result;  // data: URL به جای blob:
        a.download = name;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 500);
    };
    reader.readAsDataURL(blob);
        }

        const REPORT_STORE_KEY = 'fiber_reports_v2';
        const DRAFT_PREFIX = 'fiber_draft_';
        let autosaveTimer = null;
        let suppressAutosave = false;


// ================================================================
//  محدوده کابینت‌های هر منطقه (نسخه موقت بدون دیتابیس)
// ================================================================
const FIXED_PROVINCE = 'خراسان رضوی';
const FIXED_CITY = 'مشهد';

function _numRange(from, to) {
    const out = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
}

const CABINET_REGIONS = {
    '1': [239, 240,241, ..._numRange(244, 278)],
    '5': _numRange(500, 520),
    '9': [
        ..._numRange(208, 215),
        ..._numRange(224, 231),
        243,
        ..._numRange(279, 301).filter(n => n !== 298)
    ],
    '11': [
        ..._numRange(200, 207),
        ..._numRange(216, 223),
        ..._numRange(232, 238),
        242
    ]
};

function getCabinetOptions(region) {
    return CABINET_REGIONS[String(region)] || [];
}

function isValidCabinetForRegion(cabNum, region) {
    return getCabinetOptions(region).includes(parseInt(cabNum, 10));
}

function getNextCabinetId(container) {
    const existing = Array.from(container.querySelectorAll('.cabinet-block'))
        .map(el => parseInt(el.dataset.cid, 10) || 0);
    return existing.length ? Math.max(...existing) + 1 : 1;
}

function updateCabinetNumberOptions(regionSelect) {
    const cabEl = regionSelect.closest('.cabinet-block');
    if (!cabEl) return;
    const region = regionSelect.value;
    const cabNumInput = cabEl.querySelector('.cabinet-number');
    const datalist = cabEl.querySelector('datalist.cabinet-number-list');
    if (!cabNumInput || !datalist) return;

    const list = getCabinetOptions(region);
    datalist.innerHTML = '';
    list.forEach(n => {
        const opt = document.createElement('option');
        opt.value = String(n);
        datalist.appendChild(opt);
    });

    cabNumInput.disabled = list.length === 0;
    if (cabNumInput.value && !isValidCabinetForRegion(cabNumInput.value, region)) {
        cabNumInput.value = '';
        cabNumInput.dataset.lastValid = '';
    }
}

function getReportLocationLines(data) {
    const cabinets = Array.isArray(data?.cabinets) ? data.cabinets : [];
    const provinces = [...new Set(cabinets.map(c => String(c?.province || '').trim()).filter(Boolean))];
    const cities = [...new Set(cabinets.map(c => String(c?.city || '').trim()).filter(Boolean))];
    const provinceText = provinces.length ? provinces.join('، ') : (typeof FIXED_PROVINCE !== 'undefined' ? FIXED_PROVINCE : '');
    const cityText = cities.length ? cities.join('، ') : (typeof FIXED_CITY !== 'undefined' ? FIXED_CITY : '');
    return `استان: ${provinceText || '-'}\nشهر: ${cityText || '-'}`;
}

function buildCabinetGridHTML(cabId, containerId) {
    const listId = `cabinetList_${containerId}_${cabId}`;
    return `
        <div class="grid">
            <div class="field"><label>استان</label><input class="cabinet-province" value="${FIXED_PROVINCE}" disabled></div>
            <div class="field"><label>شهر</label><input class="cabinet-city" value="${FIXED_CITY}" disabled></div>
            <div class="field"><label>منطقه <span class="required">*</span></label>
                <select class="cabinet-region" required>
                    <option value="">انتخاب منطقه</option>
                    <option value="1">منطقه 1</option>
                    <option value="5">منطقه 5</option>
                    <option value="9">منطقه 9</option>
                    <option value="11">منطقه 11</option>
                </select>
            </div>
            <div class="field"><label>شماره کابینت <span class="required">*</span></label>
                <input class="cabinet-number" type="text" inputmode="numeric" list="${listId}" required placeholder="جستجو یا انتخاب از لیست" disabled autocomplete="off">
                <datalist class="cabinet-number-list" id="${listId}"></datalist>
            </div>
        </div>
    `;
}
function bindCabinetSelectors(cabEl, data, summaryFnName) {
    const regionSelect = cabEl.querySelector('.cabinet-region');
    if (!regionSelect) return;
    const cabNumInput = cabEl.querySelector('.cabinet-number');
    if (!cabNumInput) return;

    if (data?.region) regionSelect.value = String(data.region);
    updateCabinetNumberOptions(regionSelect);

    if (data?.cabinetNumber && isValidCabinetForRegion(data.cabinetNumber, regionSelect.value)) {
        cabNumInput.value = String(data.cabinetNumber);
        cabNumInput.dataset.lastValid = String(data.cabinetNumber);
    }

    regionSelect.addEventListener('change', function () {
        updateCabinetNumberOptions(this);
        cabNumInput.value = '';
        cabNumInput.dataset.lastValid = '';
        if (typeof window[summaryFnName] === 'function') window[summaryFnName]();
    });

    const validateAndClean = function () {
        const v = String(cabNumInput.value || '').trim();
        if (!v) { cabNumInput.dataset.lastValid = ''; return; }
        if (isValidCabinetForRegion(v, regionSelect.value)) {
            cabNumInput.dataset.lastValid = v;
        } else {
            cabNumInput.value = cabNumInput.dataset.lastValid || '';
            showToast('فقط می‌توانید از بین کابینت‌های لیست انتخاب کنید.', true);
        }
    };

    cabNumInput.addEventListener('change', validateAndClean);
    cabNumInput.addEventListener('blur', validateAndClean);
}

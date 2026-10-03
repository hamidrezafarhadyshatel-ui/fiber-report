const dropConfig = {
    key: 'drop_report_multi',
    reportName: 'گزارش کابل‌کشی',
    reportType: 'drop',
    containerId: 'dropCabinets',
    dateIds: { year: 'dropYear', month: 'dropMonth', day: 'dropDay' },
    contractorId: 'dropContractor',
    reporterId: 'dropReporter',
    validate: function () {
        const common = getCommonFields(this);
        return validateDate(this.dateIds.year, this.dateIds.month, this.dateIds.day) &&
            common.contractor !== '' && common.reporter !== '';
    },
    collect: function () {
        const common = getCommonFields(this);
        const cabinets = collectDropCabinets();
        return { reportType: this.reportType, date: common.date, contractor: common.contractor,
            reporter: common.reporter, cabinets };
    },
    render: function (data) {
        if (data.date) {
            const parts = data.date.split('/');
            if (parts.length === 3) {
                document.getElementById(this.dateIds.year).value = parts[0];
                document.getElementById(this.dateIds.month).value = parseInt(parts[1]);
                document.getElementById(this.dateIds.day).value = parseInt(parts[2]);
            }
        }
        document.getElementById(this.contractorId).value = data.contractor || '';
        document.getElementById(this.reporterId).value = data.reporter || '';
        document.getElementById(this.containerId).innerHTML = '';
        data.cabinets.forEach(cab => addDropCabinet(cab));
        updateDropSummary();
        setTimeout(() => { document.getElementById(this.contractorId)?.focus(); }, 200);
    },
    prepareExcel: function (data) { return buildDropExcelRows(data); },
    prepareCSV: function (data) { return buildDropCSVRows(data); },
    formatText: function (data, type) { return buildDropTextReport(data, type); },
    previewHTML: function (data) { return buildDropPreviewHTML(data); },
    columnWidths: [
        { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 18 }, { wch: 30 }
    ]
};

// ---- Drop status toggle (team از route حذف شد) ----
function toggleRouteStatus(btn, status) {
    const route = btn.closest('.route');
    if (!route) return;
    const previousStatus = route.querySelector('[data-status]')?.value || 'done';
    const previousFields = previousStatus === 'not_done' ? '.not-done-fields' : '.done-fields';
    const nextFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
    ['source', 'destination'].forEach(key => {
        const from = route.querySelector(`${previousFields} [data-f="${key}"]`);
        const to = route.querySelector(`${nextFields} [data-f="${key}"]`);
        if (from && to) to.value = from.value;
    });
    const statusInput = route.querySelector('[data-status]');
    if (statusInput) statusInput.value = status;
    const doneFields = route.querySelector('.done-fields');
    const notDoneFields = route.querySelector('.not-done-fields');
    const reasonInput = route.querySelector('[data-f="reason"]');
    if (status === 'done') {
        route.classList.remove('not-done-mode');
        doneFields.style.display = '';
        notDoneFields.style.display = 'none';
        if (reasonInput) reasonInput.removeAttribute('required');
        const doneBtn = route.querySelector('.toggle-done');
        const notDoneBtn = route.querySelector('.toggle-not-done');
        if (doneBtn) { doneBtn.className = 'secondary toggle-done'; doneBtn.textContent = '✔ انجام‌شده'; }
        if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done'; notDoneBtn.textContent = '✖ انجام‌نشده'; }
    } else {
        route.classList.add('not-done-mode');
        doneFields.style.display = 'none';
        notDoneFields.style.display = '';
        if (reasonInput) reasonInput.setAttribute('required', 'required');
        const doneBtn = route.querySelector('.toggle-done');
        const notDoneBtn = route.querySelector('.toggle-not-done');
        if (doneBtn) { doneBtn.className = 'secondary toggle-done'; doneBtn.textContent = '✔ انجام‌شده'; }
        if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done'; notDoneBtn.textContent = '✖ انجام‌نشده'; }
    }
    updateDropSummary();
}

// ---- collect ----
function collectDropCabinets() {
    const cabinets = [];
    document.querySelectorAll('#dropCabinets .cabinet-block').forEach(cabEl => {
        const cabinetNumber = cabEl.querySelector('.cabinet-number')?.value?.trim() || '';
        const province = cabEl.querySelector('.cabinet-province')?.value?.trim() || '';
        const city = cabEl.querySelector('.cabinet-city')?.value?.trim() || '';
        const region = cabEl.querySelector('.cabinet-region')?.value?.trim() || '';
        const teams = [];
        cabEl.querySelectorAll('.drop-team').forEach(teamEl => {
            const teamName = teamEl.querySelector('.drop-team-name')?.value?.trim() || '';
            const routes = [];
            teamEl.querySelectorAll('.route').forEach(routeEl => {
                const status = routeEl.querySelector('[data-status]')?.value || 'done';
                const o = { status };
                if (status === 'done') {
                    routeEl.querySelectorAll('.done-fields [data-f]').forEach(x => {
                        o[x.dataset.f] = x.value.trim();
                    });
                    if (!o.length || o.length === '') {
                        const len = calcDropLength(o.startCode, o.endCode);
                        if (len) o.length = len;
                    }
                } else {
                    routeEl.querySelectorAll('.not-done-fields [data-f]').forEach(x => {
                        o[x.dataset.f] = x.value.trim();
                    });
                }
                if (o.source || o.destination) routes.push(o);
            });
            if (teamName || routes.length > 0) teams.push({ teamName, routes });
        });
        if (cabinetNumber || teams.length > 0) {
            cabinets.push({ cabinetNumber, province, city, region, teams });
        }
    });
    return cabinets;
}

function calcDropLength(start, end) {
    const s = parseInt(String(start).replace(/[^0-9]/g, ''));
    const e = parseInt(String(end).replace(/[^0-9]/g, ''));
    if (isNaN(s) || isNaN(e)) return '';
    const diff = Math.abs(e - s);
    return diff > 0 ? String(diff) : '';
}

function autoCalcDropLength(routeEl) {
    const start = routeEl.querySelector('[data-f="startCode"]');
    const end = routeEl.querySelector('[data-f="endCode"]');
    const len = routeEl.querySelector('[data-f="length"]');
    if (!start || !end || !len) return;
    const val = calcDropLength(start.value, end.value);
    len.value = val || '';
    len.disabled = true;
    updateDropSummary();
}

// ---- validation ----
function validateDropRoutesInTeam(teamEl) {
    const routeEls = teamEl.querySelectorAll('.route');
    let hasError = false, errorMsg = '';
    routeEls.forEach(route => {
        const status = route.querySelector('[data-status]')?.value || 'done';
        if (status === 'done') {
            const source = route.querySelector('.done-fields [data-f="source"]')?.value?.trim() || '';
            const destination = route.querySelector('.done-fields [data-f="destination"]')?.value?.trim() || '';
            const startCode = route.querySelector('.done-fields [data-f="startCode"]')?.value?.trim() || '';
            const endCode = route.querySelector('.done-fields [data-f="endCode"]')?.value?.trim() || '';
            const cableType = route.querySelector('.done-fields [data-f="cableType"]')?.value || '';
            const clamp = route.querySelector('.done-fields [data-f="clamp"]')?.value?.trim() || '';
            const wire1 = route.querySelector('.done-fields [data-f="wire1"]')?.value?.trim() || '';
            const wire15 = route.querySelector('.done-fields [data-f="wire15"]')?.value?.trim() || '';
            if (!source || !destination || !startCode || !endCode || !cableType || !clamp || !wire1 || !wire15) {
                hasError = true;
                errorMsg = 'مسیر انجام‌شده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
            }
        } else {
            const source = route.querySelector('.not-done-fields [data-f="source"]')?.value?.trim() || '';
            const destination = route.querySelector('.not-done-fields [data-f="destination"]')?.value?.trim() || '';
            const reason = route.querySelector('.not-done-fields [data-f="reason"]')?.value?.trim() || '';
            if (!source || !destination || !reason) {
                hasError = true;
                errorMsg = 'مسیر انجام‌نشده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
            }
        }
    });
    return { ok: !hasError, message: errorMsg };
}

function validateDropTeamsInCabinet(cabinetEl) {
    const teamEls = cabinetEl.querySelectorAll('.drop-team');
    for (const team of teamEls) {
        const teamName = team.querySelector('.drop-team-name')?.value?.trim() || '';
        if (!teamName) return { ok: false, message: 'نام تیم دراپ را قبل از افزودن تیم یا کابینت جدید وارد کنید.' };
        const r = validateDropRoutesInTeam(team);
        if (!r.ok) return r;
    }
    return { ok: true };
}

// ---- add cabinet / team / route ----
document.getElementById('dropAddCabinet').addEventListener('click', function () {
    const container = document.getElementById('dropCabinets');
    const lastCabinet = container.lastElementChild;
    if (lastCabinet) {
        const validation = validateDropTeamsInCabinet(lastCabinet);
        if (!validation.ok) { showToast(validation.message, true); return; }
    }
    addDropCabinet();
});

function addDropCabinet(data) {
    const container = document.getElementById('dropCabinets');
    const cabId = getNextCabinetId(container);
    const cabDiv = document.createElement('div');
    cabDiv.className = 'cabinet-block';
    cabDiv.dataset.cid = cabId;
    cabDiv.innerHTML = `
        <div class="cabinet-header">
            <strong>کابینت ${cabId}</strong>
            <div class="cabinet-actions">
                <button type="button" class="danger" onclick="this.closest('.cabinet-block').remove(); updateDropSummary();">🗑️ حذف</button>
            </div>
        </div>
        ${buildCabinetGridHTML(cabId, 'dropCabinets')}
        <div class="drop-teams-container"></div>
        <button type="button" class="secondary" onclick="
            const cab = this.closest('.cabinet-block');
            const validation = validateDropTeamsInCabinet(cab);
            if (!validation.ok) { showToast(validation.message, true); return; }
            addDropTeam(cab);
        " style="margin-top:8px;">＋ افزودن تیم</button>
    `;
    container.appendChild(cabDiv);
    bindCabinetSelectors(cabDiv, data, 'updateDropSummary');

    if (data?.teams?.length) {
        data.teams.forEach(t => addDropTeam(cabDiv, t));
    } else {
        addDropTeam(cabDiv);
    }
    cabDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateDropSummary));
    updateDropSummary();
    const regionSel = cabDiv.querySelector('.cabinet-region');
    if (regionSel) setTimeout(() => { regionSel.focus(); regionSel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

function addDropTeam(cabinetEl, data) {
    const container = cabinetEl.querySelector('.drop-teams-container');
    const teamDiv = document.createElement('div');
    teamDiv.className = 'drop-team';
    teamDiv.innerHTML = `
        <div class="team-header">
            <strong>تیم</strong>
            <button type="button" class="danger" onclick="this.closest('.drop-team').remove(); updateDropSummary();">حذف</button>
        </div>
        <div class="drop-team-row">
            <div class="field"><label>نام تیم <span class="required">*</span></label>
                <input class="drop-team-name history-field" required value="${esc(data?.teamName || '')}" placeholder="نام تیم">
            </div>
        </div>
        <div class="drop-routes-container"></div>
        <button type="button" class="secondary add-route-btn" onclick="
            const team = this.closest('.drop-team');
            const validation = validateDropRoutesInTeam(team);
            if (!validation.ok) { showToast(validation.message, true); return; }
            addDropRoute(team);
        ">＋ افزودن مسیر</button>
    `;
    container.appendChild(teamDiv);
    const teamNameInput = teamDiv.querySelector('.drop-team-name');
    if (teamNameInput) setupFieldHistory(teamNameInput, 'drop_team_history');
    teamDiv.querySelectorAll('input, textarea').forEach(x => x.addEventListener('input', updateDropSummary));
    if (data?.routes?.length) {
        data.routes.forEach(r => addDropRoute(teamDiv, r));
    } else {
        addDropRoute(teamDiv);
    }
    updateDropSummary();
    if (teamNameInput) setTimeout(() => { teamNameInput.focus(); teamNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

function addDropRoute(teamEl, data) {
    const container = teamEl.querySelector('.drop-routes-container');
    const num = container.querySelectorAll('.route').length + 1;
    const status = data?.status || 'done';
    const routeDiv = document.createElement('div');
    routeDiv.className = 'route' + (status === 'not_done' ? ' not-done-mode' : '');
    routeDiv.innerHTML = `
        <div class="routehead">
            <strong>مسیر ${num}</strong>
            <div class="route-status-buttons">
                <button type="button" class="secondary toggle-done" onclick="toggleRouteStatus(this, 'done')">✔ انجام‌شده</button>
                <button type="button" class="danger toggle-not-done" onclick="toggleRouteStatus(this, 'not_done')">✖ انجام‌نشده</button>
            </div>
            <button type="button" class="danger" onclick="this.closest('.route').remove(); updateDropSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
        </div>
        <div class="not-done-warning">⚠️ این مسیر انجام نشده ثبت می‌شود</div>
        <div class="done-fields" style="display:${status === 'done' ? '' : 'none'};">
            <div class="grid">
                <div class="field"><label>باکس مبدأ <span class="required">*</span></label><input data-f="source" type="number" required value="${esc(data?.source)}" placeholder="مثلاً 570"></div>
                <div class="field"><label>باکس مقصد <span class="required">*</span></label><input data-f="destination" type="number" required value="${esc(data?.destination)}" placeholder="مثلاً 12400"></div>
                <div class="field"><label>کد ابتدا <span class="required">*</span></label><input data-f="startCode" type="number" required value="${esc(data?.startCode)}" placeholder="1000"></div>
                <div class="field"><label>کد انتها <span class="required">*</span></label><input data-f="endCode" type="number" required value="${esc(data?.endCode)}" placeholder="880"></div>
                <div class="field full"><label>طول کابل (متر) <span class="unit">(خودکار)</span></label><input data-f="length" type="number" value="${esc(data?.length)}" disabled></div>
                <div class="field"><label>نوع کابل <span class="required">*</span></label>
                    <select data-f="cableType" required>
                        <option value="">انتخاب</option>
                        ${['2','4','6','8','12'].map(x => `<option value="${x}" ${String(data?.cableType) === x ? 'selected' : ''}>${x} کر</option>`).join('')}
                    </select>
                </div>
                <div class="field"><label>بست (عدد) <span class="required">*</span></label><input data-f="clamp" type="number" required value="${esc(data?.clamp)}" placeholder="140"></div>
                <div class="field"><label>مفتول 1 (متر) <span class="required">*</span></label><input data-f="wire1" type="number" required value="${esc(data?.wire1)}" placeholder="0"></div>
                <div class="field"><label>مفتول 1.5 (متر) <span class="required">*</span></label><input data-f="wire15" type="number" required value="${esc(data?.wire15)}" placeholder="100"></div>
                <div class="field"><label>پیچ و رول‌پلاک (عدد)</label><input data-f="screwRawl" type="number" value="${esc(data?.screwRawl)}" placeholder="280"></div>
                <div class="field full"><label>توضیحات</label><textarea data-f="notes" placeholder="اختیاری">${esc(data?.notes)}</textarea></div>
            </div>
        </div>
        <div class="not-done-fields" style="display:${status === 'not_done' ? '' : 'none'};">
            <div class="grid">
                <div class="field"><label>باکس مبدأ <span class="required">*</span></label><input data-f="source" type="number" required value="${esc(data?.source)}" placeholder="مثلاً 570"></div>
                <div class="field"><label>باکس مقصد <span class="required">*</span></label><input data-f="destination" type="number" required value="${esc(data?.destination)}" placeholder="مثلاً 12400"></div>
                <div class="field full"><label>دلیل عدم اجرا <span class="required">*</span></label>
                    <textarea data-f="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="دلیل">${esc(data?.reason)}</textarea>
                </div>
            </div>
        </div>
        <input type="hidden" data-status value="${status}">
    `;
    container.appendChild(routeDiv);
    const start = routeDiv.querySelector('[data-f="startCode"]');
    const end = routeDiv.querySelector('[data-f="endCode"]');
    if (start && end) {
        const update = () => autoCalcDropLength(routeDiv);
        start.addEventListener('input', update);
        end.addEventListener('input', update);
        if (start.value || end.value) setTimeout(update, 50);
    }
    routeDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateDropSummary));
    updateDropSummary();
    const srcInput = routeDiv.querySelector('[data-f="source"]');
    if (srcInput) setTimeout(() => { srcInput.focus(); srcInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

// ---- summary / totals ----
function updateDropSummary() {
    const data = collectDropCabinets();
    const totalRoutes = data.reduce((s, c) => s + c.teams.reduce((a, t) => a + t.routes.length, 0), 0);
    const totalMeters = data.reduce((s, c) => s + c.teams.reduce((a, t) => a + t.routes.reduce((b, r) => b + (parseFloat(r.length) || 0), 0), 0), 0);
    const el = document.getElementById('dropSummary');
    if (!totalRoutes) { el.textContent = 'هنوز کابینتی اضافه نشده است.'; return; }
    const doneCount = data.reduce((s, c) => s + c.teams.reduce((a, t) => a + t.routes.filter(r => r.status !== 'not_done').length, 0), 0);
    const notDoneCount = totalRoutes - doneCount;
    el.innerHTML = `کابینت‌ها: <b>${data.length}</b>　| کل مسیرها: <b>${totalRoutes}</b> (انجام‌شده: <b>${doneCount}</b> | انجام‌نشده: <b>${notDoneCount}</b>)　| متراژ: <b>${totalMeters}</b> متر　| باکس MFAT مصرفی: <b>${doneCount}</b> عدد`;
}

function calculateDropTotals(data) {
    const totals = { totalLength: 0, totalClamp: 0, totalWire15: 0, totalWire1: 0, totalScrew: 0, totalMfat: 0, cableTypes: {} };
    data.cabinets.forEach(cab => {
        cab.teams?.forEach(team => {
            team.routes?.filter(r => r.status !== 'not_done').forEach(r => {
                totals.totalLength += parseFloat(r.length) || 0;
                totals.totalClamp += parseFloat(r.clamp) || 0;
                totals.totalWire15 += parseFloat(r.wire15) || 0;
                totals.totalWire1 += parseFloat(r.wire1) || 0;
                totals.totalScrew += parseFloat(r.screwRawl) || 0;
                totals.totalMfat += 1; // هر مسیر انجام‌شده = یک باکس MFAT
                const type = r.cableType || '8';
                totals.cableTypes[type] = (totals.cableTypes[type] || 0) + (parseFloat(r.length) || 0);
            });
        });
    });
    return totals;
}

// ---- excel ----
function buildDropExcelRows(data) {
    const allRoutes = [];
    data.cabinets.forEach(cab => {
        (cab.teams || []).forEach(team => {
            (team.routes || []).forEach(r => {
                allRoutes.push({ ...r, team: team.teamName || '', cabinet: cab.cabinetNumber, province: cab.province, city: cab.city, region: cab.region });
            });
        });
    });
    const doneRoutes = allRoutes.filter(r => r.status !== 'not_done');
    const notDoneRoutes = allRoutes.filter(r => r.status === 'not_done');
    const rows = [
        ['گزارش کابل‌کشی', '', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date],
        ['پیمانکار', data.contractor, '', 'مسئول تیم دراپ کشی', data.reporter],
        [],
        ['✅ مسیرهای انجام‌شده']
    ];
    let n = 1;
    if (doneRoutes.length) {
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'مقصد', 'مبدأ', 'نوع کابل', 'طول (متر)', 'کد ابتدا', 'کد انتها', 'بست (عدد)', 'مفتول 1 (متر)', 'مفتول 1.5 (متر)', 'پیچ/رول‌پلاک (عدد)', 'باکس MFAT (عدد)', 'توضیحات']);
        doneRoutes.forEach(r => {
            rows.push([n++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '', r.team || '', r.destination || '', r.source || '', r.cableType || '', parseFloat(r.length) || 0, r.startCode || '', r.endCode || '', parseFloat(r.clamp) || 0, parseFloat(r.wire1) || 0, parseFloat(r.wire15) || 0, parseFloat(r.screwRawl) || 0, 1, r.notes || '']);
        });
    }
    if (doneRoutes.length) {
        const totals = calculateDropTotals(data);
        rows.push([]);
        rows.push(['جمع کل (انجام‌شده)', '', '', '', '', '', '', '', '', '', totals.totalLength, '', '', totals.totalClamp, totals.totalWire1, totals.totalWire15, totals.totalScrew, totals.totalMfat, '']);
        rows.push(['مصرفی', `باکس MFAT به تعداد ${totals.totalMfat} عدد`]);
    }
    if (notDoneRoutes.length) {
        rows.push([]);
        rows.push(['❌ مسیرهای انجام‌نشده']);
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'مقصد', 'مبدأ', 'دلیل عدم اجرا']);
        let m = 1;
        notDoneRoutes.forEach(r => {
            rows.push([m++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '', r.team || '', r.destination || '', r.source || '', r.reason || '']);
        });
    }
    return rows;
}

function buildDropCSVRows(data) {
    const allRoutes = [];
    data.cabinets.forEach(cab => {
        (cab.teams || []).forEach(team => {
            (team.routes || []).forEach(r => {
                allRoutes.push({ ...r, team: team.teamName || '', cabinet: cab.cabinetNumber, province: cab.province, city: cab.city, region: cab.region });
            });
        });
    });
    const doneRoutes = allRoutes.filter(r => r.status !== 'not_done');
    const notDoneRoutes = allRoutes.filter(r => r.status === 'not_done');
    const rows = [
        ['گزارش کابل‌کشی', '', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date],
        ['پیمانکار', data.contractor, '', 'مسئول تیم دراپ کشی', data.reporter],
        [],
        ['✅ مسیرهای انجام‌شده'],
        ['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'مقصد', 'مبدأ', 'نوع کابل', 'طول (متر)', 'کد ابتدا', 'کد انتها', 'بست (عدد)', 'مفتول 1 (متر)', 'مفتول 1.5 (متر)', 'پیچ/رول‌پلاک (عدد)', 'باکس MFAT (عدد)', 'توضیحات']
    ];
    let n = 1;
    doneRoutes.forEach(r => {
        rows.push([n++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '', r.team || '', r.destination || '', r.source || '', r.cableType || '', parseFloat(r.length) || 0, r.startCode || '', r.endCode || '', parseFloat(r.clamp) || 0, parseFloat(r.wire1) || 0, parseFloat(r.wire15) || 0, parseFloat(r.screwRawl) || 0, 1, r.notes || '']);
    });
    if (doneRoutes.length) {
        const totals = calculateDropTotals(data);
        rows.push([]);
        rows.push(['جمع کل (انجام‌شده)', '', '', '', '', '', '', '', '', '', totals.totalLength, '', '', totals.totalClamp, totals.totalWire1, totals.totalWire15, totals.totalScrew, totals.totalMfat, '']);
        rows.push(['مصرفی', `باکس MFAT به تعداد ${totals.totalMfat} عدد`]);
    }
    if (notDoneRoutes.length) {
        rows.push([]);
        rows.push(['❌ مسیرهای انجام‌نشده']);
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'مقصد', 'مبدأ', 'دلیل عدم اجرا']);
        let m = 1;
        notDoneRoutes.forEach(r => {
            rows.push([m++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '', r.team || '', r.destination || '', r.source || '', r.reason || '']);
        });
    }
    return rows;
}

// ---- text ----
function buildDropTextReport(data, type) {
    if (type === 'summary') {
        let text = 'گزارش روزانه کابل‌کشی\n─────────────────────\n\n';
        text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\n\n`;
        text += '─────────────────────\n📊 خلاصه گزارش (تفکیک کابینت)\n─────────────────────\n\n';
        data.cabinets.forEach((cab, idx) => {
            const cabRoutes = [];
            (cab.teams || []).forEach(t => cabRoutes.push(...t.routes));
            const cabDone = cabRoutes.filter(r => r.status !== 'not_done');
            const cabNotDone = cabRoutes.filter(r => r.status === 'not_done');
            const cabTotals = calculateDropTotals({ cabinets: [cab] });
            text += `کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n`;
            text += `  ─────────────────────\n`;
            const cabMetrics = joinNonZeroMetrics([
                ['تعداد کل مسیرها', cabRoutes.length, ''], ['انجام‌شده', cabDone.length, ''], ['انجام‌نشده', cabNotDone.length, ''],
                ['متراژ کل', cabTotals.totalLength, 'متر'], ['بست', cabTotals.totalClamp, 'عدد'],
                ['مفتول 1', cabTotals.totalWire1, 'متر'], ['مفتول 1.5', cabTotals.totalWire15, 'متر'], ['پیچ و رول‌پلاک', cabTotals.totalScrew, 'عدد'],
                ['باکس MFAT مصرفی', cabTotals.totalMfat, 'عدد']
            ], '\n');
            if (cabMetrics) text += cabMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
            const cableDetail = Object.keys(cabTotals.cableTypes).sort().map(k => `${k}Core: ${cabTotals.cableTypes[k]}m`).join(' | ');
            if (cableDetail) text += `  تفکیک کابل: ${cableDetail}\n`;
            if (idx < data.cabinets.length - 1) text += '\n';
        });
        const totals = calculateDropTotals(data);
        text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
        const totalMetrics = joinNonZeroMetrics([
            ['مجموع متراژ کل', totals.totalLength, 'متر'], ['بست', totals.totalClamp, 'عدد'],
            ['مفتول 1', totals.totalWire1, 'متر'], ['مفتول 1.5', totals.totalWire15, 'متر'], ['پیچ و رول‌پلاک', totals.totalScrew, 'عدد'],
            ['باکس MFAT مصرفی', totals.totalMfat, 'عدد']
        ], '\n');
        if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
        const totalCableDetail = Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`).join(' | ');
        if (totalCableDetail) text += `  تفکیک کابل‌ها:             ${totalCableDetail}\n`;
        return text;
    }
    let text = 'گزارش روزانه کابل‌کشی\n─────────────────────\n\n';
    text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\nمسئول تیم دراپ کشی: ${data.reporter}\n\n`;
    data.cabinets.forEach((cab, cabIdx) => {
        const allRoutes = [];
        (cab.teams || []).forEach(t => allRoutes.push(...t.routes));
        const doneRoutes = allRoutes.filter(r => r.status !== 'not_done');
        const notDoneRoutes = allRoutes.filter(r => r.status === 'not_done');
        const cabTotals = calculateDropTotals({ cabinets: [cab] });
        text += `─────────────────────\n📌 کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n─────────────────────\n\n`;
        (cab.teams || []).forEach(team => {
            const teamRoutes = (team.routes || []).filter(r => r.status !== 'not_done');
            const teamNotDone = (team.routes || []).filter(r => r.status === 'not_done');
            if ((team.routes || []).length === 0) return;
            if (teamRoutes.length) {
                text += `✅ تیم ${team.teamName || 'بدون نام'}:\n`;
                teamRoutes.forEach((r, idx) => {
                    text += `  ${idx + 1}. ${r.source || ''} → ${r.destination || ''}\n`;
                    text += `     (${r.startCode || ''}-${r.endCode || ''}) | ${r.length || 0}m | ${r.cableType || ''}Core\n`;
                });
                const teamTotals = calculateDropTotals({ cabinets: [{ teams: [{ routes: teamRoutes }] }] });
                const teamSummary = joinNonZeroMetrics([
                    ['متراژ', teamTotals.totalLength, 'm'], ['بست', teamTotals.totalClamp, ''],
                    ['مفتول1', teamTotals.totalWire1, 'm'], ['مفتول1.5', teamTotals.totalWire15, 'm'], ['پیچ', teamTotals.totalScrew, ''],
                    ['باکس MFAT', teamTotals.totalMfat, 'عدد']
                ]);
                if (teamSummary) text += `  جمع تیم: ${teamSummary}\n\n`;
            }
            if (teamNotDone.length) {
                text += `❌ مسیرهای انجام‌نشده (تیم ${team.teamName || 'بدون نام'}):\n`;
                teamNotDone.forEach((r, idx) => {
                    text += `  ${idx + 1}. ${r.source || ''} → ${r.destination || ''} | دلیل: ${r.reason || 'نامشخص'}\n`;
                });
                text += '\n';
            }
        });
        const cabSummary = joinNonZeroMetrics([
            ['انجام‌شده', doneRoutes.length, ''], ['انجام‌نشده', notDoneRoutes.length, ''], ['متراژ کل', cabTotals.totalLength, 'm'],
            ['بست', cabTotals.totalClamp, ''], ['مفتول1', cabTotals.totalWire1, 'm'], ['مفتول1.5', cabTotals.totalWire15, 'm'], ['پیچ', cabTotals.totalScrew, ''],
            ['باکس MFAT', cabTotals.totalMfat, 'عدد']
        ]);
        if (cabSummary) text += `📊 جمع کابینت: ${cabSummary}\n`;
        if (cabIdx < data.cabinets.length - 1) text += '\n';
    });
    const totals = calculateDropTotals(data);
    text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
    const totalMetrics = joinNonZeroMetrics([
        ['مجموع متراژ کل', totals.totalLength, 'متر'], ['بست', totals.totalClamp, 'عدد'],
        ['مفتول 1', totals.totalWire1, 'متر'], ['مفتول 1.5', totals.totalWire15, 'متر'], ['پیچ و رول‌پلاک', totals.totalScrew, 'عدد'],
        ['باکس MFAT مصرفی', totals.totalMfat, 'عدد']
    ], '\n');
    if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
    const totalCableDetail = Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`).join(' | ');
    if (totalCableDetail) text += `  تفکیک کابل‌ها:             ${totalCableDetail}\n`;
    return text;
}

function buildDropPreviewHTML(data) {
    const css = `
        *{box-sizing:border-box} body{font-family:Tahoma,Arial,sans-serif;background:#f4f7fb;color:#263238;margin:0;padding:24px;direction:rtl}
        .wrap{max-width:1250px;margin:auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 2px 14px #0001}
        h1{text-align:center;color:#1565c0;margin:0 0 8px}.meta{background:#eef4fa;padding:14px;border-radius:10px;line-height:2;margin:18px 0}
        .cab{border:1px solid #d8e2ec;border-radius:12px;margin:18px 0;overflow:hidden}.cab h2{margin:0;padding:11px 15px;background:#eaf2f9;color:#0d47a1;font-size:18px}
        .team,.item{margin:12px 16px;padding:12px;border-radius:9px;background:#fafcff;border:1px solid #e4ebf2}.team h3{margin:0 0 8px;color:#37474f}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}th,td{border:1px solid #dfe6ed;padding:7px;text-align:right;vertical-align:top}th{background:#f0f4f8}
        .done{color:#2e7d32}.notdone{color:#c62828}.summary{background:#f8fafc;border:1px dashed #b0bec5;padding:12px;border-radius:9px;margin-top:14px}
        .cab-summary{background:#eef4fa;padding:8px 12px;border-radius:6px;margin:10px 0;font-weight:bold;border:1px solid #d8e2ec}
        .no-print{display:inline-block;margin:18px auto 0;padding:9px 20px;border:0;border-radius:8px;background:#1565c0;color:#fff;cursor:pointer}
        @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;max-width:none}.no-print{display:none}}
    `;
    const escP = esc;
    let content = `<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>پیش‌نمایش گزارش</title><style>${css}</style></head><body><div class="wrap">`;
    content += `<h1>${escP(data.reportType)} - پیش‌نمایش گزارش</h1>`;
    content += `<div class="meta"><b>تاریخ:</b> ${escP(data.date)} &nbsp;|&nbsp; <b>پیمانکار:</b> ${escP(data.contractor)} &nbsp;|&nbsp; <b>مسئول:</b> ${escP(data.reporter)}</div>`;
    let done = 0, notDone = 0, totalLength = 0;
    data.cabinets.forEach(c => {
        let cabDone = 0, cabNotDone = 0, cabLen = 0;
        let teamRows = '';
        (c.teams || []).forEach(t => {
            const d = (t.routes || []).filter(r => r.status !== 'not_done');
            const n = (t.routes || []).filter(r => r.status === 'not_done');
            cabDone += d.length;
            cabNotDone += n.length;
            const dRows = d.map(r => {
                cabLen += parseFloat(r.length) || 0;
                return `<tr><td>${escP(r.source)}</td><td>${escP(r.destination)}</td><td>${escP(r.startCode)}</td><td>${escP(r.endCode)}</td><td>${escP(r.length || '')}</td><td>${escP(r.cableType)}</td><td>${escP(r.notes)}</td></tr>`;
            }).join('');
            const nRows = n.map(r => `<tr><td>${escP(r.source)}</td><td>${escP(r.destination)}</td><td>${escP(r.reason)}</td></tr>`).join('');
            if (dRows || nRows) {
                teamRows += `<div class="team"><h3>تیم: ${escP(t.teamName)}</h3>`;
                if (dRows) teamRows += `<h4 class="done">✅ انجام‌شده</h4><table><thead><tr><th>مبدأ</th><th>مقصد</th><th>کد ابتدا</th><th>کد انتها</th><th>متراژ</th><th>کابل</th><th>توضیحات</th></tr></thead><tbody>${dRows}</tbody></table>`;
                if (nRows) teamRows += `<h4 class="notdone">❌ انجام‌نشده</h4><table><thead><tr><th>مبدأ</th><th>مقصد</th><th>دلیل</th></tr></thead><tbody>${nRows}</tbody></table>`;
                teamRows += `</div>`;
            }
        });
        done += cabDone;
        notDone += cabNotDone;
        totalLength += cabLen;
        content += `<div class="cab"><h2>کابینت ${escP(c.cabinetNumber)} — ${escP(c.province)} / ${escP(c.city)} / منطقه ${escP(c.region)}</h2>`;
        content += teamRows;
        // ⭐ خلاصه کابینت با MFAT
        const cabPreviewSummary = joinNonZeroMetrics([
            ['انجام‌شده', cabDone, ''],
            ['انجام‌نشده', cabNotDone, ''],
            ['متراژ', cabLen, 'متر'],
            ['باکس MFAT مصرفی', cabDone, 'عدد']
        ]);
        if (cabPreviewSummary) {
            content += `<div class="cab-summary">📊 جمع کابینت: ${cabPreviewSummary}</div>`;
        }
        content += `</div>`;
    });
    // ⭐ خلاصه نهایی با MFAT
    const finalPreviewSummary = joinNonZeroMetrics([
        ['انجام‌شده', done, ''],
        ['انجام‌نشده', notDone, ''],
        ['مجموع متراژ', totalLength, 'متر'],
        ['باکس MFAT مصرفی', done, 'عدد']
    ]);
    content += `<div class="summary"><b>خلاصه:</b> ${finalPreviewSummary}</div><button class="no-print" onclick="window.print()">🖨️ چاپ</button></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
    return content;
}

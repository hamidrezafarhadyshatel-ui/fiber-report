        const shootConfig = {
            key: 'shoot_report_multi',
            reportName: 'گزارش شوت فیبر',
            reportType: 'shoot',
            containerId: 'shootCabinets',
            dateIds: { year: 'shootYear', month: 'shootMonth', day: 'shootDay' },
            contractorId: 'shootContractor',
            reporterId: 'shootReporter',
            validate: function() {
                const common = getCommonFields(this);
                return validateDate(this.dateIds.year, this.dateIds.month, this.dateIds.day) &&
                    common.contractor !== '' && common.reporter !== '';
            },
            collect: function() {
                const common = getCommonFields(this);
                const cabinets = collectShootCabinets();
                return { reportType: this.reportType, date: common.date, contractor: common.contractor,
                    reporter: common.reporter, cabinets };
            },
            render: function(data) {
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
                data.cabinets.forEach(cab => addShootCabinet(cab));
                updateShootSummary();
                setTimeout(() => { document.getElementById(this.contractorId)?.focus(); }, 200);
            },
            prepareExcel: function(data) { return buildShootExcelRows(data); },
            prepareCSV: function(data) { return buildShootCSVRows(data); },
            formatText: function(data, type) { return buildShootTextReport(data, type); },
            previewHTML: function(data) { return buildShootPreviewHTML(data); },
            columnWidths: [
                { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
                { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
            ]
        };

        // ---- عمران ----
        function toggleShootRouteStatus(btn, status) {
            const route = btn.closest('.shoot-route');
            if (!route) return;
            const statusInput = route.querySelector('[data-shoot-status]');
            if (statusInput) statusInput.value = status;
            const doneFields = route.querySelector('.done-fields');
            const notDoneFields = route.querySelector('.not-done-fields');
            const reasonInput = route.querySelector('[data-shoot="reason"]');

            if (status === 'done') {
                route.classList.remove('not-done-mode');
                doneFields.style.display = '';
                notDoneFields.style.display = 'none';
                if (reasonInput) reasonInput.removeAttribute('required');
                const doneBtn = route.querySelector('.toggle-done');
                const notDoneBtn = route.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            } else {
                route.classList.add('not-done-mode');
                doneFields.style.display = 'none';
                notDoneFields.style.display = '';
                if (reasonInput) reasonInput.setAttribute('required', 'required');
                const doneBtn = route.querySelector('.toggle-done');
                const notDoneBtn = route.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            }
            updateShootSummary();
        }

        function calcShootLength(startCode, endCode) {
            const s = parseInt(String(startCode).replace(/[^0-9]/g, ''));
            const e = parseInt(String(endCode).replace(/[^0-9]/g, ''));
            if (isNaN(s) || isNaN(e)) return '';
            const diff = Math.abs(e - s);
            return diff > 0 ? String(diff) : '';
        }

function autoCalcShootLength(routeEl) {
    const start = routeEl.querySelector('[data-shoot="startCode"]');
    const end = routeEl.querySelector('[data-shoot="endCode"]');
    const len = routeEl.querySelector('[data-shoot="length"]');
    if (!start || !end || !len) return;
    const val = calcShootLength(start.value, end.value);
    len.value = val || '';
    len.disabled = true;
    updateShootSummary();
}

        function addShootDestination(routeEl, data) {
            const container = routeEl.querySelector('.shoot-destinations');
            const num = container.querySelectorAll('.shoot-destination-item').length + 1;
            const item = document.createElement('div');
            item.className = 'shoot-destination-item';
            item.innerHTML = `
                <span class="dest-index">مقصد ${num}:</span>
                <input type="text" class="shoot-dest-input" value="${esc(data || '')}" placeholder="شماره یا نام باکس مقصد">
                <button type="button" class="dest-remove" onclick="this.closest('.shoot-destination-item').remove(); updateShootSummary();">✕</button>
            `;
            container.appendChild(item);
            const input = item.querySelector('.shoot-dest-input');
            if (input) {
                input.addEventListener('input', updateShootSummary);
                setTimeout(() => { input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
            }
            updateShootSummary();
        }

        function collectShootCabinets() {
            const cabinets = [];
            document.querySelectorAll('#shootCabinets .cabinet-block').forEach(cabEl => {
                const cabinetNumber = cabEl.querySelector('.cabinet-number')?.value?.trim() || '';
                const province = cabEl.querySelector('.cabinet-province')?.value?.trim() || '';
                const city = cabEl.querySelector('.cabinet-city')?.value?.trim() || '';
                const region = cabEl.querySelector('.cabinet-region')?.value?.trim() || '';
                const teams = [];
                cabEl.querySelectorAll('.shoot-team').forEach(teamEl => {
                    const teamName = teamEl.querySelector('.shoot-team-name')?.value?.trim() || '';
                    const routes = [];
                    teamEl.querySelectorAll('.shoot-route').forEach(routeEl => {
                        const status = routeEl.querySelector('[data-shoot-status]')?.value ||
                            'done';
                        const o = { status };
                        const routeName = routeEl.querySelector('[data-shoot="routeName"]')?.value?.trim() || '';
                        const source = routeEl.querySelector('[data-shoot="source"]')?.value?.trim() || '';
                        const destInputs = routeEl.querySelectorAll('.shoot-dest-input');
                        const destinations = [];
                        destInputs.forEach(inp => {
                            const val = inp.value.trim();
                            if (val) destinations.push(val);
                        });
                        o.routeName = routeName;
                        o.source = source;
                        o.destinations = destinations;

                        if (status === 'done') {
                            routeEl.querySelectorAll('.done-fields [data-shoot]').forEach(x => {
                                o[x.dataset.shoot] = x.value.trim();
                            });
                            if (!o.length || o.length === '') {
                                const len = calcShootLength(o.startCode, o.endCode);
                                if (len) o.length = len;
                            }
                        } else {
                            routeEl.querySelectorAll('.not-done-fields [data-shoot]').forEach(x => {
                                o[x.dataset.shoot] = x.value.trim();
                            });
                        }
                        if (o.routeName || o.source || o.destinations?.length) routes.push(o);
                    });
                    if (teamName || routes.length > 0) teams.push({ teamName, routes });
                });
                if (cabinetNumber || teams.length > 0) {
                    cabinets.push({ cabinetNumber, province, city, region, teams });
                }
            });
            return cabinets;
        }

        function validateShootRoutesInTeam(teamEl) {
            const routeEls = teamEl.querySelectorAll('.shoot-route');
            let hasError = false;
            let errorMsg = '';
            routeEls.forEach(route => {
                const status = route.querySelector('[data-shoot-status]')?.value || 'done';
                const routeName = route.querySelector('[data-shoot="routeName"]')?.value?.trim() || '';
                const source = route.querySelector('[data-shoot="source"]')?.value?.trim() || '';
                const destInputs = route.querySelectorAll('.shoot-dest-input');
                const hasDest = Array.from(destInputs).some(inp => inp.value.trim() !== '');
                if (status === 'done') {
                    const startCode = route.querySelector('[data-shoot="startCode"]')?.value?.trim() || '';
                    const endCode = route.querySelector('[data-shoot="endCode"]')?.value?.trim() || '';
                    const cableType = route.querySelector('[data-shoot="cableType"]')?.value || '';
                    if (!routeName || !source || !hasDest || !startCode || !endCode || !cableType) {
                        hasError = true;
                        errorMsg = 'مسیر شوت انجام‌شده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
                    }
                } else {
                    const reason = route.querySelector('[data-shoot="reason"]')?.value?.trim() || '';
                    if (!routeName || !source || !hasDest || !reason) {
                        hasError = true;
                        errorMsg = 'مسیر شوت انجام‌نشده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
                    }
                }
            });
            return { ok: !hasError, message: errorMsg };
        }

        function validateShootTeamInCabinet(cabinetEl) {
            const teamEls = cabinetEl.querySelectorAll('.shoot-team');
            for (const team of teamEls) {
                const result = validateShootRoutesInTeam(team);
                if (!result.ok) return result;
            }
            return { ok: true };
        }

        document.getElementById('shootAddCabinet').addEventListener('click', function() {
            const container = document.getElementById('shootCabinets');
            const lastCabinet = container.lastElementChild;
            if (lastCabinet) {
                const validation = validateShootTeamInCabinet(lastCabinet);
                if (!validation.ok) {
                    showToast(validation.message, true);
                    return;
                }
            }
            addShootCabinet();
        });

        function addShootCabinet(data) {
			const container = document.getElementById('shootCabinets');
			const cabId = getNextCabinetId(container);
			const cabDiv = document.createElement('div');
			cabDiv.className = 'cabinet-block';
			cabDiv.dataset.cid = cabId;
			cabDiv.innerHTML = `
				<div class="cabinet-header">
					<strong>کابینت ${cabId}</strong>
					<div class="cabinet-actions">
						<button type="button" class="danger" onclick="this.closest('.cabinet-block').remove(); updateShootSummary();">🗑️ حذف</button>
					</div>
				</div>
				${buildCabinetGridHTML(cabId, 'shootCabinets')}
				<div class="shoot-teams-container"></div>
				<button type="button" class="secondary" onclick="
					const cab = this.closest('.cabinet-block');
					const validation = validateShootTeamInCabinet(cab);
					if (!validation.ok) {
						showToast(validation.message, true);
						return;
					}
					addShootTeam(cab);
				" style="margin-top:8px;">＋ افزودن تیم</button>
			`;
			container.appendChild(cabDiv);
			bindCabinetSelectors(cabDiv, data, 'updateShootSummary');
			if (data?.teams?.length) {
				data.teams.forEach(t => addShootTeam(cabDiv, t));
			} else {
				addShootTeam(cabDiv);
			}
			cabDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateShootSummary));
			updateShootSummary();
			const regionSel = cabDiv.querySelector('.cabinet-region');
			if (regionSel) setTimeout(() => { regionSel.focus();
				regionSel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
		}

        function addShootTeam(cabinetEl, data) {
            const container = cabinetEl.querySelector('.shoot-teams-container');
            const teamDiv = document.createElement('div');
            teamDiv.className = 'shoot-team';
            teamDiv.innerHTML = `
                <div class="team-header">
                    <strong>تیم</strong>
                    <button type="button" class="danger" onclick="this.closest('.shoot-team').remove(); updateShootSummary();">حذف</button>
                </div>
                <div class="shoot-team-row">
                    <div class="field"><label>نام تیم <span class="required">*</span></label>
                        <input class="shoot-team-name history-field" required value="${esc(data?.teamName||'')}" placeholder="نام تیم">
                    </div>
                </div>
                <div class="shoot-routes-container">
                    ${(data?.routes||[]).map(r => {
                        const status = r.status || 'done';
                        const dests = r.destinations || [];
                        return `
                            <div class="shoot-route${status === 'not_done' ? ' not-done-mode' : ''}">
                                <div class="not-done-warning">⚠️ این مسیر انجام نشده ثبت می‌شود</div>
                                <div class="routehead">
                                    <strong>مسیر</strong>
                                    <div class="route-status-buttons">
                                        <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleShootRouteStatus(this, 'done')">✔ انجام‌شده</button>
                                        <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleShootRouteStatus(this, 'not_done')">✖ انجام‌نشده</button>
                                    </div>
                                    <button type="button" class="danger" onclick="this.closest('.shoot-route').remove(); updateShootSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
                                </div>
                                <div class="grid">
                                    <div class="field"><label>نام مسیر <span class="required">*</span></label>
                                        <input data-shoot="routeName" required value="${esc(r.routeName)}" placeholder="مثل A, B, UPLINK"></div>
                                    <div class="field"><label>مبدأ <span class="required">*</span></label>
                                        <input data-shoot="source" type="text" required value="${esc(r.source)}" placeholder="شماره یا نام باکس مبدأ"></div>
                                    <div class="field full">
                                        <label>مقاصد <span class="required">*</span></label>
                                        <div class="shoot-destinations">
                                            ${dests.map((d, idx) => `
                                                <div class="shoot-destination-item">
                                                    <span class="dest-index">مقصد ${idx+1}:</span>
                                                    <input type="text" class="shoot-dest-input" value="${esc(d)}" placeholder="شماره یا نام باکس مقصد">
                                                    <button type="button" class="dest-remove" onclick="this.closest('.shoot-destination-item').remove(); updateShootSummary();">✕</button>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <button type="button" class="add-destination-btn" onclick="addShootDestination(this.closest('.shoot-route'))">＋ افزودن مقصد</button>
                                    </div>
                                </div>
                                <div class="done-fields" style="display:${status === 'done' ? '' : 'none'};">
                                    <div class="grid">
                                        <div class="field"><label>کد ابتدا <span class="required">*</span></label>
                                            <input data-shoot="startCode" type="number" required value="${esc(r.startCode)}" placeholder="1000"></div>
                                        <div class="field"><label>کد انتها <span class="required">*</span></label>
                                            <input data-shoot="endCode" type="number" required value="${esc(r.endCode)}" placeholder="880"></div>
                                        <div class="field full"><label>طول فیبر (متر) <span class="unit">(خودکار)</span></label>
                                            <input data-shoot="length" type="number" value="${esc(r.length)}" disabled></div>
                                        <div class="field"><label>نوع کابل شوت‌شده <span class="required">*</span></label>
                                            <select data-shoot="cableType" required>
                                                <option value="">انتخاب</option>
                                                ${['6','12','24','48','72'].map(x => `<option value="${x}" ${String(r.cableType)===x?'selected':''}>${x} کر</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="field full"><label>توضیحات</label>
                                            <textarea data-shoot="notes" placeholder="اختیاری">${esc(r.notes)}</textarea>
                                        </div>
                                    </div>
                                </div>
                                <div class="not-done-fields" style="display:${status === 'not_done' ? '' : 'none'};">
                                    <div class="grid">
                                        <div class="field full"><label>دلیل عدم اجرا <span class="required">*</span></label>
                                            <textarea data-shoot="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="دلیل">${esc(r.reason)}</textarea>
                                        </div>
                                    </div>
                                </div>
                                <input type="hidden" data-shoot-status value="${status}">
                            </div>
                        `;
                    }).join('')}
                </div>
                <button type="button" class="secondary" onclick="
                    const team = this.closest('.shoot-team');
                    const validation = validateShootRoutesInTeam(team);
                    if (!validation.ok) {
                        showToast(validation.message, true);
                        return;
                    }
                    addShootRoute(team);
                " style="margin-top:8px;">＋ افزودن مسیر شوت</button>
            `;
            container.appendChild(teamDiv);
            const teamNameInput = teamDiv.querySelector('.shoot-team-name');
            if (teamNameInput) setupFieldHistory(teamNameInput, 'shoot_team_history');
            teamDiv.querySelectorAll('.shoot-route').forEach(route => {
                const start = route.querySelector('[data-shoot="startCode"]');
                const end = route.querySelector('[data-shoot="endCode"]');
                if (start && end) {
                    const update = () => autoCalcShootLength(route);
                    start.addEventListener('input', update);
                    end.addEventListener('input', update);
                    if (start.value || end.value) setTimeout(update, 50);
                }
                route.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input',
                    updateShootSummary));
            });
            if (!data?.routes?.length) addShootRoute(teamDiv);
            updateShootSummary();
            if (teamNameInput) setTimeout(() => { teamNameInput.focus();
                teamNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
        }

        function addShootRoute(teamEl, data) {
            const container = teamEl.querySelector('.shoot-routes-container');
            const status = data?.status || 'done';
            const dests = data?.destinations || [];
            const routeDiv = document.createElement('div');
            routeDiv.className = 'shoot-route' + (status === 'not_done' ? ' not-done-mode' : '');
            routeDiv.innerHTML = `
                <div class="not-done-warning">⚠️ این مسیر انجام نشده ثبت می‌شود</div>
                <div class="routehead">
                    <strong>مسیر</strong>
                    <div class="route-status-buttons">
                        <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleShootRouteStatus(this, 'done')">✔ انجام‌شده</button>
                        <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleShootRouteStatus(this, 'not_done')">✖ انجام‌نشده</button>
                    </div>
                    <button type="button" class="danger" onclick="this.closest('.shoot-route').remove(); updateShootSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
                </div>
                <div class="grid">
                    <div class="field"><label>نام مسیر <span class="required">*</span></label>
                        <input data-shoot="routeName" required value="${esc(data?.routeName)}" placeholder="مثل A, B, UPLINK"></div>
                    <div class="field"><label>مبدأ <span class="required">*</span></label>
                        <input data-shoot="source" type="text" required value="${esc(data?.source)}" placeholder="شماره یا نام باکس مبدأ"></div>
                    <div class="field full">
                        <label>مقاصد <span class="required">*</span></label>
                        <div class="shoot-destinations">
                            ${dests.map((d, idx) => `
                                <div class="shoot-destination-item">
                                    <span class="dest-index">مقصد ${idx+1}:</span>
                                    <input type="text" class="shoot-dest-input" value="${esc(d)}" placeholder="شماره یا نام باکس مقصد">
                                    <button type="button" class="dest-remove" onclick="this.closest('.shoot-destination-item').remove(); updateShootSummary();">✕</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="add-destination-btn" onclick="addShootDestination(this.closest('.shoot-route'))">＋ افزودن مقصد</button>
                    </div>
                </div>
                <div class="done-fields" style="display:${status === 'done' ? '' : 'none'};">
                    <div class="grid">
                        <div class="field"><label>کد ابتدا <span class="required">*</span></label>
                            <input data-shoot="startCode" type="number" required value="${esc(data?.startCode)}" placeholder="1000"></div>
                        <div class="field"><label>کد انتها <span class="required">*</span></label>
                            <input data-shoot="endCode" type="number" required value="${esc(data?.endCode)}" placeholder="880"></div>
                        <div class="field full"><label>طول فیبر (متر) <span class="unit">(خودکار)</span></label>
                            <input data-shoot="length" type="number" value="${esc(data?.length)}" disabled></div>
                        <div class="field"><label>نوع کابل شوت‌شده <span class="required">*</span></label>
                            <select data-shoot="cableType" required>
                                <option value="">انتخاب</option>
                                ${['6','12','24','48','72'].map(x => `<option value="${x}" ${String(data?.cableType)===x?'selected':''}>${x} کر</option>`).join('')}
                            </select>
                        </div>
                        <div class="field full"><label>توضیحات</label>
                            <textarea data-shoot="notes" placeholder="اختیاری">${esc(data?.notes)}</textarea>
                        </div>
                    </div>
                </div>
                <div class="not-done-fields" style="display:${status === 'not_done' ? '' : 'none'};">
                    <div class="grid">
                        <div class="field full"><label>دلیل عدم اجرا <span class="required">*</span></label>
                            <textarea data-shoot="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="دلیل">${esc(data?.reason)}</textarea>
                        </div>
                    </div>
                </div>
                <input type="hidden" data-shoot-status value="${status}">
            `;
            container.appendChild(routeDiv);
            const start = routeDiv.querySelector('[data-shoot="startCode"]');
            const end = routeDiv.querySelector('[data-shoot="endCode"]');
            if (start && end) {
                const update = () => autoCalcShootLength(routeDiv);
                start.addEventListener('input', update);
                end.addEventListener('input', update);
                if (start.value || end.value) setTimeout(update, 50);
            }
            routeDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateShootSummary));
            updateShootSummary();
            const routeName = routeDiv.querySelector('[data-shoot="routeName"]');
            if (routeName) setTimeout(() => { routeName.focus();
                routeName.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
        }

        function updateShootSummary() {
            const data = collectShootCabinets();
            const totalRoutes = data.reduce((s, c) => s + (c.teams ? c.teams.reduce((a, t) => a + t.routes.length, 0) :
            0), 0);
            const el = document.getElementById('shootSummary');
            if (!totalRoutes) { el.textContent = 'هنوز کابینتی اضافه نشده است.'; return; }
            const doneCount = data.reduce((s, c) => s + (c.teams ? c.teams.reduce((a, t) => a + t.routes.filter(r => r
                .status !== 'not_done').length, 0) : 0), 0);
            const notDoneCount = totalRoutes - doneCount;
            let totalLength = 0;
            data.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.routes?.filter(r => r.status !== 'not_done').forEach(r => {
                        totalLength += parseFloat(r.length) || 0;
                    });
                });
            });
            el.innerHTML =
                `کابینت‌ها: <b>${data.length}</b>　| کل مسیرهای شوت: <b>${totalRoutes}</b> (انجام‌شده: <b>${doneCount}</b> | انجام‌نشده: <b>${notDoneCount}</b>)　| مجموع طول فیبر: <b>${totalLength}</b> متر`;
        }

        function calculateShootTotals(data) {
            const totals = { totalLength: 0, cableTypes: {} };
            data.cabinets.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.routes?.filter(r => r.status !== 'not_done').forEach(r => {
                        totals.totalLength += parseFloat(r.length) || 0;
                        const type = r.cableType || '12';
                        totals.cableTypes[type] = (totals.cableTypes[type] || 0) + (parseFloat(r
                            .length) || 0);
                    });
                });
            });
            return totals;
        }

        function buildShootExcelRows(data) {
            const allRoutes = [];
            data.cabinets.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.routes?.forEach(r => {
                        allRoutes.push({ ...r, cabinet: cab.cabinetNumber, province: cab.province,
                            city: cab.city, region: cab.region, teamName: team.teamName });
                    });
                });
            });
            const doneRoutes = allRoutes.filter(r => r.status !== 'not_done');
            const notDoneRoutes = allRoutes.filter(r => r.status === 'not_done');
            const rows = [
                ['گزارش شوت فیبر', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول شوت فیبر', data.reporter],
                [],
                ['✅ مسیرهای انجام‌شده']
            ];
            let n = 1;
            if (doneRoutes.length) {
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نام مسیر', 'مبدأ', 'مقاصد',
                    'کد ابتدا', 'کد انتها', 'طول (متر)', 'نوع کابل', 'توضیحات'
                ]);
                doneRoutes.forEach(r => {
                    rows.push([
                        n++, data.date, r.cabinet || '', r.province || '', r.city || '',
                        r.region || '', r.teamName || '', r.routeName || '', r.source || '',
                        (r.destinations || []).join(' → '), r.startCode || '', r.endCode || '',
                        parseFloat(r.length) || 0, r.cableType || '', r.notes || ''
                    ]);
                });
            }
            if (doneRoutes.length) {
                const totals = calculateShootTotals(data);
                rows.push([]);
                rows.push(['جمع کل (انجام‌شده)', '', '', '', '', '', '', '', '', '', '', '', totals.totalLength,
                    '', ''
                ]);
                const cableDetail = Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`)
                    .join(' | ');
                rows.push(['تفکیک کابل‌ها', cableDetail]);
            }
            if (notDoneRoutes.length) {
                rows.push([]);
                rows.push(['❌ مسیرهای انجام‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نام مسیر', 'مبدأ', 'مقاصد',
                    'دلیل عدم اجرا'
                ]);
                let m = 1;
                notDoneRoutes.forEach(r => {
                    rows.push([
                        m++, data.date, r.cabinet || '', r.province || '', r.city || '',
                        r.region || '', r.teamName || '', r.routeName || '', r.source || '',
                        (r.destinations || []).join(' → '), r.reason || ''
                    ]);
                });
            }
            return rows;
        }

        function buildShootCSVRows(data) {
            const allRoutes = [];
            data.cabinets.forEach(cab => {
                (cab.teams || []).forEach(team => {
                    (team.routes || []).forEach(r => {
                        allRoutes.push({
                            ...r,
                            cabinet: cab.cabinetNumber,
                            province: cab.province,
                            city: cab.city,
                            region: cab.region,
                            teamName: team.teamName
                        });
                    });
                });
            });
            const doneRoutes = allRoutes.filter(r => r.status !== 'not_done');
            const notDoneRoutes = allRoutes.filter(r => r.status === 'not_done');
            const rows = [
                ['گزارش شوت فیبر', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول شوت فیبر', data.reporter],
                [],
                ['✅ مسیرهای انجام‌شده'],
                ['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نام مسیر', 'مبدأ', 'مقاصد',
                    'کد ابتدا', 'کد انتها', 'طول (متر)', 'نوع کابل', 'توضیحات']
            ];
            let n = 1;
            doneRoutes.forEach(r => {
                rows.push([
                    n++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '',
                    r.teamName || '', r.routeName || '', r.source || '', (r.destinations || []).join(' → '),
                    r.startCode || '', r.endCode || '', parseFloat(r.length) || 0, r.cableType || '', r.notes || ''
                ]);
            });
            if (doneRoutes.length) {
                const totals = calculateShootTotals(data);
                rows.push([]);
                rows.push(['جمع کل (انجام‌شده)', '', '', '', '', '', '', '', '', '', '', '', totals.totalLength, '', '']);
                rows.push(['تفکیک کابل‌ها', Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`).join(' | ')]);
            }
            if (notDoneRoutes.length) {
                rows.push([]);
                rows.push(['❌ مسیرهای انجام‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نام مسیر', 'مبدأ', 'مقاصد', 'دلیل عدم اجرا']);
                let m = 1;
                notDoneRoutes.forEach(r => {
                    rows.push([
                        m++, data.date, r.cabinet || '', r.province || '', r.city || '', r.region || '',
                        r.teamName || '', r.routeName || '', r.source || '', (r.destinations || []).join(' → '),
                        r.reason || ''
                    ]);
                });
            }
            return rows;
        }

        function buildShootTextReport(data, type) {
            if (type === 'summary') {
                let text = 'گزارش روزانه شوت فیبر\n─────────────────────\n\n';
                text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\n\n`;
                text += '─────────────────────\n📊 خلاصه گزارش (تفکیک کابینت)\n─────────────────────\n\n';

                data.cabinets.forEach((cab, idx) => {
                    let cabRoutes = [];
                    cab.teams?.forEach(t => cabRoutes.push(...t.routes));
                    const doneRoutes = cabRoutes.filter(r => r.status !== 'not_done');
                    const notDoneRoutes = cabRoutes.filter(r => r.status === 'not_done');
                    const cabTotals = calculateShootTotals({ cabinets: [cab] });

                    text += `کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n`;
                    text += `  ─────────────────────\n`;
                    const cabMetrics = joinNonZeroMetrics([
                        ['تعداد کل مسیرها', cabRoutes.length, ''], ['انجام‌شده', doneRoutes.length, ''],
                        ['انجام‌نشده', notDoneRoutes.length, ''], ['مجموع متراژ', cabTotals.totalLength, 'متر']
                    ], '\n');
                    if (cabMetrics) text += cabMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
                    const cableDetail = Object.keys(cabTotals.cableTypes).sort().map(k => `${k}Core: ${cabTotals.cableTypes[k]}m`).join(' | ');
                    if (cableDetail) text += `  تفکیک کابل:              ${cableDetail}\n`;
                    if (idx < data.cabinets.length - 1) text += '\n';
                });

                const totals = calculateShootTotals(data);
                text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
                const totalLengthMetric = nonZeroMetric('مجموع متراژ کل', totals.totalLength, 'متر');
                if (totalLengthMetric) text += `  ${totalLengthMetric}\n`;
                const totalCableDetail = Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`).join(' | ');
                if (totalCableDetail) text += `  تفکیک کابل‌ها:             ${totalCableDetail}\n`;

                return text;
            }

            let text = 'گزارش روزانه شوت فیبر\n─────────────────────\n\n';
            text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\nمسئول شوت فیبر: ${data.reporter}\n\n`;

            data.cabinets.forEach((cab, cabIdx) => {
                text += `─────────────────────\n📌 کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n─────────────────────\n\n`;

                cab.teams?.forEach((team, teamIdx) => {
                    const routes = team.routes || [];
                    const doneRoutes = routes.filter(r => r.status !== 'not_done');
                    const notDoneRoutes = routes.filter(r => r.status === 'not_done');

                    if (routes.length === 0) return;

                    text += `✅ تیم ${team.teamName || 'بدون نام'}:\n`;
                    doneRoutes.forEach((r, idx) => {
                        const destStr = (r.destinations || []).join(' → ');
                        text += `  ${idx+1}. ${r.routeName || ''} | ${r.source || ''} → ${destStr}\n`;
                        text += `     (${r.startCode || ''}-${r.endCode || ''}) | ${r.length || 0}m | ${r.cableType || ''}Core\n`;
                        if (r.notes) text += `     توضیحات: ${r.notes}\n`;
                    });
                    if (notDoneRoutes.length) {
                        text += `  ❌ انجام‌نشده:\n`;
                        notDoneRoutes.forEach((r, idx) => {
                            const destStr = (r.destinations || []).join(' → ');
                            text += `    ${idx+1}. ${r.routeName || ''} | ${r.source || ''} → ${destStr} | دلیل: ${r.reason || 'نامشخص'}\n`;
                        });
                    }
                    const teamTotals = calculateShootTotals({ cabinets: [{ teams: [team] }] });
                    text += `  جمع تیم: ${teamTotals.totalLength}m | تفکیک: ${Object.keys(teamTotals.cableTypes).sort().map(k => `${k}Core: ${teamTotals.cableTypes[k]}m`).join(' | ')}\n`;
                    if (teamIdx < cab.teams.length - 1) text += '\n';
                });

                const cabTotals = calculateShootTotals({ cabinets: [cab] });
                const allRoutes = [];
                cab.teams?.forEach(t => allRoutes.push(...t.routes));
                const doneInCab = allRoutes.filter(r => r.status !== 'not_done');
                const notDoneInCab = allRoutes.filter(r => r.status === 'not_done');
                const cabSummary = joinNonZeroMetrics([['انجام‌شده', doneInCab.length, ''], ['انجام‌نشده', notDoneInCab.length, ''], ['متراژ کل', cabTotals.totalLength, 'm']]);
                if (cabSummary) text += `\n📊 جمع کابینت: ${cabSummary}\n`;
                const cableDetail = Object.keys(cabTotals.cableTypes).sort().map(k => `${k}Core: ${cabTotals.cableTypes[k]}m`).join(' | ');
                if (cableDetail) text += `   تفکیک کابل: ${cableDetail}\n`;
                if (cabIdx < data.cabinets.length - 1) text += '\n';
            });

            const totals = calculateShootTotals(data);
            text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
            text += `  مجموع متراژ کل:            ${totals.totalLength} متر\n`;
            const totalCableDetail = Object.keys(totals.cableTypes).sort().map(k => `${k}Core: ${totals.cableTypes[k]}m`).join(' | ');
            if (totalCableDetail) text += `  تفکیک کابل‌ها:             ${totalCableDetail}\n`;

            return text;
        }

        function buildShootPreviewHTML(data) {
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

            let totalDone = 0, totalNotDone = 0, totalLength = 0;
            const cableTotals = {};
            data.cabinets.forEach(c => {
                let cabDone = 0, cabNotDone = 0, cabLen = 0;
                const cabCables = {};
                let teamRows = '';
                (c.teams || []).forEach(t => {
                    const routes = t.routes || [];
                    const d = routes.filter(r => r.status !== 'not_done');
                    const n = routes.filter(r => r.status === 'not_done');
                    cabDone += d.length;
                    cabNotDone += n.length;
                    d.forEach(r => {
                        const len = parseFloat(r.length) || 0;
                        cabLen += len;
                        const type = r.cableType || '';
                        cabCables[type] = (cabCables[type] || 0) + len;
                    });
                    const dRows = d.map(r => {
                        const destStr = (r.destinations || []).join(' → ');
                        const len = parseFloat(r.length) || 0;
                        return `<tr><td>${escP(r.routeName)}</td><td>${escP(r.source)}</td><td>${escP(destStr)}</td><td>${escP(r.startCode)}</td><td>${escP(r.endCode)}</td><td>${len}</td><td>${escP(r.cableType)}</td><td>${escP(r.notes)}</td></tr>`;
                    }).join('');
                    const nRows = n.map(r => {
                        const destStr = (r.destinations || []).join(' → ');
                        return `<tr><td>${escP(r.routeName)}</td><td>${escP(r.source)}</td><td>${escP(destStr)}</td><td>${escP(r.reason)}</td></tr>`;
                    }).join('');
                    if (dRows || nRows) {
                        teamRows += `<div class="team"><h3>تیم: ${escP(t.teamName)}</h3>`;
                        if(dRows) teamRows += `<h4 class="done">✅ انجام‌شده</h4><table><thead><tr><th>مسیر</th><th>مبدأ</th><th>مقاصد</th><th>کد ابتدا</th><th>کد انتها</th><th>متراژ</th><th>کابل</th><th>توضیحات</th></tr></thead><tbody>${dRows}</tbody></table>`;
                        if(nRows) teamRows += `<h4 class="notdone">❌ انجام‌نشده</h4><table><thead><tr><th>مسیر</th><th>مبدأ</th><th>مقاصد</th><th>دلیل</th></tr></thead><tbody>${nRows}</tbody></table>`;
                        teamRows += `</div>`;
                    }
                });
                totalDone += cabDone;
                totalNotDone += cabNotDone;
                totalLength += cabLen;
                Object.keys(cabCables).forEach(k => { cableTotals[k] = (cableTotals[k] || 0) + cabCables[k]; });
                content += `<div class="cab"><h2>کابینت ${escP(c.cabinetNumber)} — ${escP(c.province)} / ${escP(c.city)} / منطقه ${escP(c.region)}</h2>`;
                content += teamRows;
                const cableSummary = Object.keys(cabCables).sort().map(k => `${k}Core: ${cabCables[k]} متر`).join(' | ');
                const cabPreviewSummary = joinNonZeroMetrics([['انجام‌شده', cabDone, ''], ['انجام‌نشده', cabNotDone, ''], ['متراژ', cabLen, 'متر']]);
                content += `<div class="cab-summary">📊 جمع کابینت: ${cabPreviewSummary}${cableSummary ? (cabPreviewSummary ? ' | ' : '') + cableSummary : ''}</div>`;
                content += `</div>`;
            });
            const finalCableSummary = Object.keys(cableTotals).sort().map(k => `${k}Core: ${cableTotals[k]} متر`).join(' | ');
            const finalPreviewSummary = joinNonZeroMetrics([['انجام‌شده', totalDone, ''], ['انجام‌نشده', totalNotDone, ''], ['مجموع متراژ', totalLength, 'متر']]);
            content += `<div class="summary"><b>خلاصه نهایی:</b> ${finalPreviewSummary}${finalCableSummary ? (finalPreviewSummary ? ' | ' : '') + finalCableSummary : ''}</div><button class="no-print" onclick="window.print()">🖨️ چاپ</button></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
            return content;

        }

        // ---- عمران ----

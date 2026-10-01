        const omranConfig = {
            key: 'omran_report_multi',
            reportName: 'گزارش عمران',
            reportType: 'omran',
            containerId: 'omranCabinets',
            dateIds: { year: 'omranYear', month: 'omranMonth', day: 'omranDay' },
            contractorId: 'omranContractor',
            reporterId: 'omranReporter',
            validate: function() {
                const common = getCommonFields(this);
                return validateDate(this.dateIds.year, this.dateIds.month, this.dateIds.day) &&
                    common.contractor !== '' && common.reporter !== '';
            },
            collect: function() {
                const common = getCommonFields(this);
                const cabinets = collectOmranCabinets();
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
                data.cabinets.forEach(cab => addOmranCabinet(cab));
                updateOmranSummary();
                setTimeout(() => { document.getElementById(this.contractorId)?.focus(); }, 200);
            },
            prepareExcel: function(data) { return buildOmranExcelRows(data); },
            prepareCSV: function(data) { return buildOmranCSVRows(data); },
            formatText: function(data, type) { return buildOmranTextReport(data, type); },
            previewHTML: function(data) { return buildOmranPreviewHTML(data); },
            columnWidths: [
                { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
                { wch: 15 }, { wch: 25 }
            ]
        };

        // ================================================================
        //  بخش ۴: پیاده‌سازی توابع اختصاصی هر گزارش (به‌صورت کامل)
        // ================================================================

        // ---- دراپ کشی (بدون تغییر) ----
        const OMRAN_ITEM_TYPES = [
            { value: 'نصب کابینت', unit: 'عدد', autoFromCabinet: true },
            { value: 'نصب هندهول', unit: 'عدد', autoFromCabinet: true },
            { value: 'حفاری زیر جوی', unit: 'عدد', autoFromCabinet: false },
            { value: 'حفاری دستی', unit: 'متر', autoFromCabinet: false },
            { value: 'حفاری پیاده رو', unit: 'عدد', autoFromCabinet: false },
            { value: 'حفاری ترنچر', unit: 'متر', autoFromCabinet: false },
            { value: 'میکروداکت ۸/۵', unit: 'متر', autoFromCabinet: false },
            { value: 'میکروداکت ۱۴/۱۰', unit: 'متر', autoFromCabinet: false },
            { value: 'آسفالت', unit: 'متر', autoFromCabinet: false },
            { value: 'فایبر', unit: 'عدد', autoFromCabinet: false }
        ];

        // ===== توابع اعتبارسنجی عمران =====
        function validateOmranItemsInTeam(teamEl) {
            const itemEls = teamEl.querySelectorAll('.omran-item');
            let hasError = false;
            let errorMsg = '';
            itemEls.forEach(item => {
                const status = item.querySelector('[data-omran-status]')?.value || 'done';
                const activeFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
                const type = item.querySelector(`${activeFields} [data-omran="type"]`)?.value?.trim() || '';
                if (!type) {
                    hasError = true;
                    errorMsg = 'نوع عملیات برای آیتم عمران الزامی است.';
                    return;
                }
                if (type === 'نصب هندهول') {
                    const handholeName = item.querySelector(`${activeFields} [data-omran="handholeName"]`)?.value?.trim() || '';
                    if (!handholeName) {
                        hasError = true;
                        errorMsg = 'برای «نصب هندهول»، نام هندهول الزامی است.';
                        return;
                    }
                }
                if (status === 'done') {
                    if (type !== 'نصب کابینت' && type !== 'نصب هندهول') {
                        const value = item.querySelector(`${activeFields} [data-omran="value"]`)?.value?.trim() || '';
                        if (value === '' || isNaN(parseFloat(value))) {
                            hasError = true;
                            errorMsg = `مقدار برای عملیات «${type}» الزامی است.`;
                        }
                    }
                } else {
                    const reason = item.querySelector(`${activeFields} [data-omran="reason"]`)?.value?.trim() || '';
                    if (!reason) {
                        hasError = true;
                        errorMsg = `توضیحات/دلیل عدم اجرا برای آیتم «${type}» الزامی است.`;
                    }
                }
            });
            return { ok: !hasError, message: errorMsg };
        }

        function validateOmranTeamInCabinet(cabinetEl) {
            const teamEls = cabinetEl.querySelectorAll('.omran-team');
            for (const team of teamEls) {
                const result = validateOmranItemsInTeam(team);
                if (!result.ok) return result;
            }
            return { ok: true };
        }

        // اصلاح تابع toggleOmranItemStatus
        function toggleOmranItemStatus(btn, status) {
            const item = btn.closest('.omran-item');
            if (!item) return;

            // قبل از تغییر وضعیت، داده‌های مشترک نوع/مقدار را از بخش فعلی
            // به بخش دیگر منتقل می‌کنیم؛ چون UI عمران دو نسخه از type/value دارد.
            const currentFields = status === 'not_done' ? '.done-fields' : '.not-done-fields';
            const currentType = item.querySelector(`${currentFields} [data-omran="type"]`)?.value || '';
            const currentValue = item.querySelector(`${currentFields} [data-omran="value"]`)?.value || '';
            item.querySelectorAll('[data-omran="type"]').forEach(select => { select.value = currentType; });
            item.querySelectorAll('[data-omran="value"]').forEach(input => { input.value = currentValue; });
            const currentHandholeName = item.querySelector(`${currentFields} [data-omran="handholeName"]`)?.value || '';
            item.querySelectorAll('[data-omran="handholeName"]').forEach(input => { input.value = currentHandholeName; });

            const statusInput = item.querySelector('[data-omran-status]');
            if (statusInput) statusInput.value = status;
            const doneFields = item.querySelector('.done-fields');
            const notDoneFields = item.querySelector('.not-done-fields');
            const reasonInput = item.querySelector('[data-omran="reason"]');
            const warningEl = item.querySelector('.not-done-warning');

            if (status === 'done') {
                item.classList.remove('not-done-mode');
                doneFields.style.display = 'block';
                notDoneFields.style.display = 'none';
                if (reasonInput) reasonInput.removeAttribute('required');
                if (warningEl) warningEl.style.display = 'none';
                const doneBtn = item.querySelector('.toggle-done');
                const notDoneBtn = item.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            } else {
                item.classList.add('not-done-mode');
                doneFields.style.display = 'none';
                notDoneFields.style.display = 'block';
                if (reasonInput) reasonInput.setAttribute('required', 'required');
                if (warningEl) warningEl.style.display = 'block';
                const doneBtn = item.querySelector('.toggle-done');
                const notDoneBtn = item.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            }
            // بعد از تغییر وضعیت، type/value بخش فعال را دوباره همگام و تنظیم می‌کنیم.
            updateOmranItemValue(item);
            updateOmranSummary();
        }

        function updateOmranItemValue(itemEl) {
            const status = itemEl.querySelector('[data-omran-status]')?.value || 'done';
            const activeFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
            const typeSelect = itemEl.querySelector(`${activeFields} [data-omran="type"]`);
            const valueInput = itemEl.querySelector(`${activeFields} [data-omran="value"]`);
            const unitLabel = itemEl.querySelector(`${activeFields} .unit-label`);
            if (!typeSelect || !valueInput || !unitLabel) return;
            const selectedType = typeSelect.value;
            const typeInfo = OMRAN_ITEM_TYPES.find(t => t.value === selectedType);
            const isHandhole = selectedType === 'نصب هندهول';

            itemEl.querySelectorAll('[data-omran="type"]').forEach(select => {
                if (select !== typeSelect) select.value = selectedType;
            });
            itemEl.querySelectorAll('[data-omran="value"]').forEach(input => {
                if (input !== valueInput) input.value = valueInput.value;
            });

            itemEl.querySelectorAll('.omran-handhole-name-field').forEach(field => {
                field.style.display = isHandhole ? '' : 'none';
                const input = field.querySelector('[data-omran="handholeName"]');
                if (input) input.required = isHandhole;
            });

            const activeName = itemEl.querySelector(`${activeFields} [data-omran="handholeName"]`);
            if (activeName && isHandhole) {
                itemEl.querySelectorAll('[data-omran="handholeName"]').forEach(input => {
                    if (input !== activeName && !input.value) input.value = activeName.value;
                });
            }

            const descriptionInput = itemEl.querySelector('.done-fields [data-omran="description"]');
            if (descriptionInput) {
                descriptionInput.required = false;
                descriptionInput.placeholder = 'توضیحات (اختیاری)';
            }

            if (typeInfo) {
                itemEl.querySelectorAll('.unit-label').forEach(label => { label.textContent = typeInfo.unit; });
                if (typeInfo.autoFromCabinet) {
                    itemEl.querySelectorAll('[data-omran="value"]').forEach(input => {
                        input.value = '1';
                        input.disabled = true;
                    });
                } else {
                    itemEl.querySelectorAll('[data-omran="value"]').forEach(input => { input.disabled = false; });
                }
            } else {
                itemEl.querySelectorAll('.unit-label').forEach(label => { label.textContent = ''; });
                itemEl.querySelectorAll('[data-omran="value"]').forEach(input => { input.disabled = false; });
                itemEl.querySelectorAll('.omran-handhole-name-field').forEach(field => { field.style.display = 'none'; });
            }
            updateOmranSummary();
        }

        function collectOmranCabinets() {
            const cabinets = [];
            document.querySelectorAll('#omranCabinets .cabinet-block').forEach(cabEl => {
                const cabinetNumber = cabEl.querySelector('.cabinet-number')?.value?.trim() || '';
                const province = cabEl.querySelector('.cabinet-province')?.value?.trim() || '';
                const city = cabEl.querySelector('.cabinet-city')?.value?.trim() || '';
                const region = cabEl.querySelector('.cabinet-region')?.value?.trim() || '';
                const teams = [];
                cabEl.querySelectorAll('.omran-team').forEach(teamEl => {
                    const teamName = teamEl.querySelector('.omran-team-name')?.value?.trim() || '';
                    const items = [];
                    teamEl.querySelectorAll('.omran-item').forEach(itemEl => {
                        const status = itemEl.querySelector('[data-omran-status]')?.value || 'done';
                        const activeFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
                        const type = itemEl.querySelector(`${activeFields} [data-omran="type"]`)?.value?.trim() || '';
                        const o = { status, type };
                        if (status === 'done') {
                            itemEl.querySelectorAll('.done-fields [data-omran]').forEach(x => {
                                o[x.dataset.omran] = x.value.trim();
                            });
                        } else {
                            itemEl.querySelectorAll('.not-done-fields [data-omran]').forEach(x => {
                                o[x.dataset.omran] = x.value.trim();
                            });
                        }
                        if (type) items.push(o);
                    });
                    if (teamName || items.length > 0) teams.push({ teamName, items });
                });
                if (cabinetNumber || teams.length > 0) {
                    cabinets.push({ cabinetNumber, province, city, region, teams });
                }
            });
            return cabinets;
        }

        // اصلاح دکمه "افزودن کابینت" در صفحه عمران
        document.getElementById('omranAddCabinet').addEventListener('click', function() {
            const container = document.getElementById('omranCabinets');
            const lastCabinet = container.lastElementChild;
            if (lastCabinet) {
                const validation = validateOmranTeamInCabinet(lastCabinet);
                if (!validation.ok) {
                    showToast(validation.message, true);
                    return;
                }
            }
            addOmranCabinet();
        });

        function addOmranCabinet(data) {
			const container = document.getElementById('omranCabinets');
			const cabId = getNextCabinetId(container);
			const cabDiv = document.createElement('div');
			cabDiv.className = 'cabinet-block';
			cabDiv.dataset.cid = cabId;
			cabDiv.innerHTML = `
				<div class="cabinet-header">
					<strong>کابینت ${cabId}</strong>
					<div class="cabinet-actions">
						<button type="button" class="danger" onclick="this.closest('.cabinet-block').remove(); updateOmranSummary();">🗑️ حذف</button>
					</div>
				</div>
				${buildCabinetGridHTML(cabId, 'omranCabinets')}
				<div class="omran-teams-container"></div>
				<button type="button" class="secondary" onclick="
					const cab = this.closest('.cabinet-block');
					const validation = validateOmranTeamInCabinet(cab);
					if (!validation.ok) {
						showToast(validation.message, true);
						return;
					}
					addOmranTeam(cab);
				" style="margin-top:8px;">＋ افزودن تیم</button>
			`;
			container.appendChild(cabDiv);
			bindCabinetSelectors(cabDiv, data, 'updateOmranSummary');
			if (data?.teams?.length) {
				data.teams.forEach(t => addOmranTeam(cabDiv, t));
			} else {
				addOmranTeam(cabDiv);
			}
			cabDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateOmranSummary));
			updateOmranSummary();
			const regionSel = cabDiv.querySelector('.cabinet-region');
			if (regionSel) setTimeout(() => { regionSel.focus();
				regionSel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
		}

        function addOmranTeam(cabinetEl, data) {
            const container = cabinetEl.querySelector('.omran-teams-container');
            const teamDiv = document.createElement('div');
            teamDiv.className = 'omran-team';
            teamDiv.innerHTML = `
                <div class="team-header">
                    <strong>تیم</strong>
                    <button type="button" class="danger" onclick="this.closest('.omran-team').remove(); updateOmranSummary();">حذف</button>
                </div>
                <div class="omran-team-row">
                    <div class="field"><label>نام تیم <span class="required">*</span></label>
                        <input class="omran-team-name history-field" required value="${esc(data?.teamName||'')}" placeholder="نام تیم">
                    </div>
                </div>
                <div class="omran-items-container">
                    ${(data?.items||[]).map(item => {
                        const status = item.status || 'done';
                        return `
                            <div class="omran-item${status === 'not_done' ? ' not-done-mode' : ''}">
                                <div class="not-done-warning" style="display:${status === 'not_done' ? 'block' : 'none'};">⚠️ این آیتم انجام نشده ثبت می‌شود</div>
                                <div class="item-header">
                                    <strong>آیتم عمرانی</strong>
                                    <div class="item-status-buttons">
                                        <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleOmranItemStatus(this, 'done')">✔ انجام‌شده</button>
                                        <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleOmranItemStatus(this, 'not_done')">✖ انجام‌نشده</button>
                                    </div>
                                    <button type="button" class="danger" onclick="this.closest('.omran-item').remove(); updateOmranSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
                                </div>
                                <div class="done-fields" style="display:${status === 'done' ? 'block' : 'none'};">
                                    <div class="grid">
                                        <div class="field"><label>نوع عملیات <span class="required">*</span></label>
                                            <select data-omran="type" onchange="updateOmranItemValue(this.closest('.omran-item'))">
                                                <option value="">انتخاب</option>
                                                ${OMRAN_ITEM_TYPES.map(t => `<option value="${t.value}" ${item.type === t.value ? 'selected' : ''}>${t.value} (${t.unit})</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label>مقدار <span class="required">*</span></label>
                                            <div class="omran-value-wrapper">
                                                <div class="value-field"><input data-omran="value" type="number" value="${esc(item.value)}" placeholder="مقدار" ${(item.type === 'نصب کابینت' || item.type === 'نصب هندهول') ? 'disabled' : ''}></div>
                                                <span class="unit-label">${OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || ''}</span>
                                            </div>
                                        </div>
                                        <div class="field omran-handhole-name-field" style="display:${item.type === 'نصب هندهول' ? '' : 'none'};"><label>نام هندهول <span class="required">*</span></label>
                                            <input data-omran="handholeName" value="${esc(item.handholeName)}" placeholder="نام یا کد هندهول">
                                        </div>
                                        <div class="field full"><label>توضیحات</label>
                                            <input data-omran="description" value="${esc(item.description)}" placeholder="توضیحات (اختیاری)">
                                        </div>
                                    </div>
                                </div>
                                <div class="not-done-fields" style="display:${status === 'not_done' ? 'block' : 'none'};">
                                    <div class="grid">
                                        <div class="field"><label>نوع عملیات <span class="required">*</span></label>
                                            <select data-omran="type" onchange="updateOmranItemValue(this.closest('.omran-item'))">
                                                <option value="">انتخاب</option>
                                                ${OMRAN_ITEM_TYPES.map(t => `<option value="${t.value}" ${item.type === t.value ? 'selected' : ''}>${t.value} (${t.unit})</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label>مقدار <span class="required">*</span></label>
                                            <div class="omran-value-wrapper">
                                                <div class="value-field"><input data-omran="value" type="number" value="${esc(item.value)}" placeholder="مقدار" ${(item.type === 'نصب کابینت' || item.type === 'نصب هندهول') ? 'disabled' : ''}></div>
                                                <span class="unit-label">${OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || ''}</span>
                                            </div>
                                        </div>
                                        <div class="field omran-handhole-name-field" style="display:${item.type === 'نصب هندهول' ? '' : 'none'};"><label>نام هندهول <span class="required">*</span></label>
                                            <input data-omran="handholeName" value="${esc(item.handholeName)}" placeholder="نام یا کد هندهول">
                                        </div>
                                        <div class="field full"><label>توضیحات / دلیل عدم اجرا <span class="required">*</span></label>
                                            <textarea data-omran="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="توضیحات یا دلیل عدم اجرا">${esc(item.reason)}</textarea>
                                        </div>
                                    </div>
                                </div>
                                <input type="hidden" data-omran-status value="${status}">
                            </div>
                        `;
                    }).join('')}
                </div>
                <button type="button" class="secondary" onclick="
                    const team = this.closest('.omran-team');
                    const validation = validateOmranItemsInTeam(team);
                    if (!validation.ok) {
                        showToast(validation.message, true);
                        return;
                    }
                    addOmranItem(team);
                " style="margin-top:8px;">＋ افزودن آیتم</button>
            `;
            container.appendChild(teamDiv);
            const teamNameInput = teamDiv.querySelector('.omran-team-name');
            if (teamNameInput) setupFieldHistory(teamNameInput, 'omran_team_history');
            teamDiv.querySelectorAll('.omran-item').forEach(item => {
                const status = item.querySelector('[data-omran-status]')?.value || 'done';
                const activeFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
                const typeSelect = item.querySelector(`${activeFields} [data-omran="type"]`);
                if (typeSelect) {
                    setTimeout(() => updateOmranItemValue(item), 100);
                }
                item.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input',
                    updateOmranSummary));
            });
            if (!data?.items?.length) addOmranItem(teamDiv);
            updateOmranSummary();
            if (teamNameInput) setTimeout(() => { teamNameInput.focus();
                teamNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
        }

        function addOmranItem(teamEl, data) {
            const container = teamEl.querySelector('.omran-items-container');
            const status = data?.status || 'done';
            const itemDiv = document.createElement('div');
            itemDiv.className = 'omran-item' + (status === 'not_done' ? ' not-done-mode' : '');
            itemDiv.innerHTML = `
                <div class="not-done-warning" style="display:${status === 'not_done' ? 'block' : 'none'};">⚠️ این آیتم انجام نشده ثبت می‌شود</div>
                <div class="item-header">
                    <strong>آیتم عمرانی</strong>
                    <div class="item-status-buttons">
                        <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleOmranItemStatus(this, 'done')">✔ انجام‌شده</button>
                        <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleOmranItemStatus(this, 'not_done')">✖ انجام‌نشده</button>
                    </div>
                    <button type="button" class="danger" onclick="this.closest('.omran-item').remove(); updateOmranSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
                </div>
                <div class="done-fields" style="display:${status === 'done' ? 'block' : 'none'};">
                    <div class="grid">
                        <div class="field"><label>نوع عملیات <span class="required">*</span></label>
                            <select data-omran="type" onchange="updateOmranItemValue(this.closest('.omran-item'))">
                                <option value="">انتخاب</option>
                                ${OMRAN_ITEM_TYPES.map(t => `<option value="${t.value}" ${data?.type === t.value ? 'selected' : ''}>${t.value} (${t.unit})</option>`).join('')}
                            </select>
                        </div>
                        <div class="field">
                            <label>مقدار <span class="required">*</span></label>
                            <div class="omran-value-wrapper">
                                <div class="value-field"><input data-omran="value" type="number" value="${esc(data?.value)}" placeholder="مقدار" ${(data?.type === 'نصب کابینت' || data?.type === 'نصب هندهول') ? 'disabled' : ''}></div>
                                <span class="unit-label">${OMRAN_ITEM_TYPES.find(t => t.value === data?.type)?.unit || ''}</span>
                            </div>
                        </div>
                        <div class="field omran-handhole-name-field" style="display:${data?.type === 'نصب هندهول' ? '' : 'none'};"><label>نام هندهول <span class="required">*</span></label>
                            <input data-omran="handholeName" value="${esc(data?.handholeName)}" placeholder="نام یا کد هندهول">
                        </div>
                        <div class="field full"><label>توضیحات</label>
                            <input data-omran="description" value="${esc(data?.description)}" placeholder="توضیحات (اختیاری)">
                        </div>
                    </div>
                </div>
                <div class="not-done-fields" style="display:${status === 'not_done' ? 'block' : 'none'};">
                    <div class="grid">
                        <div class="field"><label>نوع عملیات <span class="required">*</span></label>
                            <select data-omran="type" onchange="updateOmranItemValue(this.closest('.omran-item'))">
                                <option value="">انتخاب</option>
                                ${OMRAN_ITEM_TYPES.map(t => `<option value="${t.value}" ${data?.type === t.value ? 'selected' : ''}>${t.value} (${t.unit})</option>`).join('')}
                            </select>
                        </div>
                        <div class="field">
                            <label>مقدار <span class="required">*</span></label>
                            <div class="omran-value-wrapper">
                                <div class="value-field"><input data-omran="value" type="number" value="${esc(data?.value)}" placeholder="مقدار" ${(data?.type === 'نصب کابینت' || data?.type === 'نصب هندهول') ? 'disabled' : ''}></div>
                                <span class="unit-label">${OMRAN_ITEM_TYPES.find(t => t.value === data?.type)?.unit || ''}</span>
                            </div>
                        </div>
                        <div class="field omran-handhole-name-field" style="display:${data?.type === 'نصب هندهول' ? '' : 'none'};"><label>نام هندهول <span class="required">*</span></label>
                            <input data-omran="handholeName" value="${esc(data?.handholeName)}" placeholder="نام یا کد هندهول">
                        </div>
                        <div class="field full"><label>توضیحات / دلیل عدم اجرا <span class="required">*</span></label>
                            <textarea data-omran="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="توضیحات یا دلیل عدم اجرا">${esc(data?.reason)}</textarea>
                        </div>
                    </div>
                </div>
                <input type="hidden" data-omran-status value="${status}">
            `;
            container.appendChild(itemDiv);
            const activeFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
            const typeSelect = itemDiv.querySelector(`${activeFields} [data-omran="type"]`);
            if (typeSelect) {
                setTimeout(() => updateOmranItemValue(itemDiv), 100);
            }
            itemDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateOmranSummary));
            updateOmranSummary();
            const typeSelectFocus = itemDiv.querySelector(`${activeFields} [data-omran="type"]`);
            if (typeSelectFocus) setTimeout(() => { typeSelectFocus.focus();
                typeSelectFocus.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
        }

        function updateOmranSummary() {
            const data = collectOmranCabinets();
            const totalItems = data.reduce((s, c) => s + (c.teams ? c.teams.reduce((a, t) => a + t.items.length, 0) : 0),
            0);
            const el = document.getElementById('omranSummary');
            if (!totalItems) { el.textContent = 'هنوز کابینتی اضافه نشده است.'; return; }
            const doneCount = data.reduce((s, c) => s + (c.teams ? c.teams.reduce((a, t) => a + t.items.filter(item =>
                item.status !== 'not_done').length, 0) : 0), 0);
            const notDoneCount = totalItems - doneCount;
            const summary = {};
            data.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.items?.filter(item => item.status !== 'not_done').forEach(item => {
                        if (!summary[item.type]) summary[item.type] = 0;
                        if (item.type === 'نصب کابینت') {
                            summary[item.type] += 1;
                        } else {
                            summary[item.type] += parseFloat(item.value) || 0;
                        }
                    });
                });
            });
            let summaryText =
                `کابینت‌ها: <b>${data.length}</b>　| کل آیتم‌ها: <b>${totalItems}</b> (انجام‌شده: <b>${doneCount}</b> | انجام‌نشده: <b>${notDoneCount}</b>)<br>`;
            const items = Object.keys(summary).sort();
            if (items.length) {
                summaryText += '📊 جمع‌بندی عملیات: ';
                summaryText += items.map(key => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                    return `${key}: <b>${summary[key]}${unit ? ' '+unit : ''}</b>`;
                }).join('　|　');
            }
            el.innerHTML = summaryText;
        }

        function calculateOmranTotals(data) {
            const totals = {};
            data.cabinets.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.items?.filter(item => item.status !== 'not_done').forEach(item => {
                        if (!totals[item.type]) totals[item.type] = 0;
                        if (item.type === 'نصب کابینت') {
                            totals[item.type] += 1;
                        } else {
                            totals[item.type] += parseFloat(item.value) || 0;
                        }
                    });
                });
            });
            return totals;
        }

        function buildOmranExcelRows(data) {
            const allItems = [];
            data.cabinets.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.items?.forEach(item => {
                        allItems.push({ ...item, cabinet: cab.cabinetNumber, province: cab.province,
                            city: cab.city, region: cab.region, teamName: team.teamName });
                    });
                });
            });
            const doneItems = allItems.filter(item => item.status !== 'not_done');
            const notDoneItems = allItems.filter(item => item.status === 'not_done');
            const rows = [
                ['گزارش عمران', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول عمران', data.reporter],
                [],
                ['✅ آیتم‌های انجام‌شده']
            ];
            let n = 1;
            if (doneItems.length) {
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نوع عملیات', 'مقدار', 'واحد', 'نام هندهول',
                    'توضیحات'
                ]);
                doneItems.forEach(item => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                    rows.push([
                        n++, data.date, item.cabinet || '', item.province || '',
                        item.city || '', item.region || '', item.teamName || '', item.type || '',
                        parseFloat(item.value) || 0, unit, item.handholeName || '', item.description || ''
                    ]);
                });
            }
            if (doneItems.length) {
                const totals = calculateOmranTotals(data);
                rows.push([]);
                rows.push(['جمع کل (انجام‌شده)']);
                Object.keys(totals).sort().forEach(key => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                    rows.push([`${key}: ${totals[key]}${unit ? ' '+unit : ''}`]);
                });
            }
            if (notDoneItems.length) {
                rows.push([]);
                rows.push(['❌ آیتم‌های انجام‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نوع عملیات', 'مقدار', 'واحد', 'نام هندهول',
                    'دلیل عدم اجرا'
                ]);
                let m = 1;
                notDoneItems.forEach(item => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                    rows.push([
                        m++, data.date, item.cabinet || '', item.province || '',
                        item.city || '', item.region || '', item.teamName || '', item.type || '',
                        parseFloat(item.value) || 0, unit, item.handholeName || '', item.reason || ''
                    ]);
                });
            }
            return rows;
        }

        function buildOmranCSVRows(data) {
            const allItems = [];
            data.cabinets.forEach(cab => {
                cab.teams?.forEach(team => {
                    team.items?.forEach(item => {
                        allItems.push({ ...item, cabinet: cab.cabinetNumber, province: cab.province,
                            city: cab.city, region: cab.region, teamName: team.teamName });
                    });
                });
            });
            const doneItems = allItems.filter(item => item.status !== 'not_done');
            const notDoneItems = allItems.filter(item => item.status === 'not_done');
            const rows = [
                ['گزارش عمران', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول عمران', data.reporter],
                [],
                ['✅ آیتم‌های انجام‌شده'],
                ['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نوع عملیات', 'مقدار', 'واحد', 'نام هندهول',
                    'توضیحات'
                ]
            ];
            let n = 1;
            doneItems.forEach(item => {
                const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                rows.push([
                    n++, data.date, item.cabinet || '', item.province || '',
                    item.city || '', item.region || '', item.teamName || '', item.type || '',
                    parseFloat(item.value) || 0, unit, item.handholeName || '', item.description || ''
                ]);
            });
            if (notDoneItems.length) {
                rows.push([]);
                rows.push(['❌ آیتم‌های انجام‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'نوع عملیات', 'مقدار', 'واحد', 'نام هندهول',
                    'دلیل عدم اجرا'
                ]);
                let m = 1;
                notDoneItems.forEach(item => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                    rows.push([
                        m++, data.date, item.cabinet || '', item.province || '',
                        item.city || '', item.region || '', item.teamName || '', item.type || '',
                        parseFloat(item.value) || 0, unit, item.handholeName || '', item.reason || ''
                    ]);
                });
            }
            return rows;
        }

        // ===== گزارش کامل عمران (سلسله‌مراتبی با جمع کابینت) =====
        function buildOmranTextReport(data, type) {
            if (type === 'summary') {
                let text = 'گزارش روزانه عمران\n─────────────────────\n\n';
                text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\n\n`;
                text += '─────────────────────\n📊 خلاصه گزارش (تفکیک کابینت)\n─────────────────────\n\n';

                data.cabinets.forEach((cab, idx) => {
                    const items = [];
                    cab.teams?.forEach(t => items.push(...t.items));
                    const doneItems = items.filter(item => item.status !== 'not_done');
                    const notDoneItems = items.filter(item => item.status === 'not_done');
                    const cabTotals = calculateOmranTotals({ cabinets: [cab] });

                    text += `کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n`;
                    text += `  ─────────────────────\n`;
                    text += `  تعداد کل آیتم‌ها:           ${items.length}\n`;
                    text += `  انجام‌شده:                 ${doneItems.length}\n`;
                    text += `  انجام‌نشده:                ${notDoneItems.length}\n`;
                    text += `  جمع‌بندی عملیات:\n`;
                    Object.keys(cabTotals).sort().forEach(key => {
                        const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                        const metric = nonZeroMetric(key, cabTotals[key], unit);
                        if (metric) text += `    ${metric}\n`;
                    });
                    if (notDoneItems.length) {
                        text += `  ❌ آیتم‌های انجام‌نشده:\n`;
                        notDoneItems.forEach((item, n) => {
                            const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                            const value = item.type === 'نصب کابینت' ? (item.value || '') : (item.value || 0);
                            text += `    ${n + 1}. ${item.type || 'بدون نوع'}: ${value}${unit ? ' '+unit : ''}${item.handholeName ? ' | نام هندهول: '+item.handholeName : ''} | دلیل: ${item.reason || 'نامشخص'}\n`;
                        });
                    }
                    if (idx < data.cabinets.length - 1) text += '\n';
                });

                const totals = calculateOmranTotals(data);
                text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
                const totalItemCount = data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.length,0):0),0);
                const totalDoneCount = data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.filter(item=>item.status!=='not_done').length,0):0),0);
                const totalNotDoneCount = data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.filter(item=>item.status==='not_done').length,0):0),0);
                const totalCountMetrics = joinNonZeroMetrics([['تعداد کل آیتم‌ها', totalItemCount, ''], ['انجام‌شده', totalDoneCount, ''], ['انجام‌نشده', totalNotDoneCount, '']], '\n');
                if (totalCountMetrics) text += totalCountMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n\n';
                text += `📏 جمع‌بندی نهایی:\n`;
                Object.keys(totals).sort().forEach(key => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                    text += `  ${key}: ${totals[key]}${unit ? ' '+unit : ''}\n`;
                });
                return text;
            }

            // ---- گزارش کامل ----
            let text = 'گزارش روزانه عمران\n─────────────────────\n\n';
            text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\nمسئول عمران: ${data.reporter}\n\n`;

            data.cabinets.forEach((cab, cabIdx) => {
                const cabItems = [];
                cab.teams?.forEach(t => cabItems.push(...t.items));
                const cabDone = cabItems.filter(item => item.status !== 'not_done');
                const cabNotDone = cabItems.filter(item => item.status === 'not_done');
                const cabTotals = calculateOmranTotals({ cabinets: [cab] });

                text += `─────────────────────\n📌 کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n─────────────────────\n\n`;

                cab.teams?.forEach((team, teamIdx) => {
                    const items = team.items || [];
                    const doneItems = items.filter(item => item.status !== 'not_done');
                    const notDoneItems = items.filter(item => item.status === 'not_done');
                    if (items.length === 0) return;

                    text += `✅ تیم ${team.teamName || 'بدون نام'}:\n`;
                    doneItems.forEach((item, idx) => {
                        const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                        if (item.type === 'نصب کابینت') {
                            text += `  ${idx+1}. ${item.type} شماره ${item.value || ''}\n`;
                        } else {
                            text += `  ${idx+1}. ${item.type}: ${item.value || 0}${unit ? ' '+unit : ''}`;
                            if (item.handholeName) text += ` | نام هندهول: ${item.handholeName}`;
                            if (item.description) text += ` | توضیحات: ${item.description}`;
                            text += '\n';
                        }
                    });
                    if (notDoneItems.length) {
                        text += `  ❌ انجام‌نشده:\n`;
                        notDoneItems.forEach((item, idx) => {
                            const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                            if (item.type === 'نصب کابینت') {
                                text += `    ${idx+1}. ${item.type} شماره ${item.value || ''} | دلیل: ${item.reason || 'نامشخص'}\n`;
                            } else {
                                text += `    ${idx+1}. ${item.type}: ${item.value || 0}${unit ? ' '+unit : ''}${item.handholeName ? ' | نام هندهول: '+item.handholeName : ''} | دلیل: ${item.reason || 'نامشخص'}\n`;
                            }
                        });
                    }
                    text += `  جمع تیم: ${doneItems.length} انجام‌شده، ${notDoneItems.length} انجام‌نشده\n`;
                    if (teamIdx < cab.teams.length - 1) text += '\n';
                });

                // جمع‌بندی کابینت
                const cabSummary = joinNonZeroMetrics([['انجام‌شده', cabDone.length, ''], ['انجام‌نشده', cabNotDone.length, '']]);
                const cabOperationLines = Object.keys(cabTotals).sort().map(key => {
                    const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                    return nonZeroMetric(key, cabTotals[key], unit);
                }).filter(Boolean);
                const cabOperationSummary = cabOperationLines.join(' | ');
                if (cabSummary || cabOperationSummary) text += `\n📊 جمع کابینت: ${[cabSummary, cabOperationSummary].filter(Boolean).join(' | ')}\n`;
                if (cabIdx < data.cabinets.length - 1) text += '\n';
            });

            // جمع نهایی
            const totals = calculateOmranTotals(data);
            text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
            text += `  تعداد کل آیتم‌ها:           ${data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.length,0):0),0)}\n`;
            text += `  انجام‌شده:                 ${data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.filter(item=>item.status!=='not_done').length,0):0),0)}\n`;
            text += `  انجام‌نشده:                ${data.cabinets.reduce((s,c) => s + (c.teams? c.teams.reduce((a,t) => a + t.items.filter(item=>item.status==='not_done').length,0):0),0)}\n\n`;
            text += `📏 جمع‌بندی نهایی:\n`;
            Object.keys(totals).sort().forEach(key => {
                const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                const metric = nonZeroMetric(key, totals[key], unit);
                if (metric) text += `  ${metric}\n`;
            });
            return text;
        }

        // ===== پیش‌نمایش عمران با جمع هر کابینت و جمع نهایی =====
        function buildOmranPreviewHTML(data) {
            const css = `
                *{box-sizing:border-box} body{font-family:Tahoma,Arial,sans-serif;background:#f4f7fb;color:#263238;margin:0;padding:24px;direction:rtl}
                .wrap{max-width:1250px;margin:auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 2px 14px #0001}
                h1{text-align:center;color:#1565c0;margin:0 0 8px}.meta{background:#eef4fa;padding:14px;border-radius:10px;line-height:2;margin:18px 0}
                .cab{border:1px solid #d8e2ec;border-radius:12px;margin:18px 0;overflow:hidden}.cab h2{margin:0;padding:11px 15px;background:#eaf2f9;color:#0d47a1;font-size:18px}
                .team{margin:12px 16px;padding:12px;border-radius:9px;background:#fafcff;border:1px solid #e4ebf2}.team h3{margin:0 0 8px;color:#37474f}
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

            let totalDone = 0, totalNotDone = 0;
            const totalTotals = {};
            data.cabinets.forEach(c => {
                let cabDone = 0, cabNotDone = 0;
                const cabTotals = {};
                let teamRows = '';
                (c.teams || []).forEach(t => {
                    const items = t.items || [];
                    const d = items.filter(item => item.status !== 'not_done');
                    const n = items.filter(item => item.status === 'not_done');
                    cabDone += d.length;
                    cabNotDone += n.length;
                    d.forEach(item => {
                        const val = (item.type === 'نصب کابینت') ? 1 : (parseFloat(item.value) || 0);
                        cabTotals[item.type] = (cabTotals[item.type] || 0) + val;
                        totalTotals[item.type] = (totalTotals[item.type] || 0) + val;
                    });
                    const dRows = d.map(item => {
                        const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                        const val = (item.type === 'نصب کابینت') ? 1 : (parseFloat(item.value) || 0);
                        return `<tr><td>${escP(item.type)}</td><td>${val}${unit ? ' '+unit : ''}</td><td>${escP(item.handholeName)}</td><td>${escP(item.description)}</td></tr>`;
                    }).join('');
                    const nRows = n.map(item => {
                        const unit = OMRAN_ITEM_TYPES.find(t => t.value === item.type)?.unit || '';
                        const val = (item.type === 'نصب کابینت') ? 1 : (parseFloat(item.value) || 0);
                        return `<tr><td>${escP(item.type)}</td><td>${val}${unit ? ' '+unit : ''}</td><td>${escP(item.handholeName)}</td><td>${escP(item.reason)}</td></tr>`;
                    }).join('');
                    if (dRows || nRows) {
                        teamRows += `<div class="team"><h3>تیم: ${escP(t.teamName)}</h3>`;
                        if(dRows) teamRows += `<h4 class="done">✅ انجام‌شده</h4><table><thead><tr><th>نوع</th><th>مقدار</th><th>نام هندهول</th><th>توضیحات</th></tr></thead><tbody>${dRows}</tbody></table>`;
                        if(nRows) teamRows += `<h4 class="notdone">❌ انجام‌نشده</h4><table><thead><tr><th>نوع</th><th>مقدار</th><th>نام هندهول</th><th>دلیل</th></tr></thead><tbody>${nRows}</tbody></table>`;
                        teamRows += `</div>`;
                    }
                });
                totalDone += cabDone;
                totalNotDone += cabNotDone;
                content += `<div class="cab"><h2>کابینت ${escP(c.cabinetNumber)} — ${escP(c.province)} / ${escP(c.city)} / منطقه ${escP(c.region)}</h2>`;
                content += teamRows;
                // جمع‌بندی کابینت
                let cabSummaryHtml = `<div class="cab-summary">📊 جمع کابینت: ${cabDone} انجام‌شده | ${cabNotDone} انجام‌نشده`;
                const cabKeys = Object.keys(cabTotals).sort();
                if (cabKeys.length) {
                    cabSummaryHtml += ' | ';
                    cabSummaryHtml += cabKeys.map(key => {
                        const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                        return `${key}: ${cabTotals[key]}${unit ? ' '+unit : ''}`;
                    }).join(' | ');
                }
                cabSummaryHtml += '</div>';
                content += cabSummaryHtml;
                content += `</div>`;
            });

            // جمع نهایی
            let finalSummary = `<div class="summary"><b>خلاصه نهایی:</b> ${totalDone} آیتم انجام‌شده | ${totalNotDone} انجام‌نشده`;
            const finalKeys = Object.keys(totalTotals).sort();
            const finalOperationSummary = finalKeys.map(key => {
                const unit = OMRAN_ITEM_TYPES.find(t => t.value === key)?.unit || '';
                return nonZeroMetric(key, totalTotals[key], unit);
            }).filter(Boolean).join(' | ');
            const finalBaseSummary = joinNonZeroMetrics([['انجام‌شده', totalDone, ''], ['انجام‌نشده', totalNotDone, '']]);
            finalSummary = `<div class="summary"><b>خلاصه نهایی:</b> ${[finalBaseSummary, finalOperationSummary].filter(Boolean).join(' | ')}`;
            finalSummary += '</div>';
            content += finalSummary;
            content += `<button class="no-print" onclick="window.print()">🖨️ چاپ</button></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
            return content;
        }



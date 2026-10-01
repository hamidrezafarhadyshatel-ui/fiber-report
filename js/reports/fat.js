        const fatConfig = {
            key: 'fat_report_multi',
            reportName: 'گزارش نصب باکس FAT',
            reportType: 'fat',
            containerId: 'fatCabinets',
            dateIds: { year: 'fatYear', month: 'fatMonth', day: 'fatDay' },
            contractorId: 'fatContractor',
            reporterId: 'fatReporter',
            validate: function() {
                const common = getCommonFields(this);
                return validateDate(this.dateIds.year, this.dateIds.month, this.dateIds.day) &&
                    common.contractor !== '' && common.reporter !== '';
            },
            collect: function() {
                const common = getCommonFields(this);
                const cabinets = collectFatCabinets();
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
                data.cabinets.forEach(cab => addFatCabinet(cab));
                updateFatSummary();
                setTimeout(() => { document.getElementById(this.contractorId)?.focus(); }, 200);
            },
            prepareExcel: function(data) { return buildFatExcelRows(data); },
            prepareCSV: function(data) { return buildFatCSVRows(data); },
            formatText: function(data, type) { return buildFatTextReport(data, type); },
            previewHTML: function(data) { return buildFatPreviewHTML(data); },
            columnWidths: [
                { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 30 }
            ]
        };

        // ---- شوت ----
        function toggleFatBoxStatus(btn, status) {
            const boxItem = btn.closest('.fat-box-item');
            if (!boxItem) return;
            const previousStatus = boxItem.querySelector('.fat-box-status')?.value || 'done';
            const previousFields = previousStatus === 'not_done' ? '.not-done-fields' : '.done-fields';
            const nextFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
            const fromCode = boxItem.querySelector(`${previousFields} .fat-box-code`);
            const toCode = boxItem.querySelector(`${nextFields} .fat-box-code`);
            if (fromCode && toCode) toCode.value = fromCode.value;
            const statusInput = boxItem.querySelector('.fat-box-status');
            if (statusInput) statusInput.value = status;
            const doneFields = boxItem.querySelector('.done-fields');
            const notDoneFields = boxItem.querySelector('.not-done-fields');
            const reasonInput = boxItem.querySelector('.fat-box-reason');

            if (status === 'done') {
                boxItem.classList.remove('not-done-mode');
                doneFields.style.display = 'flex';
                notDoneFields.style.display = 'none';
                if (reasonInput) reasonInput.removeAttribute('required');
                const doneBtn = boxItem.querySelector('.toggle-done');
                const notDoneBtn = boxItem.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            } else {
                boxItem.classList.add('not-done-mode');
                doneFields.style.display = 'none';
                notDoneFields.style.display = 'flex';
                if (reasonInput) reasonInput.setAttribute('required', 'required');
                const doneBtn = boxItem.querySelector('.toggle-done');
                const notDoneBtn = boxItem.querySelector('.toggle-not-done');
                if (doneBtn) { doneBtn.className = 'secondary toggle-done';
                    doneBtn.textContent = '✔ انجام‌شده'; }
                if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done';
                    notDoneBtn.textContent = '✖ انجام‌نشده'; }
            }
            updateFatSummary();
        }

        function collectFatCabinets() {
            const cabinets = [];
            document.querySelectorAll('#fatCabinets .cabinet-block').forEach(cabEl => {
                const cabinetNumber = cabEl.querySelector('.cabinet-number')?.value?.trim() || '';
                const province = cabEl.querySelector('.cabinet-province')?.value?.trim() || '';
                const city = cabEl.querySelector('.cabinet-city')?.value?.trim() || '';
                const region = cabEl.querySelector('.cabinet-region')?.value?.trim() || '';
                const teams = [];
                cabEl.querySelectorAll('.fat-team').forEach(teamEl => {
                    const teamName = teamEl.querySelector('.fat-team-name')?.value?.trim() || '';
                    const boxes = [];
                    teamEl.querySelectorAll('.fat-box-item').forEach(boxEl => {
                        const status = boxEl.querySelector('.fat-box-status')?.value || 'done';
                        let code = '', desc = '', reason = '';
                        if (status === 'done') {
                            code = boxEl.querySelector('.done-fields .fat-box-code')?.value?.trim() || '';
                            desc = boxEl.querySelector('.done-fields .fat-box-desc')?.value?.trim() || '';
                            if (code) boxes.push({ code, desc, status });
                        } else {
                            code = boxEl.querySelector('.not-done-fields .fat-box-code')?.value?.trim() || '';
                            reason = boxEl.querySelector('.not-done-fields .fat-box-reason')?.value?.trim() || '';
                            if (code) boxes.push({ code, status, reason });
                        }
                    });
                    if (teamName || boxes.length > 0) teams.push({ teamName, boxes });
                });
                if (cabinetNumber || teams.length > 0) {
                    cabinets.push({ cabinetNumber, province, city, region, teams });
                }
            });
            return cabinets;
        }

        function validateFatBoxesInTeam(teamEl) {
            const boxEls = teamEl.querySelectorAll('.fat-box-item');
            let hasError = false;
            let errorMsg = '';
            boxEls.forEach(box => {
                const status = box.querySelector('.fat-box-status')?.value || 'done';
                if (status === 'done') {
                    const code = box.querySelector('.done-fields .fat-box-code')?.value?.trim() || '';
                    if (!code) {
                        hasError = true;
                        errorMsg = 'کد باکس FAT برای باکس انجام‌شده الزامی است.';
                    }
                } else {
                    const code = box.querySelector('.not-done-fields .fat-box-code')?.value?.trim() || '';
                    const reason = box.querySelector('.not-done-fields .fat-box-reason')?.value?.trim() || '';
                    if (!code || !reason) {
                        hasError = true;
                        errorMsg = 'کد باکس و دلیل برای باکس انجام‌نشده الزامی است.';
                    }
                }
            });
            return { ok: !hasError, message: errorMsg };
        }

        function validateFatCabinet(cabinetEl) {
            const teamEls = cabinetEl.querySelectorAll('.fat-team');
            for (const team of teamEls) {
                const teamName = team.querySelector('.fat-team-name')?.value?.trim() || '';
                if (!teamName) return { ok: false, message: 'نام تیم FAT را قبل از افزودن تیم یا کابینت جدید وارد کنید.' };
                const result = validateFatBoxesInTeam(team);
                if (!result.ok) return result;
            }
            return { ok: true };
        }

        document.getElementById('fatAddCabinet').addEventListener('click', function() {
            const container = document.getElementById('fatCabinets');
            const lastCabinet = container.lastElementChild;
            if (lastCabinet) {
                const validation = validateFatCabinet(lastCabinet);
                if (!validation.ok) {
                    showToast(validation.message, true);
                    return;
                }
            }
            addFatCabinet();
        });

        function addFatCabinet(data) {
			const container = document.getElementById('fatCabinets');
			const cabId = getNextCabinetId(container);
			const cabDiv = document.createElement('div');
			cabDiv.className = 'cabinet-block';
			cabDiv.dataset.cid = cabId;
			cabDiv.innerHTML = `
				<div class="cabinet-header"><strong>کابینت ${cabId}</strong>
					<div class="cabinet-actions"><button type="button" class="danger" onclick="this.closest('.cabinet-block').remove(); updateFatSummary();">🗑️ حذف</button></div>
				</div>
				${buildCabinetGridHTML(cabId, 'fatCabinets')}
				<div class="fat-teams-container"></div>
				<button type="button" class="secondary" onclick="
					const cab = this.closest('.cabinet-block');
					const validation = validateFatCabinet(cab);
					if (!validation.ok) {
						showToast(validation.message, true);
						return;
					}
					addFatTeam(cab);
				" style="margin-top:8px;">＋ افزودن تیم</button>
			`;
			container.appendChild(cabDiv);
			bindCabinetSelectors(cabDiv, data, 'updateFatSummary');
			if (data?.teams?.length) {
				data.teams.forEach(t => addFatTeam(cabDiv, t));
			} else {
				addFatTeam(cabDiv);
			}
			cabDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateFatSummary));
			updateFatSummary();
			const regionSel = cabDiv.querySelector('.cabinet-region');
			if (regionSel) setTimeout(() => { regionSel.focus();
				regionSel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
		}

        function addFatTeam(cabinetEl, data) {
            const container = cabinetEl.querySelector('.fat-teams-container');
            const teamDiv = document.createElement('div');
            teamDiv.className = 'fat-team';
            teamDiv.innerHTML = `
                <div class="team-header"><strong>تیم</strong>
                    <button type="button" class="danger" onclick="this.closest('.fat-team').remove(); updateFatSummary();">حذف</button>
                </div>
                <div class="fat-team-row">
                    <div class="field"><label>نام تیم <span class="required">*</span></label>
                        <input class="fat-team-name history-field" required value="${esc(data?.teamName||'')}" placeholder="نام تیم">
                    </div>
                </div>
                <div class="fat-boxes-container">
                    ${(data?.boxes||[]).map(box => `
                        <div class="fat-box-item${box.status === 'not_done' ? ' not-done-mode' : ''}">
                            <div class="not-done-warning">⚠️ این باکس نصب نشده ثبت می‌شود</div>
                            <div class="box-status-buttons">
                                <button type="button" class="${box.status !== 'not_done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleFatBoxStatus(this, 'done')">✔ انجام‌شده</button>
                                <button type="button" class="${box.status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleFatBoxStatus(this, 'not_done')">✖ انجام‌نشده</button>
                            </div>
                            <div class="done-fields" style="display:${box.status !== 'not_done' ? 'flex' : 'none'};">
                                <div class="box-code"><input class="fat-box-code" type="text" value="${esc(box.code)}" placeholder="کد باکس" required></div>
                                <div class="box-desc"><input class="fat-box-desc" value="${esc(box.desc)}" placeholder="توضیحات (اختیاری)"></div>
                                <button type="button" class="box-remove" onclick="this.closest('.fat-box-item').remove(); updateFatSummary();">✕</button>
                            </div>
                            <div class="not-done-fields" style="display:${box.status === 'not_done' ? 'flex' : 'none'};">
                                <div class="box-code"><input class="fat-box-code" type="text" value="${esc(box.code)}" placeholder="کد باکس" required></div>
                                <div class="box-reason"><input class="fat-box-reason" value="${esc(box.reason)}" placeholder="دلیل" required></div>
                                <button type="button" class="box-remove" onclick="this.closest('.fat-box-item').remove(); updateFatSummary();">✕</button>
                            </div>
                            <input type="hidden" class="fat-box-status" value="${box.status || 'done'}">
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="fat-add-box-btn" onclick="
                    const team = this.closest('.fat-team');
                    const validation = validateFatBoxesInTeam(team);
                    if (!validation.ok) {
                        showToast(validation.message, true);
                        return;
                    }
                    addFatBox(team);
                ">＋ افزودن باکس</button>
            `;
            container.appendChild(teamDiv);
            const teamNameInput = teamDiv.querySelector('.fat-team-name');
            if (teamNameInput) setupFieldHistory(teamNameInput, 'fat_team_history');
            teamDiv.querySelectorAll('input, textarea').forEach(x => x.addEventListener('input', updateFatSummary));
            if (!data?.boxes?.length) addFatBox(teamDiv);
            updateFatSummary();
            if (teamNameInput) setTimeout(() => { teamNameInput.focus();
                teamNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
        }

        function addFatBox(teamEl, data) {
            const container = teamEl.querySelector('.fat-boxes-container');
            const status = data?.status || 'done';
            const boxItem = document.createElement('div');
            boxItem.className = 'fat-box-item' + (status === 'not_done' ? ' not-done-mode' : '');
            boxItem.innerHTML = `
                <div class="not-done-warning">⚠️ این باکس نصب نشده ثبت می‌شود</div>
                <div class="box-status-buttons">
                    <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleFatBoxStatus(this, 'done')">✔ انجام‌شده</button>
                    <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleFatBoxStatus(this, 'not_done')">✖ انجام‌نشده</button>
                </div>
                <div class="done-fields" style="display:${status === 'done' ? 'flex' : 'none'};">
                    <div class="box-code"><input class="fat-box-code" type="text" value="${esc(data?.code)}" placeholder="کد باکس" required></div>
                    <div class="box-desc"><input class="fat-box-desc" value="${esc(data?.desc)}" placeholder="توضیحات (اختیاری)"></div>
                    <button type="button" class="box-remove" onclick="this.closest('.fat-box-item').remove(); updateFatSummary();">✕</button>
                </div>
                <div class="not-done-fields" style="display:${status === 'not_done' ? 'flex' : 'none'};">
                    <div class="box-code"><input class="fat-box-code" type="text" value="${esc(data?.code)}" placeholder="کد باکس" required></div>
                    <div class="box-reason"><input class="fat-box-reason" value="${esc(data?.reason)}" placeholder="دلیل" required></div>
                    <button type="button" class="box-remove" onclick="this.closest('.fat-box-item').remove(); updateFatSummary();">✕</button>
                </div>
                <input type="hidden" class="fat-box-status" value="${status}">
            `;
            container.appendChild(boxItem);
            setTimeout(() => {
                const initialFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
                const code = boxItem.querySelector(`${initialFields} .fat-box-code`);
                if (code) { code.focus();
                    code.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }, 100);
            updateFatSummary();
        }

        function updateFatSummary() {
            const data = collectFatCabinets();
            const totalBoxes = data.reduce((s, c) => s + c.teams.reduce((a, t) => a + t.boxes.length, 0), 0);
            const el = document.getElementById('fatSummary');
            if (!totalBoxes) { el.textContent = 'هنوز کابینتی اضافه نشده است.'; return; }
            const doneCount = data.reduce((s, c) => s + c.teams.reduce((a, t) => a + t.boxes.filter(b => b.status !==
                'not_done').length, 0), 0);
            const notDoneCount = totalBoxes - doneCount;
            el.innerHTML =
                `کابینت‌ها: <b>${data.length}</b>　| کل باکس‌ها: <b>${totalBoxes}</b> (نصب‌شده: <b>${doneCount}</b> | نصب‌نشده: <b>${notDoneCount}</b>)`;
        }

        function buildFatExcelRows(data) {
            const allBoxes = [];
            data.cabinets.forEach(cab => {
                cab.teams.forEach(team => {
                    team.boxes.forEach(box => {
                        allBoxes.push({ ...box, cabinet: cab.cabinetNumber, province: cab.province,
                            city: cab.city, region: cab.region, teamName: team.teamName });
                    });
                });
            });
            const doneBoxes = allBoxes.filter(b => b.status !== 'not_done');
            const notDoneBoxes = allBoxes.filter(b => b.status === 'not_done');
            const rows = [
                ['گزارش نصب باکس FAT', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول نصب FAT', data.reporter],
                [],
                ['✅ باکس‌های نصب‌شده']
            ];
            let n = 1;
            if (doneBoxes.length) {
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'کد باکس', 'توضیحات']);
                doneBoxes.forEach(b => {
                    rows.push([
                        n++, data.date, b.cabinet || '', b.province || '',
                        b.city || '', b.region || '', b.teamName || b.team || '', b.code,
                        b.desc || ''
                    ]);
                });
            }
            if (doneBoxes.length) {
                const totalBoxes = doneBoxes.length;
                rows.push([]);
                rows.push(['جمع کل (نصب‌شده)', '', '', '', '', '', '', totalBoxes, '']);
                rows.push(['مصرفی', `باکس FAT48 به تعداد ${totalBoxes} عدد`]);
            }
            if (notDoneBoxes.length) {
                rows.push([]);
                rows.push(['❌ باکس‌های نصب‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'کد باکس', 'دلیل عدم اجرا'
                ]);
                let m = 1;
                notDoneBoxes.forEach(b => {
                    rows.push([
                        m++, data.date, b.cabinet || '', b.province || '',
                        b.city || '', b.region || '', b.teamName || b.team || '', b.code,
                        b.reason || ''
                    ]);
                });
            }
            return rows;
        }

        function buildFatCSVRows(data) {
            const allBoxes = [];
            data.cabinets.forEach(cab => {
                cab.teams.forEach(team => {
                    team.boxes.forEach(box => {
                        allBoxes.push({ ...box, cabinet: cab.cabinetNumber, province: cab.province,
                            city: cab.city, region: cab.region, teamName: team.teamName });
                    });
                });
            });
            const doneBoxes = allBoxes.filter(b => b.status !== 'not_done');
            const notDoneBoxes = allBoxes.filter(b => b.status === 'not_done');
            const rows = [
                ['گزارش نصب باکس FAT', '', '', '', '', '', '', '', 'تاریخ', data.date],
                ['پیمانکار', data.contractor, '', 'مسئول نصب FAT', data.reporter],
                [],
                ['✅ باکس‌های نصب‌شده'],
                ['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'کد باکس', 'توضیحات']
            ];
            let n = 1;
            doneBoxes.forEach(b => {
                rows.push([
                    n++, data.date, b.cabinet || '', b.province || '',
                    b.city || '', b.region || '', b.teamName || b.team || '', b.code,
                    b.desc || ''
                ]);
            });
            if (notDoneBoxes.length) {
                rows.push([]);
                rows.push(['❌ باکس‌های نصب‌نشده']);
                rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'تیم', 'کد باکس', 'دلیل عدم اجرا'
                ]);
                let m = 1;
                notDoneBoxes.forEach(b => {
                    rows.push([
                        m++, data.date, b.cabinet || '', b.province || '',
                        b.city || '', b.region || '', b.teamName || b.team || '', b.code,
                        b.reason || ''
                    ]);
                });
            }
            return rows;
        }

        function buildFatTextReport(data, type) {
            if (type === 'summary') {
                let text = 'گزارش نصب باکس FAT\n─────────────────────\n\n';
                text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\n\n`;
                text += '─────────────────────\n📊 خلاصه گزارش (تفکیک کابینت)\n─────────────────────\n\n';

                data.cabinets.forEach((cab, idx) => {
                    const boxes = [];
                    cab.teams.forEach(t => boxes.push(...t.boxes));
                    const doneBoxes = boxes.filter(b => b.status !== 'not_done');
                    const notDoneBoxes = boxes.filter(b => b.status === 'not_done');

                    text += `کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n`;
                    text += `  ─────────────────────\n`;
                    const cabMetrics = joinNonZeroMetrics([
                        ['تعداد کل باکس‌ها', boxes.length, ''], ['نصب‌شده', doneBoxes.length, ''],
                        ['نصب‌نشده', notDoneBoxes.length, ''], ['باکس FAT48 مصرفی', doneBoxes.length, 'عدد']
                    ], '\n');
                    if (cabMetrics) text += cabMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
                    if (idx < data.cabinets.length - 1) text += '\n';
                });

                const totalBoxes = data.cabinets.reduce((sum, cab) => {
                    let c = 0;
                    cab.teams.forEach(t => c += t.boxes.length);
                    return sum + c;
                }, 0);
                const totalDone = data.cabinets.reduce((sum, cab) => {
                    let c = 0;
                    cab.teams.forEach(t => c += t.boxes.filter(b => b.status !== 'not_done').length);
                    return sum + c;
                }, 0);
                const totalNotDone = totalBoxes - totalDone;

                text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
                const totalMetrics = joinNonZeroMetrics([
                    ['تعداد کل باکس‌ها', totalBoxes, ''], ['نصب‌شده', totalDone, ''],
                    ['نصب‌نشده', totalNotDone, ''], ['باکس FAT48 مصرفی', totalDone, 'عدد']
                ], '\n');
                if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';

                return text;
            }

            // ---- گزارش کامل ----
            let text = 'گزارش نصب باکس FAT\n─────────────────────\n\n';
            text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\nمسئول نصب FAT: ${data.reporter}\n\n`;

            data.cabinets.forEach((cab, cabIdx) => {
                text += `─────────────────────\n📌 کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n─────────────────────\n\n`;

                cab.teams.forEach((team, teamIdx) => {
                    const boxes = team.boxes || [];
                    const doneBoxes = boxes.filter(b => b.status !== 'not_done');
                    const notDoneBoxes = boxes.filter(b => b.status === 'not_done');

                    if (boxes.length === 0) return;

                    text += `✅ تیم ${team.teamName || 'بدون نام'}:\n`;
                    doneBoxes.forEach((b, idx) => {
                        text += `  ${idx+1}. کد: ${b.code}${b.desc ? ` (${b.desc})` : ''}\n`;
                    });
                    if (notDoneBoxes.length) {
                        text += `  ❌ انجام‌نشده:\n`;
                        notDoneBoxes.forEach((b, idx) => {
                            text += `    ${idx+1}. کد: ${b.code} | دلیل: ${b.reason || 'نامشخص'}\n`;
                        });
                    }
                    const teamSummary = joinNonZeroMetrics([['نصب‌شده', doneBoxes.length, ''], ['نصب‌نشده', notDoneBoxes.length, '']]);
                    if (teamSummary) text += `  جمع تیم: ${teamSummary}\n`;
                    if (teamIdx < cab.teams.length - 1) text += '\n';
                });

                const allBoxes = [];
                cab.teams.forEach(t => allBoxes.push(...t.boxes));
                const doneInCab = allBoxes.filter(b => b.status !== 'not_done');
                const notDoneInCab = allBoxes.filter(b => b.status === 'not_done');
                const cabSummary = joinNonZeroMetrics([['نصب‌شده', doneInCab.length, ''], ['نصب‌نشده', notDoneInCab.length, ''], ['مصرفی FAT48', doneInCab.length, 'عدد']]);
                if (cabSummary) text += `\n📊 جمع کابینت: ${cabSummary}\n`;
                if (cabIdx < data.cabinets.length - 1) text += '\n';
            });

            const totalBoxes = data.cabinets.reduce((sum, cab) => {
                let c = 0;
                cab.teams.forEach(t => c += t.boxes.length);
                return sum + c;
            }, 0);
            const totalDone = data.cabinets.reduce((sum, cab) => {
                let c = 0;
                cab.teams.forEach(t => c += t.boxes.filter(b => b.status !== 'not_done').length);
                return sum + c;
            }, 0);
            const totalNotDone = totalBoxes - totalDone;

            text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
            const totalMetrics = joinNonZeroMetrics([
                ['تعداد کل باکس‌ها', totalBoxes, ''], ['نصب‌شده', totalDone, ''],
                ['نصب‌نشده', totalNotDone, ''], ['باکس FAT48 مصرفی', totalDone, 'عدد']
            ], '\n');
            if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';

            return text;
        }

        function buildFatPreviewHTML(data) {
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

            let totalDone = 0, totalNotDone = 0;
            data.cabinets.forEach(c => {
                let cabDone = 0, cabNotDone = 0;
                let teamRows = '';
                (c.teams || []).forEach(t => {
                    const boxes = t.boxes || [];
                    const d = boxes.filter(b => b.status !== 'not_done');
                    const n = boxes.filter(b => b.status === 'not_done');
                    cabDone += d.length;
                    cabNotDone += n.length;
                    const dRows = d.map(b => `<tr><td>${escP(b.code)}</td><td>${escP(b.desc)}</td><td>FAT48</td></tr>`).join('');
                    const nRows = n.map(b => `<tr><td>${escP(b.code)}</td><td>${escP(b.reason)}</td></tr>`).join('');
                    if (dRows || nRows) {
                        teamRows += `<div class="team"><h3>تیم: ${escP(t.teamName)}</h3>`;
                        if(dRows) teamRows += `<h4 class="done">✅ نصب‌شده</h4><table><thead><tr><th>کد</th><th>توضیحات</th><th>نوع</th></tr></thead><tbody>${dRows}</tbody></table>`;
                        if(nRows) teamRows += `<h4 class="notdone">❌ نصب‌نشده</h4><table><thead><tr><th>کد</th><th>دلیل</th></tr></thead><tbody>${nRows}</tbody></table>`;
                        teamRows += `</div>`;
                    }
                });
                totalDone += cabDone;
                totalNotDone += cabNotDone;
                content += `<div class="cab"><h2>کابینت ${escP(c.cabinetNumber)} — ${escP(c.province)} / ${escP(c.city)} / منطقه ${escP(c.region)}</h2>`;
                content += teamRows;
                const cabPreviewSummary = joinNonZeroMetrics([['نصب‌شده', cabDone, ''], ['نصب‌نشده', cabNotDone, ''], ['مصرفی FAT48', cabDone, 'عدد']]);
                if (cabPreviewSummary) content += `<div class="cab-summary">📊 جمع کابینت: ${cabPreviewSummary}</div>`;
                content += `</div>`;
            });
            const finalPreviewSummary = joinNonZeroMetrics([['نصب‌شده', totalDone, 'باکس FAT48'], ['نصب‌نشده', totalNotDone, '']]);
            content += `<div class="summary"><b>خلاصه نهایی:</b> ${finalPreviewSummary}</div><button class="no-print" onclick="window.print()">🖨️ چاپ</button></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
            return content;

        }

        // ---- شوت فیبر ----

<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { AppSettings, DashboardData, LeaveEntry, MailTemplateType } from '$lib/types';

	export let data: PageData;

	let dashboard: DashboardData = data.dashboard;
	let busy = false;
	let message = '';
	let messageType: 'info' | 'error' = 'info';
	let selectedMailType: MailTemplateType = 'check_in';
	let selectedTemplateType: MailTemplateType = 'check_in';
	const mailTypes: MailTemplateType[] = ['check_in', 'check_out', 'outing', 'return'];
	const mailTypeLabels: Record<MailTemplateType, string> = {
		check_in: '출근',
		check_out: '퇴근',
		outing: '외출',
		return: '복귀'
	};

	let settingsForm = toSettingsForm(dashboard.settings);
	let attendanceForm = createAttendanceForm(dashboard);
	let outingForm = createOutingForm(dashboard);
	let leaveForm = createLeaveForm();
	let mailForm = createMailForm(dashboard.mailPreview[selectedMailType]);
	let selectedTemplateKeys = getTemplateKeys(selectedTemplateType);

	$: selectedTemplateKeys = getTemplateKeys(selectedTemplateType);
	$: syncMailFormWithSettings(
		selectedMailType,
		settingsForm.name,
		settingsForm.defaultTo,
		settingsForm.defaultCc,
		settingsForm.emailSignature,
		JSON.stringify(settingsForm.templates),
		outingForm.reason,
		outingForm.destination,
		outingForm.endTime,
		dashboard.attendance.todayStatus.date,
		dashboard.attendance.todayStatus.checkIn ?? '',
		dashboard.attendance.todayStatus.checkOut ?? ''
	);

	$: if (data.dashboard !== dashboard) {
		dashboard = data.dashboard;
		syncFormsFromDashboard();
	}

	function setMessage(text: string, type: 'info' | 'error' = 'info') {
		message = text;
		messageType = type;
	}

	async function api<T>(url: string, init?: RequestInit): Promise<T> {
		const response = await fetch(url, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				...(init?.headers ?? {})
			}
		});
		const payload = (await response.json()) as T & { message?: string; errorMessage?: string };
		if (!response.ok) {
			throw new Error(payload.message ?? payload.errorMessage ?? '요청 처리에 실패했습니다.');
		}
		return payload;
	}

	async function refreshDashboard() {
		dashboard = await api<DashboardData>('/api/dashboard');
		syncFormsFromDashboard();
	}

	function localDate() {
		const now = new Date();
		const year = now.getFullYear();
		const month = `${now.getMonth() + 1}`.padStart(2, '0');
		const day = `${now.getDate()}`.padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function localTime() {
		return new Date().toTimeString().slice(0, 5);
	}

	function toCommaList(value: string) {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function hours(minutes: number) {
		return (minutes / 60).toFixed(2);
	}

	function toSettingsForm(settings: AppSettings) {
		return {
			name: settings.name,
			annualAllowance: String(settings.annualAllowance),
			workStartTime: settings.workStartTime,
			workEndTime: settings.workEndTime,
			defaultTo: settings.defaultTo.join(', '),
			defaultCc: settings.defaultCc.join(', '),
			emailSignature: settings.emailSignature,
			templates: { ...settings.templates }
		};
	}

	function createAttendanceForm(source: DashboardData) {
		const today = source.attendance.todayStatus.date;
		const record = source.attendance.recentLogs.find((log) => log.date === today);
		return {
			date: today,
			checkIn: record?.checkIn ?? '',
			checkOut: record?.checkOut ?? '',
			note: record?.note ?? ''
		};
	}

	function syncAttendanceForm(
		current: ReturnType<typeof createAttendanceForm>,
		source: DashboardData
	) {
		const record = source.attendance.recentLogs.find((log) => log.date === current.date);
		return {
			date: current.date,
			checkIn: record?.checkIn ?? current.checkIn,
			checkOut: record?.checkOut ?? current.checkOut,
			note: record?.note ?? current.note
		};
	}

	function createOutingForm(source: DashboardData) {
		const active = source.attendance.todayStatus.activeOuting;
		return {
			date: source.attendance.todayStatus.date,
			startTime: localTime(),
			endTime: localTime(),
			reason: active?.reason ?? '업무 관련 외출',
			destination: active?.destination ?? '',
			status: active?.status ?? 'approved'
		};
	}

	function syncOutingForm(current: ReturnType<typeof createOutingForm>, source: DashboardData) {
		const active = source.attendance.todayStatus.activeOuting;
		return {
			...current,
			date: source.attendance.todayStatus.date,
			reason: active?.reason ?? current.reason,
			destination: active?.destination ?? current.destination,
			status: active?.status ?? current.status
		};
	}

	function createLeaveForm() {
		return {
			date: localDate(),
			type: 'annual',
			unit: 'day',
			amount: '1',
			reason: '',
			status: 'approved',
			note: '',
			requiresDocument: false
		};
	}

	function createMailForm(preview: DashboardData['mailPreview'][MailTemplateType]) {
		return {
			to: preview.to.join(', '),
			cc: preview.cc.join(', '),
			subject: preview.subject,
			body: preview.body
		};
	}

	function syncFormsFromDashboard() {
		settingsForm = toSettingsForm(dashboard.settings);
		attendanceForm = syncAttendanceForm(attendanceForm, dashboard);
		outingForm = syncOutingForm(outingForm, dashboard);
		mailForm = createMailForm(dashboard.mailPreview[selectedMailType]);
	}

	function formatPrettyDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		if (!year || !month || !day) return value;
		return `${month}월 ${day}일`;
	}

	function renderTemplate(template: string, variables: Record<string, string>) {
		return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
	}

	function createMailPreviewFromSettings(type: MailTemplateType) {
		const keys = getTemplateKeys(type);
		const today = dashboard.attendance.todayStatus.date;
		const currentTime =
			type === 'check_out'
				? (dashboard.attendance.todayStatus.checkOut ?? localTime())
				: (dashboard.attendance.todayStatus.checkIn ?? localTime());
		const variables = {
			name: settingsForm.name,
			date: today,
			pretty_date: formatPrettyDate(today),
			time: currentTime,
			reason: outingForm.reason || '업무 관련 외출',
			destination: outingForm.destination || '외부 일정',
			return_time: outingForm.endTime || '',
			signature: settingsForm.emailSignature
		};

		return {
			to: toCommaList(settingsForm.defaultTo).join(', '),
			cc: toCommaList(settingsForm.defaultCc).join(', '),
			subject: renderTemplate(settingsForm.templates[keys.subject], variables),
			body: renderTemplate(settingsForm.templates[keys.body], variables)
		};
	}

	function syncMailFormWithSettings(..._deps: string[]) {
		void _deps;
		const preview = createMailPreviewFromSettings(selectedMailType);
		mailForm = {
			to: preview.to,
			cc: preview.cc,
			subject: preview.subject,
			body: preview.body
		};
	}

	function getTemplateKeys(type: MailTemplateType) {
		return {
			subject: `${type}_subject` as const,
			body: `${type}_body` as const
		};
	}

	function resetTemplateEditor(type: MailTemplateType) {
		const previewType = type;
		const latest = toSettingsForm(dashboard.settings);
		const keys = getTemplateKeys(previewType);
		settingsForm.templates[keys.subject] = latest.templates[keys.subject];
		settingsForm.templates[keys.body] = latest.templates[keys.body];
	}

	async function runTask(task: () => Promise<void>) {
		busy = true;
		try {
			await task();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : '작업 중 오류가 발생했습니다.', 'error');
		} finally {
			busy = false;
		}
	}

	async function submitAttendance() {
		await runTask(async () => {
			await api('/api/attendance', {
				method: 'PATCH',
				body: JSON.stringify(attendanceForm)
			});
			await refreshDashboard();
			setMessage('근태 기록을 저장했습니다.');
		});
	}

	async function submitSettings() {
		await runTask(async () => {
			await api('/api/settings', {
				method: 'PATCH',
				body: JSON.stringify({
					name: settingsForm.name,
					annualAllowance: Number(settingsForm.annualAllowance),
					workStartTime: settingsForm.workStartTime,
					workEndTime: settingsForm.workEndTime,
					defaultTo: toCommaList(settingsForm.defaultTo),
					defaultCc: toCommaList(settingsForm.defaultCc),
					emailSignature: settingsForm.emailSignature,
					templates: settingsForm.templates
				})
			});
			await refreshDashboard();
			setMessage('설정을 저장했습니다.');
		});
	}

	async function createLeave() {
		await runTask(async () => {
			await api('/api/leaves', {
				method: 'POST',
				body: JSON.stringify({
					...leaveForm,
					amount: Number(leaveForm.amount)
				})
			});
			leaveForm = createLeaveForm();
			await refreshDashboard();
			setMessage('휴가/병가/결근 항목을 추가했습니다.');
		});
	}

	async function deleteLeave(entry: LeaveEntry) {
		await runTask(async () => {
			await api(`/api/leaves?id=${entry.id}`, { method: 'DELETE' });
			await refreshDashboard();
			setMessage('항목을 삭제했습니다.');
		});
	}

	async function connectGmail() {
		await goto('/auth/gmail/start');
	}

	async function disconnectGmail() {
		await runTask(async () => {
			await api('/api/settings', {
				method: 'PATCH',
				body: JSON.stringify({ disconnectGmail: true })
			});
			await refreshDashboard();
			setMessage('Gmail 연동을 해제했습니다.');
		});
	}

	async function sendPreviewMail() {
		await runTask(async () => {
			const result = await api<{ success: boolean; errorMessage?: string }>('/api/mail/send', {
				method: 'POST',
				body: JSON.stringify({
					type: selectedMailType,
					to: toCommaList(mailForm.to),
					cc: toCommaList(mailForm.cc),
					subject: mailForm.subject,
					body: mailForm.body,
					date: dashboard.attendance.todayStatus.date,
					time: localTime(),
					reason: outingForm.reason,
					destination: outingForm.destination,
					returnTime: outingForm.endTime
				})
			});
			await refreshDashboard();
			setMessage(
				result.success ? '메일을 전송했습니다.' : (result.errorMessage ?? '메일 전송 실패')
			);
		});
	}

	function chooseMailType(type: MailTemplateType) {
		selectedMailType = type;
		syncMailFormWithSettings();
	}

	async function quickAction(type: MailTemplateType) {
		await runTask(async () => {
			const date = dashboard.attendance.todayStatus.date;
			const time = localTime();

			if (type === 'check_in') {
				await api('/api/attendance', {
					method: 'POST',
					body: JSON.stringify({ date, checkIn: time })
				});
			}

			if (type === 'check_out') {
				await api('/api/attendance', {
					method: 'PATCH',
					body: JSON.stringify({ date, checkOut: time })
				});
			}

			if (type === 'outing') {
				await api('/api/outings', {
					method: 'POST',
					body: JSON.stringify({
						date,
						startTime: time,
						reason: outingForm.reason,
						destination: outingForm.destination,
						status: outingForm.status
					})
				});
			}

			if (type === 'return') {
				const active = dashboard.attendance.todayStatus.activeOuting;
				if (!active) {
					throw new Error('복귀 처리할 진행 중 외출이 없습니다.');
				}
				await api('/api/outings', {
					method: 'PATCH',
					body: JSON.stringify({
						id: active.id,
						date,
						endTime: time,
						reason: outingForm.reason,
						destination: outingForm.destination,
						status: outingForm.status
					})
				});
			}

			await refreshDashboard();
			if (dashboard.settings.gmailConnected) {
				await api('/api/mail/send', {
					method: 'POST',
					body: JSON.stringify({
						type,
						date,
						time,
						reason: outingForm.reason,
						destination: outingForm.destination,
						returnTime: outingForm.endTime
					})
				});
				await refreshDashboard();
				setMessage('기록 저장과 메일 전송을 완료했습니다.');
			} else {
				setMessage('기록은 저장했고, Gmail 미연동 상태라 메일은 전송하지 않았습니다.');
			}
		});
	}
</script>

<svelte:head>
	<title>전문연구요원 복무관리</title>
	<meta
		name="description"
		content="전문연구요원 출퇴근, 외출, 휴가, Gmail 메일 전송을 한 화면에서 관리하는 대시보드"
	/>
</svelte:head>

<main class="shell">
	<div class="dashboard stack">
		<section class="hero">
			<span class="eyebrow">Military Alternate Service Dashboard</span>
			<h1>전문연구요원 복무관리 대시보드</h1>
			<p>
				복무관리 매뉴얼 기준 경고를 즉시 확인하고, 출근·퇴근·외출·복귀 메일을 한 번에 처리하는
				개인용 웹페이지입니다.
			</p>

			<div class="hero-grid">
				<div class="metric">
					<span class="subtle">오늘 상태</span>
					<strong>{dashboard.attendance.todayStatus.lastActionLabel}</strong>
					<span>{dashboard.attendance.todayStatus.date}</span>
				</div>
				<div class="metric">
					<span class="subtle">주간 누적</span>
					<strong>{hours(dashboard.attendance.weeklySummary.totalMinutes)}h</strong>
					<span>부족 {hours(dashboard.attendance.weeklySummary.deficitMinutes)}h</span>
				</div>
				<div class="metric">
					<span class="subtle">남은 연가</span>
					<strong>{dashboard.leave.remainingLeave.toFixed(2)}일</strong>
					<span>총 {dashboard.leave.annualAllowance}일 기준</span>
				</div>
				<div class="metric">
					<span class="subtle">Gmail 연동</span>
					<strong>{dashboard.settings.gmailConnected ? '연결됨' : '미연결'}</strong>
					<span>{dashboard.settings.gmailEmail ?? '메일 계정 없음'}</span>
				</div>
			</div>

			<div class="button-row" style="margin-top: 1rem;">
				<button class="button primary" on:click={() => quickAction('check_in')} disabled={busy}>
					출근 처리
				</button>
				<button class="button primary" on:click={() => quickAction('check_out')} disabled={busy}>
					퇴근 처리
				</button>
				<button class="button secondary" on:click={() => quickAction('outing')} disabled={busy}>
					외출 시작
				</button>
				<button class="button secondary" on:click={() => quickAction('return')} disabled={busy}>
					복귀 처리
				</button>
			</div>

			{#if message}
				<div class={`message ${messageType === 'error' ? 'error' : ''}`}>{message}</div>
			{/if}
		</section>

		<div class="grid-3">
			<section class="panel">
				<div class="kicker">
					<div>
						<h2>오늘 복무 상태</h2>
						<p class="subtle">출퇴근과 외출의 현재 상태를 기준으로 빠른 액션을 제공합니다.</p>
					</div>
					<span class="status-badge">{dashboard.attendance.todayStatus.state}</span>
				</div>
				<div class="stack">
					<div class="metric">
						<span class="subtle">출근</span>
						<strong>{dashboard.attendance.todayStatus.checkIn ?? '--:--'}</strong>
					</div>
					<div class="metric">
						<span class="subtle">퇴근</span>
						<strong>{dashboard.attendance.todayStatus.checkOut ?? '--:--'}</strong>
					</div>
					<div class="metric">
						<span class="subtle">진행 중 외출</span>
						<strong>{dashboard.attendance.todayStatus.activeOuting?.startTime ?? '없음'}</strong>
						<span>{dashboard.attendance.todayStatus.activeOuting?.reason ?? '대기 중'}</span>
					</div>
				</div>
			</section>

			<section class="panel">
				<div class="kicker">
					<div>
						<h2>주간 복무 집계</h2>
						<p class="subtle">월~금 기준 40시간 충족 여부와 일별 부족 시간을 보여줍니다.</p>
					</div>
				</div>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>요일</th>
								<th>복무시간</th>
								<th>부족시간</th>
							</tr>
						</thead>
						<tbody>
							{#each dashboard.attendance.weeklySummary.days as day (day.date)}
								<tr>
									<td>{day.label}</td>
									<td>{hours(day.totalMinutes)}h</td>
									<td>{hours(day.deficitMinutes)}h</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section class="panel">
				<div class="kicker">
					<div>
						<h2>복무 경고</h2>
						<p class="subtle">연가, 병가, 무단결근 위험을 매뉴얼 기준으로 계산합니다.</p>
					</div>
				</div>
				<div class="alert-list">
					{#each dashboard.attendance.complianceAlerts as alert (alert.id)}
						<div class={`alert ${alert.severity}`}>
							<strong>{alert.title}</strong>
							<div>{alert.description}</div>
						</div>
					{/each}
				</div>
			</section>
		</div>

		<div class="grid-2">
			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>수동 근태 기록</h2>
						<p class="subtle">특정 날짜의 출근/퇴근 시각과 메모를 직접 정정할 수 있습니다.</p>
					</div>
				</div>
				<div class="form-grid">
					<div class="field">
						<label for="attendance-date">날짜</label>
						<input id="attendance-date" type="date" bind:value={attendanceForm.date} />
					</div>
					<div class="field">
						<label for="attendance-checkin">출근</label>
						<input id="attendance-checkin" type="time" bind:value={attendanceForm.checkIn} />
					</div>
					<div class="field">
						<label for="attendance-checkout">퇴근</label>
						<input id="attendance-checkout" type="time" bind:value={attendanceForm.checkOut} />
					</div>
				</div>
				<div class="field">
					<label for="attendance-note">메모</label>
					<textarea id="attendance-note" bind:value={attendanceForm.note}></textarea>
				</div>
				<div class="toolbar">
					<button class="button primary" on:click={submitAttendance} disabled={busy}
						>근태 저장</button
					>
				</div>
			</section>

			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>외출 관리</h2>
						<p class="subtle">외출 사유와 행선지를 입력한 뒤 빠른 액션 버튼으로 시작/복귀합니다.</p>
					</div>
				</div>
				<div class="form-grid">
					<div class="field">
						<label for="outing-reason">사유</label>
						<input id="outing-reason" bind:value={outingForm.reason} />
					</div>
					<div class="field">
						<label for="outing-destination">행선지</label>
						<input id="outing-destination" bind:value={outingForm.destination} />
					</div>
					<div class="field">
						<label for="outing-status">처리 상태</label>
						<select id="outing-status" bind:value={outingForm.status}>
							<option value="approved">승인</option>
							<option value="unauthorized">무단</option>
						</select>
					</div>
					<div class="field">
						<label for="outing-return">예정/복귀 시각</label>
						<input id="outing-return" type="time" bind:value={outingForm.endTime} />
					</div>
				</div>
				<div class="toolbar">
					<button class="button secondary" on:click={() => quickAction('outing')} disabled={busy}>
						외출 시작 + 메일
					</button>
					<button class="button secondary" on:click={() => quickAction('return')} disabled={busy}>
						복귀 처리 + 메일
					</button>
				</div>
			</section>
		</div>

		<div class="grid-2">
			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>휴가 / 병가 / 결근</h2>
						<p class="subtle">연가, 병가, 결근을 일/시간 단위로 입력하고 남은 횟수를 계산합니다.</p>
					</div>
				</div>
				<div class="hero-grid">
					<div class="metric">
						<span class="subtle">연가 사용</span>
						<strong>{dashboard.leave.usedLeaveDays.toFixed(2)}일</strong>
						<span>시간 {dashboard.leave.usedLeaveHours.toFixed(2)}h</span>
					</div>
					<div class="metric">
						<span class="subtle">외출 환산</span>
						<strong>{dashboard.leave.outingConvertedLeaveDays}일</strong>
						<span>지각/조퇴/외출 누계 기준</span>
					</div>
					<div class="metric">
						<span class="subtle">병가 누적</span>
						<strong>{dashboard.leave.sickDaysUsed.toFixed(2)}일</strong>
						<span>초과 {dashboard.leave.sickDaysOverLimit.toFixed(2)}일</span>
					</div>
					<div class="metric">
						<span class="subtle">무단결근 누계</span>
						<strong>{dashboard.leave.unauthorizedAbsenceDays.toFixed(2)}일</strong>
						<span>예상 연장 {dashboard.leave.expectedExtensionDays.toFixed(2)}일</span>
					</div>
				</div>
				<div class="form-grid">
					<div class="field">
						<label for="leave-date">날짜</label>
						<input id="leave-date" type="date" bind:value={leaveForm.date} />
					</div>
					<div class="field">
						<label for="leave-type">종류</label>
						<select id="leave-type" bind:value={leaveForm.type}>
							<option value="annual">연가</option>
							<option value="sick">병가</option>
							<option value="absence">결근</option>
						</select>
					</div>
					<div class="field">
						<label for="leave-unit">단위</label>
						<select id="leave-unit" bind:value={leaveForm.unit}>
							<option value="day">일</option>
							<option value="hour">시간</option>
						</select>
					</div>
					<div class="field">
						<label for="leave-amount">수량</label>
						<input
							id="leave-amount"
							type="number"
							min="0"
							step="0.5"
							bind:value={leaveForm.amount}
						/>
					</div>
					<div class="field">
						<label for="leave-status">상태</label>
						<select id="leave-status" bind:value={leaveForm.status}>
							<option value="approved">승인</option>
							<option value="unauthorized">무단</option>
						</select>
					</div>
				</div>
				<div class="field">
					<label for="leave-reason">사유</label>
					<input id="leave-reason" bind:value={leaveForm.reason} />
				</div>
				<div class="field">
					<label for="leave-note">비고</label>
					<textarea id="leave-note" bind:value={leaveForm.note}></textarea>
				</div>
				<label class="subtle">
					<input type="checkbox" bind:checked={leaveForm.requiresDocument} />
					7일 초과 병가 등 증빙 필요 항목
				</label>
				<div class="toolbar">
					<button class="button primary" on:click={createLeave} disabled={busy}>항목 추가</button>
				</div>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>날짜</th>
								<th>종류</th>
								<th>수량</th>
								<th>상태</th>
								<th>사유</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each dashboard.leave.entries as entry (entry.id)}
								<tr>
									<td>{entry.date}</td>
									<td>{entry.type}</td>
									<td>{entry.amount} {entry.unit === 'day' ? '일' : '시간'}</td>
									<td>{entry.status}</td>
									<td>{entry.reason || '-'}</td>
									<td>
										<button
											class="button ghost"
											on:click={() => deleteLeave(entry)}
											disabled={busy}
										>
											삭제
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>설정 및 Gmail 연동</h2>
						<p class="subtle">
							기본 수신자, 복무 기준 시각, 템플릿, Gmail OAuth 연결을 관리합니다.
						</p>
					</div>
					<span class="status-badge">{dashboard.settings.gmailConnected ? '연결됨' : '미연결'}</span
					>
				</div>
				<div class="form-grid">
					<div class="field">
						<label for="setting-name">이름</label>
						<input id="setting-name" bind:value={settingsForm.name} />
					</div>
					<div class="field">
						<label for="setting-annual">연가 총량</label>
						<input
							id="setting-annual"
							type="number"
							step="0.5"
							bind:value={settingsForm.annualAllowance}
						/>
					</div>
					<div class="field">
						<label for="setting-start">기준 출근</label>
						<input id="setting-start" type="time" bind:value={settingsForm.workStartTime} />
					</div>
					<div class="field">
						<label for="setting-end">기준 퇴근</label>
						<input id="setting-end" type="time" bind:value={settingsForm.workEndTime} />
					</div>
				</div>
				<div class="field">
					<label for="setting-to">기본 수신자</label>
					<input id="setting-to" bind:value={settingsForm.defaultTo} />
				</div>
				<div class="field">
					<label for="setting-cc">기본 참조</label>
					<input id="setting-cc" bind:value={settingsForm.defaultCc} />
				</div>
				<div class="field">
					<label for="setting-signature">서명</label>
					<textarea id="setting-signature" bind:value={settingsForm.emailSignature}></textarea>
				</div>
				<div class="panel" style="padding: 1rem; background: rgba(255, 255, 255, 0.55);">
					<div class="kicker" style="margin-bottom: 0.5rem;">
						<div>
							<h3>기본 메일 템플릿 저장</h3>
							<p class="subtle">여기서 수정한 템플릿은 `설정 저장` 시 기본값으로 저장됩니다.</p>
						</div>
					</div>
					<div class="toolbar" style="margin-bottom: 0.75rem;">
						{#each mailTypes as type (type)}
							<button
								class={`button ${selectedTemplateType === type ? 'primary' : 'secondary'}`}
								on:click={() => (selectedTemplateType = type)}
								type="button"
							>
								{mailTypeLabels[type]}
							</button>
						{/each}
					</div>
					<div class="field">
						<label for="template-subject">
							{mailTypeLabels[selectedTemplateType]} 메일 제목
						</label>
						<input
							id="template-subject"
							bind:value={settingsForm.templates[selectedTemplateKeys.subject]}
						/>
					</div>
					<div class="field">
						<label for="template-body">
							{mailTypeLabels[selectedTemplateType]} 메일 본문
						</label>
						<textarea
							id="template-body"
							bind:value={settingsForm.templates[selectedTemplateKeys.body]}
						></textarea>
					</div>
					<p class="subtle">
						사용 가능한 변수: <span class="code">{'{{name}}'}</span>,
						<span class="code">{'{{pretty_date}}'}</span>, <span class="code">{'{{time}}'}</span>,
						<span class="code">{'{{signature}}'}</span>
					</p>
					<div class="toolbar">
						<button
							class="button ghost"
							on:click={() => resetTemplateEditor(selectedTemplateType)}
							disabled={busy}
							type="button"
						>
							현재 저장값으로 되돌리기
						</button>
					</div>
				</div>
				<div class="toolbar">
					<button class="button primary" on:click={submitSettings} disabled={busy}>설정 저장</button
					>
					<button class="button secondary" on:click={connectGmail} disabled={busy}
						>Gmail 연결</button
					>
					<button class="button ghost" on:click={disconnectGmail} disabled={busy}>연결 해제</button>
				</div>
			</section>
		</div>

		<div class="grid-2">
			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>메일 템플릿 / 전송</h2>
						<p class="subtle">출근, 퇴근, 외출, 복귀 템플릿을 확인하고 수동 발송할 수 있습니다.</p>
					</div>
				</div>
				<div class="toolbar">
					{#each mailTypes as type (type)}
						<button
							class={`button ${selectedMailType === type ? 'primary' : 'secondary'}`}
							on:click={() => chooseMailType(type)}
						>
							{type}
						</button>
					{/each}
				</div>
				<div class="field">
					<label for="mail-to">To</label>
					<input id="mail-to" bind:value={mailForm.to} />
				</div>
				<div class="field">
					<label for="mail-cc">Cc</label>
					<input id="mail-cc" bind:value={mailForm.cc} />
				</div>
				<div class="field">
					<label for="mail-subject">제목</label>
					<input id="mail-subject" bind:value={mailForm.subject} />
				</div>
				<div class="field">
					<label for="mail-body">본문</label>
					<textarea id="mail-body" bind:value={mailForm.body}></textarea>
				</div>
				<div class="toolbar">
					<button class="button primary" on:click={sendPreviewMail} disabled={busy}
						>수동 전송</button
					>
				</div>
			</section>

			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>최근 메일 이력</h2>
						<p class="subtle">Gmail API 전송 성공 여부와 오류 메시지를 확인합니다.</p>
					</div>
				</div>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>시각</th>
								<th>종류</th>
								<th>수신자</th>
								<th>결과</th>
							</tr>
						</thead>
						<tbody>
							{#each dashboard.mailHistory as item (item.id)}
								<tr>
									<td class="code">{item.sentAt.replace('T', ' ').slice(0, 16)}</td>
									<td>{item.type}</td>
									<td>{item.recipients.join(', ') || '-'}</td>
									<td>{item.success ? '성공' : (item.errorMessage ?? '실패')}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		</div>

		<div class="grid-2">
			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>최근 근태 기록</h2>
						<p class="subtle">최근 14일 기준 출근/퇴근/총 복무시간을 확인합니다.</p>
					</div>
				</div>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>날짜</th>
								<th>출근</th>
								<th>퇴근</th>
								<th>총 복무시간</th>
							</tr>
						</thead>
						<tbody>
							{#each dashboard.attendance.recentLogs as log (log.id)}
								<tr>
									<td>{log.date}</td>
									<td>{log.checkIn ?? '-'}</td>
									<td>{log.checkOut ?? '-'}</td>
									<td>{hours(log.totalWorkMinutes)}h</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section class="panel stack">
				<div class="kicker">
					<div>
						<h2>최근 외출 이력</h2>
						<p class="subtle">누적 외출 시간은 연가 환산 계산에 반영됩니다.</p>
					</div>
				</div>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>날짜</th>
								<th>시작</th>
								<th>복귀</th>
								<th>시간</th>
								<th>상태</th>
							</tr>
						</thead>
						<tbody>
							{#each dashboard.outings as outing (outing.id)}
								<tr>
									<td>{outing.date}</td>
									<td>{outing.startTime}</td>
									<td>{outing.endTime ?? '-'}</td>
									<td>{hours(outing.durationMinutes)}h</td>
									<td>{outing.status}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	</div>
</main>

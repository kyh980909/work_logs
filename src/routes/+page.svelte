<script lang="ts">
	import { onMount } from 'svelte';
	import WorkLogForm from '../components/WorkLogForm.svelte';
	import WorkLogTable from '../components/WorkLogTable.svelte';
	import WorkSummary from '../components/WorkSummary.svelte';

	interface WorkRecord {
		date: string;
		duration: number;
	}

	let records: WorkRecord[] = [];
	let totalHours: number = 0;
	let overtime: number = 0;

	async function fetchRecords(): Promise<void> {
		const response = await fetch('/api/work-hours');
		const data = await response.json();
		records = data.records;
		totalHours = data.totalHours;
		overtime = data.overtime;
	}

	function updateRecords(newRecords: WorkRecord[]): void {
		records = newRecords;
		totalHours = records.reduce((sum, r) => sum + r.duration, 0);
		overtime = Math.max(totalHours - 40, 0);
	}

	onMount(fetchRecords);
</script>

<main class="min-h-screen bg-gray-50 p-8 transition-all dark:bg-gray-900">
	<h1 class="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-white">근무 시간 관리</h1>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="glass rounded-lg p-6 shadow-lg">
			<h2 class="text-xl font-semibold text-gray-800 dark:text-gray-300">근무 시간 기록</h2>
			<p class="mb-4 text-gray-600 dark:text-gray-400">출퇴근 시간을 기록하세요.</p>
			<WorkLogForm on:recordAdded={(e) => updateRecords(e.detail)} />
		</div>

		<div class="glass rounded-lg p-6 shadow-lg">
			<h2 class="text-xl font-semibold text-gray-800 dark:text-gray-300">주간 요약</h2>
			<WorkSummary {totalHours} {overtime} />
		</div>
	</div>

	<div class="glass mt-6 rounded-lg p-6 shadow-lg">
		<WorkLogTable {records} />
	</div>
</main>

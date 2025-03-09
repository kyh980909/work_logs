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

<main class="min-h-screen bg-gray-50 p-8">
	<h1 class="mb-6 text-2xl font-bold">근무 시간 관리</h1>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="rounded-lg bg-white p-6 shadow-md">
			<h2 class="text-xl font-semibold">근무 시간 기록</h2>
			<WorkLogForm on:recordAdded={(e) => updateRecords(e.detail)} />
		</div>
		<div class="rounded-lg bg-white p-6 shadow-md">
			<h2 class="text-xl font-semibold">주간 요약</h2>
			<WorkSummary {totalHours} {overtime} />
		</div>
	</div>
	<div class="mt-6">
		<WorkLogTable {records} />
	</div>
</main>

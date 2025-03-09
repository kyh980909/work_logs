<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let date = '';
	let startTime = '';
	let endTime = '';
	const dispatch = createEventDispatcher();

	async function addRecord() {
		if (!date || !startTime || !endTime) {
			alert('모든 필드를 입력하세요.');
			return;
		}

		const response = await fetch('/api/work-hours', {
			method: 'POST',
			body: JSON.stringify({ date, startTime, endTime }),
			headers: { 'Content-Type': 'application/json' }
		});

		const data = await response.json();
		dispatch('recordAdded', data.records);
	}
</script>

<div>
	<label>날짜: <input type="date" bind:value={date} /></label>
	<label>출근 시간: <input type="time" bind:value={startTime} /></label>
	<label>퇴근 시간: <input type="time" bind:value={endTime} /></label>
	<button on:click={addRecord}>기록 추가</button>
</div>

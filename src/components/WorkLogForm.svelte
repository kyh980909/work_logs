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

<div class="glass-form">
	<h2 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-300">근무 시간 기록</h2>

	<label class="mb-2 block text-gray-700 dark:text-gray-300">날짜</label>
	<input type="date" bind:value={date} class="input-field" />

	<label class="mt-4 mb-2 block text-gray-700 dark:text-gray-300">출근 시간</label>
	<input type="time" bind:value={startTime} class="input-field" />

	<label class="mt-4 mb-2 block text-gray-700 dark:text-gray-300">퇴근 시간</label>
	<input type="time" bind:value={endTime} class="input-field" />

	<button on:click={addRecord} class="submit-button"> 기록 추가 </button>
</div>

<style>
	.glass-form {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(10px);
		transition: all 0.3s ease-in-out;
	}

	.input-field {
		width: 100%;
		padding: 10px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.2);
		background: rgba(255, 255, 255, 0.2);
		transition: all 0.3s ease-in-out;
	}

	.input-field:focus {
		border-color: #4f46e5;
		background: rgba(255, 255, 255, 0.4);
	}

	.submit-button {
		width: 100%;
		margin-top: 10px;
		padding: 12px;
		background: #4f46e5;
		color: white;
		font-weight: bold;
		border-radius: 8px;
		transition: all 0.3s ease-in-out;
	}

	.submit-button:hover {
		background: #4338ca;
		transform: scale(1.05);
	}
</style>

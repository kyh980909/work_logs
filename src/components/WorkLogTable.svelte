<script lang="ts">
	import type { WorkRecord } from '$lib/types';

	export let records: WorkRecord[] = [];
</script>

<div class="glass-container">
	<table class="w-full border-collapse overflow-hidden rounded-xl text-center shadow-lg">
		<thead class="bg-indigo-600 text-lg font-semibold text-white">
			<tr>
				<th class="p-4">날짜</th>
				<th class="p-4">근무시간</th>
			</tr>
		</thead>
		<tbody class="bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300">
			{#each records as r}
				<tr
					class="border-b border-gray-300 transition-all hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700"
				>
					<td class="p-4">{r.date}</td>
					<td class="p-4">{r.duration.toFixed(2)} 시간</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.glass-container {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		padding: 20px;
		margin-top: 20px;
		transition: all 0.3s ease-in-out;
	}
</style>

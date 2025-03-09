<script lang="ts">
	import type { WorkRecord } from '$lib/types';

	export let records: WorkRecord[] = [];
</script>

<table>
	<thead>
		<tr><th>날짜</th><th>근무시간</th></tr>
	</thead>
	<tbody>
		{#each records as r}
			<tr><td>{r.date}</td><td>{r.duration.toFixed(2)} 시간</td></tr>
		{/each}
	</tbody>
</table>

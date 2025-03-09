<script lang="ts">
	export let totalHours: number = 0;
	export let overtime: number = 0;
</script>

<div class="rounded-lg bg-white p-6 text-center shadow-md">
	<h2 class="text-xl font-semibold">주간 근무 요약</h2>
	<p class="mt-2 text-gray-700">총 근무시간: <strong>{totalHours.toFixed(2)}</strong> 시간</p>
	<p class="mt-2 text-red-500">초과 근무시간: <strong>{overtime.toFixed(2)}</strong> 시간</p>
</div>

<style>
	div {
		margin-top: 2rem;
	}
</style>

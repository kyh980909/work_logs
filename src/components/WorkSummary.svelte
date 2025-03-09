<script lang="ts">
	export let totalHours: number = 0;
	export let overtime: number = 0;
</script>

<div class="glass-summary">
	<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-300">주간 근무 요약</h2>
	<p class="mt-2 text-gray-700 dark:text-gray-400">
		총 근무시간: <strong>{totalHours.toFixed(2)}</strong> 시간
	</p>
	<p class="mt-2 text-red-500">초과 근무시간: <strong>{overtime.toFixed(2)}</strong> 시간</p>
</div>

<style>
	.glass-summary {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(10px);
		text-align: center;
		transition: all 0.3s ease-in-out;
	}
</style>

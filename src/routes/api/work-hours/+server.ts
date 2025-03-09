import type { RequestHandler } from './$types';

interface WorkRecord {
	date: string;
	duration: number;
}

let records: WorkRecord[] = [];

export const GET: RequestHandler = async () => {
	const totalHours = records.reduce((sum, r) => sum + r.duration, 0);
	const overtime = Math.max(totalHours - 40, 0);

	return new Response(JSON.stringify({ records, totalHours, overtime }), {
		headers: { 'Content-Type': 'application/json' }
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const { date, startTime, endTime } = await request.json();

	const start = new Date(`${date}T${startTime}`);
	let end = new Date(`${date}T${endTime}`);
	if (end < start) end.setDate(end.getDate() + 1);

	let duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
	duration -= 1;

	records.push({ date, duration });

	return new Response(JSON.stringify({ success: true, records }), {
		headers: { 'Content-Type': 'application/json' }
	});
};

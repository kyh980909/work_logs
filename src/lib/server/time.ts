const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR;

export function getNow() {
	return new Date();
}

export function formatDate(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatTime(date: Date) {
	return date.toTimeString().slice(0, 5);
}

export function normalizeTimeInput(value: string | null | undefined) {
	if (!value) return null;
	return value.slice(0, 5);
}

export function combineDateAndTime(date: string, time: string) {
	return new Date(`${date}T${time}:00`);
}

export function diffMinutes(start: string, end: string, date: string) {
	const startDate = combineDateAndTime(date, start);
	let endDate = combineDateAndTime(date, end);
	if (endDate < startDate) {
		endDate = new Date(endDate.getTime() + MINUTES_IN_DAY * 60 * 1000);
	}
	return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

export function getWeekRange(targetDate: Date) {
	const date = new Date(targetDate);
	const day = date.getDay();
	const distance = day === 0 ? -6 : 1 - day;
	date.setDate(date.getDate() + distance);
	date.setHours(0, 0, 0, 0);
	const weekStart = new Date(date);
	const weekEnd = new Date(date);
	weekEnd.setDate(weekEnd.getDate() + 6);
	return { weekStart, weekEnd };
}

export function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function minutesToHours(minutes: number) {
	return Math.round((minutes / MINUTES_IN_HOUR) * 100) / 100;
}

export function roundToTwo(value: number) {
	return Math.round(value * 100) / 100;
}

export function formatMinutesAsHoursLabel(minutes: number) {
	return `${minutesToHours(minutes).toFixed(2)}시간`;
}

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class', // 다크 모드 활성화
	content: [
		'./src/**/*.{svelte,js,ts}', // Svelte 파일에서 Tailwind 클래스를 찾도록 설정
		'./src/routes/**/*.{svelte,js,ts}',
		'./src/components/**/*.{svelte,js,ts}'
	],
	theme: {
		extend: {}
	},
	plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cinepolis: {
                    blue: '#0B264F', // Dark blue
                    light: '#215DA6', // Lighter blue
                    yellow: '#FFCA05', // Cinepolis Yellow
                    gray: '#F5F5F7'
                }
            }
        },
    },
    plugins: [],
}

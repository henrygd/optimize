const { MIN_SIZE, MAX_AGE } = process.env

/**
 * Converts bytes to kilobytes as a string
 * @param bytes - the number of bytes to convert
 * @returns the number of kilobytes as a string
 */
export function get_kilobytes(bytes: number): string {
	return Math.trunc(bytes / 1024).toLocaleString()
}

/**
 * Converts bytes to megabytes as a string
 * @param bytes - the number of bytes to convert
 * @returns the number of megabytes as a string
 */
export function get_megabytes(bytes: number): string {
	return (bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** Get the current optimization mode */
export function get_mode() {
	return (process.env.MODE || 'overwrite') as 'overwrite' | 'copy' | 'restore'
}

/** Pluralize a string based on a number */
export function pluralize(n: number, thing: string) {
	return `${n} ${n === 1 ? thing : `${thing}s`}`
}

/** Verify, format, and return environment variables */
export function formatEnvVars() {
	// check MAX_AGE
	let maxAgeMs: number | undefined
	const currentTime = Date.now()
	if (MAX_AGE) {
		const maxAgeHours = Number(MAX_AGE)
		if (Number.isNaN(maxAgeHours) || maxAgeHours < 1) {
			console.error('MAX_AGE must be a positive integer')
			process.exit(1)
		}
		maxAgeMs = maxAgeHours * 60 * 60 * 1000
	}
	// check MIN_SIZE
	let minSizeKB: number | undefined
	if (MIN_SIZE) {
		minSizeKB = Number(MIN_SIZE) * 1024
		if (Number.isNaN(minSizeKB) || minSizeKB < 1024) {
			console.error('MIN_SIZE must be a positive integer')
			process.exit(1)
		}
	}
	return { currentTime, maxAgeMs, minSizeKB }
}

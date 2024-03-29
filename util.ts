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

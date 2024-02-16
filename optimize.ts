import sharp, { FitEnum, FormatEnum } from 'sharp'
import { get_kilobytes, get_mode } from './util'

// set options for sharp
const QUALITY = Number(process.env.QUALITY || 80)
const MAX_WIDTH = Number(process.env.MAX_WIDTH || 2800)
const MAX_HEIGHT = Number(process.env.MAX_HEIGHT || 2800)
const FIT = (process.env.FIT || 'inside') as keyof FitEnum
const FORMAT = process.env.FORMAT

interface OptimizeOptions {
	input_file: string
	output_file: string
	log?: boolean
	on_error?: (err: Error) => void
}

/**
 * Optimizes an image based on the provided options.
 *
 * @param {OptimizeOptions} input_file - The input file to optimize.
 * @param {OptimizeOptions} output_file - The file to write the optimized image to.
 * @param {OptimizeOptions} log - Flag to indicate whether to log the size difference of the files. Default is true.
 * @return {Promise<number>} The size difference between the input and output files after optimization.
 */
export async function optimize_image({
	input_file,
	output_file,
	log = true,
	on_error,
}: OptimizeOptions): Promise<number> {
	try {
		let format: string
		if (get_mode() === 'copy' && FORMAT) {
			format = FORMAT
			output_file = `${output_file.replace(/\.[^.]+$/, `.${format}`)}`
		} else {
			format = input_file.split('.').at(-1) as string
		}
		await sharp(input_file)
			.resize({
				fit: FIT,
				width: MAX_WIDTH,
				height: MAX_HEIGHT,
				withoutEnlargement: true,
			})
			.toFormat(format as keyof FormatEnum, {
				quality: QUALITY,
			})
			.toFile(output_file)
		// log the size difference of the files
		const bf_input_file = Bun.file(input_file)
		const bf_output_file = Bun.file(output_file)
		if (log) {
			const log_file = get_mode() === 'overwrite' ? bf_output_file : bf_input_file
			console.log(
				`${log_file.name} \x1b[32m${get_kilobytes(bf_input_file.size)}kB \u2192 ${get_kilobytes(
					bf_output_file.size
				)}kB (${Math.trunc((bf_output_file.size / bf_input_file.size) * 100)}%) \x1b[0m`
			)
		}
		return bf_input_file.size - bf_output_file.size
	} catch (error) {
		console.error(input_file)
		if (error?.message) {
			console.error(` \u21B3 ${error?.message}`)
		}
		on_error?.(error)
		return 0
	}
}

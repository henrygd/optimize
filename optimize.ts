import sharp, { FitEnum, FormatEnum } from 'sharp'
import { get_kilobytes, get_mode } from './util'

// set options for sharp
const QUALITY = Number(process.env.QUALITY || 80)
const MAX_WIDTH = Number(process.env.MAX_WIDTH || 2200)
const MAX_HEIGHT = Number(process.env.MAX_HEIGHT || 2400)
const FIT = (process.env.FIT || 'inside') as keyof FitEnum
const FORMAT = process.env.FORMAT

interface OptimizeOptions {
	input_file: string
	output_file: string
	log?: boolean
}

const get_format = (input_file: string): keyof FormatEnum => {
	if (process.env.MODE === 'copy' && FORMAT) {
		return FORMAT as keyof FormatEnum
	}
	return input_file.split('.').at(-1)?.toLowerCase() as keyof FormatEnum
}

/** Optimize an image with the given options. */
export async function optimize_image({
	input_file,
	output_file,
	log = true,
}: OptimizeOptions): Promise<number> {
	try {
		const format = get_format(input_file)
		output_file = `${output_file.replace(/\.[^.]+$/, `.${format}`)}`
		await sharp(input_file)
			.resize({
				fit: FIT,
				width: MAX_WIDTH,
				height: MAX_HEIGHT,
				withoutEnlargement: true,
			})
			.toFormat(format, {
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
		console.log(error)
		return 0
	}
}

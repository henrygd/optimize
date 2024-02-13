import sharp, { FitEnum, FormatEnum } from 'sharp'
import { get_kilobytes } from './util'

// set options for sharp
const QUALITY = Number(process.env.QUALITY || 80)
const MAX_WIDTH = Number(process.env.MAX_WIDTH || 2200)
const MAX_HEIGHT = Number(process.env.MAX_HEIGHT || 2400)
const FIT = (process.env.FIT || 'inside') as keyof FitEnum

// const format = (process.env.FORMAT || 'webp') as keyof FormatEnum

interface OptimizeOptions {
	input_file: string
	output_file: string
	log?: boolean
}

/** Optimize an image with the given options. */
export async function optimize_image({
	input_file,
	output_file,
	log = true,
}: OptimizeOptions): Promise<number> {
	try {
		const format = input_file.split('.').at(-1)?.toLowerCase() as keyof FormatEnum
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
		const optimized_file = Bun.file(output_file)
		const original_file = Bun.file(input_file)
		if (log) {
			console.log(
				`${optimized_file.name} \x1b[32m${get_kilobytes(
					original_file.size
				)}kB \u2192 ${get_kilobytes(optimized_file.size)}kB (${Math.trunc(
					(optimized_file.size / original_file.size) * 100
				)}%) \x1b[0m`
			)
		}
		return original_file.size - optimized_file.size
	} catch (error) {
		console.log(error)
		return 0
	}
}

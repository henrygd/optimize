import { BunFile, Glob } from 'bun'
import { existsSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { optimize_image } from './optimize'
import { get_kilobytes, get_megabytes } from './util'

const MODE = (process.env.MODE || 'overwrite') as 'overwrite' | 'copy' | 'restore'
const EXTENSIONS =
	process.env.EXTENSIONS || 'jpg,JPG,jpeg,JPEG,png,PNG,gif,GIF,webp,WEBP,tif,TIF,tiff,TIFF'
const MIN_SIZE = Number(process.env.MIN_SIZE || 800)
const MAX_AGE = process.env.MAX_AGE
const OWNER = process.env.OWNER
const QUIET = process.env.QUIET

const search_dir = './images'
const glob = new Glob(`**/*.{${EXTENSIONS}}`)

// exit if required directory is not found
function check_that_dir_exists(dir: string) {
	if (!existsSync(dir)) {
		console.log(
			`\x1b[31m${dir.replace(
				'.',
				''
			)} directory not found. Please make sure you have mounted it.\x1b[0m`
		)
		process.exit(1)
	}
}

/** Check if a file meets the specified criteria to optimize */
async function file_meets_criteria(opts: { path: string; file: BunFile }) {
	// false if size is less than MIN_SIZE
	if (opts.file.size < MIN_SIZE * 1024) {
		return false
	}

	// false if creation time is more than MAX_AGE
	if (MAX_AGE) {
		const { ctimeMs } = await stat(opts.path)
		// skip if creation is more than IMG_AGE
		if (performance.timeOrigin - ctimeMs > Number(MAX_AGE) * 60 * 60 * 1000) {
			return false
		}
	}

	return true
}

// check that /images directory is mounted
check_that_dir_exists(search_dir)

let total_files = 0
let total_bytes_saved = 0
let directories_to_chown: string[] = []

switch (MODE) {
	case 'overwrite':
		await mode_overwrite()
		break
	case 'restore':
		await mode_restore()
		break
	case 'copy':
		await mode_copy()
		break
}

/** Overwrite existing images (default) */
async function mode_overwrite() {
	const backup_dir = './backup'

	for await (const f of glob.scan(search_dir)) {
		const full_path = `${search_dir}/${f}`
		const original_file = Bun.file(full_path)

		const is_valid = await file_meets_criteria({ path: full_path, file: original_file })
		if (!is_valid) {
			continue
		}

		const backup_file = `${backup_dir}/${f}`
		// copy file to backup
		await Bun.write(Bun.file(backup_file), original_file)
		const bytes_saved = await optimize_image({
			input_file: backup_file,
			output_file: full_path,
			log: !QUIET,
		})
		total_bytes_saved += bytes_saved
		bytes_saved && total_files++
	}

	// chown backup directory
	directories_to_chown.push(backup_dir)
}

/** Restore original images from backup directory */
async function mode_restore() {
	const backup_dir = './backup'
	check_that_dir_exists(backup_dir)

	for await (const f of glob.scan(backup_dir)) {
		const backup_file = Bun.file(`${backup_dir}/${f}`)
		const destination_file = Bun.file(`${search_dir}/${f}`)
		if (!QUIET) {
			console.log(
				`${destination_file.name} \x1b[32m${get_kilobytes(
					destination_file.size
				)}kB \u2192 ${get_kilobytes(backup_file.size)}kB (${Math.trunc(
					(backup_file.size / destination_file.size) * 100
				)}%) \x1b[0m`
			)
		}
		await Bun.write(destination_file, backup_file)
		total_files++
	}

	console.log(`\n\x1b[32mTotal: ${total_files} images restored\x1b[0m`)
}

async function mode_copy() {
	const output_dir = './optimized'
	check_that_dir_exists(output_dir)

	for await (const f of glob.scan(search_dir)) {
		const full_path = `${search_dir}/${f}`
		const original_file = Bun.file(full_path)

		const is_valid = await file_meets_criteria({ path: full_path, file: original_file })
		if (!is_valid) {
			continue
		}

		// create output directory if necessary
		const file_output_dir = full_path
			.replace(search_dir, output_dir)
			.split('/')
			.slice(0, -1)
			.join('/')
		if (!existsSync(file_output_dir)) {
			await mkdir(file_output_dir, { recursive: true })
		}

		const bytes_saved = await optimize_image({
			input_file: full_path,
			output_file: `${output_dir}/${f}`,
			log: !QUIET,
		})
		total_bytes_saved += bytes_saved
		bytes_saved && total_files++
	}

	// chown the output directory to the correct user
	directories_to_chown.push(output_dir)
}

// chown the directories if required
if (OWNER && directories_to_chown.length) {
	await Bun.$`chown -R ${OWNER} ${directories_to_chown.join(' ')}`
}

// log the total bytes saved
if (total_bytes_saved && total_files) {
	console.log(
		`\n\x1b[32mTotal: ${get_megabytes(total_bytes_saved)}MB saved from ${total_files} images\x1b[0m`
	)
}

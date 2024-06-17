import { BunFile, Glob } from 'bun'
import { existsSync } from 'node:fs'
import { mkdir, stat, unlink, utimes } from 'node:fs/promises'
import { optimize_image } from './optimize'
import { formatEnvVars, get_kilobytes, get_megabytes, get_mode, pluralize } from './util'
import { newQueue } from '@henrygd/queue'
import { availableParallelism } from 'os'

const { OWNER, QUIET, JOBS } = process.env
const MODE = get_mode()
let EXTENSIONS = process.env.EXTENSIONS || 'jpg,jpeg,png,webp,tif,tiff'

// add upper case extensions
EXTENSIONS += `,${EXTENSIONS.toUpperCase()}`

const search_dir = './images'
const glob = new Glob(`**/*.{${EXTENSIONS}}`)

const { maxAgeMs, minSizeKB, currentTime } = formatEnvVars()

// exit if required directory is not found
function check_that_dir_exists(dir: string, name: string) {
	if (!existsSync(dir)) {
		console.log(`\x1b[31m${name} directory not found. Make sure you have mounted it.\x1b[0m`)
		process.exit(1)
	}
}

/** Check if a file meets the specified criteria to optimize */
async function file_meets_criteria(opts: { path: string; file: BunFile }) {
	// false if size is less than MIN_SIZE
	if (minSizeKB && opts.file.size < minSizeKB) {
		return { valid: false, mtime: 0 }
	}
	// abort if file content was modified more than MAX_AGE hours ago
	const { mtimeMs, mtime } = await stat(opts.path)
	if (maxAgeMs) {
		if (currentTime - mtimeMs > maxAgeMs) {
			return { valid: false, mtime: 0 }
		}
	}
	return { valid: true, mtime }
}

function calculate_optimal_jobs(): number {
	const available = availableParallelism()
	let jobs = Math.trunc((available - 1) / 2)
	jobs = Math.min(32, Math.max(1, jobs))
	// console.log(`Available cores: ${available}. Using ${jobs} job(s).`)
	return jobs
}

// check that /images directory is mounted
check_that_dir_exists(search_dir, 'images directory')

let total_files = 0
let total_bytes_saved = 0
let directories_to_chown: string[] = []

/** Create a queue to run jobs in parallel */
function getQueue() {
	const numJobs = JOBS ? Number(JOBS) : calculate_optimal_jobs()
	if (Number.isNaN(numJobs) || numJobs < 1 || numJobs > 32) {
		console.error('JOBS must be a number between 1 and 32')
		process.exit(1)
	}
	const queue = newQueue(numJobs)
	// clear queue on SIGINT
	process.on('SIGINT', async () => {
		console.warn('\nSIGINT received. Finishing current conversion(s) and exiting...\n')
		queue.clear()
	})
	return queue
}

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

	async function runJob(f: string) {
		const full_path = `${search_dir}/${f}`
		const original_file = Bun.file(full_path)
		// check if file meets criteria to optimize
		const { valid, mtime } = await file_meets_criteria({
			path: full_path,
			file: original_file,
		})
		if (!valid) {
			return
		}
		// copy original to backup
		const backup_file = `${backup_dir}/${f}`
		await Bun.write(backup_file, original_file)
		// optimize image
		const bytes_saved = await optimize_image({
			input_file: backup_file,
			output_file: full_path,
			log: !QUIET,
			on_error: () => unlink(backup_file),
		})
		// revert if negative bytes saved
		if (bytes_saved < 0) {
			QUIET || console.warn(`\x1b[33m \u21B3 reverting ${full_path}\x1b[0m`)
			await Bun.write(full_path, Bun.file(backup_file))
			await utimes(full_path, mtime, mtime)
			await unlink(backup_file)
			return
		}
		// maintain original mtime
		await utimes(full_path, mtime, mtime)
		// update total bytes and total files
		total_bytes_saved += bytes_saved
		bytes_saved && total_files++
	}

	const queue = getQueue()

	for await (const f of glob.scan(search_dir)) {
		queue.add(() => runJob(f))
	}

	await queue.done()

	// chown backup directory
	directories_to_chown.push(backup_dir)
}

/** Restore original images from backup directory */
async function mode_restore() {
	const backup_dir = './backup'
	check_that_dir_exists(backup_dir, 'backup directory')

	for await (const f of glob.scan(backup_dir)) {
		const backup_file = Bun.file(`${backup_dir}/${f}`)
		const destination_file = Bun.file(`${search_dir}/${f}`)
		// skip if destination file does not exist
		if (!(await destination_file.exists())) {
			continue
		}
		const destination_size = destination_file.size
		await Bun.write(`${search_dir}/${f}`, backup_file)
		if (!QUIET) {
			console.log(
				`${destination_file.name?.slice(9)} \x1b[32m${get_kilobytes(
					destination_size
				)}kB \u2192 ${get_kilobytes(backup_file.size)}kB (${Math.trunc(
					(backup_file.size / destination_size) * 100
				)}%) \x1b[0m`
			)
		}
		total_files++
	}

	console.log(`\n\x1b[32mTotal: ${pluralize(total_files, 'image')} restored\x1b[0m`)
}

async function mode_copy() {
	const output_dir = './optimized'
	check_that_dir_exists(output_dir, 'optimized directory')

	async function runJob(f: string) {
		const full_path = `${search_dir}/${f}`
		const original_file = Bun.file(full_path)

		const { valid } = await file_meets_criteria({ path: full_path, file: original_file })
		if (!valid) {
			return
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

	const queue = getQueue()

	for await (const f of glob.scan(search_dir)) {
		queue.add(() => runJob(f))
	}

	await queue.done()

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
		`\n\x1b[32mTotal: ${get_megabytes(total_bytes_saved)}MB saved from ${pluralize(
			total_files,
			'image'
		)}\x1b[0m`
	)
}

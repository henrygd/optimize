import { Glob } from 'bun'
import { stat } from 'node:fs/promises'
import { optimize_image } from './optimize'
import { get_megabytes } from './util'

const MODE = (process.env.MODE || 'optimize') as 'overwrite' | 'copy' | 'restore'
const EXTENSIONS =
	process.env.EXTENSIONS || 'jpg,JPG,jpeg,JPEG,png,PNG,gif,GIF,webp,WEBP,tif,TIF,tiff,TIFF'
const MIN_SIZE = Number(process.env.MIN_SIZE || 800)
const MAX_AGE = process.env.MAX_AGE
const OWNER = process.env.OWNER
const QUIET = process.env.QUIET

const search_dir = './images'
const glob = new Glob(`**/*.{${EXTENSIONS}}`)

let total_files = 0
let total_bytes_saved = 0

switch (MODE) {
	case 'overwrite':
		await mode_overwrite()
		break
	case 'copy':
		// await mode_copy()
		break
	case 'restore':
		// await mode_restore()
		break
}

async function mode_overwrite() {
	const backup_dir = './backup'

	for await (const f of glob.scan(search_dir)) {
		const full_path = `${search_dir}/${f}`
		const original_file = Bun.file(full_path)

		// skip if size is less than MIN_SIZE
		if (original_file.size < MIN_SIZE * 1024) {
			continue
		}

		// skip if creation time is more than MAX_AGE
		if (MAX_AGE) {
			const { ctimeMs } = await stat(full_path)
			// skip if creation is more than IMG_AGE
			if (performance.timeOrigin - ctimeMs > Number(MAX_AGE) * 60 * 60 * 1000) {
				continue
			}
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

	// chown the backup folder to the correct user
	if (OWNER) {
		await Bun.$`chown -R ${OWNER} ${backup_dir}`
	}
}

// log the total bytes saved
if (total_bytes_saved && total_files) {
	console.log(
		`\n\x1b[32mTotal: ${get_megabytes(total_bytes_saved)}MB saved from ${total_files} images\x1b[0m`
	)
}

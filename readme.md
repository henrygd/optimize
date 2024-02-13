# WIP

Dockerized script to optimize images using [libvips](https://github.com/libvips/libvips) / [sharp](https://github.com/lovell/sharp) / [bun](https://bun.sh).

## Modes

`overwrite`: Overwrite existing images (default). Backup directory recommended but not required.

```
docker run --rm -v ./images:/images -v ./backup:/backup bun-vips
```

`restore`: Restore original images from backup (reverses `overwrite`).

```
docker run --rm -v ./images:/images -v ./backup:/backup -e MODE=restore bun-vips
```

`copy`: Write images to different directory, maintaining structure. This example converts all images to AVIF.

```
docker run --rm -v ./images:/images -v ./optimized:/optimized -e MODE=copy -e FORMAT=avif bun-vips
```

## Environment Variables

| Name       | Mode | Description                 | Default                                                       |
| ---------- | ---- | --------------------------- | ------------------------------------------------------------- |
| MODE       | \*   | [Mode](#modes)              | overwrite                                                     |
| EXTENSIONS | \*   | Extensions to optimize      | jpg,JPG,jpeg,JPEG,png,PNG,gif,GIF,webp,WEBP,tif,TIF,tiff,TIFF |
| MIN_SIZE   | \*   | Size threshold in kilobytes | 800                                                           |
| MAX_AGE    | \*   | Age threshold in hours[^1]  | unset                                                         |
| QUALITY    | \*   | Output quality              | 80                                                            |
| MAX_WIDTH  | \*   | Max width of output image   | 2200                                                          |
| MAX_HEIGHT | \*   | Max height of output image  | 2400                                                          |
| FIT        | \*   | [Fit method](#fit-methods)  | inside                                                        |
| OWNER      | \*   | Ownership of new files[^2]  | root:root                                                     |
| QUIET      | \*   | Will not log every file     | unset                                                         |
| FORMAT     | copy | Output format[^3]           | unset                                                         |

## Fit Methods

- `inside`: Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified.
- `cover`: Crop to cover both provided dimensions.
- `contain`: Embed within both provided dimensions.
- `fill`: Ignore the aspect ratio of the input and stretch to both provided dimensions.
- `outside`: Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to both those specified.

[^1]: MAX_AGE should be a number if set. For example, `23` would only optimize images created in the last 23 hours.
[^2]: This applies only to newly created files. Overwritten files should maintain existing permissions. Value should be compatible with a chown command.
[^3]: This will force all optimized images to be converted to the specified format. Possible values: `webp`, `avif`.

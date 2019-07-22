# ept validate

Validate metadata structure of an [Entwine Point Tile](https://entwine.io/entwine-point-tile.html) dataset.

```bash
ept validate --help
```

# Usage

```bash
ept validate <path>/ept.json
```

This command will log messages for any warnings or errors related to the EPT metadata, and exit with a non-zero status code if the dataset is not valid.

```bash
$ ept validate ~/entwine/autzen/ept.json
Validating ~/entwine/autzen/

!! Warnings:
	• srs: no "horizontal" code - interoperability will be limited

✔ EPT appears to be valid
```


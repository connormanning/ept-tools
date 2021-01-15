# ept validate

Validate metadata structure of an [Entwine Point Tile](https://entwine.io/entwine-point-tile.html) dataset.

```bash
ept validate --help

Validate EPT metadata

Options:
      --version  Show version number                                   [boolean]
      --help     Show help                                             [boolean]
  -i, --input    Path to ept.json file                       [string] [required]
```

# Usage

```bash
ept validate [path/to/ept.json]
```

This command will log messages for any errors related to the EPT metadata, and exit with a non-zero status code if the dataset is not valid.

```bash
$ ept validate ~/entwine/bad/ept.json
✖ Errors:
        • schema: should have required property 'bounds'
✖ EPT is not valid
```

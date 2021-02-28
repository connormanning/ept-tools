# ept tile

Translate an Entwine Point Tile dataset to [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) on disk. See [`ept serve`](serve.md) for on-the-fly tileset generation.

```bash
index.ts tile [input]

Translate EPT to 3D Tiles at rest

Options:
      --version     Show version number                                [boolean]
      --help        Show help                                          [boolean]
  -i, --input       Path to ept.json file                    [string] [required]
  -o, --output      Tileset output path  [string] [default: <input>/ept-tileset]
  -t, --threads     Number of parallel threads             [number] [default: 8]
  -f, --force       Overwrite existing output, if present
                                                      [boolean] [default: false]
  -v, --verbose     Enable verbose logs               [boolean] [default: false]
      --dimensions  Dimensions to be added to the batch table            [array]
      --z-offset    Elevation offset to raise/lower the resulting point cloud
                                                                        [number]
      --truncate    Truncate 16-bit colors to 8-bit   [boolean] [default: false]
```

# Usage

```bash
ept tile [path/to/ept.json]
```

This command creates a [3D Tiles tileset](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification) in `<ept-root>/ept-tileset/`.

# Quickstart

Follow the steps from the Entwine [quickstart](https://entwine.io/quickstart.html) to build a small EPT dataset at `~/entwine/red-rocks`:

```bash
conda create -n entwine -c conda-forge entwine
conda activate entwine
entwine build -i https://data.entwine.io/red-rocks.laz -o ~/entwine/red-rocks
```

Then translate the data:

```bash
ept tile ~/entwine/red-rocks/ept.json
```

A 3D Tiles tileset is created: `~/entwine/red-rocks/ept-tileset/tileset.json`. To statically serve:

```bash
npm install http-server -g
http-server ~/entwine -p 3030 --cors
```

And to view: http://cesium.entwine.io?url=http://localhost:3030/red-rocks/ept-tileset/tileset.json

# Notes

- Only EPT data with recognized EPSG spatial reference codes are supported

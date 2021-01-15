# Tiling options

The translation of [EPT](https://entwine.io/entwine-point-tile.html) [3D Tiles](https://github.com/AnalyticalGraphicsInc/3d-tiles) may require some decisions by the user. For example, XYZ and RGB (if present) attributes are always included, but in some cases other attributes may be desired as well. `Intensity`, `Classification`, or native `Z` coordinates (prior to earth-centered earth-fixed reprojection) may be useful for coloring. Another example may be a dynamic height offset. Options like these can be controlled by query parameters for the [serve](serve.md) application or by command line for the [tile](tile.md) application.

## Options

### dimensions

The `dimensions` option selects additional dimensions from the EPT schema to be included in the 3D Tiles [Batch Table](https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/PointCloud#batch-table). These dimensions will be populated directly from the EPT data, so for example, choosing `X`, `Y`, or `Z` will include these attributes in their native projection as stored in EPT, even though the `POSITION` attribute from the [Feature Table](https://github.com/CesiumGS/3d-tiles/tree/master/specification/TileFormats/PointCloud#feature-table) represents the XYZ values in EPSG:4978. For this reason, the `Z` value may be used to represent elevation.

Examples:

```
?dimensions=Z,Classification,Intensity # serve
--dimensions Z Classification Intensity # tile
```

### z-offset

The `z-offset` option dynamically offsets the height of the resulting point cloud. This may be useful to correct the height of a point cloud whose vertical spatial reference is improperly transformed to ECEF, or perhaps just to lift the point cloud for easier viewing if it partially overlaps the baselayer terrain model.

Examples:

```
?z-offset=50 # serve
--z-offset 50 # tile
```

### truncate

When RGB attributes are present, they must be written as 8-bit values in compliance with the 3D Tiles specification. In general point cloud formats, these values are often stored as 16-bit. In this case, the `truncate` option should be set to truncate these 16-bit values down to 8-bit for conversion.

Examples:

```
?truncate # serve
--truncate # tile
```

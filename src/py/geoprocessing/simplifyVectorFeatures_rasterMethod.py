import arcpy
import os

def set_environment_settings(raster_path):
    """Set arcpy environment settings based on a reference raster."""
    raster_desc = arcpy.Describe(raster_path)
    arcpy.env.outputCoordinateSystem = raster_desc.spatialReference
    arcpy.env.extent = raster_desc.extent
    arcpy.env.cellSize = raster_desc.meanCellWidth  # Assuming square cells
    arcpy.env.snapRaster = raster_path

def add_and_calculate_fields(feature_class, base_name):
    """Add fields and calculate them based on the feature class filename."""
    parts = base_name.split("_")
    field1_value = parts[0] if len(parts) > 0 else ""
    field2_value = parts[1] if len(parts) > 1 else ""

    arcpy.AddField_management(feature_class, "field1", "TEXT")
    arcpy.AddField_management(feature_class, "field2", "TEXT")
    arcpy.CalculateField_management(feature_class, "field1", f"'{field1_value}'")
    arcpy.CalculateField_management(feature_class, "field2", f"'{field2_value}'")

def features_to_raster(feature_class, output_raster_path, cell_size, feature_type):
    """Convert vector features to raster using a dynamically determined unique ID field or a newly created sequential ID field."""
    # List all field names in the feature class
    fields = [field.name for field in arcpy.ListFields(feature_class)]
    
    # Determine the correct unique identifier field
    if "OBJECTID" in fields:
        value_field = "OBJECTID"
    elif "OID" in fields:
        value_field = "OID"
    else:
        # If neither OBJECTID nor OID is found, create and populate a new field with sequential numbers
        value_field = "SeqID"
        arcpy.AddField_management(feature_class, value_field, "LONG")
        with arcpy.da.UpdateCursor(feature_class, value_field) as cursor:
            for i, row in enumerate(cursor, start=1):
                row[0] = i
                cursor.updateRow(row)
    
    # Continue with the existing logic to convert features to raster
    if feature_type == 'Polygon':
        print(f"processing {feature_class}")
        arcpy.conversion.PolygonToRaster(
            in_features=feature_class,
            value_field=value_field,
            out_rasterdataset=output_raster_path,
            cell_assignment="MAXIMUM_COMBINED_AREA",
            priority_field="Shape_Area",
            cellsize=cell_size
        )
    elif feature_type == 'Polyline':
        print(f"processing {feature_class}")
        arcpy.conversion.PolylineToRaster(
            in_features=feature_class,
            value_field=value_field,
            out_rasterdataset=output_raster_path,
            cell_assignment="MAXIMUM_LENGTH", 
            priority_field="NONE",
            cellsize=cell_size
        )
    else:  # Assumes 'Point' or other types default to point conversion
        print(f"processing {feature_class}")
        arcpy.conversion.PointToRaster(
            in_features=feature_class,
            value_field=value_field,
            out_rasterdataset=output_raster_path,
            cell_assignment="MOST_FREQUENT",
            priority_field="NONE",
            cellsize=cell_size
        )
    arcpy.AddMessage(f"Converted {feature_class} to raster {output_raster_path}")


def raster_to_features(input_raster_path, output_feature_path, feature_type):
    """Convert raster to vector features based on the original feature type."""
    if feature_type == 'Polygon':
        arcpy.conversion.RasterToPolygon(
            in_raster=input_raster_path,
            out_polygon_features=output_feature_path,
            simplify="NO_SIMPLIFY"
        )
    elif feature_type == 'Polyline':
        arcpy.RasterToPolyline_conversion(
            in_raster=input_raster_path,
            out_polyline_features=output_feature_path
        )
    else:  # Default to points for any other case
        arcpy.conversion.RasterToPoint(
            in_raster=input_raster_path,
            out_point_features=output_feature_path
        )
    arcpy.AddMessage(f"Converted raster {input_raster_path} back to features {output_feature_path}")

def process_features(feature_classes, feature_type):
    """Process each feature class based on its type."""
    for feature_class in feature_classes:
        base_name = os.path.basename(feature_class).split(".")[0]
        cell_size_str = str(arcpy.env.cellSize).replace(".", "_")
        raster_name = f"{base_name}_{cell_size_str}m"
        features_name = f"{base_name}_{cell_size_str}m_{feature_type.lower()}"

        output_raster_path = os.path.join(scratch_workspace, raster_name)
        output_features_path = os.path.join(output_workspace, features_name)

        # Perform conversions
        features_to_raster(feature_class, output_raster_path, arcpy.env.cellSize, feature_type)
        raster_to_features(output_raster_path, output_features_path, feature_type)

        # Add and calculate fields
        # add_and_calculate_fields(output_features_path, base_name)

def main():
    arcpy.CheckOutExtension("Spatial")
    set_environment_settings(base_raster_path)

    feature_types = ['Point', 'Polygon', 'Polyline']
    for feature_type in feature_types:
        feature_classes = arcpy.ListFeatureClasses(feature_type=feature_type)
        process_features(feature_classes, feature_type)

    arcpy.CheckInExtension("Spatial")

if __name__ == "__main__":
    base_raster_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\input.gdb\output_USGS_750m_NYS_contourExtent_NAD83_20231126"
    # workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\input.gdb"
    workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\footprints.gdb"
    scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\rasters.gdb"
    output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\output.gdb"
    arcpy.env.workspace = workspace
    arcpy.env.scratchWorkspace = scratch_workspace
    arcpy.env.overwriteOutput = True
    main()

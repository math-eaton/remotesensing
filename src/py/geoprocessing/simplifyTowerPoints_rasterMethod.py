import arcpy
import os
from datetime import datetime

def set_environment_settings(raster_path):
    """Set arcpy environment settings based on a reference raster."""
    raster_desc = arcpy.Describe(raster_path)
    arcpy.env.outputCoordinateSystem = raster_desc.spatialReference
    arcpy.env.extent = raster_desc.extent
    arcpy.env.cellSize = raster_desc.meanCellWidth  # Assuming square cells
    arcpy.env.snapRaster = raster_path

# Specify the raster to base environment settings on
base_raster_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\colloquium_processing.gdb\output_USGS_750m_NYS_contourExtent_NAD83_20231126"
set_environment_settings(base_raster_path)  # Initialize environment settings

# Define workspaces
workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\scratch.gdb"
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_towers\output.gdb"
arcpy.env.workspace = workspace
arcpy.env.scratchWorkspace = scratch_workspace
arcpy.env.overwriteOutput = True

def add_and_calculate_fields(feature_class, base_name):
    """Add 'radio' and 'gen' fields and calculate them based on the feature class filename."""
    # Split the base_name to get radio and gen values
    parts = base_name.split("_")
    radio_value = parts[0] if len(parts) > 0 else ""
    gen_value = parts[1] if len(parts) > 1 else ""

    # Add fields
    arcpy.AddField_management(feature_class, "radio", "TEXT")
    arcpy.AddField_management(feature_class, "gen", "TEXT")

    # Calculate fields
    arcpy.CalculateField_management(feature_class, "radio", f"'{radio_value}'")
    arcpy.CalculateField_management(feature_class, "gen", f"'{gen_value}'")

def convert_points_to_raster_and_back(feature_class, spatial_ref, output_workspace):
    """Convert points to raster and then raster back to points, ensuring correct projection, and add fields."""
    base_name = os.path.basename(feature_class).split(".")[0]  # Remove file extension if present
    cell_size_str = str(arcpy.env.cellSize).replace(".", "_")
    raster_name = f"{base_name}_{cell_size_str}m"
    points_name = f"{base_name}_{cell_size_str}m_points"
    
    output_raster_path = os.path.join(scratch_workspace, raster_name)
    output_points_path = os.path.join(output_workspace, points_name)

    # Ensure the output uses the correct spatial reference
    arcpy.env.outputCoordinateSystem = spatial_ref

    # Convert points to raster
    arcpy.conversion.PointToRaster(
        in_features=feature_class,
        value_field="cellid",
        out_rasterdataset=output_raster_path,
        cell_assignment="MOST_FREQUENT",
        priority_field="NONE",
        cellsize=arcpy.env.cellSize
    )

    arcpy.AddMessage(f"Converted {feature_class} to raster {output_raster_path}")

    # Convert raster back to points
    arcpy.conversion.RasterToPoint(
        in_raster=output_raster_path,
        out_point_features=output_points_path
    )

    arcpy.AddMessage(f"Converted raster {output_raster_path} back to points {output_points_path}")

    # Add and calculate 'radio' and 'gen' fields
    add_and_calculate_fields(output_points_path, base_name)
    return output_points_path

def main():
    # Set environment based on the input raster
    set_environment_settings(base_raster_path)
    spatial_ref = arcpy.Describe(base_raster_path).spatialReference

    output_points = []

    # Process each point feature class
    feature_classes = arcpy.ListFeatureClasses(feature_type='Point')
    for feature_class in feature_classes:
        output_point = convert_points_to_raster_and_back(feature_class, spatial_ref, output_workspace)
        output_points.append(output_point)

    # Merge all output points into a single feature class
    cell_size_str = str(arcpy.env.cellSize).replace(".", "_")
    merged_output_name = f"openCellID_cells_{cell_size_str}m"
    merged_output_path = os.path.join(output_workspace, merged_output_name)
    arcpy.Merge_management(output_points, merged_output_path)
    arcpy.AddMessage(f"Merged feature class created: {merged_output_path}")

if __name__ == "__main__":
    main()

# Check the Spatial Analyst extension back in
arcpy.CheckInExtension("Spatial")
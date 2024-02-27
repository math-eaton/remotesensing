import arcpy
import os
import math
from datetime import datetime

# Setting the environment
arcpy.env.parallelProcessingFactor = "100%"
workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\cell_viewsheds\viewshed_input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\cell_viewsheds\scratch.gdb"  # Define scratch workspace
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\cell_viewsheds\viewshed_output.gdb"  # Define output workspace
arcpy.env.workspace = workspace
arcpy.env.scratchWorkspace = scratch_workspace  # Set scratch workspace in the environment
arcpy.env.overwriteOutput = True

# Define input and output parameters
in_raster = "output_USGS30m_NYS_contourExtent_20231126"
observer_points = "NR"
batch_size = 3  # Process N inputs per batch

# Optional: Set maximum number of batches to process for testing
max_batches_to_process = 1  # Set to None to process all batches

# Function to validate and repair geometries
def validate_geometries(feature_class):
    repair_geo = os.path.join(scratch_workspace, "Repaired_Geometry")
    arcpy.RepairGeometry_management(feature_class, "DELETE_NULL")
    return repair_geo

# Function to ensure CRS compatibility
def check_crs(raster, feature_class):
    raster_desc = arcpy.Describe(raster)
    feature_desc = arcpy.Describe(feature_class)
    if raster_desc.spatialReference.name != feature_desc.spatialReference.name:
        raise ValueError("CRS mismatch between the raster and feature class.")

# Function to process viewshed in batches
def process_batch(batch):
    try:
        batch_name = f"batch_{batch}"
        out_raster = os.path.join(scratch_workspace, f"CellTowers_NYS_viewshed_{batch_name}_20231128")
        arcpy.ddd.Viewshed2(
            in_raster=in_raster,
            in_observer_features=batch_name,
            out_raster=out_raster,
            out_agl_raster=None,
            analysis_type="OBSERVERS",
            vertical_error="0 Meters",
            out_observer_region_relationship_table=None,
            refractivity_coefficient=0.13,
            surface_offset="0 Meters",
            observer_elevation=None,
            observer_offset="AllStruc",
            inner_radius=None,
            inner_radius_is_3d="GROUND",
            outer_radius="45 Miles",
            outer_radius_is_3d="GROUND",
            horizontal_start_angle=0,
            horizontal_end_angle=360,
            vertical_upper_angle=90,
            vertical_lower_angle=-90,
            analysis_method="ALL_SIGHTLINES",
            analysis_target_device="GPU_THEN_CPU"
        )
    except arcpy.ExecuteError as e:
        arcpy.AddWarning(f"Error processing batch {batch}: {e}")
        return None
    return out_raster

# Validate and repair observer points geometry
observer_points = validate_geometries(observer_points)

# Ensure CRS compatibility between the input raster and observer points
try:
    check_crs(in_raster, observer_points)
except ValueError as e:
    arcpy.AddError(str(e))
    raise

# Determine the total number of batches needed
with arcpy.da.SearchCursor(observer_points, ["OBJECTID"]) as cursor:
    total_points = sum(1 for _ in cursor)
total_batches = math.ceil(total_points / batch_size)

# Batch processing for all batches
output_rasters = []
start_time = datetime.now()  # Start time of the processing
for batch in range(total_batches):
    if max_batches_to_process is not None and batch >= max_batches_to_process:
        print(f"Reached the maximum number of batches to process ({max_batches_to_process}). Stopping early.")
        break  # Exit the loop after processing the specified number of batches

    batch_start_time = datetime.now()  # Start time of the current batch
    start = batch * batch_size + 1
    end = start + batch_size
    arcpy.AddMessage(f"Processing batch {batch+1} of {total_batches}...")

    # Create a feature layer for the current batch
    batch_query = f"OBJECTID >= {start} AND OBJECTID < {end}"
    batch_layer = f"batch_{batch}"
    arcpy.management.MakeFeatureLayer(observer_points, batch_layer, batch_query)
    
    # Process the current batch
    output_raster = process_batch(batch)
    if output_raster:
        output_rasters.append(output_raster)

    # Calculate and print elapsed time
    batch_end_time = datetime.now()
    total_elapsed_time = batch_end_time - start_time
    batch_elapsed_time = batch_end_time - batch_start_time
    print(f"Batch {batch+1}/{total_batches} processed. Batch Time: {batch_elapsed_time}, Total Time: {total_elapsed_time}")


if not output_rasters:
    arcpy.AddError("No batches were successfully processed.")
else:
    arcpy.AddMessage("All successful batches processed. Merging outputs...")

    # Merging the Outputs
    current_date = datetime.now().strftime("%Y%m%d")
    merged_output = os.path.join(output_workspace, "Merged_CellTowers_NYS_Viewshed_" + current_date)
    arcpy.management.MosaicToNewRaster(
        input_rasters=output_rasters, 
        output_location=output_workspace,
        raster_dataset_name_with_extension=os.path.basename(merged_output),
        pixel_type="32_BIT_FLOAT",  # Choose appropriate pixel type
        number_of_bands=1
    )

    arcpy.AddMessage("Merging complete.")

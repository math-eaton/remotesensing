import arcpy
import os
import math
from datetime import datetime
from arcpy.sa import *



# Setting the environment
arcpy.env.parallelProcessingFactor = "100%"
workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\cell_viewsheds\viewshed_input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\cell_viewsheds\scratch.gdb"  # Define scratch workspace
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\cell_viewsheds\viewshed_output.gdb"  # Define output workspace
arcpy.env.workspace = workspace
arcpy.env.scratchWorkspace = scratch_workspace  # Set scratch workspace in the environment
arcpy.env.overwriteOutput = True

# Check out the Spatial Analyst extension
arcpy.CheckOutExtension("Spatial")

# Define input and output parameters
in_raster = "output_USGS_150m_resample_NYS_contourExtent_NAD83_20240227"
observer_points = "Cellular_Towers_NYS_DEM_clip_20231126"
batch_size = 32  # Process N inputs per batch >>>>>>> nb: 32 is max for viewshed2

# Optional: Set maximum number of batches to process for testing
batch_limit = None  # Set to None to process all batches

# Function to validate and repair geometries
def validate_geometries(feature_class):
    # Perform a geometry check
    arcpy.AddMessage(f"Checking geometries for {feature_class}")
    check_result = arcpy.CheckGeometry_management(feature_class)
    
    # Directly attempt to repair geometries without checking the count of issues
    arcpy.AddMessage(f"Attempting to repair geometries for {feature_class}, if needed")
    repair_result = arcpy.RepairGeometry_management(feature_class, "DELETE_NULL")
    
    # Log the repair attempt
    arcpy.AddMessage(f"Geometry repair attempted on {feature_class}")
    
    return feature_class  # Return the input feature class, which has been potentially repaired
    # Check for geometry issues
    problems = arcpy.CheckGeometry_management(feature_class)
    
    # If problems are found, repair the geometries in place
    if int(arcpy.GetCount_management(problems)[0]) > 0:
        arcpy.AddMessage(f"Repairing geometries for {feature_class}")
        arcpy.RepairGeometry_management(feature_class, "DELETE_NULL")
    else:
        arcpy.AddMessage(f"No geometry repairs needed for {feature_class}")

    return feature_class  # Return the (possibly repaired) input feature class

# Function to ensure CRS compatibility
def check_crs_and_project(raster, feature_class):
    # Get the spatial references
    raster_sr = arcpy.Describe(raster).spatialReference
    feature_sr = arcpy.Describe(feature_class).spatialReference
    
    # Check if the spatial references match
    if raster_sr.name != feature_sr.name:
        arcpy.AddMessage(f"CRS mismatch detected between {raster} and {feature_class}. Projecting {feature_class} to match {raster} CRS...")
        
        # Define the output path for the projected feature class within the scratch workspace
        projected_feature_class_name = f"{feature_class}_projected"
        projected_feature_class_path = os.path.join(scratch_workspace, projected_feature_class_name)
        
        # Project the feature class to match the raster's CRS
        arcpy.Project_management(feature_class, projected_feature_class_path, raster_sr)
        
        arcpy.AddMessage(f"Projection completed: {projected_feature_class_path}")
        return projected_feature_class_path
    else:
        arcpy.AddMessage("CRS match. No projection needed.")
        return feature_class  # Return the original path if no projection was needed

try:
    # First, validate and possibly repair the geometries of the observer points
    observer_points = validate_geometries(observer_points)
    
    # Then, check for CRS compatibility and project if necessary
    observer_points = check_crs_and_project(in_raster, observer_points)
    
except Exception as e:
    arcpy.AddError(f"Error in preparing observer points: {e}")
    raise


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

# Additional functions for cleanup
def clear_scratch_gdb(scratch_workspace):
    arcpy.env.workspace = scratch_workspace
    datasets = arcpy.ListDatasets() + arcpy.ListFeatureClasses() + arcpy.ListTables()
    for dataset in datasets:
        try:
            arcpy.Delete_management(dataset)
            arcpy.AddMessage(f"Deleted {dataset} from scratch workspace.")
        except Exception as e:
            arcpy.AddWarning(f"Error deleting {dataset}: {e}")

def clear_relationship_tables(workspace, text_pattern):
    arcpy.env.workspace = workspace
    tables = arcpy.ListTables()
    for table in tables:
        if text_pattern in table:
            try:
                arcpy.Delete_management(table)
                arcpy.AddMessage(f"Deleted {table} from {workspace}.")
            except Exception as e:
                arcpy.AddWarning(f"Error deleting {table}: {e}")


# Validate and repair observer points geometry
observer_points = validate_geometries(observer_points)

# Determine the total number of batches needed
with arcpy.da.SearchCursor(observer_points, ["OBJECTID"]) as cursor:
    total_points = sum(1 for _ in cursor)
total_batches = math.ceil(total_points / batch_size)

# Batch processing for all batches
output_rasters = []
start_time = datetime.now()  # Start time of the processing
for batch in range(total_batches):
    if batch_limit is not None and batch >= batch_limit:
        print(f"Reached the maximum number of batches to process ({batch_limit}). Stopping early.")
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
    arcpy.AddMessage("All successful batches processed. Preparing for merge...")

    # Temporarily switch to scratch workspace for listing rasters
    arcpy.env.workspace = scratch_workspace
    raster_datasets = arcpy.ListRasters("CellTowers_NYS_viewshed_batch_*", "ALL")
    
    # Switch back to the primary workspace if needed or continue with the scratch workspace
    # arcpy.env.workspace = workspace  # Uncomment if you need to switch back for subsequent operations

    # Validate the existence of rasters in the scratch workspace
    valid_rasters = [os.path.join(scratch_workspace, raster) for raster in raster_datasets if arcpy.Exists(os.path.join(scratch_workspace, raster))]
    arcpy.AddMessage(f"Valid rasters identified for merging: {valid_rasters}")

    # Construct the output raster name and path
    current_date = datetime.now().strftime("%Y%m%d")
    merged_output_name = "Merged_CellTowers_NYS_Viewshed_" + current_date
    merged_output_path = os.path.join(output_workspace, merged_output_name)

    # Proceed with merging if valid rasters are found
    if valid_rasters:
        arcpy.AddMessage("Merging valid raster datasets...")
        arcpy.management.MosaicToNewRaster(
            input_rasters=valid_rasters,
            output_location=output_workspace,
            raster_dataset_name_with_extension=os.path.basename(merged_output_path),
            pixel_type="32_BIT_FLOAT",
            number_of_bands=1
        )
        arcpy.AddMessage("Merging complete. Reclassifying the merged raster...")
            
        # Ensure Spatial Analyst extension is available
        arcpy.CheckOutExtension("Spatial")

        # Reclassify the merged raster: convert NODATA to 0, and any other value to 1
        final_raster_path = os.path.join(output_workspace, "Binary_Viewshed_" + current_date)
        final_raster = Con(IsNull(Raster(merged_output_path)), 0, Con(Raster(merged_output_path) > 0, 1, 0))

        # Save the final, reclassified raster
        final_raster.save(final_raster_path)

        arcpy.AddMessage(f"Final raster saved to: {final_raster_path}")

        clear_scratch_gdb(scratch_workspace)
        clear_relationship_tables(output_workspace, "observer_lyr_Viewshed")

        arcpy.AddMessage("cleanup complete.")

        # Check the Spatial Analyst extension back in after processing
        arcpy.CheckInExtension("Spatial")

    else:
        arcpy.AddError("No valid raster datasets were found for merging.")


import arcpy
import os
import math
from datetime import datetime

# Setting the environment
arcpy.env.parallelProcessingFactor = "100%"
input_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\viewshed_input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\scratch.gdb"  # Path to the scratch geodatabase
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\viewshed_output.gdb"  # Path to the output geodatabase
arcpy.env.workspace = input_workspace
arcpy.env.overwriteOutput = True

# Define input and output parameters
in_raster = "output_USGS30m_NYS_contourExtent_20231126"
observer_points = "Cellular_Towers_NYS_studyArea_clip_20240224"
batch_size = 1
limit_batches = 1

# Calculate the current date in YYYYMMDD format
current_date = datetime.now().strftime("%Y%m%d")

# Ensure the scratch and output workspaces exist or create them
for gdb_path in [scratch_workspace, output_workspace]:
    if not arcpy.Exists(gdb_path):
        arcpy.CreateFileGDB_management(*os.path.split(gdb_path))

# Declare the final output feature classes in the output geodatabase
polygon_fc_name = "Viewshed_Polygons_" + current_date
polygon_fc = os.path.join(output_workspace, polygon_fc_name)
if not arcpy.Exists(polygon_fc):
    arcpy.CreateFeatureclass_management(output_workspace, polygon_fc_name, "POLYGON")

polyline_fc_name = "Viewshed_Polylines_" + current_date
polyline_fc = os.path.join(output_workspace, polyline_fc_name)
if not arcpy.Exists(polyline_fc):
    arcpy.CreateFeatureclass_management(output_workspace, polyline_fc_name, "POLYLINE")

# Function to convert raster to polygon, then to polyline, and append to the common feature class
def raster_to_polyline(out_raster, polyline_fc):
    # Convert raster to polygon (in memory)
    out_polygon = "in_memory/temp_polygon"
    arcpy.RasterDomain_3d(out_raster, out_polygon, "POLYGON")
    
    # Convert polygon to polyline (in memory)
    out_polyline = "in_memory/temp_polyline"
    arcpy.PolygonToLine_management(out_polygon, out_polyline)
    
    # Append to the polyline feature class
    arcpy.Append_management(out_polyline, polyline_fc, "NO_TEST")
    
    # Optionally delete in-memory data to free up memory
    arcpy.Delete_management(out_polygon)
    arcpy.Delete_management(out_polyline)

# Function to process viewshed in batches
def process_batch(batch):
    batch_name = f"batch_{batch}"
    out_raster = os.path.join(scratch_workspace, f"CellTowers_NYS_viewshed_{batch_name}_{current_date}")
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
        outer_radius="30 Miles",
        outer_radius_is_3d="GROUND",
        horizontal_start_angle=0,
        horizontal_end_angle=360,
        vertical_upper_angle=90,
        vertical_lower_angle=-90,
        analysis_method="ALL_SIGHTLINES",
        analysis_target_device="GPU_THEN_CPU"
    )
    # Convert output raster to polyline and append
    raster_to_polyline(out_raster, polyline_fc)  # Pass polyline_fc here

# Determine the total number of batches needed
with arcpy.da.SearchCursor(observer_points, ["OBJECTID"]) as cursor:
    total_points = sum(1 for _ in cursor)
total_batches = math.ceil(total_points / batch_size)
if limit_batches is not None:
    total_batches = min(total_batches, limit_batches)

# Batch processing for specified number of batches
output_rasters = []
for batch in range(total_batches):
    start = batch * batch_size + 1
    end = start + batch_size
    print(f"Processing batch {batch+1} of {total_batches}...")

    # Create a feature layer for the current batch
    batch_query = f"OBJECTID >= {start} AND OBJECTID < {end}"
    arcpy.management.MakeFeatureLayer(observer_points, f"batch_{batch}", batch_query)
    
    # Process the current batch
    process_batch(batch)
    output_rasters.append(os.path.join(scratch_workspace, f"CellTowers_NYS_viewshed_batch_{batch}_{current_date}"))

print("All batches processed. Merging outputs...")

# Merging the Outputs
merged_output = os.path.join(output_workspace, f"Merged_CellTowers_NYS_Viewshed_{current_date}")
arcpy.management.MosaicToNewRaster(
    input_rasters=output_rasters, 
    output_location=output_workspace,
    raster_dataset_name_with_extension=os.path.basename(merged_output),
    pixel_type="32_BIT_FLOAT",  # Choose appropriate pixel type
    number_of_bands=1
)

print("Merging complete.")
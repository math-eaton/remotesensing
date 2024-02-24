import arcpy
import os
from datetime import datetime

# Setting the environment
arcpy.env.parallelProcessingFactor = "100%"
input_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\viewshed_input.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\scratch.gdb"
output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_iii\viewshed_polylines\viewshed_output.gdb"
arcpy.env.workspace = input_workspace
arcpy.env.overwriteOutput = True

# Define input and output parameters
in_raster = "output_USGS30m_NYS_contourExtent_20231126"
observer_points = "Cellular_Towers_NYS_studyArea_clip_20240224"

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
    arcpy.AddField_management(polyline_fc, "observerID", "LONG")

# Function to convert raster to polygon, then to polyline, and append to the common feature class
def raster_to_polyline(out_raster, polyline_fc, observer_id):
    out_polygon = "in_memory/temp_polygon"
    arcpy.RasterDomain_3d(out_raster, out_polygon, "POLYGON")
    
    out_polyline = "in_memory/temp_polyline"
    arcpy.PolygonToLine_management(out_polygon, out_polyline)
    
    # Add observerID to each polyline before appending
    with arcpy.da.InsertCursor(polyline_fc, ['SHAPE@', 'observerID']) as cursor:
        with arcpy.da.SearchCursor(out_polyline, ['SHAPE@']) as scursor:
            for srow in scursor:
                cursor.insertRow([srow[0], observer_id])
    
    arcpy.Delete_management(out_polygon)
    arcpy.Delete_management(out_polyline)

# Function to process individual observer point
def process_observer(observer_id):
    observer_query = f"OBJECTID = {observer_id}"
    arcpy.management.MakeFeatureLayer(observer_points, "observer_lyr", observer_query)
    
    out_raster = os.path.join(scratch_workspace, f"Viewshed_{observer_id}_{current_date}")
    arcpy.ddd.Viewshed2(
        in_raster,
        "observer_lyr",
        out_raster,
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
    raster_to_polyline(out_raster, polyline_fc, observer_id)

# Process a limited number of observer points for testing
limit_iterations = 10  # Set to None or a specific number for testing
counter = 0

with arcpy.da.SearchCursor(observer_points, ["OBJECTID"]) as cursor:
    for row in cursor:
        process_observer(row[0])
        counter += 1
        if limit_iterations is not None and counter >= limit_iterations:
            break

print("Processing complete.")

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
observer_points = "CDMA"

# Calculate the current date in YYYYMMDD format
current_date = datetime.now().strftime("%Y%m%d")

# Get the spatial reference of the input raster
input_crs = arcpy.Describe(in_raster).spatialReference

# Ensure the scratch and output workspaces exist or create them
for gdb_path in [scratch_workspace, output_workspace]:
    if not arcpy.Exists(gdb_path):
        arcpy.CreateFileGDB_management(*os.path.split(gdb_path))

# Declare the final output feature classes in the output geodatabase
polygon_fc_name = "Viewshed_Polygons_" + current_date
polygon_fc = os.path.join(output_workspace, polygon_fc_name)
if not arcpy.Exists(polygon_fc):
    arcpy.CreateFeatureclass_management(output_workspace, polygon_fc_name, "POLYGON", spatial_reference=input_crs)
    arcpy.AddField_management(polygon_fc, "observerID", "LONG")

# polyline_fc_name = "Viewshed_Polylines_" + current_date
# polyline_fc = os.path.join(output_workspace, polyline_fc_name)
# if not arcpy.Exists(polyline_fc):
#     arcpy.CreateFeatureclass_management(output_workspace, polygon_fc_name, "POLYGON", spatial_reference=input_crs)
#     arcpy.AddField_management(polygon_fc, "observerID", "LONG")

# Function to convert raster to polygon, then to polyline, and append to the common feature class
# def raster_to_polyline(out_raster, polygon_fc, polyline_fc, observer_id):


    # Convert raster to polygon
    out_polygon = os.path.join(scratch_workspace, f"Polygon_{observer_id}_{current_date}")
    arcpy.RasterDomain_3d(out_raster, out_polygon, "POLYGON")
    
    # Append polygons to polygon_fc with observerID
    with arcpy.da.InsertCursor(polygon_fc, ['SHAPE@', 'observerID']) as cursor:
        with arcpy.da.SearchCursor(out_polygon, ['SHAPE@']) as scursor:
            for srow in scursor:
                cursor.insertRow([srow[0], observer_id])
    
    # Convert polygon to polyline
    out_polyline = os.path.join(scratch_workspace, f"Polyline_{observer_id}_{current_date}")
    arcpy.PolygonToLine_management(out_polygon, out_polyline)
    
    # Append to the polyline feature class with observerID
    with arcpy.da.InsertCursor(polyline_fc, ['SHAPE@', 'observerID']) as cursor:
        with arcpy.da.SearchCursor(out_polyline, ['SHAPE@']) as scursor:
            for srow in scursor:
                cursor.insertRow([srow[0], observer_id])

    # Optionally, clean up the scratch data
    arcpy.Delete_management(out_polygon)
    arcpy.Delete_management(out_polyline)

def raster_to_polyline(out_raster, polygon_fc, observer_id):

    # Convert raster to polygon
    out_polygon = os.path.join(scratch_workspace, f"Polygon_{observer_id}_{current_date}")
    arcpy.RasterDomain_3d(out_raster, out_polygon, "POLYGON")
    
    # Append polygons to polygon_fc with observerID
    with arcpy.da.InsertCursor(polygon_fc, ['SHAPE@', 'observerID']) as cursor:
        with arcpy.da.SearchCursor(out_polygon, ['SHAPE@']) as scursor:
            for srow in scursor:
                cursor.insertRow([srow[0], observer_id])

    # Clean up the scratch data
    arcpy.Delete_management(out_polygon)


# Function to process individual observer point
def process_observer(observer_id):
    try:
        
        observer_query = f"OBJECTID = {observer_id}"
        observer_id = row[0] 
        arcpy.management.MakeFeatureLayer(observer_points, "observer_lyr", observer_query)

        print(f"processing observer {observer_id}...")
        

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
            # observer_offset="AllStruc",
            observer_offset=None,
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
        raster_to_polyline(out_raster, polygon_fc, observer_id)  # no polyline_fc since skipping
        # raster_to_polyline(out_raster, polygon_fc, polyline_fc, observer_id)
        
    except Exception as e:
        print(f"Failed to process observer ID {observer_id}: {e}")
        # Optionally, log the ID of the failed observer to a file or a list for later review
        with open("failed_observers.txt", "a") as log_file:
            log_file.write(f"{observer_id}\n")
        # Continue to the next observer without stopping the script
        return


def clear_scratch_gdb(scratch_workspace):
    """
    Delete all contents of the scratch geodatabase.
    """
    arcpy.env.workspace = scratch_workspace
    datasets = arcpy.ListDatasets() + arcpy.ListFeatureClasses() + arcpy.ListTables()
    for dataset in datasets:
        try:
            arcpy.Delete_management(dataset)
            print(f"Deleted {dataset} from scratch workspace.")
        except Exception as e:
            print(f"Error deleting {dataset}: {e}")

            
def clear_relationship_tables(workspace, text_pattern):
    """
    Delete tables containing a specific text pattern from the given workspace.
    """
    arcpy.env.workspace = workspace
    tables = arcpy.ListTables()
    for table in tables:
        if text_pattern in table:
            try:
                arcpy.Delete_management(table)
                print(f"Deleted {table} from {workspace}.")
            except Exception as e:
                print(f"Error deleting {table}: {e}")



# Process a limited number of observer points for testing
start_time = datetime.now()
limit_iterations = 3000  # Set to None or a specific number for testing
counter = 0

with arcpy.da.SearchCursor(observer_points, ["OBJECTID"]) as cursor:
    for row in cursor:
        process_observer(row[0])

        # Calculate and print the elapsed time after processing each observer
        elapsed_time = datetime.now() - start_time
        print(f"TIMESTAMP: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}, ELAPSED TIME: {elapsed_time}")


        counter += 1
        if limit_iterations is not None and counter >= limit_iterations:
            break


clear_scratch_gdb(scratch_workspace)
clear_relationship_tables(input_workspace, "observer_lyr_Viewshed")
print("Scratch geodatabase cleared.")

print("Processing complete.")


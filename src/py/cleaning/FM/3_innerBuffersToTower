import arcpy
import math
import os

arcpy.env.parallelProcessingFactor = "100%"
base = r"D:\mheaton\cartography\gsapp\colloquium_processing\contour_gen\analog"

workspace = os.path.join(base, "FM_contours_input.gdb")
if not arcpy.Exists(workspace):
    arcpy.management.CreateFileGDB(base, "FM_contours_input")

scratch_workspace = os.path.join(base, "scratch.gdb")
if not arcpy.Exists(scratch_workspace):
    arcpy.management.CreateFileGDB(base, "scratch")

output_workspace = os.path.join(base, "FM_contours_output.gdb")
if not arcpy.Exists(output_workspace):
    arcpy.management.CreateFileGDB(base, "FM_contours_output")

arcpy.env.workspace = workspace
arcpy.env.scratchWorkspace = scratch_workspace  # Set scratch workspace in the environment
arcpy.env.overwriteOutput = True

# Define the feature classes
FM_contours = "FM_contours"
FM_points = "FM_points"

try:
    # Add the required fields to FM_contours
    arcpy.AddField_management(FM_contours, "furthest_vertex_KM", "DOUBLE")
    arcpy.AddField_management(FM_contours, "buffer_size", "DOUBLE")
    arcpy.AddField_management(FM_contours, "num_buffers", "LONG")
except Exception as e:
    arcpy.AddError(f"Error adding fields: {e}")
    raise

# Calculate num_buffers
num_buffers = 10
scale_factor = 0.9  # Adjust as needed

try:
    # Update cursor for FM_contours to calculate distances and update fields
    with arcpy.da.UpdateCursor(FM_contours, ["SHAPE@", "lms_application_id", "furthest_vertex_KM", "num_buffers"]) as contours_cursor:
        for contour in contours_cursor:
            try:
                contour_shape, lms_application_id, _, _ = contour
                
                # Search cursor to find matching FM_point
                with arcpy.da.SearchCursor(FM_points, ["SHAPE@", "lms_application_id"]) as points_cursor:
                    for point in points_cursor:
                        point_shape, point_lms_application_id = point
                        
                        if point_lms_application_id == lms_application_id:
                            # Calculate the distance to the furthest vertex
                            furthest_distance = max(point_shape.distanceTo(vertex) for vertex in contour_shape.boundary().getPart(0))
                            contour[2] = furthest_distance / 1000  # Convert to KM
                            contour[3] = num_buffers
                            contours_cursor.updateRow(contour)
                            break
            except Exception as e:
                arcpy.AddWarning(f"Skipped feature with lms_application_id {lms_application_id} due to error: {e}")
    
    # Calculate buffer_size
    arcpy.CalculateField_management(FM_contours, "buffer_size", "!furthest_vertex_KM! / !num_buffers!", "PYTHON3")
except Exception as e:
    arcpy.AddError(f"Error during preprocessing: {e}")
    raise

arcpy.AddMessage("preprocess complete ... buffer time ...")

try:
    # Use a search cursor to read the 'furthest_vertex_KM' for each polygon in FM_contours
    with arcpy.da.SearchCursor(FM_contours, ["SHAPE@", "furthest_vertex_KM"]) as cursor:
        for row in cursor:
            try:
                # Calculate buffer distances and create buffers
                max_distance_km = row[1]  # The furthest_vertex_KM field value
                max_distance_m = max_distance_km * 1000  # Convert KM to meters
                
                # Generate buffers in a loop, each smaller than the last
                for i in range(num_buffers):
                    buffer_distance = max_distance_m * (scale_factor ** i)
                    buffer_name = f"buffer_{i+1}_{arcpy.Describe(FM_contours).name}"
                    buffer_output_path = os.path.join(output_workspace, buffer_name)
                    
                    arcpy.Buffer_analysis(row[0], buffer_output_path, buffer_distance, "FULL", "ROUND", "NONE")
                    arcpy.AddMessage(f"Created buffer: {buffer_output_path} with distance: {buffer_distance}m")
            except Exception as e:
                arcpy.AddWarning(f"Failed to create buffers for feature due to error: {e}")
except Exception as e:
    arcpy.AddError(f"Error during buffer creation: {e}")
    raise

arcpy.AddMessage("done.")
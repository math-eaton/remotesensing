import arcpy
import os

# Define the workspace environment
target_workspace = r"D:\mheaton\cartography\gsapp\colloquium_i\colloquium_i.gdb"
scratch_workspace = arcpy.env.scratchGDB  # Default scratch workspace

# Set the workspace environment to avoid defining full path names
arcpy.env.workspace = target_workspace

# Input feature class
input_fc = "FM_contours_NY_JSONToFeature"

# Output feature class
output_fc_prefix = "FM_contours_NY_JSONToFeature_MultipleRingBuffer"

# Buffer unit
buffer_unit = "Kilometers"

# Buffer interval
buffer_interval = 10

# List to store paths to all the individual buffer feature classes
buffer_feature_classes = []

# Iterate through each feature in the feature class
with arcpy.da.SearchCursor(input_fc, ["SHAPE@", "OID@"]) as cursor:
    for i, row in enumerate(cursor):
        feature = row[0]
        oid = row[1]
        
        # Calculate max buffer distance as distance from the furthest vertex to the centroid
        # Corrected to directly use feature.centroid without unpacking
        max_distance = max([feature.distanceTo(arcpy.Point(feature.centroid.X, feature.centroid.Y)) for part in feature for pnt in part])
        
        # Create a list of buffer distances at defined intervals until the max distance
        buffer_distances = list(range(buffer_interval, int(max_distance) + buffer_interval, buffer_interval))
        
        # Define the output feature class for each polygon (stored in the scratch workspace)
        output_fc = "{}_{}".format(output_fc_prefix, oid)
        output_fc_path = os.path.join(scratch_workspace, output_fc)
        buffer_feature_classes.append(output_fc_path)
        
        # Perform the multiple ring buffer analysis
        arcpy.analysis.MultipleRingBuffer(
            Input_Features=feature,
            Output_Feature_class=output_fc_path,
            Distances=buffer_distances,
            Buffer_Unit=buffer_unit,
            Field_Name="distance",
            Dissolve_Option="ALL",
            Outside_Polygons_Only="FULL",
            Method="GEODESIC"
        )

# Merge all individual buffer feature classes into a single feature class in the target workspace
merged_output_fc = os.path.join(target_workspace, "{}_Merged".format(output_fc_prefix))
arcpy.management.Merge(buffer_feature_classes, merged_output_fc)

# Transfer attributes from the input feature class to the merged buffers
arcpy.analysis.SpatialJoin(
    target_features=merged_output_fc,
    join_features=input_fc,
    out_feature_class="{}_attributes".format(merged_output_fc),
    join_type="KEEP_COMMON",
    match_option="WITHIN"
)

# Optionally, clean up the scratch workspace by deleting the individual buffer feature classes
for fc in buffer_feature_classes:
    arcpy.management.Delete(fc)

print("Buffer creation and merging complete.")

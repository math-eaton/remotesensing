import arcpy
import random
import os

# Set the workspace and overwrite output
arcpy.env.workspace = r"D:\mheaton\cartography\gsapp\colloquium_i\nys_grid_subsetting\input_raw.gdb"
arcpy.env.overwriteOutput = True

# Inputs
input_polygon = "study_area_true_usaClip"
output_grid = "sample_cells"
output_gdb = r"D:\mheaton\cartography\gsapp\colloquium_i\nys_grid_subsetting\output_clipped.gdb"
polygonWidth = "50 kilometers"
polygonHeight = "50 kilometers"
samplePercentage = 10

# Create Grid Index Features
arcpy.cartography.GridIndexFeatures(out_feature_class=output_grid, 
                                    in_features=input_polygon, 
                                    polygon_width=polygonWidth, 
                                    polygon_height=polygonHeight)

# Extract a random sample of the grid cells
grid_cells = [row[0] for row in arcpy.da.SearchCursor(output_grid, "OID@")]
sample_size = int(len(grid_cells) * (samplePercentage / 100.0))
sampled_cells = random.sample(grid_cells, sample_size)

# Clip and export features for each sampled grid cell, preserving input layer attributes
feature_classes = arcpy.ListFeatureClasses()

for fc in feature_classes:
    desc = arcpy.Describe(fc)
    input_geometry_type = desc.shapeType
    field_infos = arcpy.ListFields(fc)
    
    # Prepare field list for new feature class excluding OID field
    field_names = [field.name for field in field_infos if field.type != 'OID' and field.name not in ['Shape', 'SHAPE']]
    field_defs = [field for field in field_infos if field.type != 'OID' and field.name not in ['Shape', 'SHAPE']]
    
    output_fc_name = f"{fc}_clip"
    output_fc_path = os.path.join(output_gdb, output_fc_name)
    
    # Create the output feature class with input fields + index_grid
    arcpy.CreateFeatureclass_management(output_gdb, output_fc_name, input_geometry_type, fc, spatial_reference=desc.spatialReference)
    arcpy.AddField_management(output_fc_path, "index_grid", "LONG")
    
    # Update insert cursor fields to include original fields + index_grid
    insert_cursor_fields = field_names + ["index_grid"]
    insert_cursor = arcpy.da.InsertCursor(output_fc_path, ["SHAPE@"] + insert_cursor_fields)
    
    for cell_id in sampled_cells:
        where_clause = f"OID = {cell_id}"
        with arcpy.da.SearchCursor(output_grid, ["SHAPE@"], where_clause=where_clause) as cursor:
            for row in cursor:
                cell_shape = row[0]
                in_memory_fc = "in_memory/clipped"
                arcpy.analysis.Clip(fc, cell_shape, in_memory_fc)
                
                # Explode multipart features to singlepart and preserve attributes
                singlepart_fc = "in_memory/singlepart"
                arcpy.MultipartToSinglepart_management(in_memory_fc, singlepart_fc)
                
                # Insert exploded features with original attributes + index_grid
                with arcpy.da.SearchCursor(singlepart_fc, ["SHAPE@"] + field_names) as singlepart_features:
                    for feature in singlepart_features:
                        feature_attributes = list(feature[1:]) + [cell_id]  # Exclude SHAPE@ from feature attributes
                        insert_cursor.insertRow([feature[0]] + feature_attributes)
    
    del insert_cursor  # Ensure the cursor is closed

print("done.")

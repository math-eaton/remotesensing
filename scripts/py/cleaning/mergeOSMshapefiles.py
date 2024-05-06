import arcpy
import os

# Input directory where the shapefiles are stored
input_directory = r"D:\mheaton\cartography\gsapp\colloquium_iii\data\osm\states"

# Output geodatabase where the merged feature classes will be stored
output_gdb = r"D:\mheaton\cartography\gsapp\colloquium_iii\data\osm\osm_merged.gdb"

arcpy.env.workspace = input_directory

# List all shapefiles in the input directory
shapefiles = arcpy.ListFiles("*.shp")

# Dictionary to group shapefiles by base name
shapefile_groups = {}

# Group shapefiles by base name (excluding the last three characters or unique identifier)
for shp in shapefiles:
    base_name = os.path.splitext(shp)[0][:-3]  # Remove last three characters from the filename
    if base_name not in shapefile_groups:
        shapefile_groups[base_name] = [shp]
    else:
        shapefile_groups[base_name].append(shp)

# Iterate over each group and merge shapefiles
for group, shps in shapefile_groups.items():
    if len(shps) > 1:  # Proceed if there are two or more shapefiles in the group

        print(f"processing {group}...")

        # Create a list of full paths for the shapefiles
        shp_paths = [os.path.join(input_directory, shp) for shp in shps]
        
        # Define the output feature class path
        output_fc = os.path.join(output_gdb, group)
        
        # Check if shapefiles in the group have the same geometry type before merging
        geom_types = set(arcpy.Describe(shp).shapeType for shp in shp_paths)
        if len(geom_types) == 1:
            # Merge shapefiles into a single feature class
            arcpy.Merge_management(inputs=shp_paths, output=output_fc)
            print(f"Merged {len(shp_paths)} shapefiles into {output_fc}")
        else:
            print(f"Skipping merge for {group}: Shapefiles have different geometry types.")

print("Processing complete.")

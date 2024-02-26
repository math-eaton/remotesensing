import arcpy
import os

# Define the folder containing JSON files
json_folder_path = r"D:\mheaton\cartography\gsapp\colloquium_iii\data\buildingFootprints_bing"
# Define the path to the geodatabase where feature classes will be saved
output_gdb_path = r"D:\mheaton\cartography\gsapp\colloquium_iii\data\buildingFootprints_bing\aoi_buildingFootprints.gdb"

# Set the workspace to the JSON folder path
arcpy.env.workspace = json_folder_path

# List all JSON files in the folder
json_files = [f for f in os.listdir(json_folder_path) if f.endswith('.json') or f.endswith('.geojson')]

# Iterate through each JSON file
for json_file in json_files:
    # Construct the input JSON file path
    in_json_file = os.path.join(json_folder_path, json_file)
    
    # Construct the output feature class name and path
    # Remove file extension and add suffix "_buildingFootprints"
    output_feature_class_name = os.path.splitext(json_file)[0] + "_buildingFootprints"
    out_features_path = os.path.join(output_gdb_path, output_feature_class_name)
    
    # Convert JSON to feature class
    arcpy.conversion.JSONToFeatures(
        in_json_file=in_json_file,
        out_features=out_features_path,
        geometry_type="POLYGON"
    )
    
    print(f"Converted {json_file} to feature class: {output_feature_class_name}")

print("All JSON files have been converted to feature classes.")

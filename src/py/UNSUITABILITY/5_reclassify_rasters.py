import arcpy
import csv
import os

# Define the input and output paths
input_geodatabase = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\aligned_rasters.gdb"
scratch_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\reclassified_rasters\scratch.gdb"
output_geodatabase = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\reclassified_rasters\reclassified_rasters.gdb"
csv_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\reclassified_rasters\reclassification_dictionary.csv"

arcpy.env.overwriteOutput = True

# Check and create the geodatabases if they don't exist
for gdb_path in [scratch_workspace, output_geodatabase]:
    if not arcpy.Exists(gdb_path):
        arcpy.CreateFileGDB_management(os.path.dirname(gdb_path), os.path.basename(gdb_path))

# Function to read CSV and create a dictionary
def read_csv_to_dict(csv_path):
    with open(csv_path, mode='r') as infile:
        reader = csv.DictReader(infile)
        return {row["key"]: int(row["value"]) for row in reader}

# Load the search terms and values from CSV
search_dict = read_csv_to_dict(csv_path)

# Set the workspace to the input geodatabase
arcpy.env.workspace = input_geodatabase

# Ensure the Spatial Analyst extension is available
arcpy.CheckOutExtension("Spatial")

reclassified_rasters = []  # List to store paths of reclassified rasters

# Loop through each raster in the geodatabase
for raster in arcpy.ListRasters():
    match_found = False  # Flag to track if a match is found
    default_value = 1

    for search_term, value in search_dict.items():
        if search_term in raster:
            match_found = True
            print(f"match found for {raster} ... reclass to value: {value}")
            outCon = arcpy.sa.Con(arcpy.sa.IsNull(raster), 0, value)
            reclassified_path = os.path.join(scratch_workspace, raster)
            outCon.save(reclassified_path)
            reclassified_rasters.append(reclassified_path)
            print(f"Reclassified {raster} based on match and saved to {scratch_workspace}")
            break

    if not match_found:
        outConFallback = arcpy.sa.Con(arcpy.sa.IsNull(raster), 0, default_value)
        print(f"no match found for {raster} ... reclass to default value: {default_value}")
        reclassified_path_fallback = os.path.join(scratch_workspace, "fallback_" + raster)
        outConFallback.save(reclassified_path_fallback)
        reclassified_rasters.append(reclassified_path_fallback)
        print(f"Reclassified {raster} with fallback values and saved to {scratch_workspace}")

# Sum the values of overlapping cells from all reclassified rasters
if reclassified_rasters:
    sum_output = arcpy.sa.CellStatistics(reclassified_rasters, "SUM", "NODATA")
    sum_output_path = os.path.join(output_geodatabase, "SUMMED_FABRIC")
    sum_output.save(sum_output_path)
    print(f"Summed raster saved to {sum_output_path}")
else:
    print("No reclassified rasters to sum.")

print("Processing complete.")

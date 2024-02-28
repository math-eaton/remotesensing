import arcpy
import csv
import os

# Define the input and output paths
input_geodatabase = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\aligned_rasters.gdb"
output_geodatabase = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\reclassified_rasters\reclassified_rasters.gdb"
csv_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\reclassified_rasters\reclassification_dictionary.csv"

arcpy.env.overwriteOutput = True

# Check if the output geodatabase exists, if not, create it
if not arcpy.Exists(output_geodatabase):
    arcpy.CreateFileGDB_management(os.path.dirname(output_geodatabase), os.path.basename(output_geodatabase))

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

# Loop through each raster in the geodatabase
for raster in arcpy.ListRasters():
    match_found = False  # Flag to track if a match is found

    for search_term, value in search_dict.items():
        if search_term in raster:
            match_found = True  # A match is found
            print(f"match found for {raster} ... reclass to value: {value}")
            # Process for matching rasters: Reclassify all data cells to the value and NODATA to 0
            outCon = arcpy.sa.Con(arcpy.sa.IsNull(raster), 0, value)
            outCon.save(os.path.join(output_geodatabase, raster))
            print(f"Reclassified {raster} based on match and saved to {output_geodatabase}")
            break

    # Fallback process for non-matching rasters: Reclassify all data cells to 1 and NODATA to 0
    if not match_found:
        outConFallback = arcpy.sa.Con(arcpy.sa.IsNull(raster), 0, 1)
        outConFallback.save(os.path.join(output_geodatabase, "fallback_" + raster))
        print(f"Reclassified {raster} with fallback values and saved to {output_geodatabase}")

print("Processing complete.")

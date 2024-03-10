import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from tqdm import tqdm
import json

# Load AOI boundary from the GeoJSON file
aoi_boundary_gdf = gpd.read_file('./data/aoi_northeast_geojson_20240310.geojson')
# Combine all the polygons in MultiPolygon to one Polygon (if there are multiple polygons)
aoi_boundary = aoi_boundary_gdf.unary_union

# Function to check if a point is in AOI
def is_in_aoi(coords):
    try:
        # Ensure coords is a string and not NaN or float
        if isinstance(coords, str):
            lat, lon = map(float, coords.strip('"').split(','))
            point = Point(lon, lat)
            return aoi_boundary.contains(point)
    except (ValueError, AttributeError) as e:
        # If there's an error in conversion, it's not a valid coordinate
        return False
    return False


# Define the input TXT file name and output JSON file name
input_txt = './data/raw/old/FM_service_contour_current.txt'
output_json = './data/raw/aoi_fm_test.json'

# Get the total number of rows for the progress bar
total_rows = sum(1 for row in open(input_txt, 'r'))

# Define the chunk size
chunk_size = 10000  # Adjust based on your system's memory

# Initialize the progress bar
pbar = tqdm(total=total_rows, desc='Processing ', unit='rows', ascii=True)

# Initialize an empty list to store filtered rows
aoi_data = []

# Process the input TXT in chunks
for chunk in pd.read_csv(input_txt, chunksize=chunk_size, dtype=str, iterator=True, delimiter='|'):
    # Filter rows where the coordinates are within AOI
    aoi_rows = chunk[chunk['transmitter_site'].apply(is_in_aoi)]
    
    # Remove the last '^' character from each row if it exists
    aoi_rows = chunk[chunk['transmitter_site'].apply(is_in_aoi)].copy()
    aoi_rows.replace({'\^': ''}, regex=True, inplace=True)
    
    # Convert the filtered DataFrame to a dictionary and append to aoi_data list
    aoi_data.extend(aoi_rows.to_dict('records'))
    
    # Update the progress bar
    pbar.update(chunk_size)

pbar.close()

# Save the filtered data to a JSON file
with open(output_json, 'w') as outfile:
    json.dump(aoi_data, outfile, indent=4)

print("Processing complete. AOI data saved to", output_json)

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from tqdm import tqdm
import json

def clean_text(input_text):
    """
    Removes extra whitespace from the input text, except for the delimiter in coordinate pairs.
    
    Parameters:
    - input_text: The text to be cleaned.
    
    Returns:
    - A string with unnecessary whitespace removed.
    """
    if ',' in input_text:  # Check if the text is a coordinate pair
        # Split the coordinate pair, strip spaces, and rejoin
        return ', '.join([x.strip() for x in input_text.split(',')])
    else:
        return input_text.strip()

def reverse_coordinates(coordinate_string):
    try:
        lat, lon = coordinate_string.split(',')
        return f"{lon.strip()}, {lat.strip()}"
    except AttributeError:
        # Handle cases where coordinate_string is not a string (e.g., NaN, float)
        return None  # or some default value, or even raise a more informative error

def is_in_aoi(coords, aoi_boundary):
    if isinstance(coords, str):
        lat, lon = map(float, coords.split(','))
        point = Point(lat, lon)
        return aoi_boundary.contains(point)
    return False

# process intput rows with optional downsample factor ie remove every N coordinates from the output
def process_data(input_filename, output_filename, aoi_geojson, limit=None, downsample_factor=3, downsample_limit=120):
    # Load AOI boundary from the GeoJSON file
    aoi_boundary_gdf = gpd.read_file(aoi_geojson)
    aoi_boundary = aoi_boundary_gdf.unary_union

    records = []

    # Initialize progress bar
    total_rows = sum(1 for _ in open(input_filename, 'r'))
    pbar = tqdm(total=min(total_rows, limit) if limit else total_rows, desc='Processing', unit='rows')

    # Setting dtype=str to treat all columns as strings
    with pd.read_csv(input_filename, chunksize=1000, sep='|', dtype=str, iterator=True) as reader:
        for chunk in reader:
            chunk['transmitter_site'] = chunk['transmitter_site'].apply(reverse_coordinates)
            chunk = chunk[chunk['transmitter_site'].apply(lambda x: is_in_aoi(x, aoi_boundary))]

            for _, row in chunk.iterrows():
                if limit and len(records) >= limit:
                    break

                # Clean non-coordinate columns
                application_id = clean_text(row['application_id'])
                service = clean_text(row['service'])
                lms_application_id = clean_text(row['lms_application_id'])
                dts_site_number = clean_text(row['dts_site_number'])
                transmitter_site = clean_text(row['transmitter_site'])

                headers = row.index.tolist()
                transmitter_site_index = headers.index('transmitter_site')
                end_index = headers.index('^')
                
                # Calculate indices for downsampled coordinates
                downsampled_indices = list(range(transmitter_site_index + 1, end_index, downsample_factor))[:downsample_limit]
                downsampled_headers = [headers[i] for i in downsampled_indices]
                polar_coordinates = [row[i] for i in range(transmitter_site_index + 1, end_index)]
                downsampled_coordinates = [reverse_coordinates(polar_coordinates[i]) for i in range(0, len(polar_coordinates), downsample_factor)][:downsample_limit]

                record_dict = {
                    'application_id': application_id,
                    'service': service,
                    'lms_application_id': lms_application_id,
                    'dts_site_number': dts_site_number,
                    'transmitter_site': transmitter_site,
                    'coordinates': dict(zip(downsampled_headers, downsampled_coordinates)),
                    'end': '^'
                }
                records.append(record_dict)
                
            pbar.update(len(chunk))
            if limit and len(records) >= limit:
                break

    pbar.close()

    # Write the processed records to the output JSON file
    with open(output_filename, 'w') as outfile:
        json.dump(records, outfile, indent=4)


# Example usage
input_filename = '/Users/matthewheaton/Documents/GitHub/remotesensing/src/assets/data/fcc/fm/raw/FM_service_contour_current.txt'
output_filename = '/Users/matthewheaton/Documents/GitHub/remotesensing/src/assets/data/fcc/fm/processed/FM_service_contour_testClean.txt'
aoi_geojson = '/Users/matthewheaton/Documents/GitHub/remotesensing/src/assets/data/fcc/fm/aoi_northeast_geojson_20240310.geojson'
process_data(input_filename, output_filename, aoi_geojson, limit=20)
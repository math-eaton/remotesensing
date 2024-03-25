import os
import geopandas as gpd
from tqdm import tqdm

def simplify_geojson(input_dir, tolerance=0.0006):
    """
    Simplify the geometry of GeoJSON files from a directory using the Douglas-Peucker algorithm.
    Outputs simplified GeoJSON files to a subdirectory called 'simplified' within the input directory.
    Each output file is named after the original with "_simplified" appended.

    :param input_dir: Directory containing the GeoJSON files.
    :param tolerance: Tolerance parameter for the simplification. Higher values mean more simplification.
    """

    # Create the 'simplified' subdirectory if it doesn't exist
    simplified_dir = os.path.join(input_dir, 'simplified')
    os.makedirs(simplified_dir, exist_ok=True)

    # List all the GeoJSON files in the input directory
    geojson_files = [f for f in os.listdir(input_dir) if f.endswith('.geojson')]

    # Process each GeoJSON file
    for file in tqdm(geojson_files, desc="Processing GeoJSON files"):
        print(f"Processing: {file}")
        # Read the GeoJSON file
        gdf = gpd.read_file(os.path.join(input_dir, file))
        
        # Simplify the geometry of each feature
        gdf['geometry'] = gdf['geometry'].simplify(tolerance, preserve_topology=True)
        
        # Construct the output filename and path
        output_filename = f"{os.path.splitext(file)[0]}_simplified.geojson"
        output_path = os.path.join(simplified_dir, output_filename)

        # Save the simplified GeoDataFrame to the output file
        gdf.to_file(output_path, driver='GeoJSON')
        print(f"Simplified GeoJSON saved to: {output_path}")

if __name__ == "__main__":
    input_directory = "src/assets/data/internal/temp"
    simplify_geojson(input_directory)
    print('All GeoJSON files have been simplified.')

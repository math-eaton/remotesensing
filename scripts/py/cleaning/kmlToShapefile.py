import os
import geopandas as gpd
from osgeo import ogr

def convert_kml_to_shp(kml_path, shp_path):
    """
    Convert a KML file to a Shapefile.

    Parameters:
    - kml_path: Path to the KML file.
    - shp_path: Path where the Shapefile will be saved.
    """
    driver = ogr.GetDriverByName('ESRI Shapefile')
    dataSource = driver.Open(kml_path, 0)  # 0 means read-only. 1 means writeable.
    layer = dataSource.GetLayer()
    outDataSource = driver.CreateDataSource(shp_path)
    outLayer = outDataSource.CopyLayer(layer, os.path.splitext(os.path.basename(shp_path))[0])
    
    # Cleanup
    del outLayer, outDataSource

def merge_shapefiles(shp_dir, output_path):
    """
    Merge all shapefiles in a directory into a single shapefile.

    Parameters:
    - shp_dir: Directory containing the shapefiles to be merged.
    - output_path: Path where the merged shapefile will be saved.
    """
    shp_files = [os.path.join(shp_dir, f) for f in os.listdir(shp_dir) if f.endswith('.shp')]
    gdfs = [gpd.read_file(shp) for shp in shp_files]
    merged_gdf = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
    merged_gdf.to_file(output_path)

def main(kml_directory, output_directory):
    """
    Convert KML files in a directory to Shapefiles and merge them.

    Parameters:
    - kml_directory: Directory containing KML files.
    - output_directory: Directory where the Shapefiles and the merged Shapefile will be saved.
    """
    # Step 1: Convert all KML files to Shapefiles
    for kml_file in os.listdir(kml_directory):
        if kml_file.endswith('.kml'):
            kml_path = os.path.join(kml_directory, kml_file)
            shp_path = os.path.join(output_directory, os.path.splitext(kml_file)[0] + '.shp')
            convert_kml_to_shp(kml_path, shp_path)
    
    # Step 2: Merge all Shapefiles into a single Shapefile
    merge_shapefiles(output_directory, os.path.join(output_directory, 'merged_shapefile.shp'))

if __name__ == "__main__":
    kml_directory = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\fcc\kml'  # Update this path
    output_directory = r'D:\mheaton\cartography\gsapp\colloquium_iii\data\fcc\kml\shapefile'  # Update this path
    main(kml_directory, output_directory)

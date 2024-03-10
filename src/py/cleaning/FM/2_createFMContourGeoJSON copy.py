import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon

# Load the data from the CSV file
csv_file = 'data/processed/FM_contours_NYS.geojson'  
data = pd.read_csv(csv_file, dtype=str)

# Functions to create geometries
def create_point(row, i):
    try:
        coords = row[str(i)].split(',')
        if len(coords) != 2:  # If the coordinates are not in pairs, skip
            return None
        lon, lat = map(float, coords)
        return Point(lon, lat)
    except (ValueError, TypeError):
        return None

def create_linestring(row):
    try:
        coordinates = [tuple(map(float, row[str(i)].split(','))) for i in range(360)]
        # Ensure the LineString is closed by adding the first point at the end
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])
        return LineString(coordinates)
    except (ValueError, TypeError):
        return None

def create_polygon(row):
    try:
        coordinates = [tuple(map(float, row[str(i)].split(','))) for i in range(360)]
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])
        return Polygon(coordinates)
    except (ValueError, TypeError):
        return None

# Initialize dictionaries to hold geometry data
point_dict = {'geometry': [], 'properties': []}
line_dict = {'geometry': [], 'properties': []}
polygon_dict = {'geometry': [], 'properties': []}

# Iterate over each row and create geometries
for index, row in data.iterrows():
    props = row.drop([str(i) for i in range(360)]).to_dict()
    line_points = []
    for i in range(360):
        point = create_point(row, i)
        if point:
            point_dict['geometry'].append(point)
            point_dict['properties'].append(props)
            line_points.append(point)
    line = create_linestring(row)
    if line:
        line_dict['geometry'].append(line)
        line_dict['properties'].append(props)
    polygon = create_polygon(row)
    if polygon:
        polygon_dict['geometry'].append(polygon)
        polygon_dict['properties'].append(props)

# Convert dictionaries to GeoDataFrames
gdf_points = gpd.GeoDataFrame(point_dict['properties'], geometry=point_dict['geometry'])
gdf_lines = gpd.GeoDataFrame(line_dict['properties'], geometry=line_dict['geometry'])
gdf_polygons = gpd.GeoDataFrame(polygon_dict['properties'], geometry=polygon_dict['geometry'])

# Set the CRS for each GeoDataFrame
for gdf in [gdf_points, gdf_lines, gdf_polygons]:
    gdf.set_crs(epsg=4326, inplace=True)

# Save the GeoDataFrames as GeoJSON files
gdf_points.to_file('data/processed/FM_contours_NYS_Lines.geojson', driver='GeoJSON')
gdf_lines.to_file('data/processed/FM_contours_NYS_Polygons.geojson', driver='GeoJSON')
gdf_polygons.to_file('data/processed/FM_contours_NYS_Points.geojson', driver='GeoJSON')

print("GeoJSON files have been created.")
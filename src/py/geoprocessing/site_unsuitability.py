import arcpy

# Set the workspace environment to your input GDB
arcpy.env.workspace = "path/to/suitability_inputs.gdb"

# Define the path to your output and scratch GDBs
output_gdb = "path/to/suitability_outputs.gdb"
scratch_gdb = "path/to/scratch.gdb"

# Path to your DEM raster
dem_path = "path/to/DEM"

# Ask user if they want to resample the DEM
resample_dem = input("Do you want to resample the DEM? (yes/no): ").lower()
if resample_dem == "yes":
    new_cell_size = float(input("Enter the new cell size for the DEM: "))
    # Resample DEM
    resampled_dem_path = f"{scratch_gdb}/resampled_DEM"
    arcpy.management.Resample(in_raster=dem_path, 
                              out_raster=resampled_dem_path, 
                              cell_size=new_cell_size, 
                              resampling_type="BILINEAR")
    dem_path = resampled_dem_path  # Update dem_path to use the resampled DEM

# Set environment settings from the (possibly resampled) DEM
arcpy.env.extent = arcpy.Describe(dem_path).extent
arcpy.env.cellSize = arcpy.Describe(dem_path).meanCellWidth
arcpy.env.snapRaster = dem_path
arcpy.env.outputCoordinateSystem = arcpy.Describe(dem_path).spatialReference

# Define the clipping extent
aoi_path = "output_USGS30m_rasterAOI"

# Function to clip and rasterize vector data
def clip_and_rasterize(input_feature, value, output_raster):
    # Clip the feature to the AOI
    clipped_feature = arcpy.analysis.Clip(input_feature, aoi_path, f"{scratch_gdb}/clipped_{input_feature}")
    
    # Rasterize the clipped feature
    arcpy.conversion.PolygonToRaster(clipped_feature, value_field="FID", 
                                      out_rasterdataset=f"{scratch_gdb}/{output_raster}",
                                      cell_assignment="MAXIMUM_AREA", 
                                      priority_field="NONE", 
                                      cellsize=arcpy.env.cellSize)

# Clip and rasterize each feature type
clip_and_rasterize("buildings", 1, "buildings_raster")
clip_and_rasterize("roads", 2, "roads_raster")
clip_and_rasterize("cell_towers", 3, "cell_towers_raster")

# Sum the raster values to create the suitability raster
arcpy.ia.CellStatistics([f"{scratch_gdb}/buildings_raster", f"{scratch_gdb}/roads_raster", f"{scratch_gdb}/cell_towers_raster"], 
                        statistic_type="SUM", 
                        ignore_nodata="DATA").save(f"{output_gdb}/suitability_raster")

print("Process completed. Check the output GDB for the suitability raster.")

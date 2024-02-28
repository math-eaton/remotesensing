import arcpy
import os

def set_environment_settings(raster_path):
    """Set arcpy environment settings based on a reference raster."""
    raster_desc = arcpy.Describe(raster_path)
    arcpy.env.outputCoordinateSystem = raster_desc.spatialReference
    arcpy.env.extent = raster_desc.extent
    arcpy.env.cellSize = raster_desc.meanCellWidth  # Assuming square cells
    arcpy.env.snapRaster = raster_path


def process_rasters(workspace, base_raster_path, output_workspace):
    """
    Loop through all rasters in the specified geodatabase, reprojecting them only if
    their CRS does not match the base raster's CRS. Clipping is disabled in this version.
    """
    arcpy.env.workspace = workspace

    # Set the environment settings based on the base raster
    set_environment_settings(base_raster_path)
    base_raster_crs = arcpy.Describe(base_raster_path).spatialReference

    # List all raster datasets in the geodatabase
    raster_list = arcpy.ListRasters()

    for raster in raster_list:
        raster_path = os.path.join(workspace, raster)
        raster_crs = arcpy.Describe(raster_path).spatialReference

        # Check if the CRS matches the base raster's CRS
        if raster_crs.name != base_raster_crs.name:
            # CRS does not match, reproject raster
            raster_name = os.path.splitext(raster)[0] + "_reprojected"
            output_raster_path = os.path.join(output_workspace, raster_name)
            
            arcpy.management.ProjectRaster(in_raster=raster_path,
                                           out_raster=output_raster_path,
                                           out_coor_system=base_raster_crs,
                                           resampling_type="BILINEAR",
                                           cell_size=arcpy.env.cellSize)
            print(f"Reprojected raster: {raster} to match the base raster CRS.")
        else:
            # CRS matches, no need to reproject, just copy to the output workspace
            output_raster_path = os.path.join(output_workspace, os.path.splitext(raster)[0])
            arcpy.management.CopyRaster(in_raster=raster_path, out_rasterdataset=output_raster_path)
            print(f"Copied raster without reprojection: {raster}")


def main():
    arcpy.CheckOutExtension("Spatial")

    arcpy.env.overwriteOutput = True
    
    base_raster_path = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\input.gdb\output_USGS_750m_NYS_contourExtent_NAD83_20231126"
    workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\rasters.gdb"
    output_workspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\aligned_rasters.gdb"
    arcpy.env.scratchWorkspace = r"D:\mheaton\cartography\gsapp\colloquium_processing\downsampled_features\aligned_rasters\scratch.gdb"
    
    process_rasters(workspace, base_raster_path, output_workspace)
    
    arcpy.CheckInExtension("Spatial")

if __name__ == "__main__":
    main()
